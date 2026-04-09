"use strict";

const db = require("../db");
const { BadRequestError, ForbiddenError, NotFoundError } = require("../expressError");
const Notification = require("./notification");
const User = require("./user");
const { canCreateProperty, isAdminRole } = require("../services/tierService");

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

async function cancelPendingForProperty(propertyId, client) {
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

class PropertyOwnershipTransferRequest {
  static async create({ propertyId, fromUserId, toUserId }) {
    if (!propertyId || !fromUserId || !toUserId) {
      throw new BadRequestError("propertyId, fromUserId, and toUserId are required");
    }
    if (Number(fromUserId) === Number(toUserId)) {
      throw new BadRequestError("Cannot transfer ownership to yourself");
    }

    const ownerRow = await db.query(
      `SELECT 1 FROM property_users
       WHERE property_id = $1 AND user_id = $2 AND role = 'owner'`,
      [propertyId, fromUserId]
    );
    if (ownerRow.rows.length === 0) {
      throw new ForbiddenError("Only the property owner can request a transfer");
    }

    const memberRow = await db.query(
      `SELECT 1 FROM property_users WHERE property_id = $1 AND user_id = $2`,
      [propertyId, toUserId]
    );
    if (memberRow.rows.length === 0) {
      throw new BadRequestError("The new owner must already be on the property team");
    }

    // Early check: will the recipient's account exceed its property limit?
    const toAccountId = await resolveUserPrimaryAccountId(toUserId);
    if (toAccountId) {
      const propAccountRes = await db.query(
        `SELECT account_id FROM properties WHERE id = $1`,
        [propertyId]
      );
      const currentAccountId = propAccountRes.rows[0]?.account_id;
      if (currentAccountId && Number(currentAccountId) !== Number(toAccountId)) {
        const toUserRes = await db.query(`SELECT role FROM users WHERE id = $1`, [toUserId]);
        const toUserRole = toUserRes.rows[0]?.role;
        if (!isAdminRole(toUserRole)) {
          const tierCheck = await canCreateProperty(toAccountId, toUserRole);
          if (!tierCheck.allowed) {
            throw new ForbiddenError(
              `The recipient has reached their property limit (${tierCheck.current}/${tierCheck.max}). They need to upgrade their plan before ownership can be transferred.`
            );
          }
        }
      }
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await cancelPendingForProperty(propertyId, client);

      const ins = await client.query(
        `INSERT INTO property_ownership_transfer_requests
         (property_id, from_user_id, to_user_id, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id, property_id AS "propertyId", from_user_id AS "fromUserId",
           to_user_id AS "toUserId", status, created_at AS "createdAt"`,
        [propertyId, fromUserId, toUserId]
      );
      const request = ins.rows[0];

      const [fromUser, propRes] = await Promise.all([
        User.getById(fromUserId),
        client.query(`SELECT address, city, state, property_uid FROM properties WHERE id = $1`, [
          propertyId,
        ]),
      ]);
      const prop = propRes.rows[0] || {};
      const fromName = fromUser?.name || fromUser?.email || "Someone";
      const label = propertyLabel(prop);
      const title = `${fromName} wants to transfer ownership of ${label} to you`;

      await Notification.create(
        {
          userId: toUserId,
          type: "ownership_transfer_request",
          title,
          propertyId,
          ownershipTransferRequestId: request.id,
        },
        (t, p) => client.query(t, p)
      );

      await client.query("COMMIT");
      return request;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  static async accept(requestId, actingUserId) {
    const client = await db.connect();
    let finished = false;
    try {
      await client.query("BEGIN");

      const r = await client.query(
        `SELECT * FROM property_ownership_transfer_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );
      const row = r.rows[0];
      if (!row) throw new NotFoundError("Transfer request not found");
      if (row.status !== "pending") {
        throw new BadRequestError("This transfer request is no longer pending");
      }
      if (Number(row.to_user_id) !== Number(actingUserId)) {
        throw new ForbiddenError("You are not the recipient of this transfer");
      }

      const ownerCheck = await client.query(
        `SELECT 1 FROM property_users
         WHERE property_id = $1 AND user_id = $2 AND role = 'owner'`,
        [row.property_id, row.from_user_id]
      );
      if (ownerCheck.rows.length === 0) {
        await client.query(
          `UPDATE property_ownership_transfer_requests
           SET status = 'cancelled', responded_at = NOW() WHERE id = $1`,
          [requestId]
        );
        await Notification.deleteByOwnershipTransferRequestId(requestId, (t, p) => client.query(t, p));
        await client.query("COMMIT");
        finished = true;
        throw new BadRequestError("Ownership has changed; this transfer is no longer valid");
      }

      // Resolve both users' accounts to determine if property needs to move
      const toAccountId = await resolveUserPrimaryAccountId(
        row.to_user_id,
        (t, p) => client.query(t, p)
      );
      if (!toAccountId) {
        throw new BadRequestError("The recipient does not have an account");
      }

      const propAccountRes = await client.query(
        `SELECT account_id FROM properties WHERE id = $1`,
        [row.property_id]
      );
      const currentAccountId = propAccountRes.rows[0]?.account_id;
      const accountChanging = currentAccountId && Number(currentAccountId) !== Number(toAccountId);

      // Enforce max_properties on the recipient's account (skip if property stays on same account)
      if (accountChanging) {
        const toUserRes = await client.query(`SELECT role FROM users WHERE id = $1`, [row.to_user_id]);
        const toUserRole = toUserRes.rows[0]?.role;
        if (!isAdminRole(toUserRole)) {
          const tierCheck = await canCreateProperty(toAccountId, toUserRole);
          if (!tierCheck.allowed) {
            throw new ForbiddenError(
              `The recipient has reached their property limit (${tierCheck.current}/${tierCheck.max}). They need to upgrade their plan before accepting this transfer.`
            );
          }
        }
      }

      // Swap roles
      await client.query(
        `UPDATE property_users SET role = 'editor', updated_at = NOW()
         WHERE property_id = $1 AND user_id = $2 AND role = 'owner'`,
        [row.property_id, row.from_user_id]
      );
      await client.query(
        `UPDATE property_users SET role = 'owner', updated_at = NOW()
         WHERE property_id = $1 AND user_id = $2`,
        [row.property_id, row.to_user_id]
      );

      // Move property to recipient's account
      if (accountChanging) {
        await client.query(
          `UPDATE properties SET account_id = $1, updated_at = NOW() WHERE id = $2`,
          [toAccountId, row.property_id]
        );
      }

      await client.query(
        `UPDATE property_ownership_transfer_requests
         SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
        [requestId]
      );

      await Notification.deleteByOwnershipTransferRequestId(requestId, (t, p) => client.query(t, p));

      const propRes = await client.query(`SELECT address, city, state FROM properties WHERE id = $1`, [
        row.property_id,
      ]);
      const prop = propRes.rows[0] || {};
      const label = propertyLabel(prop);
      const toUser = await User.getById(row.to_user_id);
      const toName = toUser?.name || toUser?.email || "The recipient";

      await Notification.create(
        {
          userId: row.from_user_id,
          type: "ownership_transfer_accepted",
          propertyId: row.property_id,
          title: `${toName} accepted ownership of ${label}. You are now an editor on this property.`,
        },
        (t, p) => client.query(t, p)
      );
      await Notification.create(
        {
          userId: row.to_user_id,
          type: "ownership_transfer_accepted",
          propertyId: row.property_id,
          title: `You are now the owner of ${label}.`,
        },
        (t, p) => client.query(t, p)
      );

      await client.query("COMMIT");
      finished = true;
      return { ok: true, propertyId: row.property_id };
    } catch (err) {
      if (!finished) {
        try {
          await client.query("ROLLBACK");
        } catch (_) {
          /* ignore */
        }
      }
      throw err;
    } finally {
      client.release();
    }
  }

  static async decline(requestId, actingUserId) {
    const client = await db.connect();
    let finished = false;
    try {
      await client.query("BEGIN");

      const r = await client.query(
        `SELECT * FROM property_ownership_transfer_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );
      const row = r.rows[0];
      if (!row) throw new NotFoundError("Transfer request not found");
      if (row.status !== "pending") {
        throw new BadRequestError("This transfer request is no longer pending");
      }
      if (Number(row.to_user_id) !== Number(actingUserId)) {
        throw new ForbiddenError("You are not the recipient of this transfer");
      }

      await client.query(
        `UPDATE property_ownership_transfer_requests
         SET status = 'declined', responded_at = NOW() WHERE id = $1`,
        [requestId]
      );
      await Notification.deleteByOwnershipTransferRequestId(requestId, (t, p) => client.query(t, p));

      const propRes = await client.query(`SELECT address, city, state FROM properties WHERE id = $1`, [
        row.property_id,
      ]);
      const prop = propRes.rows[0] || {};
      const label = propertyLabel(prop);
      const toUser = await User.getById(row.to_user_id);
      const toName = toUser?.name || toUser?.email || "The recipient";

      await Notification.create(
        {
          userId: row.from_user_id,
          type: "ownership_transfer_declined",
          propertyId: row.property_id,
          title: `${toName} declined the ownership transfer for ${label}.`,
        },
        (t, p) => client.query(t, p)
      );

      await client.query("COMMIT");
      finished = true;
      return { ok: true };
    } catch (err) {
      if (!finished) {
        try {
          await client.query("ROLLBACK");
        } catch (_) {
          /* ignore */
        }
      }
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = PropertyOwnershipTransferRequest;
