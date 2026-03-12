#!/usr/bin/env node
/**
 * Add communication_id column to notifications table.
 * Required for communication_sent notifications (resource_id references resources, not communications).
 * Run: node scripts/run-notifications-communication-id-migration.js
 */
require("dotenv").config();
const db = require("../db");

async function run() {
  try {
    await db.query(`
      ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS communication_id INTEGER REFERENCES communications(id) ON DELETE CASCADE
    `);
    console.log("Migration complete: communication_id column added to notifications.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
