#!/usr/bin/env node
/**
 * Cleanup Incomplete Signups
 *
 * Deactivates users who never completed onboarding (payment or free plan selection)
 * after a configurable grace period. Run via cron (e.g. daily):
 *
 *   node scripts/cleanup-incomplete-signups.js
 *
 * Or with custom retention days:
 *   INCOMPLETE_SIGNUP_RETENTION_DAYS=7 node scripts/cleanup-incomplete-signups.js
 *
 * Environment:
 *   INCOMPLETE_SIGNUP_RETENTION_DAYS - Days before deactivating (default: 14)
 *   DRY_RUN - If set, only report what would be done without making changes
 */
require("dotenv").config();
const db = require("../db");

const RETENTION_DAYS = parseInt(process.env.INCOMPLETE_SIGNUP_RETENTION_DAYS || "14", 10);
const DRY_RUN = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";

async function run() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString();

  try {
    const { rows } = await db.query(
      `SELECT id, email, name, created_at
       FROM users
       WHERE onboarding_completed = false
         AND created_at < $1
       ORDER BY created_at ASC`,
      [cutoffStr]
    );

    if (rows.length === 0) {
      console.log(`No incomplete signups older than ${RETENTION_DAYS} days (cutoff: ${cutoffStr}).`);
      return;
    }

    console.log(`Found ${rows.length} incomplete signup(s) older than ${RETENTION_DAYS} days:`);
    rows.forEach((r) => {
      console.log(`  - ${r.email} (id: ${r.id}, created: ${r.created_at})`);
    });

    if (DRY_RUN) {
      console.log("\n[DRY RUN] No changes made. Set DRY_RUN=false to deactivate these users.");
      return;
    }

    const ids = rows.map((r) => r.id);
    await db.query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ANY($1)`,
      [ids]
    );

    console.log(`\nDeactivated ${ids.length} user(s). They can no longer sign in.`);
  } catch (err) {
    console.error("Cleanup failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
