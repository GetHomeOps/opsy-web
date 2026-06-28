"use strict";

/**
 * Customer.io person profile sync for property state and journey exit events.
 * Fires no_properties_remaining only when a user's property_count is zero.
 */

const db = require("../db");
const { APP_BASE_URL } = require("../config");
const customerIoProvider = require("./emailProviders/customerIoProvider");

const NO_PROPERTIES_REMAINING_EVENT = "no_properties_remaining";

function normalizeAccountSlug(raw) {
  return String(raw || "home").replace(/^\/+|\/+$/g, "");
}

function buildPropertyUrl(accountSlug, propertyUid) {
  const base = (APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  const slug = normalizeAccountSlug(accountSlug);
  if (propertyUid) {
    return `${base}/${slug}/properties/${propertyUid}`;
  }
  return `${base}/${slug}/properties/new`;
}

async function loadUserEmail(userId, userEmail) {
  if (userEmail) return String(userEmail).trim();
  const res = await db.query(`SELECT email FROM users WHERE id = $1`, [userId]);
  return String(res.rows[0]?.email || "").trim();
}

async function loadUserPropertyState(userId) {
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS c FROM property_users WHERE user_id = $1`,
    [userId]
  );
  const propertyCount = countRes.rows[0]?.c ?? 0;

  let primaryPropertyUid = "";
  let primaryPropertyId = null;
  let accountSlug = "home";

  if (propertyCount > 0) {
    const primaryRes = await db.query(
      `SELECT p.id, p.property_uid, a.url AS account_url, a.name AS account_name
       FROM property_users pu
       JOIN properties p ON p.id = pu.property_id
       JOIN accounts a ON a.id = p.account_id
       WHERE pu.user_id = $1
       ORDER BY CASE WHEN pu.role = 'owner' THEN 0 ELSE 1 END, pu.created_at
       LIMIT 1`,
      [userId]
    );
    const row = primaryRes.rows[0];
    if (row) {
      primaryPropertyUid = String(row.property_uid || "").trim();
      primaryPropertyId = row.id;
      accountSlug = row.account_url || row.account_name || "home";
    }
  } else {
    const accRes = await db.query(
      `SELECT a.url, a.name
       FROM account_users au
       JOIN accounts a ON a.id = au.account_id
       WHERE au.user_id = $1
       ORDER BY au.created_at
       LIMIT 1`,
      [userId]
    );
    const acc = accRes.rows[0];
    if (acc) {
      accountSlug = acc.url || acc.name || "home";
    }
  }

  return {
    propertyCount,
    primaryPropertyUid,
    primaryPropertyId,
    accountSlug,
    primaryPropertyUrl: buildPropertyUrl(accountSlug, primaryPropertyUid),
  };
}

/**
 * Sync Customer.io person attributes for property state.
 * Fires no_properties_remaining when property_count is 0 (unless fireExitEvent is false).
 */
async function syncCustomerIoUserPropertyState({
  userId,
  userEmail,
  context = {},
  fireExitEvent = true,
}) {
  if (!customerIoProvider.isCustomerIoConfigured()) return;

  const uid = Number(userId);
  if (!uid || Number.isNaN(uid)) return;

  try {
    const email = await loadUserEmail(uid, userEmail);
    if (!email) return;

    const state = await loadUserPropertyState(uid);
    const hasProperty = state.propertyCount > 0;

    await customerIoProvider.identifyPerson({
      email,
      attributes: {
        has_property: hasProperty,
        property_count: state.propertyCount,
        primary_property_uid: state.primaryPropertyUid,
        primary_property_url: state.primaryPropertyUrl,
      },
    });

    if (fireExitEvent && state.propertyCount === 0) {
      await customerIoProvider.trackNoPropertiesRemaining({
        userEmail: email,
        userId: uid,
        reason: context.reason || "unknown",
        lastPropertyId: context.lastPropertyId ?? null,
        lastPropertyUid: context.lastPropertyUid || "",
      });
    }
  } catch (err) {
    console.error(
      "[customerIoLifecycleService] syncCustomerIoUserPropertyState:",
      err.message
    );
  }
}

async function syncCustomerIoUsersPropertyState(userIds, context = {}) {
  const ids = [
    ...new Set(
      userIds
        .map((id) => Number(id))
        .filter((id) => id && !Number.isNaN(id))
    ),
  ];
  await Promise.all(
    ids.map((id) => syncCustomerIoUserPropertyState({ userId: id, context }))
  );
}

module.exports = {
  NO_PROPERTIES_REMAINING_EVENT,
  buildPropertyUrl,
  normalizeAccountSlug,
  syncCustomerIoUserPropertyState,
  syncCustomerIoUsersPropertyState,
};
