"use strict";

/**
 * Plan Seed Service
 *
 * On a completely empty `subscription_products` table, inserts every plan from data/plans.json
 * (including the free tier `homeowner_free` if present there).
 *
 * Once any product exists, startup does **not** overwrite catalog fields from plans.json
 * (Super Admin is source of truth). New codes are inserted only when `subscription_products`
 * is still empty. Products you delete in the admin UI are not re-created on restart.
 *
 * Price IDs: STRIPE_PRICE_IDS env (JSON) or Super Admin UI. No hardcoded price IDs in code.
 */

const fs = require("fs");
const path = require("path");
const db = require("../db");

const PLANS_PATH = path.join(__dirname, "..", "data", "plans.json");

function loadPlans() {
  try {
    const raw = fs.readFileSync(PLANS_PATH, "utf8");
    const data = JSON.parse(raw);
    return data.plans || [];
  } catch (err) {
    console.warn("[planSeed] Could not load plans.json:", err.message);
    return [];
  }
}

function parsePriceIdsEnv() {
  try {
    const raw = process.env.STRIPE_PRICE_IDS;
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Upsert plans from plans.json; optionally apply Stripe price IDs from env. */
async function ensureStripePlans() {
  const plans = loadPlans();
  if (plans.length === 0) return;

  const priceIds = parsePriceIdsEnv();

  const { rows: countRows } = await db.query(
    `SELECT COUNT(*)::int AS c FROM subscription_products`
  );
  const allowInsertNewCodes = countRows[0].c === 0;

  for (const plan of plans) {
    const {
      code,
      name,
      description,
      targetRole,
      price,
      priceYear,
      sortOrder,
      trialDays,
      popular,
      limits,
      features,
    } = plan;

    const featuresJson = features ? JSON.stringify(features) : "[]";

    const existing = await db.query(
      `SELECT id FROM subscription_products WHERE code = $1`,
      [code]
    );

    let productId;
    if (existing.rows.length > 0) {
      productId = existing.rows[0].id;
      /* Do not UPDATE subscription_products from plans.json for existing rows.
         Super Admin (Subscriptions → Products & Plans) is the source of truth for
         name, description, role, sort order, trial days, and legacy limit columns.
         Previously every server start reset those fields from JSON, so plan picker
         UIs kept showing stale copy from data/plans.json. */
    } else if (allowInsertNewCodes) {
      const ins = await db.query(
        `INSERT INTO subscription_products
          (name, description, target_role, price, billing_interval, code, sort_order, trial_days,
           max_properties, max_contacts, max_viewers, max_team_members, features, popular, is_active)
         VALUES ($1, $2, $3, $4, 'month', $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
         RETURNING id`,
        [
          name,
          description || `${name} plan for ${targetRole}s`,
          targetRole,
          price ?? 0,
          code,
          sortOrder ?? 99,
          trialDays,
          limits?.maxProperties ?? 1,
          limits?.maxContacts ?? 25,
          limits?.maxViewers ?? 2,
          limits?.maxTeamMembers ?? 5,
          featuresJson,
          popular ?? false,
        ]
      );
      productId = ins.rows[0].id;
    } else {
      console.log(
        `[planSeed] Skipping insert for code=${code}: catalog already has products; deleted tiers stay removed. Add via admin or empty subscription_products to bootstrap from plans.json.`
      );
      continue;
    }

    const aiFeatSeed = limits?.aiFeaturesEnabled === undefined ? null : !!limits.aiFeaturesEnabled;
    await db.query(
      `INSERT INTO plan_limits
        (subscription_product_id, max_properties, max_contacts, max_viewers, max_team_members, ai_token_monthly_quota, max_documents_per_system, ai_features_enabled, other_limits, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, true), $9, NOW())
       ON CONFLICT (subscription_product_id) DO NOTHING`,
      [
        productId,
        limits?.maxProperties ?? 1,
        limits?.maxContacts ?? 25,
        limits?.maxViewers ?? 2,
        limits?.maxTeamMembers ?? 5,
        limits?.aiTokenMonthlyQuota ?? 50000,
        limits?.maxDocumentsPerSystem ?? 5,
        aiFeatSeed,
        limits?.otherLimits ? JSON.stringify(limits.otherLimits) : "{}",
      ]
    );

    if (price > 0) {
      const priceKeyMonth = `${code}_month`;
      const priceKeyYear = `${code}_year`;
      const stripeMonth = priceIds[priceKeyMonth] || null;
      const stripeYear = priceYear != null ? (priceIds[priceKeyYear] || null) : null;

      if (stripeMonth) {
        await db.query(
          `INSERT INTO plan_prices (subscription_product_id, stripe_price_id, billing_interval)
           VALUES ($1, $2, 'month')
           ON CONFLICT (subscription_product_id, billing_interval) DO UPDATE SET stripe_price_id = EXCLUDED.stripe_price_id`,
          [productId, stripeMonth]
        );
      }
      if (stripeYear) {
        await db.query(
          `INSERT INTO plan_prices (subscription_product_id, stripe_price_id, billing_interval)
           VALUES ($1, $2, 'year')
           ON CONFLICT (subscription_product_id, billing_interval) DO UPDATE SET stripe_price_id = EXCLUDED.stripe_price_id`,
          [productId, stripeYear]
        );
      }
    }
  }

  console.log(
    `[planSeed] Synced plans from plans.json (${plans.length} entries; new inserts only when subscription_products was empty)`
  );
}

module.exports = { ensureStripePlans, loadPlans };
