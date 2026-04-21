"use strict";

/**
 * Billing Routes
 *
 * - POST /checkout-session: Create Stripe Checkout URL for subscription
 * - POST /portal-session: Create Stripe Customer Portal URL
 * - GET /status: Current user/account billing status
 * - POST /webhooks/stripe: Stripe webhook (raw body, no JSON middleware)
 */

const express = require("express");
const { ensureLoggedIn, ensureSuperAdmin } = require("../middleware/auth");
const { BadRequestError, ForbiddenError } = require("../expressError");
const db = require("../db");
const stripeService = require("../services/stripeService");
const planModel = require("../models/plan");
const Coupon = require("../models/coupon");
const { BILLING_MOCK_MODE } = require("../config");
const { wrapStripeErrors } = require("../utils/stripeErrors");

const router = express.Router();

/** POST /billing/checkout-session
 *  Body: { planCode, billingInterval?, accountId?, successUrl?, cancelUrl? }
 *  Returns: { url }
 */
router.post("/checkout-session", ensureLoggedIn, wrapStripeErrors(async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new ForbiddenError("Authentication required");

    const { planCode, billingInterval = "month", accountId, successUrl, cancelUrl, couponCode } = req.body || {};
    if (!planCode) throw new BadRequestError("planCode is required");

    let accountIdToUse = accountId;
    if (!accountIdToUse) {
      const acc = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY (account_id IN (SELECT id FROM accounts WHERE owner_user_id = $1)) DESC LIMIT 1`,
        [userId]
      );
      if (!acc.rows[0]) throw new BadRequestError("No account found. Complete signup first.");
      accountIdToUse = acc.rows[0].account_id;
    }

    const hasAccess = await db.query(
      `SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2`,
      [accountIdToUse, userId]
    );
    if (!hasAccess.rows[0]) throw new ForbiddenError("Access denied to this account");

    const userRoleCheckout = (res.locals.user?.role || "").toLowerCase();
    if (userRoleCheckout === "super_admin") {
      const interval =
        billingInterval === "annual" ? "year" : billingInterval;
      const paidCheck = await db.query(
        `SELECT pp.unit_amount, sp.price AS legacy_price
         FROM subscription_products sp
         LEFT JOIN plan_prices pp ON pp.subscription_product_id = sp.id
           AND pp.billing_interval = $2 AND COALESCE(pp.is_active, true) = true
         WHERE sp.code = $1`,
        [planCode, interval]
      );
      const row = paidCheck.rows[0];
      const ua = row?.unit_amount;
      if (ua != null && ua > 0) {
        throw new ForbiddenError("Super admin accounts do not use paid subscriptions.");
      }
      const lp = row?.legacy_price;
      const legacyNum = lp != null && lp !== "" ? Number(lp) : NaN;
      if ((ua == null || ua === 0) && Number.isFinite(legacyNum) && legacyNum > 0) {
        throw new ForbiddenError("Super admin accounts do not use paid subscriptions.");
      }
    }

    const userRes = await db.query(
      `SELECT email, name, role, COALESCE(role_locked, false) AS role_locked
       FROM users WHERE id = $1`,
      [userId]
    );
    const user = userRes.rows[0];

    /* Reject checkout for plans that don't match the user's locked role.
       This is the server-side counterpart to the wizard hiding the wrong
       set of plans for admin-created users — protects against a tampered
       client posting an `agent_*` planCode for a locked homeowner, etc. */
    if (
      user?.role_locked === true &&
      (user?.role === "homeowner" || user?.role === "agent")
    ) {
      const planTargetRole = await db.query(
        `SELECT target_role FROM subscription_products WHERE code = $1 LIMIT 1`,
        [planCode]
      );
      const targetRole = planTargetRole.rows[0]?.target_role || null;
      if (targetRole && targetRole !== user.role && (targetRole === "homeowner" || targetRole === "agent")) {
        throw new ForbiddenError(
          `Plan "${planCode}" is for ${targetRole}s. Your account is registered as ${user.role}.`
        );
      }
    }

    let resolvedPromoCodeId;
    if (couponCode) {
      const validation = await Coupon.validate(couponCode, accountIdToUse, planCode);
      if (!validation.valid) throw new BadRequestError(validation.reason);
      resolvedPromoCodeId = validation.coupon?.stripePromoCodeId || undefined;
    }

    const { url } = await stripeService.createCheckoutSession({
      accountId: accountIdToUse,
      userId,
      planCode,
      billingInterval,
      successUrl,
      cancelUrl,
      customerEmail: user?.email,
      customerName: user?.name,
      couponCode: resolvedPromoCodeId,
    });

    return res.json({ url });
  } catch (err) {
    return next(err);
  }
}));

/** POST /billing/downgrade-to-plan
 *  Switch to a free / zero-cost plan: cancels Stripe subscription when present, updates account_subscriptions.
 *  Body: { planCode, accountId? }
 */
router.post("/downgrade-to-plan", ensureLoggedIn, wrapStripeErrors(async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new ForbiddenError("Authentication required");

    const { planCode, accountId } = req.body || {};
    if (!planCode) throw new BadRequestError("planCode is required");

    let accountIdToUse = accountId;
    if (!accountIdToUse) {
      const acc = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY (account_id IN (SELECT id FROM accounts WHERE owner_user_id = $1)) DESC LIMIT 1`,
        [userId]
      );
      if (!acc.rows[0]) throw new BadRequestError("No account found. Complete signup first.");
      accountIdToUse = acc.rows[0].account_id;
    }

    const hasAccess = await db.query(
      `SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2`,
      [accountIdToUse, userId]
    );
    if (!hasAccess.rows[0]) throw new ForbiddenError("Access denied to this account");

    const userRole = (res.locals.user?.role || "homeowner").toLowerCase();
    const expectedAudience = ["agent", "admin"].includes(userRole) ? "agent" : "homeowner";

    const result = await stripeService.downgradeToZeroCostPlan({
      accountId: accountIdToUse,
      userId,
      planCode,
      expectedAudience,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}));

/** POST /billing/reactivate
 *  Undo a scheduled cancellation (cancel_at_period_end) so the subscription renews normally.
 *  Body: { accountId? }
 */
router.post("/reactivate", ensureLoggedIn, wrapStripeErrors(async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new ForbiddenError("Authentication required");

    const { accountId } = req.body || {};
    let accountIdToUse = accountId;
    if (!accountIdToUse) {
      const acc = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY (account_id IN (SELECT id FROM accounts WHERE owner_user_id = $1)) DESC LIMIT 1`,
        [userId]
      );
      if (!acc.rows[0]) throw new BadRequestError("No account found. Complete signup first.");
      accountIdToUse = acc.rows[0].account_id;
    }

    const hasAccess = await db.query(
      `SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2`,
      [accountIdToUse, userId]
    );
    if (!hasAccess.rows[0]) throw new ForbiddenError("Access denied to this account");

    const result = await stripeService.reactivateSubscription(accountIdToUse, userId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}));

/** POST /billing/portal-session
 *  Body: { accountId?, returnUrl? }
 *  Returns: { url }
 */
router.post("/portal-session", ensureLoggedIn, wrapStripeErrors(async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new ForbiddenError("Authentication required");

    const { accountId, returnUrl } = req.body || {};
    let accountIdToUse = accountId;
    if (!accountIdToUse) {
      const acc = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (!acc.rows[0]) throw new BadRequestError("No account found");
      accountIdToUse = acc.rows[0].account_id;
    }

    const hasAccess = await db.query(
      `SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2`,
      [accountIdToUse, userId]
    );
    if (!hasAccess.rows[0]) throw new ForbiddenError("Access denied to this account");

    const { url } = await stripeService.createPortalSession(accountIdToUse, userId, returnUrl);
    return res.json({ url });
  } catch (err) {
    return next(err);
  }
}));

/** GET /billing/status
 *  Query: accountId (optional) - defaults to user's primary account.
 *  Returns current subscription, plan, limits, usage.
 */
router.get("/status", ensureLoggedIn, async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new ForbiddenError("Authentication required");

    let accountId = req.query.accountId ? parseInt(req.query.accountId, 10) : null;
    if (!accountId) {
      const accRes = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY (account_id IN (SELECT id FROM accounts WHERE owner_user_id = $1)) DESC LIMIT 1`,
        [userId]
      );
      accountId = accRes.rows[0]?.account_id;
    }
    if (!accountId) {
      return res.json({ subscription: null, plan: null, limits: null, usage: null, mockMode: BILLING_MOCK_MODE });
    }

    const isAdminOrSuper = ["super_admin", "admin"].includes(res.locals.user?.role);
    if (!isAdminOrSuper) {
      const hasAccess = await db.query(
        `SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2`,
        [accountId, userId]
      );
      if (!hasAccess.rows[0]) throw new ForbiddenError("Access denied to this account");
    }

    const acc = await db.query(
      `SELECT a.id, a.name, a.stripe_customer_id
       FROM accounts a WHERE a.id = $1`,
      [accountId]
    );
    if (!acc.rows[0]) {
      return res.json({ subscription: null, plan: null, limits: null, usage: null, mockMode: BILLING_MOCK_MODE });
    }

    if (BILLING_MOCK_MODE) {
      const plan = await planModel.getByCode("homeowner_maintain").catch(() => null);
      return res.json({
        subscription: { status: "active", mockMode: true },
        plan: plan || null,
        limits: plan?.limits || null,
        usage: { propertiesCount: 0, contactsCount: 0, aiTokensUsed: 0 },
        mockMode: true,
      });
    }

    const subRes = await db.query(
      `SELECT asub.id, asub.status, asub.current_period_start AS "currentPeriodStart",
              asub.current_period_end AS "currentPeriodEnd", asub.cancel_at_period_end AS "cancelAtPeriodEnd",
              sp.code, sp.name, sp.trial_days AS "trialDays"
       FROM account_subscriptions asub
       JOIN subscription_products sp ON sp.id = asub.subscription_product_id
       WHERE asub.account_id = $1 AND asub.status IN ('active', 'trialing')
       ORDER BY asub.current_period_end DESC NULLS LAST
       LIMIT 1`,
      [accountId]
    );

    const subscription = subRes.rows[0] || null;
    let plan = null;
    let limits = null;

    if (subscription) {
      plan = { code: subscription.code, name: subscription.name, trialDays: subscription.trialDays };
      const limRes = await db.query(
        `SELECT pl.max_properties AS "maxProperties", pl.max_contacts AS "maxContacts",
                pl.max_viewers AS "maxViewers", pl.max_team_members AS "maxTeamMembers",
                pl.ai_token_monthly_quota AS "aiTokenMonthlyQuota",
                pl.max_documents_per_system AS "maxDocumentsPerSystem",
                COALESCE(pl.ai_features_enabled, true) AS "aiFeaturesEnabled"
         FROM plan_limits pl
         JOIN subscription_products sp ON sp.id = pl.subscription_product_id
         WHERE sp.code = $1`,
        [subscription.code]
      );
      limits = limRes.rows[0] || null;
    } else {
      const userRole = (res.locals.user?.role || "homeowner").toLowerCase();
      const fallbackRole = ["agent", "admin"].includes(userRole) ? "agent" : "homeowner";
      const freePlanRes = await db.query(
        `SELECT sp.code, sp.name, sp.trial_days AS "trialDays"
         FROM subscription_products sp
         WHERE sp.target_role = $1 AND (sp.price IS NULL OR sp.price::float = 0)
           AND (sp.is_active IS NULL OR sp.is_active = true)
         ORDER BY sp.sort_order ASC NULLS LAST LIMIT 1`,
        [fallbackRole]
      );
      if (freePlanRes.rows[0]) {
        plan = { code: freePlanRes.rows[0].code, name: freePlanRes.rows[0].name, trialDays: freePlanRes.rows[0].trialDays };
        const limRes = await db.query(
          `SELECT pl.max_properties AS "maxProperties", pl.max_contacts AS "maxContacts",
                  pl.max_viewers AS "maxViewers", pl.max_team_members AS "maxTeamMembers",
                  pl.ai_token_monthly_quota AS "aiTokenMonthlyQuota",
                  pl.max_documents_per_system AS "maxDocumentsPerSystem",
                  COALESCE(pl.ai_features_enabled, true) AS "aiFeaturesEnabled"
           FROM plan_limits pl
           JOIN subscription_products sp ON sp.id = pl.subscription_product_id
           WHERE sp.code = $1`,
          [freePlanRes.rows[0].code]
        );
        limits = limRes.rows[0] || null;
      }
    }

    // Keep billing/status resilient in production if optional analytics tables are missing
    // (e.g., partial migrations). A 500 here causes the activation page to spin indefinitely.
    const usage = { propertiesCount: 0, contactsCount: 0, aiTokensUsed: 0 };

    try {
      const propsRes = await db.query(
        `SELECT COUNT(*)::int AS "propertiesCount" FROM properties WHERE account_id = $1`,
        [accountId]
      );
      usage.propertiesCount = propsRes.rows[0]?.propertiesCount || 0;
    } catch (usageErr) {
      console.warn("[billing/status] properties usage query failed:", usageErr.message);
    }

    try {
      const contactsRes = await db.query(
        `SELECT COUNT(*)::int AS "contactsCount" FROM account_contacts WHERE account_id = $1`,
        [accountId]
      );
      usage.contactsCount = contactsRes.rows[0]?.contactsCount || 0;
    } catch (usageErr) {
      console.warn("[billing/status] contacts usage query failed:", usageErr.message);
    }

    try {
      const tokensRes = await db.query(
        `SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0)::bigint AS "aiTokensUsed"
         FROM user_api_usage WHERE user_id = $1 AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
        [userId]
      );
      usage.aiTokensUsed = Number(tokensRes.rows[0]?.aiTokensUsed || 0);
    } catch (usageErr) {
      console.warn("[billing/status] token usage query failed:", usageErr.message);
    }

    return res.json({
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      } : null,
      plan,
      limits,
      usage,
      mockMode: false,
    });
  } catch (err) {
    return next(err);
  }
});

/** GET /billing/payment-method
 *  Query: accountId (optional)
 *  Returns { paymentMethod: { brand, last4 } | null }
 */
router.get("/payment-method", ensureLoggedIn, wrapStripeErrors(async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new ForbiddenError("Authentication required");

    let accountId = req.query.accountId ? parseInt(req.query.accountId, 10) : null;
    if (!accountId) {
      const accRes = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY (account_id IN (SELECT id FROM accounts WHERE owner_user_id = $1)) DESC LIMIT 1`,
        [userId]
      );
      accountId = accRes.rows[0]?.account_id;
    }
    if (!accountId) return res.json({ paymentMethod: null });

    const hasAccess = await db.query(
      `SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2`,
      [accountId, userId]
    );
    if (!hasAccess.rows[0]) throw new ForbiddenError("Access denied to this account");

    const acc = await db.query(`SELECT stripe_customer_id FROM accounts WHERE id = $1`, [accountId]);
    if (!acc.rows[0]?.stripe_customer_id) return res.json({ paymentMethod: null });

    if (BILLING_MOCK_MODE) {
      return res.json({ paymentMethod: { brand: "visa", last4: "4242" } });
    }

    const paymentMethod = await stripeService.getCustomerPaymentMethod(acc.rows[0].stripe_customer_id);
    return res.json({ paymentMethod });
  } catch (err) {
    return next(err);
  }
}));

/** GET /billing/invoices
 *  Query: accountId (optional), limit (optional, default 12)
 *  Returns { invoices: [{ id, created, amountDue, currency, status, hostedInvoiceUrl, invoicePdf }] }
 */
router.get("/invoices", ensureLoggedIn, wrapStripeErrors(async function (req, res, next) {
  try {
    const userId = res.locals.user?.id;
    if (!userId) throw new ForbiddenError("Authentication required");

    let accountId = req.query.accountId ? parseInt(req.query.accountId, 10) : null;
    if (!accountId) {
      const accRes = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1 ORDER BY (account_id IN (SELECT id FROM accounts WHERE owner_user_id = $1)) DESC LIMIT 1`,
        [userId]
      );
      accountId = accRes.rows[0]?.account_id;
    }
    if (!accountId) return res.json({ invoices: [] });

    const hasAccess = await db.query(
      `SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2`,
      [accountId, userId]
    );
    if (!hasAccess.rows[0]) throw new ForbiddenError("Access denied to this account");

    const acc = await db.query(`SELECT stripe_customer_id FROM accounts WHERE id = $1`, [accountId]);
    if (!acc.rows[0]?.stripe_customer_id) return res.json({ invoices: [] });

    if (BILLING_MOCK_MODE) {
      return res.json({ invoices: [] });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
    const invoices = await stripeService.listCustomerInvoices(acc.rows[0].stripe_customer_id, limit);
    return res.json({ invoices });
  } catch (err) {
    return next(err);
  }
}));

/** GET /billing/plans/:audience - Get plans for homeowner or agent (for plan selection UI) */
router.get("/plans/:audience", ensureLoggedIn, async function (req, res, next) {
  try {
    const audience = req.params.audience;
    if (!["homeowner", "agent"].includes(audience)) {
      throw new BadRequestError("audience must be homeowner or agent");
    }
    const plans = await planModel.getPlansForAudience(audience);
    return res.json({ plans });
  } catch (err) {
    return next(err);
  }
});

/** GET /billing/plans - List all plans (Super Admin only) */
router.get("/plans", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const plans = await planModel.getAll();
    return res.json({ plans });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /billing/plans/:id - Update plan (Super Admin only) */
router.patch("/plans/:id", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid plan ID");
    const plan = await planModel.updatePlan(id, req.body);
    return res.json({ plan });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /billing/plans/:id/limits - Update plan limits (Super Admin only) */
router.patch("/plans/:id/limits", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid plan ID");
    const plan = await planModel.updatePlanLimits(id, req.body);
    return res.json({ plan });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /billing/plans/:id/popular - Toggle "most popular" (Super Admin only). Clears siblings of same role. */
router.patch("/plans/:id/popular", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid plan ID");
    const { popular } = req.body;
    if (typeof popular !== "boolean") throw new BadRequestError("popular must be a boolean");
    const plan = await planModel.setPopular(id, popular);
    return res.json({ plan });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /billing/plans/:id/prices - Update plan price (Super Admin only) */
router.patch("/plans/:id/prices", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid plan ID");
    const { billingInterval, stripePriceId } = req.body;
    if (!billingInterval) throw new BadRequestError("billingInterval is required");
    const plan = await planModel.updatePlanPrice(id, billingInterval, stripePriceId || null);
    return res.json({ plan });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /billing/plans/:id/active - Toggle the plan globally active/inactive (Super Admin).
 *  Body: { isActive: boolean }
 *  Cascades to every plan_prices row so monthly + yearly intervals stay in sync with the parent. */
router.patch("/plans/:id/active", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid plan ID");
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") throw new BadRequestError("isActive must be a boolean");
    const plan = await planModel.setPlanActive(id, isActive);
    return res.json({ plan });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /billing/plans/:id/prices/active - Toggle price interval active/inactive (Super Admin).
 *  Body: { billingInterval: "month"|"year", isActive: boolean }
 *  When both intervals are inactive the parent plan is also deactivated automatically. */
router.patch("/plans/:id/prices/active", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid plan ID");
    const { billingInterval, isActive } = req.body;
    if (!billingInterval || !["month", "year"].includes(billingInterval)) {
      throw new BadRequestError("billingInterval must be month or year");
    }
    if (typeof isActive !== "boolean") throw new BadRequestError("isActive must be a boolean");
    const plan = await planModel.togglePriceActive(id, billingInterval, isActive);
    return res.json({ plan });
  } catch (err) {
    return next(err);
  }
});

/** GET /billing/stripe/prices - List active Stripe prices for admin dropdown */
router.get("/stripe/prices", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const prices = await stripeService.listActivePrices();
    return res.json({ prices });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /billing/plans/:id/features - Update plan features (Super Admin only) */
router.patch("/plans/:id/features", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid plan ID");
    const { features } = req.body;
    if (!features) throw new BadRequestError("features array is required");
    const plan = await planModel.updatePlanFeatures(id, features);
    return res.json({ plan });
  } catch (err) {
    return next(err);
  }
});

/** POST /billing/sync - Force sync subscription from Stripe (Super Admin debug only) */
router.post("/sync", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    if (BILLING_MOCK_MODE || !stripeService.stripe) {
      return res.json({ message: "Stripe not configured or mock mode enabled" });
    }
    const { accountId } = req.body || {};
    if (!accountId) throw new BadRequestError("accountId required");
    const acc = await db.query(
      `SELECT stripe_customer_id FROM accounts WHERE id = $1`,
      [accountId]
    );
    if (!acc.rows[0]?.stripe_customer_id) {
      return res.json({ message: "No Stripe customer for this account" });
    }
    const subscriptions = await stripeService.stripe.subscriptions.list({
      customer: acc.rows[0].stripe_customer_id,
      status: "all",
      limit: 10,
    });
    if (!subscriptions?.data?.length) {
      return res.json({ message: "No subscriptions found in Stripe" });
    }
    for (const sub of subscriptions.data) {
      const full = await stripeService.stripe.subscriptions.retrieve(sub.id, { expand: ["items.data.price"] });
      await stripeService.handleSubscriptionUpdated(full);
    }
    return res.json({ message: "Sync complete", count: subscriptions.data.length });
  } catch (err) {
    return next(err);
  }
});

/** POST /billing/admin/reconcile-user/:userId - Force reconcile subscription state for a user's primary account (Super Admin). */
router.post("/admin/reconcile-user/:userId", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    if (BILLING_MOCK_MODE || !stripeService.stripe) {
      return res.json({ message: "Stripe not configured or mock mode enabled", updated: 0 });
    }

    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) throw new BadRequestError("Invalid userId");

    const accountRes = await db.query(
      `SELECT au.account_id
       FROM account_users au
       LEFT JOIN accounts a ON a.id = au.account_id
       WHERE au.user_id = $1
       ORDER BY (a.owner_user_id = $1) DESC, au.account_id ASC
       LIMIT 1`,
      [userId]
    );
    const accountId = accountRes.rows[0]?.account_id;
    if (!accountId) {
      return res.json({ message: "User has no linked account", updated: 0 });
    }

    const customerRes = await db.query(
      `SELECT stripe_customer_id FROM accounts WHERE id = $1`,
      [accountId]
    );
    const stripeCustomerId = customerRes.rows[0]?.stripe_customer_id;
    if (!stripeCustomerId) {
      return res.json({ message: "No Stripe customer linked to user's account", accountId, updated: 0 });
    }

    const subscriptions = await stripeService.stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 20,
    });

    if (!subscriptions?.data?.length) {
      return res.json({ message: "No subscriptions found in Stripe for this account", accountId, updated: 0 });
    }

    let updated = 0;
    for (const sub of subscriptions.data) {
      const full = await stripeService.stripe.subscriptions.retrieve(sub.id, { expand: ["items.data.price"] });
      await stripeService.handleSubscriptionUpdated(full);
      updated += 1;
    }

    return res.json({
      message: "Reconciliation complete",
      accountId,
      stripeCustomerId,
      updated,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
