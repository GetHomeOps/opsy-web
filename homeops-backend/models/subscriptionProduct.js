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

async function upsertPlanLimits(productId, limits) {
  const { maxProperties, maxContacts, maxViewers, maxTeamMembers, aiTokenMonthlyQuota, aiTokenMonthlyValueUsd, aiTokenPriceUsd, maxDocumentsPerSystem } = limits || {};
  const valueUsd = aiTokenMonthlyValueUsd != null && aiTokenMonthlyValueUsd !== "" ? Number(aiTokenMonthlyValueUsd) : null;
  const priceUsd = aiTokenPriceUsd != null && aiTokenPriceUsd !== "" ? Number(aiTokenPriceUsd) : null;
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

async function upsertPlanPrice(productId, billingInterval, stripePriceId) {
  if (!stripePriceId) return;
  await db.query(
    `INSERT INTO plan_prices (subscription_product_id, stripe_price_id, billing_interval)
     VALUES ($1, $2, $3)
     ON CONFLICT (subscription_product_id, billing_interval) DO UPDATE SET stripe_price_id = EXCLUDED.stripe_price_id`,
    [productId, stripePriceId, billingInterval]
  );
}

const PRODUCT_COLUMNS_BASE = `id, name, description, target_role AS "targetRole",
  stripe_product_id AS "stripeProductId", stripe_price_id AS "stripePriceId",
  price, billing_interval AS "billingInterval",
  max_properties AS "maxProperties", max_contacts AS "maxContacts",
  max_viewers AS "maxViewers", max_team_members AS "maxTeamMembers",
  is_active AS "isActive",
  created_at AS "createdAt", updated_at AS "updatedAt"`;

const PRODUCT_COLUMNS_FULL = `${PRODUCT_COLUMNS_BASE},
  code, sort_order AS "sortOrder", trial_days AS "trialDays", features`;

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
      await upsertPlanLimits(product.id, { maxProperties, maxContacts, maxViewers, maxTeamMembers, aiTokenMonthlyQuota, aiTokenMonthlyValueUsd, aiTokenPriceUsd, maxDocumentsPerSystem });
      if (monthPriceId) await upsertPlanPrice(product.id, 'month', monthPriceId);
      if (yearPriceId) await upsertPlanPrice(product.id, 'year', yearPriceId);
      if (Array.isArray(features) && hasBilling) {
        await db.query(
          `UPDATE subscription_products SET features = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(features), product.id]
        );
      }
    } catch (e) { /* plan_limits/plan_prices may not exist */ }
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
      const [limRes, priceRes] = await Promise.all([
        db.query(`SELECT max_properties AS "maxProperties", max_contacts AS "maxContacts", max_viewers AS "maxViewers",
                  max_team_members AS "maxTeamMembers", ai_token_monthly_quota AS "aiTokenMonthlyQuota",
                  ai_token_monthly_value_usd AS "aiTokenMonthlyValueUsd",
                  ai_token_price_usd AS "aiTokenPriceUsd",
                  max_documents_per_system AS "maxDocumentsPerSystem"
                  FROM plan_limits WHERE subscription_product_id = $1`, [id]),
        db.query(`SELECT billing_interval AS "billingInterval", stripe_price_id AS "stripePriceId"
                  FROM plan_prices WHERE subscription_product_id = $1`, [id]),
      ]);
      product.limits = limRes.rows[0] || null;
      product.prices = priceRes.rows || [];
    } catch {
      product.limits = null;
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
    try {
      const [priceRes, limitsRes] = await Promise.all([
        db.query(
          `SELECT subscription_product_id AS "subscriptionProductId", billing_interval AS "billingInterval", stripe_price_id AS "stripePriceId", unit_amount AS "unitAmount", currency
           FROM plan_prices ORDER BY subscription_product_id, billing_interval`
        ),
        db.query(
          `SELECT subscription_product_id AS "subscriptionProductId", max_properties AS "maxProperties", max_contacts AS "maxContacts",
                  ai_token_monthly_quota AS "aiTokenMonthlyQuota"
           FROM plan_limits`
        ),
      ]);
      const pricesByProduct = {};
      for (const row of priceRes.rows) {
        const pid = row.subscriptionProductId;
        if (!pricesByProduct[pid]) pricesByProduct[pid] = [];
        pricesByProduct[pid].push({ billingInterval: row.billingInterval, stripePriceId: row.stripePriceId, unitAmount: row.unitAmount, currency: row.currency });
      }
      const limitsByProduct = {};
      for (const row of limitsRes.rows) {
        limitsByProduct[row.subscriptionProductId] = {
          maxProperties: row.maxProperties,
          maxContacts: row.maxContacts,
          aiTokenMonthlyQuota: row.aiTokenMonthlyQuota,
        };
      }
      for (const p of products) {
        p.prices = pricesByProduct[p.id] || [];
        p.limits = limitsByProduct[p.id] || null;
      }
    } catch (e) {
      for (const p of products) {
        p.prices = [];
        p.limits = null;
      }
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
                stripe_price_id AS "stripePriceId", unit_amount AS "unitAmount", currency
         FROM plan_prices WHERE subscription_product_id = ANY($1::int[])`,
        [products.map((p) => p.id)]
      );
      const pricesByProduct = {};
      for (const row of priceRes.rows) {
        const pid = row.subscriptionProductId;
        if (!pricesByProduct[pid]) pricesByProduct[pid] = [];
        let unitAmount = row.unitAmount;
        let currency = row.currency || "usd";
        if (unitAmount == null && row.stripePriceId) {
          try {
            const stripeService = require("../services/stripeService");
            if (stripeService.stripe) {
              const price = await stripeService.stripe.prices.retrieve(row.stripePriceId);
              unitAmount = price.unit_amount;
              currency = price.currency || "usd";
            }
          } catch (_) { /* Stripe unavailable */ }
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
                max_contacts AS "maxContacts", ai_token_monthly_quota AS "aiTokenMonthlyQuota" FROM plan_limits
         WHERE subscription_product_id = ANY($1::int[])`,
        [products.map((p) => p.id)]
      );
      const limitsByProduct = {};
      for (const row of limitsRes.rows) {
        limitsByProduct[row.subscriptionProductId] = {
          maxProperties: row.maxProperties,
          maxContacts: row.maxContacts,
          aiTokenMonthlyQuota: row.aiTokenMonthlyQuota,
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

    if (productData.code != null && productData.code !== "") {
      const codeCheck = await db.query(
        `SELECT id FROM subscription_products WHERE code = $1 AND id != $2`,
        [productData.code, id]
      );
      if (codeCheck.rows.length > 0) {
        throw new BadRequestError(`Product with code "${productData.code}" already exists. Use a unique code (e.g. maintain-agent, maintain-homeowner).`);
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
    try {
      if (limits) await upsertPlanLimits(id, limits);
      if (prices?.month) await upsertPlanPrice(id, 'month', prices.month);
      if (prices?.year) await upsertPlanPrice(id, 'year', prices.year);
      if (Array.isArray(features) && hasBilling) {
        await db.query(
          `UPDATE subscription_products SET features = $1, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(features), id]
        );
      }
    } catch (e) { /* plan_limits/plan_prices may not exist */ }
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
