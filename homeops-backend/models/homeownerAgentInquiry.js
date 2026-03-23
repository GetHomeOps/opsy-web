"use strict";

const db = require("../db");
const { BadRequestError, ForbiddenError, NotFoundError } = require("../expressError");
const Account = require("./account");

const KINDS = new Set(["message", "referral_request", "refer_agent"]);
const MAX_MESSAGE = 8000;
const MAX_SHORT = 500;

class HomeownerAgentInquiry {
  static assertKind(kind) {
    if (!KINDS.has(kind)) {
      throw new BadRequestError(`kind must be one of: ${[...KINDS].join(", ")}`);
    }
  }

  static normalizePayload(kind, body) {
    if (kind === "message") {
      const text = typeof body.message === "string" ? body.message.trim() : "";
      if (!text) throw new BadRequestError("message is required");
      if (text.length > MAX_MESSAGE) throw new BadRequestError(`message must be at most ${MAX_MESSAGE} characters`);
      return { message: text };
    }
    if (kind === "referral_request") {
      const referralType = typeof body.referralType === "string" ? body.referralType.trim() : "";
      if (!referralType) throw new BadRequestError("referralType is required");
      const notes = typeof body.notes === "string" ? body.notes.trim() : "";
      if (notes.length > MAX_MESSAGE) throw new BadRequestError(`notes must be at most ${MAX_MESSAGE} characters`);
      return { referralType, notes };
    }
    const referName = typeof body.referName === "string" ? body.referName.trim() : "";
    const referContact = typeof body.referContact === "string" ? body.referContact.trim() : "";
    const note = typeof body.referNote === "string" ? body.referNote.trim() : "";
    if (!referName) throw new BadRequestError("referName is required");
    if (!referContact) throw new BadRequestError("referContact is required");
    if (referName.length > MAX_SHORT) throw new BadRequestError("referName is too long");
    if (referContact.length > MAX_SHORT) throw new BadRequestError("referContact is too long");
    if (note.length > MAX_MESSAGE) throw new BadRequestError(`note must be at most ${MAX_MESSAGE} characters`);
    return { referName, referContact, note };
  }

  /** Returns true if userId is on property team and targetAgentId is an agent on that team. */
  static async verifySenderAndAgentOnProperty(propertyInternalId, senderUserId, targetAgentId) {
    const result = await db.query(
      `SELECT u.id, u.role AS global_role, pu.role AS property_role
       FROM property_users pu
       JOIN users u ON u.id = pu.user_id
       WHERE pu.property_id = $1`,
      [propertyInternalId]
    );
    const rows = result.rows;
    const senderOk = rows.some((r) => Number(r.id) === Number(senderUserId));
    if (!senderOk) throw new ForbiddenError("You do not have access to this property.");
    const agentRow = rows.find((r) => Number(r.id) === Number(targetAgentId));
    if (!agentRow) throw new BadRequestError("That agent is not assigned to this property.");
    const gr = String(agentRow.global_role || "").toLowerCase();
    const pr = String(agentRow.property_role || "").toLowerCase();
    if (gr !== "agent" && pr !== "agent") {
      throw new BadRequestError("The selected user is not an agent on this property.");
    }
    return true;
  }

  static async create({ accountId, propertyId, senderUserId, agentUserId, kind, payload }) {
    this.assertKind(kind);
    const result = await db.query(
      `INSERT INTO homeowner_agent_inquiries (account_id, property_id, sender_user_id, agent_user_id, kind, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, account_id AS "accountId", property_id AS "propertyId", sender_user_id AS "senderUserId",
                 agent_user_id AS "agentUserId", kind, payload, agent_read_at AS "agentReadAt", created_at AS "createdAt"`,
      [accountId, propertyId, senderUserId, agentUserId, kind, JSON.stringify(payload)]
    );
    return result.rows[0];
  }

  static async listForAccountViewer({ accountId, viewerUserId, viewerRole, limit = 100 }) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
    const isSuperAdmin = viewerRole === "super_admin";
    const isAdmin = viewerRole === "admin";
    let sql;
    let params;
    if (isSuperAdmin || isAdmin) {
      if (!isSuperAdmin) {
        const ok = await Account.isUserLinkedToAccount(viewerUserId, accountId);
        if (!ok) throw new ForbiddenError("Not authorized to view this account.");
      }
      sql = `
        SELECT h.id, h.account_id AS "accountId", h.property_id AS "propertyId",
               p.property_uid AS "propertyUid", p.address,
               h.sender_user_id AS "senderUserId", u.name AS "senderName", u.email AS "senderEmail",
               h.agent_user_id AS "agentUserId", ag.name AS "agentName",
               h.kind, h.payload, h.agent_read_at AS "agentReadAt", h.created_at AS "createdAt"
        FROM homeowner_agent_inquiries h
        JOIN users u ON u.id = h.sender_user_id
        JOIN users ag ON ag.id = h.agent_user_id
        JOIN properties p ON p.id = h.property_id
        WHERE h.account_id = $1
        ORDER BY h.created_at DESC
        LIMIT $2`;
      params = [accountId, lim];
    } else {
      sql = `
        SELECT h.id, h.account_id AS "accountId", h.property_id AS "propertyId",
               p.property_uid AS "propertyUid", p.address,
               h.sender_user_id AS "senderUserId", u.name AS "senderName", u.email AS "senderEmail",
               h.agent_user_id AS "agentUserId", ag.name AS "agentName",
               h.kind, h.payload, h.agent_read_at AS "agentReadAt", h.created_at AS "createdAt"
        FROM homeowner_agent_inquiries h
        JOIN users u ON u.id = h.sender_user_id
        JOIN users ag ON ag.id = h.agent_user_id
        JOIN properties p ON p.id = h.property_id
        WHERE h.account_id = $1 AND h.agent_user_id = $2
        ORDER BY h.created_at DESC
        LIMIT $3`;
      params = [accountId, viewerUserId, lim];
    }
    const result = await db.query(sql, params);
    return result.rows;
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT h.id, h.account_id AS "accountId", h.property_id AS "propertyId",
              h.sender_user_id AS "senderUserId", h.agent_user_id AS "agentUserId",
              h.kind, h.payload, h.agent_read_at AS "agentReadAt", h.created_at AS "createdAt"
       FROM homeowner_agent_inquiries h WHERE h.id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Inquiry not found: ${id}`);
    return row;
  }

  static async markAgentRead(inquiryId, viewerUserId, viewerRole) {
    const row = await this.getById(inquiryId);
    if (viewerRole === "super_admin") {
      // allow
    } else if (viewerRole === "admin") {
      const ok = await Account.isUserLinkedToAccount(viewerUserId, row.accountId);
      if (!ok) throw new ForbiddenError("Not authorized to access this account.");
    } else {
      if (Number(row.agentUserId) !== Number(viewerUserId)) {
        throw new ForbiddenError("You can only update inquiries addressed to you.");
      }
      const ok = await Account.isUserLinkedToAccount(viewerUserId, row.accountId);
      if (!ok) throw new ForbiddenError("Not authorized.");
    }
    await db.query(
      `UPDATE homeowner_agent_inquiries SET agent_read_at = COALESCE(agent_read_at, NOW()) WHERE id = $1`,
      [inquiryId]
    );
    await db.query(
      `UPDATE notifications SET read_at = COALESCE(read_at, NOW())
       WHERE homeowner_inquiry_id = $1 AND read_at IS NULL`,
      [inquiryId]
    );
    return { ok: true };
  }
}

module.exports = HomeownerAgentInquiry;
