"use strict";

/**
 * Idempotent schema bootstrap for agent-subsidized property billing.
 *
 * Adds the `property_sponsorships` table and `properties.active_sponsor_account_id`
 * column when an existing database predates this feature. Runs at startup (and via
 * `scripts/run_migrate_property_sponsorships.js`) so the feature works without a
 * manual schema reload. All statements are guarded with IF NOT EXISTS.
 */

const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE properties
     ADD COLUMN IF NOT EXISTS active_sponsor_account_id INTEGER REFERENCES accounts(id)`,
  // Grace-period marker mirrored from the live sponsorship row (see below).
  `ALTER TABLE properties
     ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ`,
  `CREATE INDEX IF NOT EXISTS idx_properties_active_sponsor
     ON properties(active_sponsor_account_id)
     WHERE active_sponsor_account_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS property_sponsorships (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
     sponsor_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     sponsor_agent_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
     beneficiary_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
     beneficiary_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
     status VARCHAR(20) NOT NULL DEFAULT 'pending'
       CHECK (status IN ('pending', 'active', 'grace', 'ended', 'declined')),
     effective_at TIMESTAMPTZ,
     grace_until TIMESTAMPTZ,
     grace_plan_code VARCHAR(100),
     grace_reminded_at TIMESTAMPTZ,
     ended_at TIMESTAMPTZ,
     ended_reason VARCHAR(100),
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  // Backfill grace columns + relax the status CHECK on databases created before grace.
  `ALTER TABLE property_sponsorships ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ`,
  `ALTER TABLE property_sponsorships ADD COLUMN IF NOT EXISTS grace_plan_code VARCHAR(100)`,
  `ALTER TABLE property_sponsorships ADD COLUMN IF NOT EXISTS grace_reminded_at TIMESTAMPTZ`,
  `ALTER TABLE property_sponsorships DROP CONSTRAINT IF EXISTS property_sponsorships_status_check`,
  `ALTER TABLE property_sponsorships
     ADD CONSTRAINT property_sponsorships_status_check
     CHECK (status IN ('pending', 'active', 'grace', 'ended', 'declined'))`,
  // Recreate partial indexes so the 'grace' state also counts as in-flight.
  `DROP INDEX IF EXISTS idx_property_sponsorships_one_live_per_property`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_property_sponsorships_one_live_per_property
     ON property_sponsorships (property_id)
     WHERE status IN ('pending', 'active', 'grace')`,
  `DROP INDEX IF EXISTS idx_property_sponsorships_sponsor`,
  `CREATE INDEX IF NOT EXISTS idx_property_sponsorships_sponsor
     ON property_sponsorships (sponsor_account_id)
     WHERE status IN ('pending', 'active', 'grace')`,
  `CREATE INDEX IF NOT EXISTS idx_property_sponsorships_beneficiary
     ON property_sponsorships (beneficiary_account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_property_sponsorships_status
     ON property_sponsorships (status)`,
  `CREATE INDEX IF NOT EXISTS idx_property_sponsorships_grace_until
     ON property_sponsorships (grace_until)
     WHERE status = 'grace'`,
];

async function ensurePropertySponsorshipSchema() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
}

module.exports = { ensurePropertySponsorshipSchema };
