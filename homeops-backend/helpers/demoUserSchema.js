"use strict";

const db = require("../db");

let ensured = false;

/** Ensure demo-only user columns exist (idempotent). */
async function ensureDemoUserSchema() {
  if (ensured) return;
  await db.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_login_password VARCHAR(255)`
  );
  ensured = true;
}

module.exports = { ensureDemoUserSchema };
