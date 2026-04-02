#!/usr/bin/env node
/**
 * Enforce at most one subscription product with popular=true per target_role.
 *
 * 1) Clears duplicate popular flags (keeps lowest sort_order, then id).
 * 2) Creates partial unique index idx_subscription_products_popular_per_role.
 *
 * Run: node scripts/run-subscription-products-popular-unique-migration.js
 */
require("dotenv").config();
const db = require("../db");

const DEDUPE_SQL = `
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY target_role
           ORDER BY sort_order ASC NULLS LAST, id ASC
         ) AS rn
  FROM subscription_products
  WHERE popular = true
)
UPDATE subscription_products sp
SET popular = false, updated_at = NOW()
FROM ranked r
WHERE sp.id = r.id AND r.rn > 1;
`;

async function run() {
  try {
    const dedupe = await db.query(DEDUPE_SQL);
    console.log("Dedupe popular flags: rows updated =", dedupe.rowCount ?? 0);
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_products_popular_per_role
        ON subscription_products (target_role)
        WHERE (popular = true)
    `);
    console.log("Partial unique index idx_subscription_products_popular_per_role ensured.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
