"use strict";

/**
 * Invitation Model
 *
 * Manages invitations in the `invitations` table. Supports account and property
 * invitations with token-based validation, expiry, and status lifecycle.
 *
 * Key operations:
 * - create: Create invitation with hashed token
 * - findByToken / validateToken: Verify and fetch valid invitations
 * - getByAccount / getByProperty / getSentByUser: List invitations by scope
 * - accept / decline / revoke: Update invitation status
 * - expirePending: Mark expired invitations
 * - markEmailSent: Record successful invitation email delivery
 */

const db = require("../db");
const crypto = require("crypto");
const { BadRequestError, NotFoundError, UnauthorizedError } = require("../expressError");
const {
  generateInvitationToken,
  invitationExpiresAt,
} = require("../helpers/invitationTokens");

const INVITATION_SELECT_CORE = `
  id, type, inviter_user_id AS "inviterUserId", invitee_email AS "inviteeEmail",
  account_id AS "accountId", property_id AS "propertyId",
  intended_role AS "intendedRole",
  intended_property_role AS "intendedPropertyRole",
  permissions,
  status, expires_at AS "expiresAt",
  accepted_at AS "acceptedAt", accepted_by_user_id AS "acceptedByUserId",
  email_sent_at AS "emailSentAt",
  created_at AS "createdAt"`;

class Invitation {
  static async create({ type, inviterUserId, inviteeEmail, accountId, propertyId, intendedRole, intendedPropertyRole, permissions, tokenHash, expiresAt }) {
    const permsJson =
      permissions && typeof permissions === "object" && !Array.isArray(permissions)
        ? JSON.stringify(permissions)
        : null;
    const result = await db.query(
      `INSERT INTO invitations
        (type, inviter_user_id, invitee_email, account_id, property_id, intended_role, intended_property_role, permissions, token_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
       RETURNING id, type, inviter_user_id AS "inviterUserId", invitee_email AS "inviteeEmail",
                 account_id AS "accountId", property_id AS "propertyId",
                 intended_role AS "intendedRole",
                 intended_property_role AS "intendedPropertyRole",
                 permissions,
                 status, expires_at AS "expiresAt",
                 email_sent_at AS "emailSentAt",
                 created_at AS "createdAt"`,
      [type, inviterUserId, inviteeEmail, accountId, propertyId || null, intendedRole, intendedPropertyRole || null, permsJson, tokenHash, expiresAt]
    );
    return result.rows[0];
  }

  static async findByToken(tokenHash) {
    const result = await db.query(
      `SELECT ${INVITATION_SELECT_CORE}
       FROM invitations
       WHERE token_hash = $1 AND status = 'pending' AND expires_at > NOW()`,
      [tokenHash]
    );
    return result.rows[0] || null;
  }

  static async get(id) {
    const result = await db.query(
      `SELECT ${INVITATION_SELECT_CORE}
       FROM invitations WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`No invitation with id: ${id}`);
    return result.rows[0];
  }

  /**
   * @param {number|string} accountId
   * @param {{ status?: string, emailNeverSent?: boolean }} [opts]
   */
  static async getByAccount(accountId, { status, emailNeverSent } = {}) {
    const clauses = [`i.account_id = $1`];
    const values = [accountId];
    if (status) {
      values.push(status);
      clauses.push(`i.status = $${values.length}`);
    }
    if (emailNeverSent === true) {
      clauses.push(`i.email_sent_at IS NULL`);
    }
    const result = await db.query(
      `SELECT i.id, i.type, i.inviter_user_id AS "inviterUserId",
              u.name AS "inviterName",
              i.invitee_email AS "inviteeEmail",
              invitee.name AS "inviteeName",
              i.account_id AS "accountId", i.property_id AS "propertyId",
              p.property_uid AS "propertyUid",
              p.address AS "propertyAddress",
              i.intended_role AS "intendedRole",
              i.intended_property_role AS "intendedPropertyRole",
              i.status,
              i.email_sent_at AS "emailSentAt",
              i.expires_at AS "expiresAt", i.created_at AS "createdAt"
       FROM invitations i
       LEFT JOIN users u ON u.id = i.inviter_user_id
       LEFT JOIN users invitee ON LOWER(TRIM(invitee.email)) = LOWER(TRIM(i.invitee_email))
       LEFT JOIN properties p ON p.id = i.property_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY i.created_at DESC`,
      values
    );
    return result.rows;
  }

  /**
   * Platform-admin listing of pending invitations that have never been emailed.
   * @param {{ type?: string }} [opts]
   */
  static async getPendingNeverSent({ type } = {}) {
    const clauses = [
      `i.status = 'pending'`,
      `i.email_sent_at IS NULL`,
      `i.expires_at > NOW()`,
    ];
    const values = [];
    if (type) {
      values.push(type);
      clauses.push(`i.type = $${values.length}`);
    }
    const result = await db.query(
      `SELECT i.id, i.type, i.inviter_user_id AS "inviterUserId",
              u.name AS "inviterName",
              i.invitee_email AS "inviteeEmail",
              invitee.role::text AS "inviteeRole",
              i.account_id AS "accountId", i.property_id AS "propertyId",
              p.property_uid AS "propertyUid",
              p.address AS "propertyAddress",
              i.intended_role AS "intendedRole",
              i.intended_property_role AS "intendedPropertyRole",
              i.status,
              i.email_sent_at AS "emailSentAt",
              i.expires_at AS "expiresAt", i.created_at AS "createdAt"
       FROM invitations i
       LEFT JOIN users u ON u.id = i.inviter_user_id
       LEFT JOIN users invitee ON LOWER(TRIM(invitee.email)) = LOWER(TRIM(i.invitee_email))
       LEFT JOIN properties p ON p.id = i.property_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY i.created_at DESC`,
      values
    );
    return result.rows;
  }

  static async getByProperty(propertyId, { status } = {}) {
    const clauses = [`i.property_id = $1`];
    const values = [propertyId];
    if (status) {
      values.push(status);
      clauses.push(`i.status = $${values.length}`);
    }
    const result = await db.query(
      `SELECT i.id, i.type,
              i.inviter_user_id AS "inviterUserId",
              u.name AS "inviterName",
              i.invitee_email AS "inviteeEmail",
              i.intended_role AS "intendedRole",
              i.intended_property_role AS "intendedPropertyRole",
              i.permissions,
              i.status,
              i.email_sent_at AS "emailSentAt",
              i.expires_at AS "expiresAt", i.created_at AS "createdAt"
       FROM invitations i
       LEFT JOIN users u ON u.id = i.inviter_user_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY i.created_at DESC`,
      values
    );
    return result.rows;
  }

  static async getSentByUser(userId) {
    const result = await db.query(
      `SELECT i.id, i.type, i.invitee_email AS "inviteeEmail",
              a.name AS "accountName",
              i.intended_role AS "intendedRole",
              i.intended_property_role AS "intendedPropertyRole",
              i.status,
              i.email_sent_at AS "emailSentAt",
              i.expires_at AS "expiresAt", i.accepted_at AS "acceptedAt",
              i.created_at AS "createdAt"
       FROM invitations i
       LEFT JOIN accounts a ON a.id = i.account_id
       WHERE i.inviter_user_id = $1
       ORDER BY i.created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /** Get invitations received by a user (where invitee_email matches user's email) */
  static async getReceivedByEmail(inviteeEmail, { status = "pending" } = {}) {
    const clauses = [`LOWER(i.invitee_email) = LOWER($1)`];
    const values = [inviteeEmail];
    if (status) {
      values.push(status);
      clauses.push(`i.status = $${values.length}`);
    }
    const result = await db.query(
      `SELECT i.id, i.type, i.invitee_email AS "inviteeEmail",
              i.account_id AS "accountId", i.property_id AS "propertyId",
              p.property_uid AS "propertyUid",
              i.intended_role AS "intendedRole",
              i.intended_property_role AS "intendedPropertyRole",
              i.status,
              i.email_sent_at AS "emailSentAt",
              i.expires_at AS "expiresAt", i.created_at AS "createdAt",
              u.name AS "inviterName", u.email AS "inviterEmail",
              a.name AS "accountName",
              p.address AS "propertyAddress"
       FROM invitations i
       LEFT JOIN users u ON u.id = i.inviter_user_id
       LEFT JOIN accounts a ON a.id = i.account_id
       LEFT JOIN properties p ON p.id = i.property_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY i.created_at DESC`,
      values
    );
    return result.rows;
  }

  /** Mark invitation email as successfully sent. */
  static async markEmailSent(id) {
    const result = await db.query(
      `UPDATE invitations
       SET email_sent_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING id, email_sent_at AS "emailSentAt"`,
      [id]
    );
    return result.rows[0] || null;
  }

  /** Mark many invitation emails as successfully sent. */
  static async markEmailSentMany(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const result = await db.query(
      `UPDATE invitations
       SET email_sent_at = NOW()
       WHERE id = ANY($1::uuid[]) AND status = 'pending'
       RETURNING id`,
      [ids]
    );
    return result.rows.length;
  }

  static async accept(id, acceptedByUserId) {
    const result = await db.query(
      `UPDATE invitations
       SET status = 'accepted', accepted_at = NOW(), accepted_by_user_id = $2
       WHERE id = $1 AND status = 'pending'
       RETURNING id, type, account_id AS "accountId", property_id AS "propertyId",
                 intended_role AS "intendedRole",
                 intended_property_role AS "intendedPropertyRole",
                 permissions,
                 invitee_email AS "inviteeEmail"`,
      [id, acceptedByUserId]
    );
    if (!result.rows[0]) throw new NotFoundError(`No pending invitation with id: ${id}`);
    return result.rows[0];
  }

  static async decline(id) {
    const result = await db.query(
      `UPDATE invitations SET status = 'declined' WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`No pending invitation with id: ${id}`);
    return { declined: id };
  }

  static async revoke(id) {
    const result = await db.query(
      `UPDATE invitations SET status = 'revoked' WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`No pending invitation with id: ${id}`);
    return { revoked: id };
  }

  static async expirePending() {
    const result = await db.query(
      `UPDATE invitations SET status = 'expired'
       WHERE status = 'pending' AND expires_at <= NOW()
       RETURNING id`
    );
    return result.rows.length;
  }

  static async validateToken(rawToken) {
    if (!rawToken) throw new BadRequestError("Invitation token required");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const invitation = await this.findByToken(tokenHash);
    if (!invitation) throw new UnauthorizedError("Invalid or expired invitation token");
    return invitation;
  }

  /**
   * Regenerate token for a pending invitation and reset its expiry window.
   * Expired-but-still-pending rows are allowed so Resend can revive them.
   * Returns { invitation, token }.
   */
  static async regenerateToken(id) {
    const invitation = await this.get(id);
    if (invitation.status !== "pending") {
      throw new BadRequestError("Invitation is no longer pending");
    }
    const { token, tokenHash } = generateInvitationToken();
    const expiresAt = invitationExpiresAt();
    await db.query(
      `UPDATE invitations
       SET token_hash = $1, expires_at = $2
       WHERE id = $3 AND status = 'pending'`,
      [tokenHash, expiresAt, id]
    );
    return { invitation: await this.get(id), token };
  }
}

module.exports = Invitation;
