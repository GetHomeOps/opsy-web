"use strict";

/**
 * One-shot migration: Scout scoring_audit JSONB + expanded condition ratings.
 * Safe to re-run (IF NOT EXISTS / DROP IF EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE pre_purchase_analyses
     ADD COLUMN IF NOT EXISTS scoring_audit JSONB DEFAULT NULL`,
  `ALTER TABLE pre_purchase_analyses
     DROP CONSTRAINT IF EXISTS pre_purchase_analyses_overall_condition_rating_check`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pre_purchase_analyses_overall_condition_rating_check'
  ) THEN
    ALTER TABLE pre_purchase_analyses
      ADD CONSTRAINT pre_purchase_analyses_overall_condition_rating_check
      CHECK (
        overall_condition_rating IS NULL OR overall_condition_rating IN (
          'excellent',
          'very_good',
          'good',
          'fair',
          'needs_attention',
          'poor',
          'critical',
          'unknown'
        )
      );
  END IF;
END $$`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("pre_purchase_analyses: scoring_audit + expanded condition ratings.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
