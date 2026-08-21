"use strict";

/**
 * One-shot migration: allow homeAnniversary and other as first-class
 * event_types on maintenance_events (not stored as 'maintenance'). Safe to re-run.
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE maintenance_events
     DROP CONSTRAINT IF EXISTS maintenance_events_event_type_check`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_events_event_type_check'
  ) THEN
    ALTER TABLE maintenance_events
      ADD CONSTRAINT maintenance_events_event_type_check
      CHECK (event_type IN ('maintenance', 'inspection', 'homeAnniversary', 'other'));
  END IF;
END $$`,
  `UPDATE maintenance_events
      SET event_type = 'homeAnniversary'
    WHERE system_key = 'homeAnniversary'
      AND event_type IS DISTINCT FROM 'homeAnniversary'`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("maintenance_events.event_type allows homeAnniversary and other.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
