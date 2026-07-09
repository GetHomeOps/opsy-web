"use strict";

/**
 * In-process scheduler for ready-to-use demo account expiry notifications.
 *
 * Mirrors sponsorshipScheduler: lightweight hourly sweep, idempotent via
 * demo_expiry_notified_at. Only runs in the demo environment.
 */

const db = require("../db");
const { isDemoEnvironment } = require("../helpers/demoEnvironment");
const {
  DEMO_USER_SELECT,
  notifyDemoAccountExpired,
} = require("./demoAccountNotifyService");

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const INITIAL_DELAY_MS = 60 * 1000; // first run shortly after boot

let timer = null;
let running = false;

async function claimExpiredDemoAccounts() {
  const result = await db.query(
    `UPDATE users
     SET demo_expiry_notified_at = NOW(),
         updated_at = NOW()
     WHERE demo_login_password IS NOT NULL
       AND demo_expires_at IS NOT NULL
       AND demo_expires_at <= NOW()
       AND demo_expiry_notified_at IS NULL
     RETURNING id`
  );
  return result.rows.map((row) => row.id);
}

async function loadClaimedUsers(userIds) {
  if (!userIds.length) return [];
  const result = await db.query(
    `SELECT ${DEMO_USER_SELECT}
     FROM users u
     LEFT JOIN users provisioner ON provisioner.id = u.demo_provisioned_by_user_id
     WHERE u.id = ANY($1::int[])`,
    [userIds]
  );
  return result.rows;
}

async function clearExpiryNotified(userId) {
  await db.query(
    `UPDATE users
     SET demo_expiry_notified_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

async function runOnce() {
  if (running) return;
  if (!isDemoEnvironment()) return;

  running = true;
  try {
    const claimedIds = await claimExpiredDemoAccounts();
    if (!claimedIds.length) return;

    const users = await loadClaimedUsers(claimedIds);
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      const result = await notifyDemoAccountExpired(user);
      if (result?.success) {
        sent += 1;
      } else {
        failed += 1;
        try {
          await clearExpiryNotified(user.id);
        } catch (clearErr) {
          console.warn(
            "[demoExpiry] failed to clear notified flag:",
            clearErr?.message
          );
        }
      }
    }

    if (sent > 0 || failed > 0) {
      console.info(
        `[demoExpiry] sweep: claimed=${claimedIds.length} sent=${sent} failed=${failed}`
      );
    }
  } catch (err) {
    console.warn("[demoExpiry] sweep failed:", err?.message);
  } finally {
    running = false;
  }
}

function startDemoExpirySweeper() {
  if (timer) return;
  if (!isDemoEnvironment()) {
    console.info("[demoExpiry] sweeper skipped (not demo environment).");
    return;
  }
  setTimeout(runOnce, INITIAL_DELAY_MS).unref?.();
  timer = setInterval(runOnce, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.info("[demoExpiry] expiry notification sweeper started (hourly).");
}

module.exports = { startDemoExpirySweeper, runOnce };
