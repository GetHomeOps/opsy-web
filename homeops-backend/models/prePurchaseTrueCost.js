"use strict";

/**
 * PrePurchaseTrueCost Model
 *
 * Analysis-scoped financing inputs and repair-line overrides for True Cost.
 */

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");

const TIMINGS = new Set(["immediate", "deferred", "excluded"]);

function toNumberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestError("Numeric values must be finite and non-negative");
  }
  return n;
}

function toNumber(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestError("Numeric values must be finite and non-negative");
  }
  return n;
}

function normalizeRepairs(repairs) {
  const items = Array.isArray(repairs?.items) ? repairs.items : [];
  const normalized = [];

  for (const item of items) {
    if (!item || typeof item !== "object") {
      throw new BadRequestError("Invalid repair item");
    }
    const kind = item.kind;
    if (kind !== "finding" && kind !== "custom") {
      throw new BadRequestError("Repair kind must be finding or custom");
    }
    const timing = item.timing;
    if (!TIMINGS.has(timing)) {
      throw new BadRequestError("Repair timing must be immediate, deferred, or excluded");
    }
    const estimatedCost = toNumber(item.estimatedCost, 0);
    const included = Boolean(item.included);
    const note =
      item.note == null || item.note === ""
        ? null
        : String(item.note).slice(0, 2000);

    if (kind === "finding") {
      const findingId = parseInt(item.findingId, 10);
      if (!Number.isFinite(findingId) || findingId < 1) {
        throw new BadRequestError("findingId is required for finding repair items");
      }
      normalized.push({
        kind: "finding",
        findingId,
        included,
        timing,
        estimatedCost,
        note,
      });
    } else {
      const id = String(item.id || "").trim();
      if (!id) throw new BadRequestError("id is required for custom repair items");
      const description = String(item.description || "").trim().slice(0, 500);
      if (!description) {
        throw new BadRequestError("description is required for custom repair items");
      }
      normalized.push({
        kind: "custom",
        id,
        description,
        included,
        timing,
        estimatedCost,
        note,
      });
    }
  }

  return { items: normalized };
}

class PrePurchaseTrueCost {
  static async getByAnalysisId(analysisId) {
    const result = await db.query(
      `SELECT id,
              analysis_id,
              listing_price,
              offer_price,
              down_payment_percent,
              interest_rate,
              loan_term_years,
              property_tax_percent,
              insurance_monthly,
              closing_costs,
              maintenance_reserve_percent,
              maintenance_reserve_enabled,
              acquisition_buffer,
              repairs,
              created_at,
              updated_at
       FROM pre_purchase_true_cost
       WHERE analysis_id = $1`,
      [analysisId],
    );
    return result.rows[0] || null;
  }

  static async get(id) {
    const result = await db.query(
      `SELECT id,
              analysis_id,
              listing_price,
              offer_price,
              down_payment_percent,
              interest_rate,
              loan_term_years,
              property_tax_percent,
              insurance_monthly,
              closing_costs,
              maintenance_reserve_percent,
              maintenance_reserve_enabled,
              acquisition_buffer,
              repairs,
              created_at,
              updated_at
       FROM pre_purchase_true_cost
       WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`True Cost not found: ${id}`);
    return row;
  }

  /** Upsert True Cost inputs for an analysis. */
  static async upsert(analysisId, data) {
    if (!analysisId) throw new BadRequestError("analysis_id is required");

    const listingPrice = toNumberOrNull(data.listingPrice);
    const offerPrice = toNumberOrNull(data.offerPrice);
    const downPaymentPercent = toNumber(data.downPaymentPercent, 20);
    const interestRate = toNumber(data.interestRate, 6.5);
    const loanTermYears = Math.round(toNumber(data.loanTermYears, 30));
    if (loanTermYears < 1 || loanTermYears > 50) {
      throw new BadRequestError("loanTermYears must be between 1 and 50");
    }
    const propertyTaxPercent = toNumber(data.propertyTaxPercent, 1);
    const insuranceMonthly = toNumber(data.insuranceMonthly, 0);
    const closingCosts = toNumber(data.closingCosts, 0);
    const maintenanceReservePercent = toNumber(data.maintenanceReservePercent, 1);
    const maintenanceReserveEnabled =
      data.maintenanceReserveEnabled == null
        ? true
        : Boolean(data.maintenanceReserveEnabled);
    const acquisitionBuffer = toNumber(data.acquisitionBuffer, 0);
    const repairs = normalizeRepairs(data.repairs || { items: [] });

    const result = await db.query(
      `INSERT INTO pre_purchase_true_cost (
          analysis_id,
          listing_price,
          offer_price,
          down_payment_percent,
          interest_rate,
          loan_term_years,
          property_tax_percent,
          insurance_monthly,
          closing_costs,
          maintenance_reserve_percent,
          maintenance_reserve_enabled,
          acquisition_buffer,
          repairs
       ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
       )
       ON CONFLICT (analysis_id) DO UPDATE SET
          listing_price = EXCLUDED.listing_price,
          offer_price = EXCLUDED.offer_price,
          down_payment_percent = EXCLUDED.down_payment_percent,
          interest_rate = EXCLUDED.interest_rate,
          loan_term_years = EXCLUDED.loan_term_years,
          property_tax_percent = EXCLUDED.property_tax_percent,
          insurance_monthly = EXCLUDED.insurance_monthly,
          closing_costs = EXCLUDED.closing_costs,
          maintenance_reserve_percent = EXCLUDED.maintenance_reserve_percent,
          maintenance_reserve_enabled = EXCLUDED.maintenance_reserve_enabled,
          acquisition_buffer = EXCLUDED.acquisition_buffer,
          repairs = EXCLUDED.repairs,
          updated_at = NOW()
       RETURNING id`,
      [
        analysisId,
        listingPrice,
        offerPrice,
        downPaymentPercent,
        interestRate,
        loanTermYears,
        propertyTaxPercent,
        insuranceMonthly,
        closingCosts,
        maintenanceReservePercent,
        maintenanceReserveEnabled,
        acquisitionBuffer,
        JSON.stringify(repairs),
      ],
    );

    return this.get(result.rows[0].id);
  }
}

module.exports = PrePurchaseTrueCost;
