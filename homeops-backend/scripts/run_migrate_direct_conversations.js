"use strict";

/**
 * One-shot migration: allow property-less direct conversations (admin DMs).
 * Uses DATABASE_URL from env. Safe to re-run.
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE conversations
     ALTER COLUMN property_id DROP NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_pair
     ON conversations (account_id, homeowner_user_id, agent_user_id)
     WHERE property_id IS NULL`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("conversations.property_id is nullable; idx_conversations_direct_pair is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
