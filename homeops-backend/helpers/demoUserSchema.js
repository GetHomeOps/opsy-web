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
  ensured = true;
}

module.exports = { ensureDemoUserSchema };
