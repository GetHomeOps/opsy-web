#!/usr/bin/env node
/**
 * Add property_id column to notifications table (property_missing_agent, etc.).
 * Run: node scripts/run-notifications-property-id-migration.js
 */
require("dotenv").config();
const db = require("../db");

async function run() {
  try {
    await db.query(`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_property_id
      ON notifications(property_id) WHERE property_id IS NOT NULL
    `);
    console.log("Migration complete: property_id column added to notifications.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
