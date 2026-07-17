"use strict";

/**
 * One-shot migration: add plan_limits.pre_purchase_enabled (default false).
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE plan_limits
    ADD COLUMN IF NOT EXISTS pre_purchase_enabled BOOLEAN NOT NULL DEFAULT false`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("plan_limits: pre_purchase_enabled column is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
