"use strict";

/**
 * Apply the RLS lock SQL files against DATABASE_URL.
 * Production Opsy/DEMO were applied via the Supabase migration API.
 * Use this for a local/staging database that still has the public grants.
 *
 * Usage:
 *   node scripts/run_rls_lock.js            # revoke + remaining RLS
 *   node scripts/run_rls_lock.js --down     # restore anon/authenticated grants
 */
const fs = require("fs");
const path = require("path");
const db = require("../db");

const sqlDir = path.join(__dirname, "sql");
const down = process.argv.includes("--down");

const files = down
  ? ["rls_lock_01_revoke_anon_authenticated_down.sql"]
  : [
    "rls_lock_01_revoke_anon_authenticated.sql",
    "rls_lock_02_enable_rls_pilot.sql",
    "rls_lock_03_enable_rls_remaining.sql",
  ];

async function run() {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(sqlDir, file), "utf8");
    await db.query(sql);
    // eslint-disable-next-line no-console
    console.log(`applied ${file}`);
  }
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
