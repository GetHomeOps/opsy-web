"use strict";

/**
 * Plan Model
 *
 * Wraps subscription_products + plan_limits + plan_prices for billing.
 * Used by billing routes and tierService.
 */

const db = require("../db");
const { NotFoundError, BadRequestError } = require("../expressError");

/**
 * Public plan lists must show at most one "Most popular" badge. Legacy rows may have multiple
 * popular=true; keep the first by sort order (query ORDER BY already applied).
 */
function normalizeSinglePopularInList(plans) {
  if (!plans?.length) return plans;
  let kept = false;
  for (const p of plans) {
    if (p.popular) {
      if (kept) p.popular = false;
      else kept = true;
    }
  }
  return plans;
}

/** Resolve unit_amount from Stripe when DB has null. Returns { unitAmount, currency } or null. */
async function resolvePriceFromStripe(stripePriceId) {
  if (!stripePriceId) return null;
  try {
    const stripeService = require("../services/stripeService");
    if (stripeService.stripe) {
      const price = await stripeService.stripe.prices.retrieve(stripePriceId);
      return {
        unitAmount: price.unit_amount,
        currency: price.currency || "usd",
      };
    }
  } catch (_) { /* Stripe unavailable */ }
  return null;
}

/** Get all active plans for an audience (homeowner | agent), with limits, prices, and features.
 *  Only prices where is_active = true are included. Plans with zero active prices are excluded. */
async function getPlansForAudience(audienceType) {
  const result = await db.query(
    `SELECT sp.id, sp.code, sp.name, sp.description, sp.target_role AS "targetRole",
            sp.price, sp.billing_interval AS "billingInterval", sp.sort_order AS "sortOrder",
            sp.trial_days AS "trialDays", sp.is_active AS "isActive", sp.popular, sp.features
     FROM subscription_products sp
     WHERE sp.target_role = $1 AND (sp.is_active IS NULL OR sp.is_active = true)
     ORDER BY sp.sort_order ASC, sp.price ASC`,
    [audienceType]
  );

  const plans = [];
  for (const p of result.rows) {
    p.features = p.features || [];

    const limits = await db.query(
      `SELECT max_properties AS "maxProperties", max_contacts AS "maxContacts",
              max_viewers AS "maxViewers", max_team_members AS "maxTeamMembers",
              ai_token_monthly_quota AS "aiTokenMonthlyQuota",
              max_documents_per_system AS "maxDocumentsPerSystem",
              COALESCE(ai_features_enabled, true) AS "aiFeaturesEnabled",
              other_limits AS "otherLimits"
       FROM plan_limits WHERE subscription_product_id = $1`,
      [p.id]
    );
    p.limits = limits.rows[0] || {
      maxProperties: 1,
      maxContacts: 25,
      maxViewers: 2,
      maxTeamMembers: 5,
      aiTokenMonthlyQuota: 50000,
      maxDocumentsPerSystem: 5,
      aiFeaturesEnabled: true,
      otherLimits: {},
    };

    const prices = await db.query(
      `SELECT billing_interval AS "billingInterval", stripe_price_id AS "stripePriceId",
              unit_amount AS "unitAmount", currency,
              COALESCE(is_active, true) AS "isActive"
       FROM plan_prices WHERE subscription_product_id = $1`,
      [p.id]
    );
    const activePrices = prices.rows.filter((r) => r.isActive !== false);
    /* Skip paid plans that have no active Stripe prices (can't be subscribed to via Stripe).
       Free / zero-cost plans don't need a plan_prices row — they go through the in-app
       downgrade flow, so keep them visible even when activePrices is empty. */
    const isZeroCostPlan = Number(p.price ?? 0) <= 0;
    if (activePrices.length === 0 && !isZeroCostPlan) continue;

    p.prices = activePrices.reduce((acc, r) => {
      acc[r.billingInterval] = r.stripePriceId;
      return acc;
    }, {});
    p.stripePrices = {};
    for (const r of activePrices) {
      let unitAmount = r.unitAmount;
      let currency = r.currency || "usd";
      if (r.stripePriceId) {
        const resolved = await resolvePriceFromStripe(r.stripePriceId);
        if (resolved) {
          if (resolved.unitAmount !== unitAmount || resolved.currency !== currency) {
            unitAmount = resolved.unitAmount;
            currency = resolved.currency;
            await db.query(
              `UPDATE plan_prices SET unit_amount = $1, currency = $2 WHERE subscription_product_id = $3 AND billing_interval = $4`,
              [unitAmount, currency, p.id, r.billingInterval]
            );
          }
        }
      }
      p.stripePrices[r.billingInterval] = {
        stripePriceId: r.stripePriceId,
        unitAmount,
        currency,
      };
    }
    p.activeBillingIntervals = activePrices.map((r) => r.billingInterval);
    plans.push(p);
  }
  return normalizeSinglePopularInList(plans);
}

/** Get plan by code. */
async function getByCode(code) {
  const result = await db.query(
    `SELECT sp.id, sp.code, sp.name, sp.description, sp.target_role AS "targetRole",
            sp.price, sp.trial_days AS "trialDays", sp.is_active AS "isActive", sp.popular, sp.features
     FROM subscription_products sp WHERE sp.code = $1`,
    [code]
  );
  const plan = result.rows[0];
  if (!plan) throw new NotFoundError(`Plan not found: ${code}`);
  plan.features = plan.features || [];
  return plan;
}

/** Get all plans (Super Admin). */
async function getAll() {
  const result = await db.query(
    `SELECT sp.id, sp.code, sp.name, sp.description, sp.target_role AS "targetRole",
            sp.price, sp.sort_order AS "sortOrder", sp.trial_days AS "trialDays",
            sp.is_active AS "isActive", sp.popular, sp.features,
            sp.created_at AS "createdAt", sp.updated_at AS "updatedAt"
     FROM subscription_products sp ORDER BY sp.sort_order ASC, sp.target_role, sp.price ASC`
  );
  const plans = result.rows;
  for (const p of plans) {
    p.features = p.features || [];

    const limits = await db.query(
      `SELECT id, max_properties AS "maxProperties", max_contacts AS "maxContacts",
              max_viewers AS "maxViewers", max_team_members AS "maxTeamMembers",
              ai_token_monthly_quota AS "aiTokenMonthlyQuota",
              max_documents_per_system AS "maxDocumentsPerSystem",
              COALESCE(ai_features_enabled, true) AS "aiFeaturesEnabled",
              other_limits AS "otherLimits"
       FROM plan_limits WHERE subscription_product_id = $1`,
      [p.id]
    );
    p.limits = limits.rows[0];

    const prices = await db.query(
      `SELECT id, billing_interval AS "billingInterval", stripe_price_id AS "stripePriceId",
              unit_amount AS "unitAmount", currency, COALESCE(is_active, true) AS "isActive"
       FROM plan_prices WHERE subscription_product_id = $1 ORDER BY billing_interval`,
      [p.id]
    );
    p.prices = prices.rows;
  }
  return plans;
}

/** Update plan (Super Admin). */
async function updatePlan(productId, data) {
  const { name, description, isActive, sortOrder, trialDays } = data;
  const updates = [];
  const values = [];
  let i = 1;
  if (name !== undefined) { updates.push(`name = $${i++}`); values.push(name); }
  if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description); }
  if (isActive !== undefined) { updates.push(`is_active = $${i++}`); values.push(isActive); }
  if (sortOrder !== undefined) { updates.push(`sort_order = $${i++}`); values.push(sortOrder); }
  if (trialDays !== undefined) { updates.push(`trial_days = $${i++}`); values.push(trialDays); }
  if (updates.length > 0) {
    values.push(productId);
    await db.query(
      `UPDATE subscription_products SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i}`,
      values
    );
  }
  return getPlanById(productId);
}

/**
 * Clear duplicate popular flags so at most one row per target_role has popular = true.
 * Keeps the row with lowest sort_order, then lowest id. Run before creating the partial unique index.
 */
async function dedupePopularPerRole() {
  await db.query(`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY target_role
               ORDER BY sort_order ASC NULLS LAST, id ASC
             ) AS rn
      FROM subscription_products
      WHERE popular = true
    )
    UPDATE subscription_products sp
    SET popular = false, updated_at = NOW()
    FROM ranked r
    WHERE sp.id = r.id AND r.rn > 1
  `);
}

/** Set a plan as the "most popular" for its target_role. Clears popular from sibling plans. */
async function setPopular(productId, isPopular) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    if (isPopular) {
      const plan = await client.query(
        `SELECT target_role FROM subscription_products WHERE id = $1`,
        [productId]
      );
      if (!plan.rows[0]) {
        await client.query("ROLLBACK");
        throw new NotFoundError(`Plan not found: ${productId}`);
      }
      await client.query(
        `UPDATE subscription_products SET popular = false, updated_at = NOW()
         WHERE target_role = $1 AND popular = true`,
        [plan.rows[0].target_role]
      );
    }
    await client.query(
      `UPDATE subscription_products SET popular = $1, updated_at = NOW() WHERE id = $2`,
      [isPopular, productId]
    );
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
  return getPlanById(productId);
}

/** Update plan limits (Super Admin). */
async function updatePlanLimits(productId, limits) {
  const {
    maxProperties, maxContacts, maxViewers, maxTeamMembers,
    aiTokenMonthlyQuota, maxDocumentsPerSystem, otherLimits, aiFeaturesEnabled,
  } = limits;
  const aiFeatParam = aiFeaturesEnabled === undefined ? null : !!aiFeaturesEnabled;
  await db.query(
    `INSERT INTO plan_limits (subscription_product_id, max_properties, max_contacts, max_viewers, max_team_members, ai_token_monthly_quota, max_documents_per_system, ai_features_enabled, other_limits, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true), $9, NOW())
     ON CONFLICT (subscription_product_id) DO UPDATE SET
       max_properties = EXCLUDED.max_properties,
       max_contacts = EXCLUDED.max_contacts,
       max_viewers = EXCLUDED.max_viewers,
       max_team_members = EXCLUDED.max_team_members,
       ai_token_monthly_quota = EXCLUDED.ai_token_monthly_quota,
       max_documents_per_system = EXCLUDED.max_documents_per_system,
       ai_features_enabled = COALESCE(EXCLUDED.ai_features_enabled, plan_limits.ai_features_enabled),
       other_limits = EXCLUDED.other_limits,
       updated_at = NOW()`,
    [
      productId,
      maxProperties ?? 1,
      maxContacts ?? 25,
      maxViewers ?? 2,
      maxTeamMembers ?? 5,
      aiTokenMonthlyQuota ?? 50000,
      maxDocumentsPerSystem ?? 5,
      aiFeatParam,
      otherLimits ? JSON.stringify(otherLimits) : "{}",
    ]
  );
  return getPlanById(productId);
}

/** Update plan features (Super Admin). Validates array shape. */
async function updatePlanFeatures(productId, features) {
  if (!Array.isArray(features)) {
    throw new BadRequestError("features must be an array");
  }
  for (const f of features) {
    const id = f.id ?? f.label?.replace(/\s+/g, "-").toLowerCase() ?? `f-${Math.random().toString(36).slice(2, 9)}`;
    if (typeof f.label !== "string" || !f.label) {
      throw new BadRequestError("Each feature must have a string label");
    }
    if (typeof f.included !== "boolean") {
      throw new BadRequestError("Each feature must have a boolean included field");
    }
    f.id = typeof f.id === "string" && f.id ? f.id : id;
    if (f.description != null && typeof f.description !== "string") f.description = String(f.description);
  }
  await db.query(
    `UPDATE subscription_products SET features = $1, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(features), productId]
  );
  return getPlanById(productId);
}

/** Update plan price (Super Admin). Resolves Stripe price amount when possible. */
async function updatePlanPrice(productId, billingInterval, stripePriceId) {
  if (!stripePriceId) {
    await db.query(
      `DELETE FROM plan_prices WHERE subscription_product_id = $1 AND billing_interval = $2`,
      [productId, billingInterval]
    );
  } else {
    let unitAmount = null;
    let currency = "usd";
    try {
      const stripeService = require("../services/stripeService");
      if (stripeService.stripe) {
        const price = await stripeService.stripe.prices.retrieve(stripePriceId);
        unitAmount = price.unit_amount;
        currency = price.currency || "usd";
      }
    } catch (_) { /* Stripe unavailable; store ID only */ }

    await db.query(
      `INSERT INTO plan_prices (subscription_product_id, stripe_price_id, billing_interval, unit_amount, currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (subscription_product_id, billing_interval) DO UPDATE SET
         stripe_price_id = EXCLUDED.stripe_price_id,
         unit_amount = EXCLUDED.unit_amount,
         currency = EXCLUDED.currency`,
      [productId, stripePriceId, billingInterval, unitAmount, currency]
    );
  }
  return getPlanById(productId);
}

async function getPlanById(id) {
  const result = await db.query(
    `SELECT sp.id, sp.code, sp.name, sp.description, sp.target_role AS "targetRole",
            sp.price, sp.sort_order AS "sortOrder", sp.trial_days AS "trialDays",
            sp.is_active AS "isActive", sp.popular, sp.features
     FROM subscription_products sp WHERE sp.id = $1`,
    [id]
  );
  const plan = result.rows[0];
  if (!plan) throw new NotFoundError(`Plan not found: ${id}`);
  plan.features = plan.features || [];
  const limits = await db.query(
    `SELECT id, max_properties AS "maxProperties", max_contacts AS "maxContacts",
            max_viewers AS "maxViewers", max_team_members AS "maxTeamMembers",
            ai_token_monthly_quota AS "aiTokenMonthlyQuota",
            max_documents_per_system AS "maxDocumentsPerSystem",
            COALESCE(ai_features_enabled, true) AS "aiFeaturesEnabled",
            other_limits AS "otherLimits"
     FROM plan_limits WHERE subscription_product_id = $1`,
    [id]
  );
  plan.limits = limits.rows[0];
  const prices = await db.query(
    `SELECT id, billing_interval AS "billingInterval", stripe_price_id AS "stripePriceId",
            unit_amount AS "unitAmount", currency, COALESCE(is_active, true) AS "isActive"
     FROM plan_prices WHERE subscription_product_id = $1`,
    [id]
  );
  plan.prices = prices.rows;
  return plan;
}

/** Toggle is_active on a specific plan_prices row.
 *  - Requires a plan_prices row to already exist for the interval. Without one we have nothing
 *    to flip, and silently no-oping previously caused the parent plan to be deactivated by the
 *    cascade below (zero rows → anyActive=false). Force the caller to link a Stripe price first.
 *  - Cascade rule (when rows exist):
 *      • at least one interval active → parent stays / becomes active
 *      • all existing intervals inactive → parent becomes inactive
 *    If zero rows exist we never touch the parent's is_active flag. */
async function togglePriceActive(productId, billingInterval, isActive) {
  if (!["month", "year"].includes(billingInterval)) {
    throw new BadRequestError("billingInterval must be month or year");
  }

  const existing = await db.query(
    `SELECT id FROM plan_prices
     WHERE subscription_product_id = $1 AND billing_interval = $2`,
    [productId, billingInterval]
  );
  if (!existing.rows[0]) {
    const intervalLabel = billingInterval === "month" ? "monthly" : "yearly";
    throw new BadRequestError(
      `No Stripe ${intervalLabel} price linked to this plan yet — pick one in the Prices tab and save before toggling it on.`
    );
  }

  await db.query(
    `UPDATE plan_prices SET is_active = $1
     WHERE subscription_product_id = $2 AND billing_interval = $3`,
    [isActive, productId, billingInterval]
  );

  const remaining = await db.query(
    `SELECT billing_interval AS "billingInterval", COALESCE(is_active, true) AS "isActive"
     FROM plan_prices WHERE subscription_product_id = $1`,
    [productId]
  );
  if (remaining.rows.length > 0) {
    const anyActive = remaining.rows.some((r) => r.isActive === true);
    await db.query(
      `UPDATE subscription_products SET is_active = $1, updated_at = NOW() WHERE id = $2`,
      [anyActive, productId]
    );
  }

  return getPlanById(productId);
}

/** Set the parent subscription_product.is_active flag and cascade to all of its plan_prices rows.
 *  - Toggling Off:  product hidden everywhere, both monthly + yearly prices flipped to inactive.
 *  - Toggling On:   product visible again, any existing plan_prices rows flipped back to active.
 *  Use this for the global plan switch; per-interval toggling still goes through togglePriceActive. */
async function setPlanActive(productId, isActive) {
  const exists = await db.query(
    `SELECT id FROM subscription_products WHERE id = $1`,
    [productId]
  );
  if (!exists.rows[0]) throw new NotFoundError(`Plan not found: ${productId}`);
  await db.query(
    `UPDATE subscription_products SET is_active = $1, updated_at = NOW() WHERE id = $2`,
    [isActive, productId]
  );
  await db.query(
    `UPDATE plan_prices SET is_active = $1 WHERE subscription_product_id = $2`,
    [isActive, productId]
  );
  return getPlanById(productId);
}

module.exports = {
  getPlansForAudience,
  getByCode,
  getAll,
  updatePlan,
  dedupePopularPerRole,
  setPopular,
  updatePlanLimits,
  updatePlanFeatures,
  updatePlanPrice,
  togglePriceActive,
  setPlanActive,
  getPlanById,
};
