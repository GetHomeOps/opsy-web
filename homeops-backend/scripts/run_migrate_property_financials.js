"use strict";

/**
 * One-shot migration: property financial snapshots, value history, and
 * attom_lookup_jobs.financials_backfill trigger.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS property_financials (
    property_id INTEGER PRIMARY KEY REFERENCES properties(id) ON DELETE CASCADE,

    avm_value NUMERIC(14, 2),
    avm_low NUMERIC(14, 2),
    avm_high NUMERIC(14, 2),
    avm_date DATE,
    avm_source VARCHAR(40),

    assessed_value NUMERIC(14, 2),
    market_value NUMERIC(14, 2),
    assessment_year INTEGER,

    last_sale_price NUMERIC(14, 2),
    last_sale_date DATE,

    absentee_indicator VARCHAR(80),
    owner_occupied BOOLEAN,
    owner_type VARCHAR(120),
    trust_indicator BOOLEAN,
    corporate_indicator BOOLEAN,

    annual_tax_amount NUMERIC(14, 2),
    tax_year INTEGER,

    mortgage_lender VARCHAR(255),
    mortgage_loan_type VARCHAR(80),
    mortgage_interest_rate NUMERIC(8, 4),
    mortgage_original_amount NUMERIC(14, 2),
    mortgage_term_months INTEGER,
    mortgage_origination_date DATE,
    mortgage_maturity_date DATE,
    mortgage_deed_type VARCHAR(80),
    second_lien_original_amount NUMERIC(14, 2),
    modeled_balance NUMERIC(14, 2),

    attom_fetched_at TIMESTAMPTZ,

    verified_current_balance NUMERIC(14, 2),
    verified_monthly_payment NUMERIC(14, 2),
    verified_payment_due_day INTEGER,
    verified_interest_rate NUMERIC(8, 4),
    verified_escrow_included BOOLEAN,
    mortgage_verified_at TIMESTAMPTZ,
    mortgage_source_document_id INTEGER REFERENCES property_documents(id) ON DELETE SET NULL,

    insurance_provider VARCHAR(255),
    insurance_annual_premium NUMERIC(14, 2),
    insurance_renewal_date DATE,
    insurance_policy_number VARCHAR(120),
    insurance_deductible NUMERIC(14, 2),
    insurance_escrow_included BOOLEAN,
    insurance_verified_at TIMESTAMPTZ,
    insurance_source_document_id INTEGER REFERENCES property_documents(id) ON DELETE SET NULL,

    hoa_association_name VARCHAR(255),
    hoa_amount NUMERIC(14, 2),
    hoa_frequency VARCHAR(20)
      CHECK (hoa_frequency IS NULL OR hoa_frequency IN ('monthly', 'quarterly', 'annually')),
    hoa_next_due_date DATE,
    hoa_special_assessment NUMERIC(14, 2),
    hoa_not_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    hoa_verified_at TIMESTAMPTZ,
    hoa_source_document_id INTEGER REFERENCES property_documents(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `ALTER TABLE property_financials
     ADD COLUMN IF NOT EXISTS verified_home_value NUMERIC(14, 2)`,

  `ALTER TABLE property_financials
     ADD COLUMN IF NOT EXISTS home_value_verified_at TIMESTAMPTZ`,

  `ALTER TABLE property_financials
     ADD COLUMN IF NOT EXISTS plausibility_flags JSONB`,

  `ALTER TABLE property_financials
     ADD COLUMN IF NOT EXISTS plausibility_reviewed_at TIMESTAMPTZ`,

  `CREATE TABLE IF NOT EXISTS property_value_snapshots (
    id SERIAL PRIMARY KEY,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    avm_value NUMERIC(14, 2),
    estimated_balance NUMERIC(14, 2)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_property_value_snapshots_property
     ON property_value_snapshots(property_id, captured_at)`,

  `ALTER TABLE attom_lookup_jobs
     DROP CONSTRAINT IF EXISTS attom_lookup_jobs_trigger_check`,

  `ALTER TABLE attom_lookup_jobs
     ADD CONSTRAINT attom_lookup_jobs_trigger_check
     CHECK (trigger IN ('bulk_import', 'manual_refresh', 'financials_backfill'))`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("property_financials: tables and attom backfill trigger are present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
