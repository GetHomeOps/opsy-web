"use strict";

/**
 * Property Ownership Service
 *
 * Shared logic for transferring property ownership (manual accept flow and
 * automatic transfer when a homeowner accepts an agent/super_admin invite).
 */

const db = require("../db");
const { BadRequestError, ForbiddenError } = require("../expressError");
const Notification = require("../models/notification");
const User = require("../models/user");
const { canCreateProperty, isAdminRole } = require("./tierService");

function propertyLabel(row) {
  const parts = [row.address, row.city, row.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "this property";
}

/**
 * Resolve a user's primary account id.
 * Prefers the account they own; falls back to any linked account.
 */
async function resolveUserPrimaryAccountId(userId, queryFn) {
  const fn = queryFn || ((t, p) => db.query(t, p));
  const res = await fn(
    `SELECT au.account_id
     FROM account_users au
     LEFT JOIN accounts a ON a.id = au.account_id
     WHERE au.user_id = $1
     ORDER BY (a.owner_user_id = $1) DESC
     LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.account_id ?? null;
}

async function cancelPendingTransferRequestsForProperty(propertyId, client) {
  const prev = await client.query(
    `SELECT id FROM property_ownership_transfer_requests
     WHERE property_id = $1 AND status = 'pending'`,
    [propertyId]
  );
  for (const row of prev.rows) {
    await Notification.deleteByOwnershipTransferRequestId(row.id, (t, p) => client.query(t, p));
  }
  if (prev.rows.length > 0) {
    await client.query(
      `UPDATE property_ownership_transfer_requests
       SET status = 'cancelled', responded_at = NOW()
       WHERE property_id = $1 AND status = 'pending'`,
      [propertyId]
    );
  }
}

/**
 * Whether the property already has a homeowner platform user as owner.
 */
async function propertyHasHomeownerOwner(propertyId, queryFn) {
  const fn = queryFn || ((t, p) => db.query(t, p));
  const res = await fn(
    `SELECT 1 FROM property_users pu
     INNER JOIN users u ON u.id = pu.user_id
     WHERE pu.property_id = $1
       AND pu.role = 'owner'
       AND LOWER(u.role::text) = 'homeowner'
     LIMIT 1`,
    [propertyId]
  );
  return res.rows.length > 0;
}

/**
 * Resolve the current property owner user id.
 */
async function getPropertyOwnerUserId(propertyId, queryFn) {
  const fn = queryFn || ((t, p) => db.query(t, p));
  const res = await fn(
    `SELECT user_id FROM property_users
     WHERE property_id = $1 AND role = 'owner'
     ORDER BY created_at ASC
     LIMIT 1`,
    [propertyId]
  );
  return res.rows[0]?.user_id ?? null;
}

/**
 * Whether a homeowner invite acceptance should auto-transfer ownership.
 */
async function shouldAutoTransferOwnershipOnHomeownerInvite({
  invitation,
  inviteeUserId,
  inviteeUserRole,
  queryFn,
}) {
  const fn = queryFn || ((t, p) => db.query(t, p));

  if (invitation?.type !== "property" || !invitation.propertyId) return false;
  if ((invitation.intendedPropertyRole || "").toLowerCase() !== "homeowner") return false;
  if ((invitation.intendedRole || "editor").toLowerCase() === "viewer") return false;
  if ((inviteeUserRole || "").toLowerCase() !== "homeowner") return false;

  if (!invitation.inviterUserId) return false;
  const inviterRes = await fn(
    `SELECT role FROM users WHERE id = $1`,
    [invitation.inviterUserId]
  );
  const inviterRole = (inviterRes.rows[0]?.role || "").toLowerCase();
  if (inviterRole !== "agent" && inviterRole !== "super_admin") return false;

  if (await propertyHasHomeownerOwner(invitation.propertyId, fn)) return false;

  const fromUserId = await getPropertyOwnerUserId(invitation.propertyId, fn);
  if (!fromUserId || Number(fromUserId) === Number(inviteeUserId)) return false;

  return { fromUserId, toUserId: inviteeUserId, propertyId: invitation.propertyId };
}

/**
 * Core ownership transfer: demote prior owner, promote recipient, move account_id.
 * Must run inside a transaction when client is provided.
 */
async function transferPropertyOwnership({
  propertyId,
  fromUserId,
  toUserId,
  client,
  reason = "manual",
  sendNotifications = true,
}) {
  if (!propertyId || !fromUserId || !toUserId) {
    throw new BadRequestError("propertyId, fromUserId, and toUserId are required");
  }
  if (Number(fromUserId) === Number(toUserId)) {
    throw new BadRequestError("Cannot transfer ownership to yourself");
  }

  const queryFn = client ? (t, p) => client.query(t, p) : (t, p) => db.query(t, p);

  const ownerCheck = await queryFn(
    `SELECT 1 FROM property_users
     WHERE property_id = $1 AND user_id = $2 AND role = 'owner'`,
    [propertyId, fromUserId]
  );
  if (ownerCheck.rows.length === 0) {
    throw new BadRequestError("Ownership has changed; this transfer is no longer valid");
  }

  const memberCheck = await queryFn(
    `SELECT 1 FROM property_users WHERE property_id = $1 AND user_id = $2`,
    [propertyId, toUserId]
  );
  if (memberCheck.rows.length === 0) {
    throw new BadRequestError("The new owner must already be on the property team");
  }

  const toAccountId = await resolveUserPrimaryAccountId(toUserId, queryFn);
  if (!toAccountId) {
    throw new BadRequestError("The recipient does not have an account");
  }

  const propAccountRes = await queryFn(
    `SELECT account_id FROM properties WHERE id = $1`,
    [propertyId]
  );
  const currentAccountId = propAccountRes.rows[0]?.account_id;
  const accountChanging =
    currentAccountId && Number(currentAccountId) !== Number(toAccountId);

  if (accountChanging) {
    const toUserRes = await queryFn(`SELECT role FROM users WHERE id = $1`, [toUserId]);
    const toUserRole = toUserRes.rows[0]?.role;
    if (!isAdminRole(toUserRole)) {
      const tierCheck = await canCreateProperty(toAccountId, toUserRole, toUserId);
      if (!tierCheck.allowed) {
        const msg =
          reason === "homeowner_invite"
            ? `You have reached your property limit (${tierCheck.current}/${tierCheck.max}). Upgrade your plan before accepting this invitation.`
            : `The recipient has reached their property limit (${tierCheck.current}/${tierCheck.max}). They need to upgrade their plan before accepting this transfer.`;
        throw new ForbiddenError(msg);
      }
    }
  }

  await cancelPendingTransferRequestsForProperty(propertyId, client || db);

  await queryFn(
    `UPDATE property_users SET role = 'editor', updated_at = NOW()
     WHERE property_id = $1 AND user_id = $2 AND role = 'owner'`,
    [propertyId, fromUserId]
  );
  await queryFn(
    `UPDATE property_users SET role = 'owner', updated_at = NOW()
     WHERE property_id = $1 AND user_id = $2`,
    [propertyId, toUserId]
  );

  if (accountChanging) {
    await queryFn(
      `UPDATE properties SET account_id = $1, updated_at = NOW() WHERE id = $2`,
      [toAccountId, propertyId]
    );
  }

  if (sendNotifications) {
    const propRes = await queryFn(
      `SELECT address, city, state FROM properties WHERE id = $1`,
      [propertyId]
    );
    const prop = propRes.rows[0] || {};
    const label = propertyLabel(prop);
    const toUser = await User.getById(toUserId);
    const toName = toUser?.name || toUser?.email || "The recipient";

    const fromTitle =
      reason === "homeowner_invite"
        ? `${toName} accepted your invitation and is now the owner of ${label}. You are now an editor on this property.`
        : `${toName} accepted ownership of ${label}. You are now an editor on this property.`;

    await Notification.create(
      {
        userId: fromUserId,
        type: "ownership_transfer_accepted",
        propertyId,
        title: fromTitle,
      },
      queryFn
    );
    await Notification.create(
      {
        userId: toUserId,
        type: "ownership_transfer_accepted",
        propertyId,
        title: `You are now the owner of ${label}.`,
      },
      queryFn
    );
  }

  return {
    propertyId,
    fromUserId,
    toUserId,
    accountChanged: accountChanging,
    newAccountId: accountChanging ? toAccountId : currentAccountId,
  };
}

module.exports = {
  propertyLabel,
  resolveUserPrimaryAccountId,
  cancelPendingTransferRequestsForProperty,
  propertyHasHomeownerOwner,
  getPropertyOwnerUserId,
  shouldAutoTransferOwnershipOnHomeownerInvite,
  transferPropertyOwnership,
};
