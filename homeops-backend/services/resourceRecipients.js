"use strict";

/**
 * Resolves recipients for resource broadcasts.
 * - admin/super_admin: all contacts + all active users
 * - agents: their contacts + linked homeowners (same account)
 */

const db = require("../db");
const Contact = require("../models/contact");

/** Get contacts for a user (scoped by role).
 * Agents: contacts they added, invited, or share a managed property with.
 * Homeowners: contacts they added, their property agents, or legacy account-owned vendors.
 * Admins: all contacts.
 */
async function getContactsForUser(userId, userRole) {
  const contacts = await Contact.getAllForUser(userId, userRole);
  return contacts
    .filter((c) => c.email)
    .map((c) => ({ id: c.id, name: c.name, email: c.email }));
}

/** Get active users (is_active, has account_users).
 * roleFilter: 'homeowner' | 'agent' | null (all)
 */
async function getActiveUsersForUser(userId, userRole, roleFilter = null) {
  let query = `
    SELECT u.id, u.email, u.name FROM users u
    JOIN account_users au ON au.user_id = u.id
    WHERE u.is_active = true
  `;
  const values = [];
  let idx = 1;

  if (roleFilter) {
    query += ` AND u.role = $${idx}`;
    values.push(roleFilter);
    idx++;
  }

  if (userRole === "super_admin" || userRole === "admin") {
    query += ` ORDER BY u.name`;
    const r = await db.query(query, values);
    return r.rows;
  }

  if (userRole === "agent") {
    query += ` AND au.account_id IN (
      SELECT account_id FROM account_users WHERE user_id = $${idx}
    )`;
    values.push(userId);
    query += ` ORDER BY u.name`;
    const r = await db.query(query, values);
    return r.rows;
  }

  return [];
}

/** Resolve recipients based on mode and ids. Returns { contacts, users, count }. */
async function resolveRecipients(userId, userRole, recipientMode, recipientIds = []) {
  const ids = Array.isArray(recipientIds) ? recipientIds : [];
  let contacts = [];
  let users = [];

  switch (recipientMode) {
    case "all_contacts": {
      contacts = await getContactsForUser(userId, userRole);
      break;
    }
    case "specific_contacts": {
      if (ids.length === 0) break;
      const r = await db.query(
        `SELECT id, name, email FROM contacts WHERE id = ANY($1::int[]) AND email IS NOT NULL AND email != ''`,
        [ids]
      );
      contacts = r.rows;
      break;
    }
    case "all_homeowners": {
      users = await getActiveUsersForUser(userId, userRole, "homeowner");
      break;
    }
    case "all_users": {
      if (userRole !== "super_admin" && userRole !== "admin") break;
      users = await getActiveUsersForUser(userId, userRole, null);
      break;
    }
    case "all_agents": {
      if (userRole !== "super_admin" && userRole !== "admin") break;
      users = await getActiveUsersForUser(userId, userRole, "agent");
      break;
    }
    case "specific_users": {
      if (userRole !== "super_admin" && userRole !== "admin" || ids.length === 0) break;
      const r = await db.query(
        `SELECT id, email, name FROM users WHERE id = ANY($1::int[]) AND is_active = true`,
        [ids]
      );
      users = r.rows;
      break;
    }
    default:
      break;
  }

  const emails = new Set();
  contacts.forEach((c) => { if (c.email) emails.add(c.email); });
  users.forEach((u) => { if (u.email) emails.add(u.email); });

  return {
    contacts,
    users,
    count: emails.size,
    emails: Array.from(emails),
  };
}

/** Estimate recipient count without full resolution. */
async function estimateRecipients(userId, userRole, recipientMode, recipientIds = []) {
  const { count } = await resolveRecipients(userId, userRole, recipientMode, recipientIds);
  return count;
}

module.exports = {
  resolveRecipients,
  estimateRecipients,
  getContactsForUser,
  getActiveUsersForUser,
};
