"use strict";

/**
 * Property Access Helper
 *
 * Single source of truth for "is this user allowed to act on this property?".
 *
 * Mirrors the policy enforced by middleware/auth.ensurePropertyAccess:
 *   - super_admin / admin always allowed
 *   - membership in property_users
 *   - OR tethered assistants inherit their agent's property_users membership
 *   - OR a pending, non-expired invitation matching the user's email
 *
 * Used by both the express middleware and non-HTTP entry points (e.g. the
 * SES inbound email pipeline) so the rules stay in one place.
 *
 * Exports:
 *   - isUserAuthorizedForProperty({ userId, propertyId, role? }, dbClient?)
 *   - hasPropertyMembership({ userId, propertyId }, dbClient?)
 *   - hasPendingInvitationForProperty({ userId, propertyId }, dbClient?)
 *   - resolveAssistantAgentUserId(userId, dbClient?)
 *   - resolvePropertiesListUserId(userId, dbClient?)
 */

/** Lazy-load so unit tests can inject a mock client without opening a pool. */
function defaultDb() {
  return require("../db");
}

/**
 * Membership check: user_id ∈ property_users(property_id).
 * Caller may pass a transaction client; defaults to the pool.
 */
async function hasPropertyMembership({ userId, propertyId }, dbClient) {
  const db = dbClient || defaultDb();
  if (!userId || !propertyId) return false;
  const result = await db.query(
    `SELECT 1 FROM property_users WHERE property_id = $1 AND user_id = $2 LIMIT 1`,
    [propertyId, userId],
  );
  return result.rows.length > 0;
}

/**
 * Pending-invitation check: an invitation row addressed to this user's email
 * (case-insensitive) for this property, still pending and not expired.
 */
async function hasPendingInvitationForProperty(
  { userId, propertyId },
  dbClient,
) {
  const db = dbClient || defaultDb();
  if (!userId || !propertyId) return false;
  const result = await db.query(
    `SELECT 1 FROM invitations i
     JOIN users u ON LOWER(u.email) = LOWER(i.invitee_email) AND u.id = $2
     WHERE i.property_id = $1 AND i.status = 'pending' AND i.expires_at > NOW()
     LIMIT 1`,
    [propertyId, userId],
  );
  return result.rows.length > 0;
}

/**
 * For tethered assistants, return the agent user id they inherit workspace
 * access from. Returns null when the user is not an active tether.
 */
async function resolveAssistantAgentUserId(userId, dbClient) {
  const db = dbClient || defaultDb();
  if (!userId) return null;
  const result = await db.query(
    `SELECT assistant_of_user_id AS "agentId"
     FROM users
     WHERE id = $1
       AND role = 'assistant'
       AND assistant_of_user_id IS NOT NULL`,
    [userId],
  );
  const agentId = result.rows[0]?.agentId;
  return agentId != null ? Number(agentId) : null;
}

/**
 * User id whose property_users rows should be listed for this viewer.
 * Assistants inherit their tethered agent's property portfolio.
 */
async function resolvePropertiesListUserId(userId, dbClient) {
  const agentId = await resolveAssistantAgentUserId(userId, dbClient);
  return agentId != null ? agentId : Number(userId);
}

/**
 * True when a tethered assistant should inherit access because their agent
 * is on the property team.
 */
async function hasAssistantInheritedMembership(
  { userId, propertyId },
  dbClient,
) {
  const agentId = await resolveAssistantAgentUserId(userId, dbClient);
  if (!agentId) return false;
  return hasPropertyMembership({ userId: agentId, propertyId }, dbClient);
}

/**
 * Combined check used by every "user touches property" path.
 *
 * @param {{ userId: number, propertyId: number, role?: string }} args
 *   role is optional - if provided and equal to "super_admin"/"admin",
 *   short-circuits to true (matches middleware behavior).
 * @param {{ query: Function }} [dbClient] - optional transaction client.
 */
async function isUserAuthorizedForProperty(
  { userId, propertyId, role } = {},
  dbClient,
) {
  if (!userId || !propertyId) return false;
  if (role === "super_admin" || role === "admin") return true;
  if (await hasPropertyMembership({ userId, propertyId }, dbClient)) return true;
  if (await hasAssistantInheritedMembership({ userId, propertyId }, dbClient)) {
    return true;
  }
  if (await hasPendingInvitationForProperty({ userId, propertyId }, dbClient)) {
    return true;
  }
  return false;
}

module.exports = {
  isUserAuthorizedForProperty,
  hasPropertyMembership,
  hasPendingInvitationForProperty,
  hasAssistantInheritedMembership,
  resolveAssistantAgentUserId,
  resolvePropertiesListUserId,
};
