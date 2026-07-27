"use strict";

/**
 * One-shot migration: add image_keys to pre_purchase_notes.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE pre_purchase_notes
   ADD COLUMN IF NOT EXISTS image_keys TEXT[] NOT NULL DEFAULT '{}'`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("pre_purchase_notes: image_keys column is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
