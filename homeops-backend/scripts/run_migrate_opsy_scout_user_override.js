"use strict";

/**
 * One-shot migration: add users.opsy_scout_override_enabled and
 * users.opsy_scout_free_analyses_limit for complimentary Opsy Scout grants.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE users
    ADD COLUMN IF NOT EXISTS opsy_scout_override_enabled BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE users
    ADD COLUMN IF NOT EXISTS opsy_scout_free_analyses_limit INTEGER`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("users: opsy_scout_override_enabled and opsy_scout_free_analyses_limit columns are present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
