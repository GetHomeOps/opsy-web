#!/usr/bin/env node
/**
 * Add event_type to maintenance_events (maintenance vs inspection) for calendar display.
 * Run: node scripts/run-maintenance-event-type-migration.js
 *
 * Safe on fresh installs that already include event_type in opsy-schema.sql (no-op for column + constraint).
 */
require("dotenv").config();
const db = require("../db");

const MIGRATION_SQL = `
ALTER TABLE maintenance_events
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) DEFAULT 'maintenance';

UPDATE maintenance_events SET event_type = 'maintenance' WHERE event_type IS NULL;

ALTER TABLE maintenance_events ALTER COLUMN event_type SET DEFAULT 'maintenance';

ALTER TABLE maintenance_events ALTER COLUMN event_type SET NOT NULL;

DO $m$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'maintenance_events'
      AND c.conname = 'maintenance_events_event_type_check'
  ) THEN
    ALTER TABLE maintenance_events ADD CONSTRAINT maintenance_events_event_type_check
      CHECK (event_type IN ('maintenance', 'inspection'));
  END IF;
END $m$;
`;

async function run() {
  try {
    await db.query(MIGRATION_SQL);
    console.log("maintenance_events.event_type migration complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
