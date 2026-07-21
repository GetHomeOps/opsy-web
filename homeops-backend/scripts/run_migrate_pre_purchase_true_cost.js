"use strict";

/**
 * One-shot migration: pre_purchase_true_cost table.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS pre_purchase_true_cost (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL UNIQUE REFERENCES pre_purchase_analyses(id) ON DELETE CASCADE,
    listing_price NUMERIC(12, 2),
    offer_price NUMERIC(12, 2),
    down_payment_percent NUMERIC(6, 3) NOT NULL DEFAULT 20,
    interest_rate NUMERIC(6, 3) NOT NULL DEFAULT 6.5,
    loan_term_years INTEGER NOT NULL DEFAULT 30,
    property_tax_percent NUMERIC(6, 3) NOT NULL DEFAULT 1.0,
    insurance_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0,
    closing_costs NUMERIC(12, 2) NOT NULL DEFAULT 0,
    maintenance_reserve_percent NUMERIC(6, 3) NOT NULL DEFAULT 1.0,
    maintenance_reserve_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    acquisition_buffer NUMERIC(12, 2) NOT NULL DEFAULT 0,
    repairs JSONB NOT NULL DEFAULT '{"items":[]}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_true_cost_analysis ON pre_purchase_true_cost(analysis_id)`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("pre_purchase_true_cost: table is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
