"use strict";

/**
 * Idempotent schema bootstrap for Homeaversary email send claims.
 * Unique (property, user, audience, year) prevents overlapping sweeps
 * from sending the same anniversary email twice.
 */

const db = require("../db");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS homeaversary_sends (
     id SERIAL PRIMARY KEY,
     property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     audience VARCHAR(20) NOT NULL
       CHECK (audience IN ('homeowner', 'agent')),
     anniversary_year INTEGER NOT NULL,
     sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_homeaversary_sends_unique
     ON homeaversary_sends (property_id, user_id, audience, anniversary_year)`,
  `CREATE INDEX IF NOT EXISTS idx_homeaversary_sends_property
     ON homeaversary_sends (property_id)`,
];

async function ensureHomeaversarySchema() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
}

module.exports = { ensureHomeaversarySchema };
