"use strict";

const db = require("../db");

let ensured = false;

/** Ensure demo-only user columns exist (idempotent). */
async function ensureDemoUserSchema() {
  if (ensured) return;
  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_login_password VARCHAR(255)`
  );
  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_paired_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL`
  );
  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ`
  );
  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_provisioned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`
  );
  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_first_login_at TIMESTAMPTZ`
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_users_demo_provisioned_by
     ON users (demo_provisioned_by_user_id)
     WHERE demo_login_password IS NOT NULL`
  );
  ensured = true;
}

module.exports = { ensureDemoUserSchema };
