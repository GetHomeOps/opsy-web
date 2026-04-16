"use strict";

/**
 * Property Agent Policy
 *
 * Enforces "only one agent per property" across invitation creation and direct
 * team updates. An "agent" here is any user whose platform role is agent,
 * admin, or super_admin (matches propertyMissingAgentNotifications + the
 * frontend hasAgent rule in SharePropertyModal).
 */

const db = require("../db");
const { BadRequestError } = require("../expressError");

const AGENT_PLATFORM_ROLES = ["agent", "admin", "super_admin"];

/** Does the invitee (by email) currently exist as an active agent-role user? */
async function isEmailAnActiveAgentUser(emailLower) {
  if (!emailLower) return false;
  const r = await db.query(
    `SELECT role FROM users WHERE LOWER(TRIM(email)) = $1 AND is_active = true`,
    [emailLower]
  );
  if (r.rows.length === 0) return false;
  return AGENT_PLATFORM_ROLES.includes(
    (r.rows[0].role || "").toLowerCase()
  );
}

/**
 * Is there already an agent-role user on the property, or a pending property
 * invitation whose invitee resolves to an agent-role user?
 *
 * @param {number} propertyId
 * @param {object} [opts]
 * @param {number} [opts.excludeUserId] - ignore this user_id in property_users
 * @param {number} [opts.excludeInvitationId] - ignore this invitation in pending check
 */
async function propertyHasAgentMemberOrPendingAgentInvitation(
  propertyId,
  { excludeUserId, excludeInvitationId } = {}
) {
  const memberSql = excludeUserId
    ? `SELECT 1 FROM property_users pu
       INNER JOIN users u ON u.id = pu.user_id
       WHERE pu.property_id = $1
         AND u.is_active = true
         AND u.role::text = ANY($2::text[])
         AND u.id != $3
       LIMIT 1`
    : `SELECT 1 FROM property_users pu
       INNER JOIN users u ON u.id = pu.user_id
       WHERE pu.property_id = $1
         AND u.is_active = true
         AND u.role::text = ANY($2::text[])
       LIMIT 1`;
  const memberParams = excludeUserId
    ? [propertyId, AGENT_PLATFORM_ROLES, excludeUserId]
    : [propertyId, AGENT_PLATFORM_ROLES];
  const memberRes = await db.query(memberSql, memberParams);
  if (memberRes.rows.length > 0) return true;

  const pendingSql = excludeInvitationId
    ? `SELECT 1 FROM invitations i
       INNER JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(i.invitee_email))
       WHERE i.property_id = $1
         AND i.status = 'pending'
         AND u.is_active = true
         AND u.role::text = ANY($2::text[])
         AND i.id != $3
       LIMIT 1`
    : `SELECT 1 FROM invitations i
       INNER JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(i.invitee_email))
       WHERE i.property_id = $1
         AND i.status = 'pending'
         AND u.is_active = true
         AND u.role::text = ANY($2::text[])
       LIMIT 1`;
  const pendingParams = excludeInvitationId
    ? [propertyId, AGENT_PLATFORM_ROLES, excludeInvitationId]
    : [propertyId, AGENT_PLATFORM_ROLES];
  const pendingRes = await db.query(pendingSql, pendingParams);
  return pendingRes.rows.length > 0;
}

/**
 * Reject if inviting this email to this property would add a second
 * agent-role user (counting accepted members and pending invitations).
 */
async function assertPropertyCanAcceptAgentInvite(propertyId, inviteeEmailLower) {
  if (!(await isEmailAnActiveAgentUser(inviteeEmailLower))) return;
  if (await propertyHasAgentMemberOrPendingAgentInvitation(propertyId)) {
    throw new BadRequestError(
      "An agent has already been added or invited to this property. Only one agent is allowed per property."
    );
  }
}

/**
 * Given a list of user ids being added/synced to a property, reject if more
 * than one is an agent-role user, or if the single agent-role user would land
 * on a property that already has a different agent-role user (accepted or
 * pending invitation).
 *
 * Used by POST /:propertyId/users (additive) and PATCH /:propertyId/team (sync).
 *
 * @param {number} propertyId
 * @param {Array<number>} userIds - desired user ids after the operation
 * @param {object} [opts]
 * @param {boolean} [opts.isSync=false] - when true (PATCH /team), users not in
 *   userIds will be removed; we only need to worry about conflicts within userIds
 *   itself. When false (POST /users, additive), we also need to ensure the
 *   property doesn't already have a different agent user still present.
 */
async function assertAtMostOneAgentOnProperty(propertyId, userIds, { isSync = false } = {}) {
  const ids = (userIds || []).map((n) => Number(n)).filter((n) => Number.isInteger(n));
  if (ids.length === 0) return;

  const r = await db.query(
    `SELECT id FROM users
     WHERE id = ANY($1::int[])
       AND is_active = true
       AND role::text = ANY($2::text[])`,
    [ids, AGENT_PLATFORM_ROLES]
  );
  const agentIdsInRequest = r.rows.map((row) => row.id);
  if (agentIdsInRequest.length > 1) {
    throw new BadRequestError(
      "Only one agent is allowed per property."
    );
  }
  if (agentIdsInRequest.length === 1 && !isSync) {
    const hasOther = await propertyHasAgentMemberOrPendingAgentInvitation(
      propertyId,
      { excludeUserId: agentIdsInRequest[0] }
    );
    if (hasOther) {
      throw new BadRequestError(
        "An agent has already been added or invited to this property. Only one agent is allowed per property."
      );
    }
  }
}

module.exports = {
  AGENT_PLATFORM_ROLES,
  isEmailAnActiveAgentUser,
  propertyHasAgentMemberOrPendingAgentInvitation,
  assertPropertyCanAcceptAgentInvite,
  assertAtMostOneAgentOnProperty,
};
