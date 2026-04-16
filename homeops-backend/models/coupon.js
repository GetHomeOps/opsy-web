"use strict";

const crypto = require("crypto");
const db = require("../db");
const { NotFoundError, BadRequestError } = require("../expressError");

const COUPON_COLUMNS = `
  id, code, name, description,
  discount_type   AS "discountType",
  discount_value  AS "discountValue",
  currency, duration,
  duration_in_months AS "durationInMonths",
  plan_ids        AS "planIds",
  max_redemptions AS "maxRedemptions",
  redemption_count AS "redemptionCount",
  expires_at      AS "expiresAt",
  is_active       AS "isActive",
  stripe_coupon_id     AS "stripeCouponId",
  stripe_promo_code_id AS "stripePromoCodeId",
  coupon_type     AS "couponType",
  batch_id        AS "batchId",
  batch_name      AS "batchName",
  created_by      AS "createdBy",
  created_at      AS "createdAt",
  updated_at      AS "updatedAt"`;

const UNAMBIGUOUS_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(prefix, length = 4) {
  let suffix = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    suffix += UNAMBIGUOUS_CHARS[bytes[i] % UNAMBIGUOUS_CHARS.length];
  }
  return prefix ? `${prefix.toUpperCase()}-${suffix}` : suffix;
}

class Coupon {
  /**
   * Create a single coupon.
   * Returns { id, code, name, ... }
   */
  static async create({
    code, name, description, discountType, discountValue, currency = "usd",
    duration, durationInMonths, planIds = [], maxRedemptions, expiresAt,
    isActive = true, stripeCouponId, stripePromoCodeId, createdBy,
    couponType = "general", batchId = null, batchName = null,
  }) {
    const result = await db.query(
      `INSERT INTO coupons
        (code, name, description, discount_type, discount_value, currency,
         duration, duration_in_months, plan_ids, max_redemptions, expires_at,
         is_active, stripe_coupon_id, stripe_promo_code_id,
         coupon_type, batch_id, batch_name, created_by)
       VALUES (UPPER($1), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING ${COUPON_COLUMNS}`,
      [
        code, name || null, description || null, discountType, discountValue,
        currency, duration, durationInMonths || null, planIds,
        maxRedemptions || null, expiresAt || null, isActive,
        stripeCouponId || null, stripePromoCodeId || null,
        couponType, batchId || null, batchName || null, createdBy || null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Create a batch of unique single-use codes sharing the same discount.
   * Returns { batchId, batchName, codes: [...] }
   *
   * `createStripePromoCode` is an async callback: (code) => { id } — caller
   * provides it so this model stays Stripe-agnostic.
   */
  static async createBatch({
    quantity, codePrefix, batchName,
    name, description, discountType, discountValue, currency = "usd",
    duration, durationInMonths, planIds = [], expiresAt,
    stripeCouponId, createdBy, createStripePromoCode,
  }) {
    if (!quantity || quantity < 1 || quantity > 500) {
      throw new BadRequestError("Batch quantity must be between 1 and 500.");
    }

    const batchId = crypto.randomUUID();
    const suffixLength = quantity > 999 ? 6 : quantity > 99 ? 5 : 4;
    const client = await db.connect();

    try {
      await client.query("BEGIN");

      const codes = [];
      const usedCodes = new Set();

      for (let i = 0; i < quantity; i++) {
        let code;
        let attempts = 0;
        do {
          code = generateCode(codePrefix || "", suffixLength);
          attempts++;
          if (attempts > 20) throw new BadRequestError("Could not generate unique code; try a different prefix.");
        } while (usedCodes.has(code));
        usedCodes.add(code);

        let stripePromoCodeId = null;
        if (createStripePromoCode) {
          const promo = await createStripePromoCode(code);
          stripePromoCodeId = promo.id;
        }

        const result = await client.query(
          `INSERT INTO coupons
            (code, name, description, discount_type, discount_value, currency,
             duration, duration_in_months, plan_ids, max_redemptions, expires_at,
             is_active, stripe_coupon_id, stripe_promo_code_id,
             coupon_type, batch_id, batch_name, created_by)
           VALUES (UPPER($1), $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, true, $11, $12,
                   'unique', $13, $14, $15)
           RETURNING ${COUPON_COLUMNS}`,
          [
            code, name || null, description || null, discountType, discountValue,
            currency, duration, durationInMonths || null, planIds,
            expiresAt || null, stripeCouponId || null, stripePromoCodeId,
            batchId, batchName || null, createdBy || null,
          ]
        );
        codes.push(result.rows[0]);
      }

      await client.query("COMMIT");
      return { batchId, batchName, quantity, codes };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /** List all coupons (admin view). */
  static async findAll() {
    const result = await db.query(
      `SELECT ${COUPON_COLUMNS}
       FROM coupons
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  /**
   * List coupons grouped for the admin list view.
   * General coupons are returned individually.
   * Unique coupons are collapsed into batch summaries.
   */
  static async findAllGrouped() {
    const generalRes = await db.query(
      `SELECT ${COUPON_COLUMNS}
       FROM coupons
       WHERE coupon_type = 'general'
       ORDER BY created_at DESC`
    );

    const batchRes = await db.query(
      `SELECT
         batch_id        AS "batchId",
         batch_name      AS "batchName",
         discount_type   AS "discountType",
         discount_value  AS "discountValue",
         currency,
         duration,
         duration_in_months AS "durationInMonths",
         plan_ids        AS "planIds",
         expires_at      AS "expiresAt",
         COUNT(*)::int                                    AS "totalCodes",
         SUM(CASE WHEN redemption_count > 0 THEN 1 ELSE 0 END)::int AS "redeemedCount",
         SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS "activeCount",
         MIN(created_at)  AS "createdAt"
       FROM coupons
       WHERE coupon_type = 'unique' AND batch_id IS NOT NULL
       GROUP BY batch_id, batch_name, discount_type, discount_value, currency,
                duration, duration_in_months, plan_ids, expires_at
       ORDER BY MIN(created_at) DESC`
    );

    return {
      general: generalRes.rows,
      batches: batchRes.rows,
    };
  }

  /** Get a single coupon by ID (admin). Includes redemption list. */
  static async findById(id) {
    const result = await db.query(
      `SELECT ${COUPON_COLUMNS}
       FROM coupons WHERE id = $1`,
      [id]
    );
    const coupon = result.rows[0];
    if (!coupon) throw new NotFoundError(`No coupon with id: ${id}`);

    const redemptions = await db.query(
      `SELECT cr.id, cr.account_id AS "accountId", a.name AS "accountName",
              cr.user_id AS "userId", u.email AS "userEmail",
              cr.stripe_subscription_id AS "stripeSubscriptionId",
              cr.redeemed_at AS "redeemedAt"
       FROM coupon_redemptions cr
       LEFT JOIN accounts a ON a.id = cr.account_id
       LEFT JOIN users u ON u.id = cr.user_id
       WHERE cr.coupon_id = $1
       ORDER BY cr.redeemed_at DESC`,
      [id]
    );
    coupon.redemptions = redemptions.rows;
    return coupon;
  }

  /** Find coupon by code (case-insensitive). Returns row or null. */
  static async findByCode(code) {
    const result = await db.query(
      `SELECT ${COUPON_COLUMNS}
       FROM coupons WHERE code = UPPER($1)`,
      [code]
    );
    return result.rows[0] || null;
  }

  /** Find coupon by stripe_coupon_id. Returns first match or null. */
  static async findByStripeCouponId(stripeCouponId) {
    const result = await db.query(
      `SELECT id, code, coupon_type AS "couponType", redemption_count AS "redemptionCount"
       FROM coupons WHERE stripe_coupon_id = $1`,
      [stripeCouponId]
    );
    return result.rows[0] || null;
  }

  /** Find coupon by stripe_promo_code_id. More precise for batch codes. */
  static async findByStripePromoCodeId(stripePromoCodeId) {
    const result = await db.query(
      `SELECT id, code, coupon_type AS "couponType", redemption_count AS "redemptionCount"
       FROM coupons WHERE stripe_promo_code_id = $1`,
      [stripePromoCodeId]
    );
    return result.rows[0] || null;
  }

  /** Get all codes belonging to a batch. */
  static async findBatchCodes(batchId) {
    const result = await db.query(
      `SELECT ${COUPON_COLUMNS}
       FROM coupons
       WHERE batch_id = $1
       ORDER BY code ASC`,
      [batchId]
    );
    if (result.rows.length === 0) throw new NotFoundError(`No batch with id: ${batchId}`);
    return result.rows;
  }

  /** Get aggregate stats for a batch. */
  static async findBatchSummary(batchId) {
    const result = await db.query(
      `SELECT
         batch_id        AS "batchId",
         batch_name      AS "batchName",
         COUNT(*)::int                                    AS "totalCodes",
         SUM(CASE WHEN redemption_count > 0 THEN 1 ELSE 0 END)::int AS "redeemedCount",
         SUM(CASE WHEN is_active THEN 1 ELSE 0 END)::int AS "activeCount"
       FROM coupons
       WHERE batch_id = $1
       GROUP BY batch_id, batch_name`,
      [batchId]
    );
    if (result.rows.length === 0) throw new NotFoundError(`No batch with id: ${batchId}`);
    return result.rows[0];
  }

  /** Update coupon fields. Only allowed fields are updated. */
  static async update(id, data) {
    const allowed = {
      name: "name",
      description: "description",
      maxRedemptions: "max_redemptions",
      expiresAt: "expires_at",
      isActive: "is_active",
      planIds: "plan_ids",
    };

    const sets = [];
    const vals = [];
    let idx = 1;

    for (const [jsKey, dbCol] of Object.entries(allowed)) {
      if (data[jsKey] !== undefined) {
        sets.push(`${dbCol} = $${idx}`);
        vals.push(data[jsKey]);
        idx++;
      }
    }

    if (sets.length === 0) throw new BadRequestError("No data to update");

    sets.push("updated_at = NOW()");
    vals.push(id);

    const result = await db.query(
      `UPDATE coupons SET ${sets.join(", ")} WHERE id = $${idx}
       RETURNING ${COUPON_COLUMNS}`,
      vals
    );
    const coupon = result.rows[0];
    if (!coupon) throw new NotFoundError(`No coupon with id: ${id}`);
    return coupon;
  }

  /** Soft-delete: deactivate coupon. */
  static async deactivate(id) {
    return this.update(id, { isActive: false });
  }

  /** Deactivate all codes in a batch. Returns count of updated rows. */
  static async deactivateBatch(batchId) {
    const result = await db.query(
      `UPDATE coupons SET is_active = false, updated_at = NOW()
       WHERE batch_id = $1 AND is_active = true
       RETURNING id`,
      [batchId]
    );
    if (result.rows.length === 0) {
      const exists = await db.query(`SELECT 1 FROM coupons WHERE batch_id = $1 LIMIT 1`, [batchId]);
      if (!exists.rows[0]) throw new NotFoundError(`No batch with id: ${batchId}`);
    }
    return result.rows.length;
  }

  /**
   * Reactivate unused codes in a batch (admin undo of batch deactivation).
   * Skips redeemed codes and expired codes. Returns count of updated rows.
   */
  static async activateBatch(batchId) {
    const result = await db.query(
      `UPDATE coupons SET is_active = true, updated_at = NOW()
       WHERE batch_id = $1
         AND coupon_type = 'unique'
         AND is_active = false
         AND redemption_count = 0
         AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING id`,
      [batchId]
    );
    if (result.rows.length === 0) {
      const exists = await db.query(`SELECT 1 FROM coupons WHERE batch_id = $1 LIMIT 1`, [batchId]);
      if (!exists.rows[0]) throw new NotFoundError(`No batch with id: ${batchId}`);
    }
    return result.rows.length;
  }

  /** Check if an account has already redeemed this coupon. */
  static async hasAccountRedeemed(couponId, accountId) {
    const result = await db.query(
      `SELECT 1 FROM coupon_redemptions WHERE coupon_id = $1 AND account_id = $2`,
      [couponId, accountId]
    );
    return result.rows.length > 0;
  }

  /**
   * Record a redemption and increment the counter atomically.
   * For unique coupons, also sets is_active = false ("crossed off").
   */
  static async recordRedemption({ couponId, accountId, userId, stripeSubscriptionId }) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const lockRes = await client.query(
        `SELECT id, coupon_type AS "couponType" FROM coupons WHERE id = $1 FOR UPDATE`,
        [couponId]
      );
      const coupon = lockRes.rows[0];

      await client.query(
        `INSERT INTO coupon_redemptions (coupon_id, account_id, user_id, stripe_subscription_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (coupon_id, account_id) DO NOTHING`,
        [couponId, accountId, userId, stripeSubscriptionId || null]
      );

      const deactivateClause = coupon?.couponType === "unique"
        ? ", is_active = false"
        : "";

      await client.query(
        `UPDATE coupons SET redemption_count = redemption_count + 1${deactivateClause}, updated_at = NOW()
         WHERE id = $1`,
        [couponId]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Validate a coupon code for a given account + plan.
   * Returns { valid, coupon?, reason? }
   */
  static async validate(code, accountId, planCode) {
    const coupon = await this.findByCode(code);
    if (!coupon) return { valid: false, reason: "Coupon code not found." };
    if (!coupon.isActive) return { valid: false, reason: "This coupon is no longer active." };

    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return { valid: false, reason: "This coupon has expired." };
    }

    if (coupon.couponType === "unique" && coupon.redemptionCount >= 1) {
      return { valid: false, reason: "This coupon code has already been used." };
    }

    if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) {
      return { valid: false, reason: "This coupon has reached its maximum number of redemptions." };
    }

    if (coupon.planIds && coupon.planIds.length > 0 && planCode) {
      const planResult = await db.query(
        `SELECT id FROM subscription_products WHERE code = $1`,
        [planCode]
      );
      const planId = planResult.rows[0]?.id;
      if (!planId || !coupon.planIds.includes(planId)) {
        return { valid: false, reason: "This coupon is not valid for the selected plan." };
      }
    }

    if (accountId) {
      const alreadyUsed = await this.hasAccountRedeemed(coupon.id, accountId);
      if (alreadyUsed) {
        return { valid: false, reason: "This coupon has already been applied to your account." };
      }
    }

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: Number(coupon.discountValue),
        currency: coupon.currency,
        duration: coupon.duration,
        durationInMonths: coupon.durationInMonths,
        stripePromoCodeId: coupon.stripePromoCodeId,
      },
    };
  }
}

module.exports = Coupon;
