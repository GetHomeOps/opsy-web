"use strict";

/**
 * One-shot migration: add audience to maintenance_events so homeowner- vs
 * agent-facing calendar events can be filtered independently. Safe to re-run.
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE maintenance_events
     ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'all'`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_events_audience_check'
  ) THEN
    ALTER TABLE maintenance_events
      ADD CONSTRAINT maintenance_events_audience_check
      CHECK (audience IN ('all', 'homeowner', 'agent'));
  END IF;
END $$`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_events_home_anniversary
     ON maintenance_events (property_id, audience)
     WHERE system_key = 'homeAnniversary' AND recurrence_parent_id IS NULL`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("maintenance_events.audience is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
