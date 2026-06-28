#!/usr/bin/env node
/**
 * Backfill demo account contacts for provisioned demo accounts.
 * Safe to re-run — upserts by email within each account.
 *
 * Usage:
 *   node scripts/backfill-demo-account-contacts.js
 *   node scripts/backfill-demo-account-contacts.js --email=agent@example.com
 */
require("dotenv").config();
const db = require("../db");
const { upsertAccountContacts } = require("../services/demoAccountProvisioner");

async function findDemoAccounts(email) {
  if (email) {
    const res = await db.query(
      `SELECT u.id AS user_id, u.email, u.name, a.id AS account_id, a.url AS account_url
       FROM users u
       JOIN account_users au ON au.user_id = u.id AND au.role = 'owner'
       JOIN accounts a ON a.id = au.account_id
       WHERE u.demo_login_password IS NOT NULL
         AND u.email = $1`,
      [email]
    );
    return res.rows;
  }

  const res = await db.query(
    `SELECT u.id AS user_id, u.email, u.name, a.id AS account_id, a.url AS account_url
     FROM users u
     JOIN account_users au ON au.user_id = u.id AND au.role = 'owner'
     JOIN accounts a ON a.id = au.account_id
     WHERE u.demo_login_password IS NOT NULL
     ORDER BY u.id`
  );
  return res.rows;
}

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--email="));
  const email = emailArg ? emailArg.split("=")[1] : null;

  const accounts = await findDemoAccounts(email);
  if (!accounts.length) {
    console.error(
      email
        ? `No provisioned demo account found for email: ${email}`
        : "No provisioned demo accounts found (demo_login_password IS NOT NULL)."
    );
    process.exit(1);
  }

  console.log(`Backfilling contacts for ${accounts.length} demo account(s)...`);
  let totalInserted = 0;
  let totalUpdated = 0;

  for (const row of accounts) {
    try {
      const result = await upsertAccountContacts(row.account_id);
      totalInserted += result.inserted;
      totalUpdated += result.updated;
      console.log(
        `  ${row.email} (${row.account_url}): +${result.inserted} inserted, ${result.updated} updated`
      );
    } catch (err) {
      console.error(`  ${row.email}: ${err.message}`);
    }
  }

  console.log(`Done. ${totalInserted} inserted, ${totalUpdated} updated across ${accounts.length} account(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
