#!/usr/bin/env node
/**
 * Add maintenance_record_id column to notifications table.
 * Required for maintenance-related notifications (e.g. contractor report sent).
 * Run: node scripts/run-notifications-maintenance-record-migration.js
 */
require("dotenv").config();
const db = require("../db");

async function run() {
  try {
    await db.query(`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS maintenance_record_id INTEGER REFERENCES property_maintenance(id) ON DELETE SET NULL
    `);
    console.log("Migration complete: maintenance_record_id column added to notifications.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
