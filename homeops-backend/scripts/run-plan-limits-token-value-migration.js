#!/usr/bin/env node
/**
 * Add ai_token_monthly_value_usd to plan_limits for dollar-based token budget.
 * When set, system calculates: aiTokenMonthlyQuota = value_usd / AI_TOKEN_COST_USD
 * Run: node scripts/run-plan-limits-token-value-migration.js
 */
require("dotenv").config();
const db = require("../db");

const MIGRATION_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plan_limits' AND column_name = 'ai_token_monthly_value_usd'
  ) THEN
    ALTER TABLE plan_limits ADD COLUMN ai_token_monthly_value_usd DECIMAL(10, 4) DEFAULT NULL;
    COMMENT ON COLUMN plan_limits.ai_token_monthly_value_usd IS 'Optional dollar budget per month for AI tokens; quota computed as value_usd / AI_TOKEN_COST_USD when set';
  END IF;
END $$;
`;

async function run() {
  try {
    await db.query(MIGRATION_SQL);
    console.log("plan_limits ai_token_monthly_value_usd migration complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
