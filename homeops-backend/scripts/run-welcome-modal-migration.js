#!/usr/bin/env node
/**
 * Add welcome_modal_dismissed column to users table.
 * Run: node scripts/run-welcome-modal-migration.js
 */
require("dotenv").config();
const db = require("../db");

async function run() {
  try {
    await db.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_modal_dismissed BOOLEAN DEFAULT false"
    );
    console.log("Migration complete: welcome_modal_dismissed column added.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
