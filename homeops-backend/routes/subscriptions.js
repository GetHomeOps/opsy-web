"use strict";

const express = require("express");
const jsonschema = require("jsonschema");
const { ensureLoggedIn, ensureSuperAdmin, ensurePlatformAdmin, ensureAdminOrSuperAdmin, ensureUserCanAccessAccountByParam } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const Subscription = require("../models/subscription");
const subscriptionNewSchema = require("../schemas/subscriptionNew.json");
const subscriptionUpdateSchema = require("../schemas/subscriptionUpdate.json");

const router = express.Router();

/** POST /backfill - Create free subscriptions for accounts that have none. Super admin only. */
router.post("/backfill", ensureSuperAdmin, async function (req, res, next) {
  try {
    const created = await Subscription.backfillMissingSubscriptions();
    return res.json({ created, message: `Created ${created} default subscription(s) for accounts without one.` });
  } catch (err) {
    return next(err);
  }
});

/** POST /repair - One-time data repair. Super admin only. Body: { dryRun }.
 *
 *  1. Account ownership: accounts owned by platform staff (super_admin/admin) that have
 *     a real customer member get their owner_user_id reassigned to that member.
 *  2. Placeholder subscriptions: active/trialing rows on a PAID plan with no Stripe
 *     subscription (access granted without payment) are marked canceled.
 *  3. Re-syncs all subscriptions from Stripe so real paid/trialing subs are reflected.
 *
 *  With dryRun (default false), returns the proposed changes without applying anything. */
router.post("/repair", ensureSuperAdmin, async function (req, res, next) {
  try {
    const db = require("../db");
    const dryRun = req.body?.dryRun === true || req.body?.dryRun === "true";

    /* 1. Accounts owned by staff whose name matches a non-staff member, or with exactly
       one non-staff member. Skip demo users (their accounts are intentionally provisioned). */
    const ownershipRes = await db.query(
      `SELECT a.id AS "accountId",
              a.name AS "accountName",
              owner_u.name AS "currentOwnerName",
              owner_u.email AS "currentOwnerEmail",
              candidate.id AS "newOwnerId",
              candidate.name AS "newOwnerName",
              candidate.email AS "newOwnerEmail"
       FROM accounts a
       JOIN users owner_u ON owner_u.id = a.owner_user_id
       JOIN LATERAL (
         SELECT u.id, u.name, u.email
         FROM account_users au
         JOIN users u ON u.id = au.user_id
         WHERE au.account_id = a.id
           AND u.role NOT IN ('super_admin', 'admin')
           AND u.demo_expires_at IS NULL
         ORDER BY (LOWER(TRIM(u.name)) = LOWER(TRIM(a.name))) DESC, u.id ASC
         LIMIT 1
       ) candidate ON true
       WHERE owner_u.role IN ('super_admin', 'admin')
         AND (
           LOWER(TRIM(candidate.name)) = LOWER(TRIM(a.name))
           OR (SELECT COUNT(*) FROM account_users au2
               JOIN users u2 ON u2.id = au2.user_id
               WHERE au2.account_id = a.id
                 AND u2.role NOT IN ('super_admin', 'admin')) = 1
         )`
    );
    const ownershipFixes = ownershipRes.rows;

    /* 2. Internal rows granting a paid plan with no Stripe payment. Exclude demo accounts. */
    const placeholderRes = await db.query(
      `SELECT s.id AS "subscriptionId",
              s.account_id AS "accountId",
              a.name AS "accountName",
              sp.name AS "planName",
              COALESCE(sp.price, 0) AS "planPrice",
              owner_u.name AS "ownerName",
              owner_u.email AS "ownerEmail",
              s.status
       FROM account_subscriptions s
       JOIN accounts a ON a.id = s.account_id
       LEFT JOIN users owner_u ON owner_u.id = a.owner_user_id
       JOIN subscription_products sp ON sp.id = s.subscription_product_id
       WHERE s.stripe_subscription_id IS NULL
         AND s.status IN ('active', 'trialing')
         AND COALESCE(sp.price, 0) > 0
         AND (owner_u.id IS NULL OR owner_u.demo_expires_at IS NULL)
       ORDER BY s.account_id`
    );
    const placeholderCancellations = placeholderRes.rows;

    if (dryRun) {
      return res.json({
        dryRun: true,
        applied: false,
        ownershipFixes,
        placeholderCancellations,
      });
    }

    await db.query("BEGIN");
    try {
      for (const fix of ownershipFixes) {
        await db.query(
          `UPDATE accounts SET owner_user_id = $1, updated_at = NOW() WHERE id = $2`,
          [fix.newOwnerId, fix.accountId]
        );
      }
      if (placeholderCancellations.length > 0) {
        await db.query(
          `UPDATE account_subscriptions SET status = 'canceled', updated_at = NOW()
           WHERE id = ANY($1::int[])`,
          [placeholderCancellations.map((p) => p.subscriptionId)]
        );
      }
      await db.query("COMMIT");
    } catch (txErr) {
      await db.query("ROLLBACK");
      throw txErr;
    }

    /* 3. Pull the truth back in from Stripe. */
    const stripeService = require("../services/stripeService");
    let stripeSync = { synced: 0, failed: 0 };
    try {
      stripeSync = await stripeService.syncAllStripeSubscriptions();
    } catch (syncErr) {
      console.error("[subscriptions/repair] Stripe sync failed:", syncErr.message);
    }

    return res.json({
      dryRun: false,
      applied: true,
      ownershipFixes,
      placeholderCancellations,
      stripeSync,
      message: `Reassigned ${ownershipFixes.length} account owner(s), canceled ${placeholderCancellations.length} placeholder subscription(s), synced ${stripeSync.synced} Stripe subscription(s).`,
    });
  } catch (err) {
    return next(err);
  }
});

/** GET / - List subscriptions. Query: status, accountId. Platform admin only. */
router.get("/", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const { status, accountId } = req.query;
    const subscriptions = await Subscription.getAll({
      status,
      accountId: accountId ? Number(accountId) : undefined,
    });
    return res.json({ subscriptions });
  } catch (err) {
    return next(err);
  }
});

/** GET /summary - Aggregate counts by status and product. Platform admin only. */
router.get("/summary", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const summary = await Subscription.getSummary();
    return res.json({ summary });
  } catch (err) {
    return next(err);
  }
});

/** GET /account/:accountId - List subscriptions for account. Requires account access. */
router.get("/account/:accountId", ensureLoggedIn, ensureUserCanAccessAccountByParam("accountId"), async function (req, res, next) {
  try {
    const subscriptions = await Subscription.getByAccountId(Number(req.params.accountId));
    return res.json({ subscriptions });
  } catch (err) {
    return next(err);
  }
});

/** POST /account - Create subscription for own account. Body: accountId, subscriptionProductId, etc. */
router.post("/account", ensureLoggedIn, async function (req, res, next) {
  try {
    const { accountId, subscriptionProductId, status, currentPeriodStart, currentPeriodEnd } = req.body;
    if (!accountId || !subscriptionProductId) {
      throw new BadRequestError("accountId and subscriptionProductId are required");
    }
    const userId = res.locals.user?.id;
    const Account = require("../models/account");
    const hasAccess = await Account.isUserLinkedToAccount(userId, Number(accountId));
    if (!hasAccess) {
      const { UnauthorizedError } = require("../expressError");
      throw new UnauthorizedError("You do not have access to this account");
    }
    const validator = jsonschema.validate(
      { accountId, subscriptionProductId, status: status || "active", currentPeriodStart, currentPeriodEnd },
      subscriptionNewSchema
    );
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs);
    }
    const subscription = await Subscription.create({
      accountId: Number(accountId),
      subscriptionProductId: Number(subscriptionProductId),
      status: status || "active",
      currentPeriodStart: currentPeriodStart || new Date().toISOString(),
      currentPeriodEnd: currentPeriodEnd || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString();
      })(),
    });
    return res.status(201).json({ subscription });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id - Get single subscription. Admin only. */
router.get("/:id", ensureAdminOrSuperAdmin, async function (req, res, next) {
  try {
    const subscription = await Subscription.get(Number(req.params.id));
    return res.json({ subscription });
  } catch (err) {
    return next(err);
  }
});

/** POST / - Create subscription. Super admin only.
 *  Accepts accountId directly, or userId (resolved to the user's primary account —
 *  the account they own, falling back to their first membership). Rows created here
 *  have no Stripe IDs, so the UI reports them as internal/comped rather than paid. */
router.post("/", ensureSuperAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, subscriptionNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }
    const { userId, accountId, subscriptionProductId, status, currentPeriodStart, currentPeriodEnd } = req.body;

    let resolvedAccountId = accountId ? Number(accountId) : null;
    if (!resolvedAccountId && userId) {
      const db = require("../db");
      const accountRes = await db.query(
        `SELECT au.account_id
         FROM account_users au
         LEFT JOIN accounts a ON a.id = au.account_id
         WHERE au.user_id = $1
         ORDER BY (a.owner_user_id = $1) DESC, au.account_id ASC
         LIMIT 1`,
        [Number(userId)]
      );
      resolvedAccountId = accountRes.rows[0]?.account_id || null;
      if (!resolvedAccountId) {
        throw new BadRequestError("Selected user has no linked account.");
      }
    }

    const subscription = await Subscription.create({
      accountId: resolvedAccountId,
      subscriptionProductId,
      status,
      currentPeriodStart,
      currentPeriodEnd,
    });
    return res.status(201).json({ subscription });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id - Update subscription. Super admin only. */
router.patch("/:id", ensureSuperAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, subscriptionUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }
    const subscription = await Subscription.update(Number(req.params.id), req.body);
    return res.json({ subscription });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:id - Remove subscription. Super admin only. */
router.delete("/:id", ensureSuperAdmin, async function (req, res, next) {
  try {
    await Subscription.remove(Number(req.params.id));
    return res.json({ deleted: Number(req.params.id) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
