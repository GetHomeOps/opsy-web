"use strict";

/**
 * Subscription Model
 *
 * Manages account subscriptions in the `account_subscriptions` table. Links
 * accounts to subscription products with status, billing period, and Stripe IDs.
 *
 * Key operations:
 * - create / get / getAll / getByAccountId: CRUD and filtering
 * - update / remove: Modify or cancel subscriptions
 * - getSummary: Aggregate counts by status and product
 */

const db = require("../db");
const { NotFoundError, BadRequestError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** When platform staff own an account, show the real customer member instead. */
const SUBSCRIPTION_OWNER_JOINS = `
       LEFT JOIN users u ON u.id = a.owner_user_id
       LEFT JOIN LATERAL (
         SELECT u2.id, u2.name, u2.email, u2.role, u2.onboarding_completed
         FROM account_users au
         JOIN users u2 ON u2.id = au.user_id
         WHERE au.account_id = a.id
           AND u2.role NOT IN ('super_admin', 'admin')
         ORDER BY
           (LOWER(TRIM(u2.name)) = LOWER(TRIM(a.name))) DESC,
           CASE WHEN au.role = 'owner' THEN 0 ELSE 1 END,
           u2.id ASC
         LIMIT 1
       ) customer_u ON true
       LEFT JOIN users name_matched_u ON u.role IN ('super_admin', 'admin')
         AND customer_u.id IS NULL
         AND LOWER(TRIM(name_matched_u.name)) = LOWER(TRIM(a.name))
         AND name_matched_u.role NOT IN ('super_admin', 'admin')`;

const SUBSCRIPTION_OWNER_SELECT = `
              CASE
                WHEN u.role IN ('super_admin', 'admin') AND customer_u.id IS NOT NULL
                  THEN customer_u.name
                WHEN u.role IN ('super_admin', 'admin') AND name_matched_u.id IS NOT NULL
                  THEN name_matched_u.name
                ELSE u.name
              END AS "ownerName",
              CASE
                WHEN u.role IN ('super_admin', 'admin') AND customer_u.id IS NOT NULL
                  THEN customer_u.email
                WHEN u.role IN ('super_admin', 'admin') AND name_matched_u.id IS NOT NULL
                  THEN name_matched_u.email
                ELSE u.email
              END AS "ownerEmail",
              CASE
                WHEN u.role IN ('super_admin', 'admin') AND customer_u.id IS NOT NULL
                  THEN customer_u.role
                WHEN u.role IN ('super_admin', 'admin') AND name_matched_u.id IS NOT NULL
                  THEN name_matched_u.role
                ELSE u.role
              END AS "ownerRole",
              CASE
                WHEN u.role IN ('super_admin', 'admin') AND customer_u.id IS NOT NULL
                  THEN customer_u.onboarding_completed
                WHEN u.role IN ('super_admin', 'admin') AND name_matched_u.id IS NOT NULL
                  THEN name_matched_u.onboarding_completed
                ELSE u.onboarding_completed
              END AS "ownerOnboardingCompleted"`;

class Subscription {
  static async create({ accountId, subscriptionProductId, status = 'active', currentPeriodStart, currentPeriodEnd }) {
    if (!accountId || !subscriptionProductId) {
      throw new BadRequestError("accountId and subscriptionProductId are required.");
    }
    const result = await db.query(
      `INSERT INTO account_subscriptions
              (account_id, subscription_product_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id,
                 account_id AS "accountId",
                 subscription_product_id AS "subscriptionProductId",
                 status,
                 current_period_start AS "currentPeriodStart",
                 current_period_end AS "currentPeriodEnd",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [accountId, subscriptionProductId, status, currentPeriodStart || null, currentPeriodEnd || null]
    );
    return result.rows[0];
  }

  static async get(id) {
    const result = await db.query(
      `SELECT s.id,
              s.account_id AS "accountId",
              a.name AS "accountName",
              a.url AS "accountUrl",
              ${SUBSCRIPTION_OWNER_SELECT},
              s.subscription_product_id AS "subscriptionProductId",
              sp.name AS "productName",
              CASE
                /* Prefer the exact Stripe price attached to this subscription when available. */
                WHEN pp.unit_amount IS NOT NULL THEN pp.unit_amount::numeric / 100
                /* Otherwise reflect the selected product's configured monthly/catalog price. */
                ELSE COALESCE(
                  (SELECT ppm.unit_amount::numeric / 100 FROM plan_prices ppm
                   WHERE ppm.subscription_product_id = sp.id AND ppm.billing_interval = 'month'
                     AND (ppm.is_active IS NULL OR ppm.is_active = true)
                   LIMIT 1),
                  sp.price::numeric,
                  0
                )
              END AS "productPrice",
              sp.target_role AS "targetRole",
              sp.trial_days AS "trialDays",
              s.stripe_subscription_id AS "stripeSubscriptionId",
              s.stripe_customer_id AS "stripeCustomerId",
              s.cancel_at_period_end AS "cancelAtPeriodEnd",
              s.status,
              s.current_period_start AS "currentPeriodStart",
              s.current_period_end AS "currentPeriodEnd",
              COALESCE(pp.billing_interval, sp.billing_interval, 'month') AS "billingInterval",
              s.created_at AS "createdAt",
              s.updated_at AS "updatedAt"
       FROM account_subscriptions s
       LEFT JOIN accounts a ON a.id = s.account_id
       ${SUBSCRIPTION_OWNER_JOINS}
       LEFT JOIN subscription_products sp ON sp.id = s.subscription_product_id
       LEFT JOIN plan_prices pp ON pp.stripe_price_id = s.stripe_price_id
       WHERE s.id = $1`,
      [id]
    );
    const subscription = result.rows[0];
    if (!subscription) throw new NotFoundError(`No subscription with id: ${id}`);
    return Subscription.enrichSubscriptionRow(subscription);
  }

  static async getAll({ status, accountId } = {}) {
    const clauses = [];
    const values = [];
    if (status) {
      values.push(status);
      clauses.push(`s.status = $${values.length}`);
    }
    if (accountId) {
      values.push(accountId);
      clauses.push(`s.account_id = $${values.length}`);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await db.query(
      `SELECT s.id,
              s.account_id AS "accountId",
              a.name AS "accountName",
              a.url AS "accountUrl",
              ${SUBSCRIPTION_OWNER_SELECT},
              s.subscription_product_id AS "subscriptionProductId",
              sp.name AS "productName",
              CASE
                /* Prefer the exact Stripe price attached to this subscription when available. */
                WHEN pp.unit_amount IS NOT NULL THEN pp.unit_amount::numeric / 100
                /* Otherwise reflect the selected product's configured monthly/catalog price. */
                ELSE COALESCE(
                  (SELECT ppm.unit_amount::numeric / 100 FROM plan_prices ppm
                   WHERE ppm.subscription_product_id = sp.id AND ppm.billing_interval = 'month'
                     AND (ppm.is_active IS NULL OR ppm.is_active = true)
                   LIMIT 1),
                  sp.price::numeric,
                  0
                )
              END AS "productPrice",
              sp.target_role AS "targetRole",
              sp.trial_days AS "trialDays",
              s.stripe_subscription_id AS "stripeSubscriptionId",
              s.stripe_customer_id AS "stripeCustomerId",
              s.cancel_at_period_end AS "cancelAtPeriodEnd",
              s.status,
              s.current_period_start AS "currentPeriodStart",
              s.current_period_end AS "currentPeriodEnd",
              COALESCE(pp.billing_interval, sp.billing_interval, 'month') AS "billingInterval",
              s.created_at AS "createdAt",
              s.updated_at AS "updatedAt"
       FROM account_subscriptions s
       LEFT JOIN accounts a ON a.id = s.account_id
       ${SUBSCRIPTION_OWNER_JOINS}
       LEFT JOIN subscription_products sp ON sp.id = s.subscription_product_id
       LEFT JOIN plan_prices pp ON pp.stripe_price_id = s.stripe_price_id
       ${where}
       ORDER BY s.created_at DESC`,
      values
    );
    return result.rows.map((row) => Subscription.enrichSubscriptionRow(row));
  }

  /** Derive an honest billing state from a subscription row.
   *
   * - paid_active / trialing / past_due only apply to Stripe-backed rows
   * - internal rows on a $0 plan are "free"
   * - internal rows on a paid plan are "comped" (access granted without payment)
   * - retired placeholder rows (awaiting_payment / internal canceled) reflect signup state
   */
  static deriveBillingState(row) {
    const status = (row.status || "").toLowerCase();
    const isStripe = Boolean(row.stripeSubscriptionId);
    const price = Number(row.productPrice) || 0;
    const onboardingDone = row.ownerOnboardingCompleted !== false;

    if (status === "awaiting_payment") {
      return onboardingDone ? "awaiting_payment" : "signup_incomplete";
    }
    if (status === "past_due" || status === "unpaid") return "past_due";
    if (status === "incomplete" || status === "incomplete_expired") return "incomplete";

    if (status === "canceled" || status === "cancelled") {
      /* Placeholder rows retired by repair were never real Stripe cancellations. */
      if (!isStripe && price > 0) {
        return onboardingDone ? "awaiting_payment" : "signup_incomplete";
      }
      return "canceled";
    }

    if (!["active", "trialing", "trial"].includes(status)) return status || "unknown";

    const trialDays = Number(row.trialDays) || 0;
    const onInternalTrial =
      !isStripe && trialDays > 0 && ["active", "trialing", "trial"].includes(status);

    if (isStripe) {
      return status === "active" ? "paid_active" : "trialing";
    }
    if (onInternalTrial || status === "trialing" || status === "trial") {
      return "trialing";
    }
    return price > 0 ? "comped" : "free";
  }

  /** Days left in trial (null when not trialing). Uses period end, or start + plan trial_days. */
  static computeTrialDaysRemaining(row, billingState) {
    if (billingState !== "trialing") return null;

    let trialEnd = null;
    if (row.currentPeriodEnd) {
      trialEnd = new Date(row.currentPeriodEnd);
    } else if (row.currentPeriodStart && row.trialDays) {
      trialEnd = new Date(row.currentPeriodStart);
      trialEnd.setUTCDate(trialEnd.getUTCDate() + Number(row.trialDays));
    }

    if (!trialEnd || Number.isNaN(trialEnd.getTime())) return null;

    const msLeft = trialEnd.getTime() - Date.now();
    if (msLeft <= 0) return 0;
    return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  }

  static enrichSubscriptionRow(row) {
    const billingState = Subscription.deriveBillingState(row);
    return {
      ...row,
      source: row.stripeSubscriptionId ? "stripe" : "internal",
      billingState,
      trialDaysRemaining: Subscription.computeTrialDaysRemaining(row, billingState),
    };
  }

  static async getByAccountId(accountId) {
    return this.getAll({ accountId });
  }

  static async update(id, data) {
    const jsToSql = {
      subscriptionProductId: "subscription_product_id",
      status: "status",
      stripeSubscriptionId: "stripe_subscription_id",
      currentPeriodStart: "current_period_start",
      currentPeriodEnd: "current_period_end",
    };
    const { setCols, values } = sqlForPartialUpdate(data, jsToSql);
    const idVarIdx = "$" + (values.length + 1);
    const querySql = `
      UPDATE account_subscriptions
      SET ${setCols}, updated_at = NOW()
      WHERE id = ${idVarIdx}
      RETURNING id,
                account_id AS "accountId",
                subscription_product_id AS "subscriptionProductId",
                status,
                current_period_start AS "currentPeriodStart",
                current_period_end AS "currentPeriodEnd",
                created_at AS "createdAt",
                updated_at AS "updatedAt"`;
    const result = await db.query(querySql, [...values, id]);
    const subscription = result.rows[0];
    if (!subscription) throw new NotFoundError(`No subscription with id: ${id}`);
    return subscription;
  }

  static async remove(id) {
    const result = await db.query(
      `DELETE FROM account_subscriptions WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`No subscription with id: ${id}`);
    return { deleted: id };
  }

  /** Ensure account has at least one active subscription. Creates a free tier if none exists.
   *
   * Strict billing: this never provisions a paid plan. Agents get no default
   * subscription unless an explicit zero-cost planCode is supplied (e.g. "agent_free"
   * or "agent_beta"); paid agents must complete Stripe checkout.
   * Returns the subscription id, or null when nothing was (or should be) created.
   *
   * @param {{ planCode?: string }} [options] — e.g. { planCode: "homeowner_free" | "agent_free" | "agent_beta" } */
  static async ensureDefaultForAccount(accountId, userRole = "homeowner", options = {}) {
    const existing = await db.query(
      `SELECT id FROM account_subscriptions WHERE account_id = $1 AND status = 'active' LIMIT 1`,
      [accountId]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;

    const planCode =
      options.planCode || (userRole === "agent" ? null : "homeowner_free");
    if (!planCode) return null;

    const productRes = await db.query(
      `SELECT sp.id,
              COALESCE(
                (SELECT ppm.unit_amount FROM plan_prices ppm
                 WHERE ppm.subscription_product_id = sp.id AND ppm.billing_interval = 'month'
                   AND (ppm.is_active IS NULL OR ppm.is_active = true)
                 LIMIT 1),
                (COALESCE(sp.price, 0) * 100)::int
              ) AS "unitAmount"
       FROM subscription_products sp
       WHERE (sp.code = $1 OR (sp.code IS NULL AND LOWER(sp.name) = 'free'))
         AND (sp.is_active IS NULL OR sp.is_active = true)
       LIMIT 1`,
      [planCode]
    );
    let productId = productRes.rows[0]?.id;
    if (productId && Number(productRes.rows[0].unitAmount) > 0) {
      console.warn(
        `[subscriptions] Refusing to auto-provision paid plan "${planCode}" for account ${accountId} without payment.`
      );
      return null;
    }
    if (!productId) {
      /* A product is only truly free when both its catalog price and its
         active monthly Stripe price (plan_prices) are zero — a $0 catalog
         price can hide a real paid Stripe price (e.g. trial products). */
      const fallback = await db.query(
        `SELECT sp.id FROM subscription_products sp
         WHERE COALESCE(sp.price, 0) = 0
           AND (sp.is_active IS NULL OR sp.is_active = true)
           AND (sp.target_role IS NULL OR sp.target_role = $1)
           AND COALESCE(
             (SELECT ppm.unit_amount FROM plan_prices ppm
              WHERE ppm.subscription_product_id = sp.id AND ppm.billing_interval = 'month'
                AND (ppm.is_active IS NULL OR ppm.is_active = true)
              LIMIT 1),
             0
           ) = 0
         ORDER BY sp.sort_order ASC NULLS LAST, sp.price ASC LIMIT 1`,
        [userRole]
      );
      productId = fallback.rows[0]?.id;
    }
    if (!productId) return null;

    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 1);

    const result = await db.query(
      `INSERT INTO account_subscriptions
              (account_id, subscription_product_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, 'active', $3, $4)
       RETURNING id`,
      [accountId, productId, today.toISOString(), endDate.toISOString()]
    );
    return result.rows[0]?.id;
  }

  /** Ensure account has an active subscription on the exact requested plan code.
   * Used for onboarding free-tier selections so switching between free plans
   * (e.g. homeowner_beta -> homeowner_free) updates the active subscription.
   */
  static async ensureAccountOnPlanCode(accountId, planCode) {
    if (!accountId || !planCode) {
      throw new BadRequestError("accountId and planCode are required.");
    }

    const productRes = await db.query(
      `SELECT sp.id,
              COALESCE(sp.price, 0) AS price,
              pp.unit_amount AS "unitAmount"
       FROM subscription_products sp
       LEFT JOIN plan_prices pp
         ON pp.subscription_product_id = sp.id
        AND pp.billing_interval = 'month'
       WHERE sp.code = $1
         AND (sp.is_active IS NULL OR sp.is_active = true)
       LIMIT 1`,
      [planCode]
    );
    const product = productRes.rows[0];
    if (!product) {
      throw new BadRequestError(`Unknown plan code: ${planCode}`);
    }
    const effectivePrice = typeof product.unitAmount === "number"
      ? product.unitAmount
      : Number(product.price);
    if (effectivePrice > 0) {
      throw new BadRequestError(
        `Plan code ${planCode} is not zero-cost and cannot be set via free-tier onboarding.`
      );
    }

    const existingRes = await db.query(
      `SELECT id, subscription_product_id AS "subscriptionProductId"
       FROM account_subscriptions
       WHERE account_id = $1
         AND status IN ('active', 'trialing')
       ORDER BY updated_at DESC NULLS LAST, id DESC
       LIMIT 1`,
      [accountId]
    );
    const existing = existingRes.rows[0];

    if (existing) {
      if (existing.subscriptionProductId === product.id) {
        return existing.id;
      }
      const updatedRes = await db.query(
        `UPDATE account_subscriptions
         SET subscription_product_id = $1,
             stripe_subscription_id = NULL,
             stripe_price_id = NULL,
             cancel_at_period_end = false,
             status = 'active',
             current_period_start = NOW(),
             current_period_end = NOW() + INTERVAL '1 month',
             updated_at = NOW()
         WHERE id = $2
         RETURNING id`,
        [product.id, existing.id]
      );
      return updatedRes.rows[0]?.id || existing.id;
    }

    const result = await db.query(
      `INSERT INTO account_subscriptions
              (account_id, subscription_product_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '1 month')
       RETURNING id`,
      [accountId, product.id]
    );
    return result.rows[0]?.id || null;
  }

  /** Backfill: create a free default subscription for every account that has none. Returns count created.
   * Skips accounts whose owner has not completed onboarding (industry practice: subscriptions only after onboarding).
   * Skips super_admin and admin accounts (internal platform accounts).
   * Skips agents entirely — agents must pay through Stripe and are never comped a plan. */
  static async backfillMissingSubscriptions() {
    const accountsWithoutSub = await db.query(
      `SELECT a.id, u.role AS "ownerRole"
       FROM accounts a
       JOIN users u ON u.id = a.owner_user_id
       WHERE u.onboarding_completed = true
         AND u.role NOT IN ('super_admin', 'admin', 'agent')
         AND NOT EXISTS (
           SELECT 1 FROM account_subscriptions s WHERE s.account_id = a.id
         )`
    );
    let created = 0;
    for (const row of accountsWithoutSub.rows) {
      const id = await this.ensureDefaultForAccount(row.id, row.ownerRole || "homeowner");
      if (id) created++;
    }
    return created;
  }

  static async getSummary() {
    const totalRes = await db.query(`SELECT COUNT(*)::int AS count FROM account_subscriptions`);
    const byStatusRes = await db.query(
      `SELECT status, COUNT(*)::int AS count FROM account_subscriptions GROUP BY status ORDER BY count DESC`
    );
    const byProductRes = await db.query(
      `SELECT sp.name AS "productName", COUNT(*)::int AS count
       FROM account_subscriptions s
       LEFT JOIN subscription_products sp ON sp.id = s.subscription_product_id
       GROUP BY sp.name ORDER BY count DESC`
    );
    return {
      total: totalRes.rows[0]?.count || 0,
      byStatus: byStatusRes.rows,
      byProduct: byProductRes.rows,
    };
  }
}

module.exports = Subscription;
