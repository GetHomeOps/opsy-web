"use strict";

/**
 * One-shot migration: add button_color / button_text_color to branding tables.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS button_color VARCHAR(7)`,
  `ALTER TABLE accounts
    ADD COLUMN IF NOT EXISTS button_text_color VARCHAR(7)`,
  `ALTER TABLE agencies
    ADD COLUMN IF NOT EXISTS button_color VARCHAR(7)`,
  `ALTER TABLE agencies
    ADD COLUMN IF NOT EXISTS button_text_color VARCHAR(7)`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS button_color VARCHAR(7)`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS button_text_color VARCHAR(7)`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("accounts/agencies/teams: button_color and button_text_color columns are present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
