#!/usr/bin/env node
/**
 * Add composite indexes to speed up calendar and property list queries.
 * Run: node scripts/run-perf-indexes-migration.js
 */
require("dotenv").config();
const db = require("../db");

const MIGRATION_SQL = `
-- Composite index for calendar queries that filter by (property_id, scheduled_date)
CREATE INDEX IF NOT EXISTS idx_maintenance_events_property_date
  ON maintenance_events(property_id, scheduled_date);

-- Partial composite index for property_systems calendar lookups
CREATE INDEX IF NOT EXISTS idx_property_systems_property_service
  ON property_systems(property_id, next_service_date)
  WHERE next_service_date IS NOT NULL;

-- Composite index for property_users role-priority owner lookup
CREATE INDEX IF NOT EXISTS idx_property_users_property_role
  ON property_users(property_id, role, created_at);
`;

async function run() {
  try {
    await db.query(MIGRATION_SQL);
    console.log("Performance indexes migration complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
