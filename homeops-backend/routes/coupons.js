"use strict";

const express = require("express");
const jsonschema = require("jsonschema");
const { ensureLoggedIn, ensureSuperAdmin } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const { wrapStripeErrors } = require("../utils/stripeErrors");
const Coupon = require("../models/coupon");
const db = require("../db");
const { BILLING_MOCK_MODE, STRIPE_SECRET_KEY } = require("../config");

const couponCreateSchema = require("../schemas/couponCreate.json");
const couponUpdateSchema = require("../schemas/couponUpdate.json");

const Stripe = require("stripe");
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const router = express.Router();

/**
 * Sync redemption state from Stripe for all unique coupon codes whose local
 * redemption_count is 0 but Stripe shows they've been redeemed.
 * Groups by stripe_coupon_id so we make one Stripe list call per underlying coupon.
 */
async function syncBatchRedemptionsFromStripe() {
  const staleRows = await db.query(
    `SELECT id, stripe_coupon_id AS "stripeCouponId", stripe_promo_code_id AS "stripePromoCodeId"
     FROM coupons
     WHERE coupon_type = 'unique'
       AND stripe_promo_code_id IS NOT NULL
       AND redemption_count = 0
       AND is_active = true`
  );
  if (staleRows.rows.length === 0) return;

  const byCoupon = new Map();
  for (const row of staleRows.rows) {
    if (!row.stripeCouponId) continue;
    if (!byCoupon.has(row.stripeCouponId)) byCoupon.set(row.stripeCouponId, []);
    byCoupon.get(row.stripeCouponId).push(row);
  }

  for (const [stripeCouponId, rows] of byCoupon) {
    const promos = await stripe.promotionCodes.list({ coupon: stripeCouponId, limit: 100 });
    const stripeMap = new Map();
    for (const p of promos.data) {
      stripeMap.set(p.id, p.times_redeemed);
    }

    for (const row of rows) {
      const timesRedeemed = stripeMap.get(row.stripePromoCodeId);
      if (timesRedeemed && timesRedeemed > 0) {
        await db.query(
          `UPDATE coupons
           SET redemption_count = $1, is_active = false, updated_at = NOW()
           WHERE id = $2`,
          [timesRedeemed, row.id]
        );
      }
    }
  }
}

/** GET /coupons — List coupons. ?view=batches returns grouped view. */
router.get("/", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    if (req.query.view === "batches") {
      // Sync unique-coupon redemption state from Stripe before returning grouped data.
      if (stripe && !BILLING_MOCK_MODE) {
        try {
          await syncBatchRedemptionsFromStripe();
        } catch (syncErr) {
          console.warn("[coupons] Stripe batch sync failed, continuing with local data:", syncErr.message);
        }
      }
      const grouped = await Coupon.findAllGrouped();
      return res.json(grouped);
    }
    const coupons = await Coupon.findAll();
    return res.json({ coupons });
  } catch (err) {
    return next(err);
  }
});

/** GET /coupons/batch/:batchId — Get all codes in a batch (syncs from Stripe) */
router.get("/batch/:batchId", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const { batchId } = req.params;
    let codes = await Coupon.findBatchCodes(batchId);

    // Sync redemption state from Stripe for codes that may have been
    // redeemed outside of webhook delivery (e.g. local dev without stripe listen).
    if (stripe && !BILLING_MOCK_MODE && codes.length > 0) {
      const stripeCouponId = codes[0].stripeCouponId;
      if (stripeCouponId) {
        try {
          const promos = await stripe.promotionCodes.list({
            coupon: stripeCouponId,
            limit: 100,
          });
          const stripeMap = new Map();
          for (const p of promos.data) {
            stripeMap.set(p.id, { timesRedeemed: p.times_redeemed, active: p.active });
          }

          for (const code of codes) {
            if (!code.stripePromoCodeId) continue;
            const sp = stripeMap.get(code.stripePromoCodeId);
            if (!sp) continue;

            const locallyUnredeemed = code.redemptionCount === 0 && sp.timesRedeemed > 0;
            const locallyActive = code.isActive && !sp.active && sp.timesRedeemed > 0;

            if (locallyUnredeemed || locallyActive) {
              await db.query(
                `UPDATE coupons
                 SET redemption_count = $1,
                     is_active = CASE WHEN coupon_type = 'unique' AND $1 > 0 THEN false ELSE is_active END,
                     updated_at = NOW()
                 WHERE id = $2`,
                [sp.timesRedeemed, code.id]
              );
              code.redemptionCount = sp.timesRedeemed;
              if (code.couponType === "unique" && sp.timesRedeemed > 0) {
                code.isActive = false;
              }
            }
          }
        } catch (syncErr) {
          console.warn("[coupons] Stripe sync failed for batch, continuing with local data:", syncErr.message);
        }
      }
    }

    const summary = await Coupon.findBatchSummary(batchId);
    return res.json({ ...summary, codes });
  } catch (err) {
    return next(err);
  }
});

/** GET /coupons/:id — Get coupon detail with redemptions (Super Admin) */
router.get("/:id", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid coupon ID");
    const coupon = await Coupon.findById(id);
    return res.json({ coupon });
  } catch (err) {
    return next(err);
  }
});

/** POST /coupons — Create coupon(s). Handles both general and unique batch. */
router.post("/", ensureLoggedIn, ensureSuperAdmin, wrapStripeErrors(async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, couponCreateSchema, { required: true });
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs.join("; "));
    }

    const {
      couponType = "general",
      code, name, description, discountType, discountValue, currency = "usd",
      duration, durationInMonths, planIds = [], maxRedemptions, expiresAt, isActive,
      quantity, codePrefix, batchName,
    } = req.body;

    if (discountType === "percent" && (discountValue <= 0 || discountValue > 100)) {
      throw new BadRequestError("Percentage discount must be between 0 and 100.");
    }
    if (duration === "repeating" && !durationInMonths) {
      throw new BadRequestError("durationInMonths is required when duration is 'repeating'.");
    }

    // ── Unique batch creation ──
    if (couponType === "unique") {
      if (!quantity || quantity < 1) {
        throw new BadRequestError("quantity is required for unique coupon batches.");
      }

      let stripeCouponId = null;
      let createStripePromoCode = null;

      if (stripe && !BILLING_MOCK_MODE) {
        const stripeCoupon = await stripe.coupons.create({
          ...(discountType === "percent"
            ? { percent_off: discountValue }
            : { amount_off: Math.round(discountValue * 100), currency }),
          duration,
          ...(duration === "repeating" ? { duration_in_months: durationInMonths } : {}),
          ...(expiresAt ? { redeem_by: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
          metadata: { source: "opsy_admin", batch: "true" },
        });
        stripeCouponId = stripeCoupon.id;

        createStripePromoCode = async (generatedCode) => {
          return stripe.promotionCodes.create({
            coupon: stripeCoupon.id,
            code: generatedCode.toUpperCase(),
            active: true,
            max_redemptions: 1,
            ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
          });
        };
      }

      const batch = await Coupon.createBatch({
        quantity,
        codePrefix: codePrefix || undefined,
        batchName: batchName || name || null,
        name, description, discountType, discountValue, currency,
        duration, durationInMonths, planIds, expiresAt,
        stripeCouponId,
        createdBy: res.locals.user?.id,
        createStripePromoCode,
      });

      return res.status(201).json({ batch });
    }

    // ── General coupon creation (existing flow) ──
    if (!code) throw new BadRequestError("code is required for general coupons.");

    const existing = await Coupon.findByCode(code);
    if (existing) throw new BadRequestError(`Coupon code '${code.toUpperCase()}' already exists.`);

    let stripeCouponId = null;
    let stripePromoCodeId = null;

    if (stripe && !BILLING_MOCK_MODE) {
      const stripeCoupon = await stripe.coupons.create({
        ...(discountType === "percent"
          ? { percent_off: discountValue }
          : { amount_off: Math.round(discountValue * 100), currency }),
        duration,
        ...(duration === "repeating" ? { duration_in_months: durationInMonths } : {}),
        ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
        ...(expiresAt ? { redeem_by: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
        metadata: { source: "opsy_admin" },
      });
      stripeCouponId = stripeCoupon.id;

      const promoCode = await stripe.promotionCodes.create({
        coupon: stripeCoupon.id,
        code: code.toUpperCase(),
        active: isActive !== false,
        ...(maxRedemptions ? { max_redemptions: maxRedemptions } : {}),
        ...(expiresAt ? { expires_at: Math.floor(new Date(expiresAt).getTime() / 1000) } : {}),
      });
      stripePromoCodeId = promoCode.id;
    }

    const coupon = await Coupon.create({
      code, name, description, discountType, discountValue, currency,
      duration, durationInMonths, planIds, maxRedemptions, expiresAt,
      isActive: isActive !== false, stripeCouponId, stripePromoCodeId,
      couponType: "general",
      createdBy: res.locals.user?.id,
    });

    return res.status(201).json({ coupon });
  } catch (err) {
    return next(err);
  }
}));

/** PATCH /coupons/:id — Update coupon metadata (Super Admin) */
router.patch("/:id", ensureLoggedIn, ensureSuperAdmin, wrapStripeErrors(async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid coupon ID");

    const validator = jsonschema.validate(req.body, couponUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs.join("; "));
    }

    if (req.body.isActive !== undefined && stripe && !BILLING_MOCK_MODE) {
      const current = await Coupon.findById(id);
      if (current.stripePromoCodeId) {
        await stripe.promotionCodes.update(current.stripePromoCodeId, {
          active: req.body.isActive,
        });
      }
    }

    const coupon = await Coupon.update(id, req.body);
    return res.json({ coupon });
  } catch (err) {
    return next(err);
  }
}));

/** DELETE /coupons/batch/:batchId — Deactivate all codes in a batch (Super Admin) */
router.delete("/batch/:batchId", ensureLoggedIn, ensureSuperAdmin, wrapStripeErrors(async function (req, res, next) {
  try {
    const { batchId } = req.params;

    // Flip DB immediately — Stripe updates run in parallel and don't block the response.
    const count = await Coupon.deactivateBatch(batchId);

    if (stripe && !BILLING_MOCK_MODE) {
      const codes = await Coupon.findBatchCodes(batchId);
      const targets = codes.filter((c) => c.stripePromoCodeId);
      await Promise.all(
        targets.map((c) =>
          stripe.promotionCodes
            .update(c.stripePromoCodeId, { active: false })
            .catch((err) => {
              console.warn(
                "[coupons] Stripe deactivate failed for",
                c.stripePromoCodeId,
                err.message,
              );
            }),
        ),
      );
    }

    const summary = await Coupon.findBatchSummary(batchId);
    return res.json({
      message: `Batch deactivated. ${count} code(s) updated.`,
      deactivatedCount: count,
      summary,
    });
  } catch (err) {
    return next(err);
  }
}));

/** POST /coupons/batch/:batchId/activate — Reactivate unused codes in a batch (Super Admin) */
router.post("/batch/:batchId/activate", ensureLoggedIn, ensureSuperAdmin, wrapStripeErrors(async function (req, res, next) {
  try {
    const { batchId } = req.params;
    const codes = await Coupon.findBatchCodes(batchId);

    const eligible = codes.filter((c) => {
      if (c.couponType !== "unique") return false;
      if (c.isActive) return false;
      if (c.redemptionCount > 0) return false;
      if (c.expiresAt && new Date(c.expiresAt) <= new Date()) return false;
      return true;
    });

    const count = await Coupon.activateBatch(batchId);

    if (stripe && !BILLING_MOCK_MODE) {
      const targets = eligible.filter((c) => c.stripePromoCodeId);
      await Promise.all(
        targets.map((c) =>
          stripe.promotionCodes
            .update(c.stripePromoCodeId, { active: true })
            .catch((err) => {
              console.warn(
                "[coupons] Stripe activate failed for",
                c.stripePromoCodeId,
                err.message,
              );
            }),
        ),
      );
    }

    const summary = await Coupon.findBatchSummary(batchId);
    return res.json({
      message: `Batch activated. ${count} code(s) updated.`,
      activatedCount: count,
      summary,
    });
  } catch (err) {
    return next(err);
  }
}));

/** DELETE /coupons/:id — Soft-delete (deactivate) coupon (Super Admin) */
router.delete("/:id", ensureLoggedIn, ensureSuperAdmin, wrapStripeErrors(async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid coupon ID");

    if (stripe && !BILLING_MOCK_MODE) {
      const current = await Coupon.findById(id);
      if (current.stripePromoCodeId) {
        await stripe.promotionCodes.update(current.stripePromoCodeId, { active: false });
      }
    }

    const coupon = await Coupon.deactivate(id);
    return res.json({ coupon, message: "Coupon deactivated." });
  } catch (err) {
    return next(err);
  }
}));

/** POST /coupons/validate — Validate a coupon for the current user/account (Logged in) */
router.post("/validate", ensureLoggedIn, async function (req, res, next) {
  try {
    const { code, planCode } = req.body || {};
    if (!code) throw new BadRequestError("Coupon code is required.");

    const userId = res.locals.user?.id;
    let accountId = req.body.accountId;

    if (!accountId && userId) {
      const acc = await db.query(
        `SELECT account_id FROM account_users WHERE user_id = $1
         ORDER BY (account_id IN (SELECT id FROM accounts WHERE owner_user_id = $1)) DESC
         LIMIT 1`,
        [userId]
      );
      accountId = acc.rows[0]?.account_id;
    }

    const result = await Coupon.validate(code, accountId, planCode);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
