"use strict";

/**
 * Ops email alerts for ready-to-use demo account lifecycle events.
 * Failures are logged and never thrown to callers (login / sweeper).
 */

const db = require("../db");
const {
  sendDemoAccountOpenedEmail,
  sendDemoAccountExpiredEmail,
} = require("./emailService");

const DEMO_USER_SELECT = `
  u.id,
  u.email,
  u.name,
  u.role,
  u.demo_expires_at AS "demoExpiresAt",
  u.demo_first_login_at AS "demoFirstLoginAt",
  u.demo_provisioned_by_user_id AS "demoProvisionedByUserId",
  provisioner.name AS "provisionedByName",
  (
    SELECT a.url
    FROM account_users au
    JOIN accounts a ON a.id = au.account_id
    WHERE au.user_id = u.id
    ORDER BY au.created_at ASC
    LIMIT 1
  ) AS "accountUrl"
`;

async function loadDemoNotifyUser(userId) {
  const result = await db.query(
    `SELECT ${DEMO_USER_SELECT}
     FROM users u
     LEFT JOIN users provisioner ON provisioner.id = u.demo_provisioned_by_user_id
     WHERE u.id = $1
       AND u.demo_login_password IS NOT NULL`,
    [userId]
  );
  return result.rows[0] || null;
}

async function notifyDemoAccountOpened(userId) {
  try {
    const user = await loadDemoNotifyUser(userId);
    if (!user) return { success: false, reason: "not_demo_user" };
    return await sendDemoAccountOpenedEmail(user);
  } catch (err) {
    console.error("[demoAccountNotify] opened:", err.message);
    return { success: false, reason: "send_failed" };
  }
}

async function notifyDemoAccountExpired(user) {
  try {
    if (!user?.id) return { success: false, reason: "no_user" };
    return await sendDemoAccountExpiredEmail(user);
  } catch (err) {
    console.error("[demoAccountNotify] expired:", err.message);
    return { success: false, reason: "send_failed" };
  }
}

module.exports = {
  loadDemoNotifyUser,
  notifyDemoAccountOpened,
  notifyDemoAccountExpired,
  DEMO_USER_SELECT,
};
