"use strict";

/**
 * PropertyFinancials model — 1:1 ATTOM snapshot + homeowner-verified overrides.
 * ATTOM upsert never overwrites verified_* / insurance / hoa columns.
 */

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

const COLUMNS = `
  property_id,
  avm_value, avm_low, avm_high, avm_date, avm_source,
  assessed_value, market_value, assessment_year,
  last_sale_price, last_sale_date,
  absentee_indicator, owner_occupied, owner_type, trust_indicator, corporate_indicator,
  annual_tax_amount, tax_year,
  mortgage_lender, mortgage_loan_type, mortgage_interest_rate, mortgage_original_amount,
  mortgage_term_months, mortgage_origination_date, mortgage_maturity_date, mortgage_deed_type,
  second_lien_original_amount, modeled_balance, attom_fetched_at,
  verified_current_balance, verified_monthly_payment, verified_payment_due_day,
  verified_interest_rate, verified_escrow_included, mortgage_verified_at, mortgage_source_document_id,
  insurance_provider, insurance_annual_premium, insurance_renewal_date, insurance_policy_number,
  insurance_deductible, insurance_escrow_included, insurance_verified_at, insurance_source_document_id,
  hoa_association_name, hoa_amount, hoa_frequency, hoa_next_due_date, hoa_special_assessment,
  hoa_not_applicable, hoa_verified_at, hoa_source_document_id,
  verified_home_value, home_value_verified_at,
  plausibility_flags, plausibility_reviewed_at,
  created_at, updated_at
`;

const ATTOM_SNAPSHOT_KEYS = [
  "avm_value",
  "avm_low",
  "avm_high",
  "avm_date",
  "avm_source",
  "assessed_value",
  "market_value",
  "assessment_year",
  "last_sale_price",
  "last_sale_date",
  "absentee_indicator",
  "owner_occupied",
  "owner_type",
  "trust_indicator",
  "corporate_indicator",
  "annual_tax_amount",
  "tax_year",
  "mortgage_lender",
  "mortgage_loan_type",
  "mortgage_interest_rate",
  "mortgage_original_amount",
  "mortgage_term_months",
  "mortgage_origination_date",
  "mortgage_maturity_date",
  "mortgage_deed_type",
  "second_lien_original_amount",
  "modeled_balance",
];

const ADMIN_SNAPSHOT_KEYS = new Set([
  "last_sale_price",
  "last_sale_date",
  "owner_occupied",
  "absentee_indicator",
  "mortgage_lender",
  "mortgage_original_amount",
  "mortgage_interest_rate",
  "mortgage_term_months",
  "mortgage_origination_date",
  "annual_tax_amount",
  "tax_year",
]);

function pickSnapshot(data = {}) {
  const out = {};
  for (const key of ATTOM_SNAPSHOT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      out[key] = data[key] === undefined ? null : data[key];
    }
  }
  return out;
}

class PropertyFinancials {
  static async get(propertyId) {
    if (!propertyId) return null;
    const result = await db.query(
      `SELECT ${COLUMNS} FROM property_financials WHERE property_id = $1`,
      [propertyId]
    );
    return result.rows[0] || null;
  }

  /**
   * Insert or refresh ATTOM snapshot fields only. Verified overrides are preserved.
   * Always stamps attom_fetched_at so GET financials will not re-enqueue backfill.
   */
  static async upsertAttomSnapshot(propertyId, snapshot = {}) {
    if (!propertyId) throw new BadRequestError("propertyId is required");
    const data = pickSnapshot(snapshot);

    const insertCols = ["property_id", ...ATTOM_SNAPSHOT_KEYS, "attom_fetched_at"];
    const insertVals = [
      propertyId,
      ...ATTOM_SNAPSHOT_KEYS.map((k) =>
        Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null
      ),
    ];
    const placeholders = insertCols.map((_, i) =>
      i === insertCols.length - 1 ? "NOW()" : `$${i + 1}`
    );
    const updates = ATTOM_SNAPSHOT_KEYS.map(
      (col) => `${col} = EXCLUDED.${col}`
    ).concat(["attom_fetched_at = NOW()", "updated_at = NOW()"]);

    const result = await db.query(
      `INSERT INTO property_financials (${insertCols.join(", ")})
       VALUES (${placeholders.join(", ")})
       ON CONFLICT (property_id) DO UPDATE SET ${updates.join(", ")}
       RETURNING ${COLUMNS}`,
      insertVals
    );
    return result.rows[0];
  }

  static async ensureRow(propertyId) {
    if (!propertyId) throw new BadRequestError("propertyId is required");
    const existing = await this.get(propertyId);
    if (existing) return existing;
    const result = await db.query(
      `INSERT INTO property_financials (property_id)
       VALUES ($1)
       ON CONFLICT (property_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [propertyId]
    );
    if (result.rows[0]) return result.rows[0];
    return this.get(propertyId);
  }

  static async updateVerified(propertyId, dataToUpdate) {
    if (!propertyId) throw new BadRequestError("propertyId is required");
    await this.ensureRow(propertyId);
    const { setCols, values } = sqlForPartialUpdate(dataToUpdate, {});
    const result = await db.query(
      `UPDATE property_financials
       SET ${setCols}, updated_at = NOW()
       WHERE property_id = $${values.length + 1}
       RETURNING ${COLUMNS}`,
      [...values, propertyId]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No financials for property ${propertyId}`);
    return row;
  }

  /**
   * Admin/super_admin correction of public-record snapshot fields.
   * Never clears or writes verified_* / insurance / hoa columns.
   */
  static async updateAdminSnapshot(propertyId, dataToUpdate = {}) {
    if (!propertyId) throw new BadRequestError("propertyId is required");
    const filtered = {};
    for (const [key, value] of Object.entries(dataToUpdate)) {
      if (ADMIN_SNAPSHOT_KEYS.has(key) && value !== undefined) {
        filtered[key] = value;
      }
    }
    if (Object.keys(filtered).length === 0) {
      throw new BadRequestError("No snapshot fields to update");
    }
    await this.ensureRow(propertyId);
    const { setCols, values } = sqlForPartialUpdate(filtered, {});
    const result = await db.query(
      `UPDATE property_financials
       SET ${setCols}, updated_at = NOW()
       WHERE property_id = $${values.length + 1}
       RETURNING ${COLUMNS}`,
      [...values, propertyId]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No financials for property ${propertyId}`);
    return row;
  }

  static async savePlausibilityFlags(propertyId, flags) {
    if (!propertyId) throw new BadRequestError("propertyId is required");
    await this.ensureRow(propertyId);
    const payload = Array.isArray(flags) ? flags : [];
    const result = await db.query(
      `UPDATE property_financials
       SET plausibility_flags = $2::jsonb,
           plausibility_reviewed_at = NOW(),
           updated_at = NOW()
       WHERE property_id = $1
       RETURNING ${COLUMNS}`,
      [propertyId, JSON.stringify(payload)]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`No financials for property ${propertyId}`);
    return row;
  }

  static async listSnapshots(propertyId, { limit = 24 } = {}) {
    if (!propertyId) return [];
    const result = await db.query(
      `SELECT id, property_id, captured_at, avm_value, estimated_balance
       FROM property_value_snapshots
       WHERE property_id = $1
       ORDER BY captured_at ASC
       LIMIT $2`,
      [propertyId, Math.min(Math.max(Number(limit) || 24, 1), 120)]
    );
    return result.rows;
  }

  /**
   * Insert a trend point when AVM or estimated balance actually changed.
   */
  static async insertSnapshotIfChanged(propertyId, { avmValue, estimatedBalance }) {
    if (!propertyId) return null;
    const last = await db.query(
      `SELECT avm_value, estimated_balance
       FROM property_value_snapshots
       WHERE property_id = $1
       ORDER BY captured_at DESC
       LIMIT 1`,
      [propertyId]
    );
    const prev = last.rows[0];
    const sameAvm =
      (prev?.avm_value == null && avmValue == null) ||
      Number(prev?.avm_value) === Number(avmValue);
    const sameBal =
      (prev?.estimated_balance == null && estimatedBalance == null) ||
      Number(prev?.estimated_balance) === Number(estimatedBalance);
    if (prev && sameAvm && sameBal) return prev;

    if (avmValue == null && estimatedBalance == null) return null;

    const result = await db.query(
      `INSERT INTO property_value_snapshots (property_id, avm_value, estimated_balance)
       VALUES ($1, $2, $3)
       RETURNING id, property_id, captured_at, avm_value, estimated_balance`,
      [propertyId, avmValue ?? null, estimatedBalance ?? null]
    );
    return result.rows[0];
  }
}

module.exports = PropertyFinancials;
