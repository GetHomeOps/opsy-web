"use strict";

/**
 * One-time heal: sync Customer.io property state and fire no_properties_remaining
 * for users stuck in property nurture journeys with zero properties.
 *
 * Usage:
 *   node scripts/heal_customerio_stuck_profiles.js
 *   node scripts/heal_customerio_stuck_profiles.js af.ordonezs@gmail.com
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const db = require("../db");
const customerIoLifecycleService = require("../services/customerIoLifecycleService");

const DEFAULT_EMAILS = ["af.ordonezs@gmail.com"];

async function healEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return;

  const userRes = await db.query(
    `SELECT id, email FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1`,
    [normalized]
  );
  const user = userRes.rows[0];
  if (!user?.id) {
    console.warn(`[heal] No user row for ${normalized}; skipping`);
    return;
  }

  await customerIoLifecycleService.syncCustomerIoUserPropertyState({
    userId: user.id,
    userEmail: user.email,
    context: { reason: "heal_stuck_profile" },
  });
  console.info(`[heal] Synced Customer.io property state for ${user.email} (user ${user.id})`);
}

async function main() {
  const emails = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_EMAILS;
  for (const email of emails) {
    await healEmail(email);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[heal] Failed:", err.message);
    process.exit(1);
  });
