"use strict";

/**
 * Plan Seed Service
 *
 * On a completely empty `subscription_products` table, inserts every plan from data/plans.json
 * (including the free tier `homeowner_free` if present there).
 *
 * Once any product exists, startup only **updates** rows whose `code` matches plans.json.
 * Products you delete in the admin UI are not re-created on restart. To add tiers from JSON
 * to an existing database, use the admin UI or run the seed script with a one-time empty DB.
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
      // Update product fields but preserve admin-edited values (features, popular, is_active).
      // Do not overwrite `price`: dollar amounts come from Super Admin → Stripe (`plan_prices`) or upsertPlanPrice sync, not data/plans.json.
      await db.query(
        `UPDATE subscription_products
         SET name = $1, description = $2, target_role = $3, sort_order = $4,
             trial_days = $5, max_properties = $6, max_contacts = $7, max_viewers = $8, max_team_members = $9,
             updated_at = NOW()
         WHERE id = $10`,
        [
          name,
          description || `${name} plan for ${targetRole}s`,
          targetRole,
          sortOrder ?? 99,
          trialDays,
          limits?.maxProperties ?? 1,
          limits?.maxContacts ?? 25,
          limits?.maxViewers ?? 2,
          limits?.maxTeamMembers ?? 5,
          productId,
        ]
      );
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
