"use strict";

/**
 * One-shot migration: assistant role + tether column + plan_limits assistants fields.
 * Uses DATABASE_URL from env. Safe to re-run.
 */
const db = require("../db");

const STATEMENTS = [
  `DO $$ BEGIN
     ALTER TYPE user_role ADD VALUE 'assistant';
   EXCEPTION
     WHEN duplicate_object THEN NULL;
   END $$`,
  `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS assistant_of_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`,
  `CREATE INDEX IF NOT EXISTS idx_users_assistant_of_user_id ON users(assistant_of_user_id)`,
  `ALTER TABLE plan_limits
     ADD COLUMN IF NOT EXISTS assistants_enabled BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE plan_limits
     ADD COLUMN IF NOT EXISTS max_assistants INTEGER NOT NULL DEFAULT 0`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("assistant role, users.assistant_of_user_id, and plan_limits assistants columns are present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
