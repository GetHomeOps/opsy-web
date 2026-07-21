"use strict";

/**
 * One-shot migration: pre_purchase_notes table.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS pre_purchase_notes (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL REFERENCES pre_purchase_analyses(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_notes_analysis ON pre_purchase_notes(analysis_id, updated_at DESC)`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("pre_purchase_notes: table is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
