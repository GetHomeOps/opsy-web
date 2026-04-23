"use strict";

/**
 * One-shot migration: add brand_name and social_links to comm_templates
 * if the DB was created from an older schema. Uses DATABASE_URL from env.
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE comm_templates
    ADD COLUMN IF NOT EXISTS brand_name VARCHAR(120) DEFAULT 'Opsy'`,
  `ALTER TABLE comm_templates
    ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb`,
  `UPDATE comm_templates
    SET brand_name = COALESCE(brand_name, 'Opsy')
    WHERE brand_name IS NULL`,
  `UPDATE comm_templates
    SET social_links = COALESCE(social_links, '[]'::jsonb)
    WHERE social_links IS NULL`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("comm_templates: brand_name and social_links are present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
