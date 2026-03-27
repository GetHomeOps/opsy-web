"use strict";

/**
 * Notify platform admin/super_admin when a property has no Opsy team member
 * whose user role is agent, admin, or super_admin (matches frontend hasAgent).
 * Sync removes alerts when an Opsy agent is added to the property team.
 */

const db = require("../db");
const Notification = require("../models/notification");

const OPSY_AGENT_USER_ROLES = ["agent", "admin", "super_admin"];

async function propertyHasOpsyAgentUser(propertyId) {
  const r = await db.query(
    `SELECT 1
     FROM property_users pu
     INNER JOIN users u ON u.id = pu.user_id
     WHERE pu.property_id = $1
       AND u.role::text = ANY($2::text[])
     LIMIT 1`,
    [propertyId, OPSY_AGENT_USER_ROLES]
  );
  return r.rows.length > 0;
}

async function getPlatformAdminUserIds() {
  const r = await db.query(
    `SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND is_active = true`
  );
  return r.rows.map((row) => row.id);
}

function buildTitle(row) {
  const parts = [row.address, row.city, row.state]
    .filter(Boolean)
    .map((s) => String(s).trim())
    .filter(Boolean);
  const label =
    parts.length > 0 ? parts.join(", ") : row.property_uid || `Property #${row.id}`;
  return `Property has no Opsy team agent: ${label}`;
}

async function syncPropertyMissingAgentAdminNotifications(propertyId) {
  if (propertyId == null) return;
  const pid = Number(propertyId);
  if (!Number.isInteger(pid) || pid < 1) return;

  const hasAgent = await propertyHasOpsyAgentUser(pid);
  if (hasAgent) {
    await db.query(`DELETE FROM notifications WHERE type = 'property_missing_agent' AND property_id = $1`, [
      pid,
    ]);
    return;
  }

  const propRes = await db.query(
    `SELECT id, address, city, state, property_uid FROM properties WHERE id = $1`,
    [pid]
  );
  const prop = propRes.rows[0];
  if (!prop) return;

  const adminIds = await getPlatformAdminUserIds();
  if (!adminIds.length) return;

  const title = buildTitle(prop);

  for (const userId of adminIds) {
    const dup = await db.query(
      `SELECT 1 FROM notifications
       WHERE user_id = $1 AND type = 'property_missing_agent' AND property_id = $2 AND read_at IS NULL
       LIMIT 1`,
      [userId, pid]
    );
    if (dup.rows.length > 0) continue;
    await Notification.create({
      userId,
      type: "property_missing_agent",
      title,
      propertyId: pid,
    });
  }
}

module.exports = {
  syncPropertyMissingAgentAdminNotifications,
  propertyHasOpsyAgentUser,
};
