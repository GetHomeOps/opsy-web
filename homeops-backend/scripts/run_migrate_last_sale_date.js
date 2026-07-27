"use strict";

/**
 * One-shot migration: properties.last_sale_date from ATTOM most-recent sale.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE properties
     ADD COLUMN IF NOT EXISTS last_sale_date DATE`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("properties.last_sale_date: column is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
