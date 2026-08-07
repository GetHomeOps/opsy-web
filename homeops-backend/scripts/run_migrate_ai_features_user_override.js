"use strict";

/**
 * One-shot migration: add users.ai_features_override_enabled and
 * users.ai_features_token_monthly_quota for complimentary AI feature grants.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ai_features_override_enabled BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ai_features_token_monthly_quota INTEGER`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log(
    "users: ai_features_override_enabled and ai_features_token_monthly_quota columns are present."
  );
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
