#!/usr/bin/env node
/**
 * Add ai_token_price_usd to plan_limits.
 * When both ai_token_monthly_value_usd and ai_token_price_usd are set,
 * tokens = budget / price. Otherwise falls back to AI_TOKEN_COST_USD env.
 * Run: node scripts/run-plan-limits-token-price-migration.js
 */
require("dotenv").config();
const db = require("../db");

const MIGRATION_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_limits' AND column_name = 'ai_token_price_usd'
  ) THEN
    ALTER TABLE plan_limits ADD COLUMN ai_token_price_usd DECIMAL(12, 8) DEFAULT NULL;
    COMMENT ON COLUMN plan_limits.ai_token_price_usd IS 'Cost per AI token (USD). When set with ai_token_monthly_value_usd: quota = value_usd / price_usd';
  END IF;
END $$;
`;

async function run() {
  try {
    await db.query(MIGRATION_SQL);
    console.log("plan_limits ai_token_price_usd migration complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
