"use strict";

/**
 * SubscriptionProduct Model
 *
 * Manages subscription plan definitions in the `subscription_products` table.
 * Defines pricing, limits (properties, contacts, etc.), and Stripe integration.
 *
 * Key operations:
 * - create / get / getAll / getByName: CRUD for products
 * - getByRole: Fetch active products for a target role (homeowner, agent)
 * - initializeDefaultProducts: Seed from data/plans.json (fallback when planSeedService fails)
 */

const db = require("../db");
const { NotFoundError, BadRequestError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");
const { loadPlans } = require("../services/planSeedService");

function isMissingColumnError(err, columnName) {
  if (!err || err.code !== "42703") return false;
  if (!columnName) return true;
  return String(err.message || "").toLowerCase().includes(String(columnName).toLowerCase());
}

async function upsertPlanLimits(productId, limits) {
  const {
    maxProperties, maxContacts, maxViewers, maxTeamMembers,
    aiTokenMonthlyQuota, aiTokenMonthlyValueUsd, aiTokenPriceUsd, maxDocumentsPerSystem,
    aiFeaturesEnabled,
  } = limits || {};
  const valueUsd = aiTokenMonthlyValueUsd != null && aiTokenMonthlyValueUsd !== "" ? Number(aiTokenMonthlyValueUsd) : null;
  const priceUsd = aiTokenPriceUsd != null && aiTokenPriceUsd !== "" ? Number(aiTokenPriceUsd) : null;
  const aiFeatParam = aiFeaturesEnabled === undefined ? null : !!aiFeaturesEnabled;
  try {
    await db.query(
      `INSERT INTO plan_limits (subscription_product_id, max_properties, max_contacts, max_viewers, max_team_members, ai_token_monthly_quota, ai_token_monthly_value_usd, ai_token_price_usd, max_documents_per_system, ai_features_enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, true), NOW())
       ON CONFLICT (subscription_product_id) DO UPDATE SET
         max_properties = COALESCE(EXCLUDED.max_properties, plan_limits.max_properties),
         max_contacts = COALESCE(EXCLUDED.max_contacts, plan_limits.max_contacts),
         max_viewers = COALESCE(EXCLUDED.max_viewers, plan_limits.max_viewers),
         max_team_members = COALESCE(EXCLUDED.max_team_members, plan_limits.max_team_members),
         ai_token_monthly_quota = COALESCE(EXCLUDED.ai_token_monthly_quota, plan_limits.ai_token_monthly_quota),
         ai_token_monthly_value_usd = COALESCE(EXCLUDED.ai_token_monthly_value_usd, plan_limits.ai_token_monthly_value_usd),
         ai_token_price_usd = COALESCE(EXCLUDED.ai_token_price_usd, plan_limits.ai_token_price_usd),
         max_documents_per_system = COALESCE(EXCLUDED.max_documents_per_system, plan_limits.max_documents_per_system),
         ai_features_enabled = COALESCE(EXCLUDED.ai_features_enabled, plan_limits.ai_features_enabled),
         updated_at = NOW()`,
      [productId, maxProperties ?? 1, maxContacts ?? 25, maxViewers ?? 2, maxTeamMembers ?? 5, aiTokenMonthlyQuota ?? 50000, valueUsd, priceUsd, maxDocumentsPerSystem ?? 5, aiFeatParam]
    );
  } catch (err) {
    if (!isMissingColumnError(err, "ai_features_enabled")) throw err;
    await db.query(
      `INSERT INTO plan_limits (subscription_product_id, max_properties, max_contacts, max_viewers, max_team_members, ai_token_monthly_quota, ai_token_monthly_value_usd, ai_token_price_usd, max_documents_per_system, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (subscription_product_id) DO UPDATE SET
         max_properties = COALESCE(EXCLUDED.max_properties, plan_limits.max_properties),
         max_contacts = COALESCE(EXCLUDED.max_contacts, plan_limits.max_contacts),
         max_viewers = COALESCE(EXCLUDED.max_viewers, plan_limits.max_viewers),
         max_team_members = COALESCE(EXCLUDED.max_team_members, plan_limits.max_team_members),
         ai_token_monthly_quota = COALESCE(EXCLUDED.ai_token_monthly_quota, plan_limits.ai_token_monthly_quota),
         ai_token_monthly_value_usd = COALESCE(EXCLUDED.ai_token_monthly_value_usd, plan_limits.ai_token_monthly_value_usd),
         ai_token_price_usd = COALESCE(EXCLUDED.ai_token_price_usd, plan_limits.ai_token_price_usd),
         max_documents_per_system = COALESCE(EXCLUDED.max_documents_per_system, plan_limits.max_documents_per_system),
         updated_at = NOW()`,
      [productId, maxProperties ?? 1, maxContacts ?? 25, maxViewers ?? 2, maxTeamMembers ?? 5, aiTokenMonthlyQuota ?? 50000, valueUsd, priceUsd, maxDocumentsPerSystem ?? 5]
    );
  }
}

async function upsertPlanPrice(productId, billingInterval, stripePriceId) {
  const normalizedPriceId = typeof stripePriceId === "string" ? stripePriceId.trim() : stripePriceId;

  if (!normalizedPriceId) {
    await db.query(
      `DELETE FROM plan_prices WHERE subscription_product_id = $1 AND billing_interval = $2`,
      [productId, billingInterval]
    );
    return;
  }

  const existing = await db.query(
    `SELECT subscription_product_id AS "productId", billing_interval AS "billingInterval"
     FROM plan_prices WHERE stripe_price_id = $1`,
    [normalizedPriceId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (row.productId === productId && row.billingInterval === billingInterval) {
      return;
    }
    const conflictInfo = await db.query(
      `SELECT sp.name FROM subscription_products sp WHERE sp.id = $1`, [row.productId]
    );
    const planName = conflictInfo.rows[0]?.name || `plan #${row.productId}`;
    throw new BadRequestError(
      `Stripe price ${normalizedPriceId} is already linked to "${planName}" (${row.billingInterval}).`
    );
  }

  let unitAmount = null;
  let currency = "usd";
  try {
    const stripeService = require("../services/stripeService");
    if (stripeService.stripe) {
      const price = await stripeService.stripe.prices.retrieve(normalizedPriceId);
      unitAmount = price.unit_amount;
      currency = price.currency || "usd";
    }
  } catch (_) { /* Stripe unavailable; store ID only, will resolve on read */ }

  await db.query(
    `INSERT INTO plan_prices (subscription_product_id, stripe_price_id, billing_interval, unit_amount, currency)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (subscription_product_id, billing_interval) DO UPDATE SET
       stripe_price_id = EXCLUDED.stripe_price_id,
       unit_amount = EXCLUDED.unit_amount,
       currency = EXCLUDED.currency`,
    [productId, normalizedPriceId, billingInterval, unitAmount, currency]
  );

  /* Keep subscription_products.price aligned with Stripe for list/sort; Products & Plans is the source of truth. */
  if (billingInterval === "month" && unitAmount != null) {
    await db.query(
      `UPDATE subscription_products SET price = $1::numeric / 100, updated_at = NOW() WHERE id = $2`,
      [unitAmount, productId]
    );
  }
}

async function getLimitsForProduct(productId) {
  try {
    const limRes = await db.query(
      `SELECT max_properties AS "maxProperties", max_contacts AS "maxContacts", max_viewers AS "maxViewers",
              max_team_members AS "maxTeamMembers", ai_token_monthly_quota AS "aiTokenMonthlyQuota",
              ai_token_monthly_value_usd AS "aiTokenMonthlyValueUsd",
              ai_token_price_usd AS "aiTokenPriceUsd",
              max_documents_per_system AS "maxDocumentsPerSystem",
              COALESCE(ai_features_enabled, true) AS "aiFeaturesEnabled"
       FROM plan_limits WHERE subscription_product_id = $1`,
      [productId]
    );
    return limRes.rows[0] || null;
  } catch (err) {
    if (!isMissingColumnError(err, "ai_features_enabled")) throw err;
    const limRes = await db.query(
      `SELECT max_properties AS "maxProperties", max_contacts AS "maxContacts", max_viewers AS "maxViewers",
              max_team_members AS "maxTeamMembers", ai_token_monthly_quota AS "aiTokenMonthlyQuota",
              ai_token_monthly_value_usd AS "aiTokenMonthlyValueUsd",
              ai_token_price_usd AS "aiTokenPriceUsd",
              max_documents_per_system AS "maxDocumentsPerSystem"
       FROM plan_limits WHERE subscription_product_id = $1`,
      [productId]
    );
    if (!limRes.rows[0]) return null;
    return { ...limRes.rows[0], aiFeaturesEnabled: true };
  }
}

const PRODUCT_COLUMNS_BASE = `id, name, description, target_role AS "targetRole",
  stripe_product_id AS "stripeProductId", stripe_price_id AS "stripePriceId",
  price, billing_interval AS "billingInterval",
  max_properties AS "maxProperties", max_contacts AS "maxContacts",
  max_viewers AS "maxViewers", max_team_members AS "maxTeamMembers",
  is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

const PRODUCT_COLUMNS_FULL = `${PRODUCT_COLUMNS_BASE},
  code, sort_order AS "sortOrder", trial_days AS "trialDays", popular, features`;

let _hasBillingColumns = null;
async function hasBillingColumns() {
  if (_hasBillingColumns !== null) return _hasBillingColumns;
  try {
    await db.query(`SELECT code FROM subscription_products LIMIT 0`);
    _hasBillingColumns = true;
  } catch {
    _hasBillingColumns = false;
  }
  return _hasBillingColumns;
}

async function getProductColumns() {
  await hasBillingColumns();
  return _hasBillingColumns ? PRODUCT_COLUMNS_FULL : PRODUCT_COLUMNS_BASE;
}

class SubscriptionProduct {
  static async create({ name, description, targetRole, price, billingInterval,
    maxProperties, maxContacts, maxViewers, maxTeamMembers,
    stripeProductId, stripePriceId, code, sortOrder, trialDays,
    aiTokenMonthlyQuota, aiTokenMonthlyValueUsd, aiTokenPriceUsd, maxDocumentsPerSystem,
    aiFeaturesEnabled,
    stripePriceIdMonth, stripePriceIdYear, prices, features }) {
    if (!name) throw new BadRequestError("Name is required.");
    if (!targetRole) throw new BadRequestError("Target role is required.");

    const hasBilling = await hasBillingColumns();
    if (hasBilling && code) {
      const codeCheck = await db.query(
        `SELECT id FROM subscription_products WHERE code = $1`,
        [code]
      );
      if (codeCheck.rows.length > 0) {
        throw new BadRequestError(`Product with code "${code}" already exists.`);
      }
    }

    const cols = await getProductColumns();
    const monthPriceId = prices?.month || stripePriceIdMonth || null;
    const yearPriceId = prices?.year || stripePriceIdYear || null;
    const legacyStripePriceId = stripePriceId || monthPriceId || yearPriceId || null;
    let result;
    if (hasBilling) {
      result = await db.query(
        `INSERT INTO subscription_products
          (name, description, target_role, price, billing_interval,
           max_properties, max_contacts, max_viewers, max_team_members,
           stripe_product_id, stripe_price_id, code, sort_order, trial_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING ${cols}`,
        [name, description || null, targetRole, price ?? 0, billingInterval || 'month',
         maxProperties ?? 1, maxContacts ?? 25, maxViewers ?? 2, maxTeamMembers ?? 5,
         stripeProductId || null, legacyStripePriceId,
         code || null, sortOrder ?? 0, trialDays ?? null]
      );
    } else {
      result = await db.query(
        `INSERT INTO subscription_products
          (name, description, target_role, price, billing_interval,
           max_properties, max_contacts, max_viewers, max_team_members,
           stripe_product_id, stripe_price_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING ${cols}`,
        [name, description || null, targetRole, price ?? 0, billingInterval || 'month',
         maxProperties ?? 1, maxContacts ?? 25, maxViewers ?? 2, maxTeamMembers ?? 5,
         stripeProductId || null, legacyStripePriceId]
      );
    }
    const product = result.rows[0];
    try {
      await upsertPlanLimits(product.id, {
        maxProperties, maxContacts, maxViewers, maxTeamMembers,
        aiTokenMonthlyQuota, aiTokenMonthlyValueUsd, aiTokenPriceUsd, maxDocumentsPerSystem,
        aiFeaturesEnabled,
      });
    } catch (e) {
      console.warn("[SubscriptionProduct.create] Could not upsert plan limits:", e.message);
    }
    await upsertPlanPrice(product.id, "month", monthPriceId);
    await upsertPlanPrice(product.id, "year", yearPriceId);
    if (Array.isArray(features) && hasBilling) {
      try {
        await db.query(
          `UPDATE subscription_products SET features = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(features), product.id]
        );
      } catch (e) {
        console.warn("[SubscriptionProduct.create] Could not save features:", e.message);
      }
    }
    return SubscriptionProduct.get(product.id);
  }

  static async get(id) {
    const cols = await getProductColumns();
    const result = await db.query(
      `SELECT ${cols} FROM subscription_products WHERE id = $1`,
      [id]
    );
    const product = result.rows[0];
    if (!product) throw new NotFoundError(`No product with id: ${id}`);
    product.features = product.features || [];
    try {
      product.limits = await getLimitsForProduct(id);
    } catch {
      product.limits = null;
    }
    try {
      const priceRes = await db.query(
        `SELECT billing_interval AS "billingInterval", stripe_price_id AS "stripePriceId",
                COALESCE(is_active, true) AS "isActive"
         FROM plan_prices WHERE subscription_product_id = $1`,
        [id]
      );
      product.prices = priceRes.rows || [];
    } catch {
      product.prices = [];
    }
    return product;
  }

  static async getAll() {
    const cols = await getProductColumns();
    const result = await db.query(
      `SELECT ${cols} FROM subscription_products ORDER BY name ASC`
    );
    const products = result.rows;
    let pricesByProduct = {};
    let limitsByProduct = {};
    try {
      const priceRes = await db.query(
        `SELECT subscription_product_id AS "subscriptionProductId", billing_interval AS "billingInterval",
                stripe_price_id AS "stripePriceId", unit_amount AS "unitAmount", currency,
                COALESCE(is_active, true) AS "isActive"
         FROM plan_prices ORDER BY subscription_product_id, billing_interval`
      );
      for (const row of priceRes.rows) {
        const pid = row.subscriptionProductId;
        if (!pricesByProduct[pid]) pricesByProduct[pid] = [];
        pricesByProduct[pid].push({ billingInterval: row.billingInterval, stripePriceId: row.stripePriceId, unitAmount: row.unitAmount, currency: row.currency, isActive: row.isActive });
      }
    } catch (e) {
      pricesByProduct = {};
    }
    try {
      const limitsRes = await db.query(
        `SELECT subscription_product_id AS "subscriptionProductId", max_properties AS "maxProperties", max_contacts AS "maxContacts",
                ai_token_monthly_quota AS "aiTokenMonthlyQuota"
         FROM plan_limits`
      );
      for (const row of limitsRes.rows) {
        limitsByProduct[row.subscriptionProductId] = {
          maxProperties: row.maxProperties,
          maxContacts: row.maxContacts,
          aiTokenMonthlyQuota: row.aiTokenMonthlyQuota,
        };
      }
    } catch (e) {
      limitsByProduct = {};
    }
    for (const p of products) {
      p.prices = pricesByProduct[p.id] || [];
      p.limits = limitsByProduct[p.id] || null;
    }
    return products;
  }

  static async getByName(name) {
    const cols = await getProductColumns();
    const result = await db.query(
      `SELECT ${cols} FROM subscription_products WHERE LOWER(name) = LOWER($1)`,
      [name]
    );
    return result.rows[0] || null;
  }

  /** Get active products for a target role (e.g. homeowner, agent). Includes plan_prices for display. */
  static async getByRole(role) {
    const cols = await getProductColumns();
    const result = await db.query(
      `SELECT ${cols} FROM subscription_products
       WHERE target_role = $1 AND (is_active IS NULL OR is_active = true)
       ORDER BY price ASC`,
      [role]
    );
    const products = result.rows;
    if (products.length === 0) return products;
    try {
      const priceRes = await db.query(
        `SELECT subscription_product_id AS "subscriptionProductId", billing_interval AS "billingInterval",
                stripe_price_id AS "stripePriceId", unit_amount AS "unitAmount", currency,
                COALESCE(is_active, true) AS "isActive"
         FROM plan_prices WHERE subscription_product_id = ANY($1::int[])`,
        [products.map((p) => p.id)]
      );
      const pricesByProduct = {};
      for (const row of priceRes.rows) {
        if (row.isActive === false) continue;
        const pid = row.subscriptionProductId;
        if (!pricesByProduct[pid]) pricesByProduct[pid] = [];
        let unitAmount = row.unitAmount;
        let currency = row.currency || "usd";
        if (row.stripePriceId) {
          try {
            const stripeService = require("../services/stripeService");
            if (stripeService.stripe) {
              const price = await stripeService.stripe.prices.retrieve(row.stripePriceId);
              const freshAmount = price.unit_amount;
              const freshCurrency = price.currency || "usd";
              if (freshAmount !== unitAmount || freshCurrency !== currency) {
                unitAmount = freshAmount;
                currency = freshCurrency;
                await db.query(
                  `UPDATE plan_prices SET unit_amount = $1, currency = $2
                   WHERE subscription_product_id = $3 AND billing_interval = $4`,
                  [unitAmount, currency, pid, row.billingInterval]
                );
              }
            }
          } catch (_) { /* Stripe unavailable — use cached value */ }
        }
        pricesByProduct[pid].push({
          billingInterval: row.billingInterval,
          stripePriceId: row.stripePriceId,
          unitAmount,
          currency,
        });
      }
      for (const p of products) {
        p.prices = pricesByProduct[p.id] || [];
      }
    } catch (e) {
      for (const p of products) {
        p.prices = [];
      }
    }
    try {
      const limitsRes = await db.query(
        `SELECT subscription_product_id AS "subscriptionProductId", max_properties AS "maxProperties",
                max_contacts AS "maxContacts", ai_token_monthly_quota AS "aiTokenMonthlyQuota",
                max_documents_per_system AS "maxDocumentsPerSystem",
                COALESCE(ai_features_enabled, true) AS "aiFeaturesEnabled"
         FROM plan_limits
         WHERE subscription_product_id = ANY($1::int[])`,
        [products.map((p) => p.id)]
      );
      const limitsByProduct = {};
      for (const row of limitsRes.rows) {
        limitsByProduct[row.subscriptionProductId] = {
          maxProperties: row.maxProperties,
          maxContacts: row.maxContacts,
          aiTokenMonthlyQuota: row.aiTokenMonthlyQuota,
          maxDocumentsPerSystem: row.maxDocumentsPerSystem,
          aiFeaturesEnabled: row.aiFeaturesEnabled,
        };
      }
      for (const p of products) {
        p.limits = limitsByProduct[p.id] || null;
      }
    } catch (e) {
      for (const p of products) {
        p.limits = null;
      }
    }
    return products;
  }

  static async update(id, data) {
    const { limits, prices, features, ...productData } = data;
    const hasBilling = await hasBillingColumns();
    const monthPriceFromBody = prices?.month ?? data?.stripePriceIdMonth;
    const yearPriceFromBody = prices?.year ?? data?.stripePriceIdYear;

    if (productData.code != null && productData.code !== "") {
      const codeCheck = await db.query(
        `SELECT id FROM subscription_products WHERE code = $1 AND id != $2`,
        [productData.code, id]
      );
      if (codeCheck.rows.length > 0) {
        throw new BadRequestError(`Product with code "${productData.code}" already exists. Use a unique code (e.g. maintain-agent, maintain-homeowner).`);
      }
    }

    if (productData.targetRole !== undefined) {
      const cur = await db.query(
        `SELECT target_role AS "targetRole", popular FROM subscription_products WHERE id = $1`,
        [id]
      );
      const row = cur.rows[0];
      if (row && row.targetRole !== productData.targetRole && row.popular) {
        await db.query(
          `UPDATE subscription_products SET popular = false, updated_at = NOW() WHERE id = $1`,
          [id]
        );
      }
    }

    const jsToSql = {
      name: "name",
      description: "description",
      targetRole: "target_role",
      price: "price",
      billingInterval: "billing_interval",
      maxProperties: "max_properties",
      maxContacts: "max_contacts",
      maxViewers: "max_viewers",
      maxTeamMembers: "max_team_members",
      stripeProductId: "stripe_product_id",
      stripePriceId: "stripe_price_id",
      ...(hasBilling && { code: "code", sortOrder: "sort_order", trialDays: "trial_days" }),
      isActive: "is_active",
    };
    const { setCols, values } = sqlForPartialUpdate(productData, jsToSql);
    if (setCols) {
      try {
        const idVarIdx = "$" + (values.length + 1);
        await db.query(
          `UPDATE subscription_products SET ${setCols}, updated_at = NOW() WHERE id = ${idVarIdx}`,
          [...values, id]
        );
      } catch (e) {
        if (e.code === "23505" && e.constraint === "subscription_products_code_key") {
          throw new BadRequestError(`Product with code "${productData.code}" already exists. Use a unique code (e.g. maintain-agent, maintain-homeowner).`);
        }
        throw e;
      }
    }
    if (limits) {
      try {
        await upsertPlanLimits(id, limits);
      } catch (e) {
        console.warn("[SubscriptionProduct.update] Could not upsert plan limits:", e.message);
      }
    }
    const shouldUpdateMonthPrice = Object.prototype.hasOwnProperty.call(prices || {}, "month")
      || Object.prototype.hasOwnProperty.call(data || {}, "stripePriceIdMonth");
    const shouldUpdateYearPrice = Object.prototype.hasOwnProperty.call(prices || {}, "year")
      || Object.prototype.hasOwnProperty.call(data || {}, "stripePriceIdYear");

    if (shouldUpdateMonthPrice) {
      await upsertPlanPrice(id, "month", monthPriceFromBody ?? null);
    }
    if (shouldUpdateYearPrice) {
      await upsertPlanPrice(id, "year", yearPriceFromBody ?? null);
    }
    if (Array.isArray(features) && hasBilling) {
      try {
        await db.query(
          `UPDATE subscription_products SET features = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(features), id]
        );
      } catch (e) {
        console.warn("[SubscriptionProduct.update] Could not save features:", e.message);
      }
    }
    return SubscriptionProduct.get(id);
  }

  static async remove(id) {
    const usageCheck = await db.query(
      `SELECT COUNT(*)::int AS count FROM account_subscriptions WHERE subscription_product_id = $1`,
      [id]
    );
    if (usageCheck.rows[0].count > 0) {
      throw new BadRequestError(
        `Cannot delete: ${usageCheck.rows[0].count} subscription(s) reference this product.`
      );
    }
    const result = await db.query(
      `DELETE FROM subscription_products WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`No product with id: ${id}`);
    return { deleted: id };
  }

  static async initializeDefaultProducts() {
    const plans = loadPlans();
    if (plans.length === 0) {
      console.warn("[initializeDefaultProducts] No plans in plans.json, skipping.");
      return this.getAll();
    }
    try {
      const existing = await this.getAll();
      if (existing.length > 0) {
        console.log(`Subscription products already exist (${existing.length}). Skipping seed.`);
        return existing;
      }
      const created = [];
      for (const plan of plans) {
        const limits = plan.limits || {};
        const product = await this.create({
          name: plan.name,
          description: plan.description || `${plan.name} plan`,
          targetRole: plan.targetRole,
          price: plan.price ?? 0,
          code: plan.code,
          sortOrder: plan.sortOrder ?? 99,
          trialDays: plan.trialDays,
          maxProperties: limits.maxProperties ?? 1,
          maxContacts: limits.maxContacts ?? 25,
          maxViewers: limits.maxViewers ?? 2,
          maxTeamMembers: limits.maxTeamMembers ?? 5,
          aiTokenMonthlyQuota: limits.aiTokenMonthlyQuota,
        });
        created.push(product);
      }
      console.log(`Default products created from plans.json: ${created.map(p => p.name).join(", ")}`);
      return created;
    } catch (err) {
      console.error("Error initializing default products:", err.message);
      throw err;
    }
  }
}

module.exports = SubscriptionProduct;
