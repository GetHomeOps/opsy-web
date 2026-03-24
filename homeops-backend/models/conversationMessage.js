"use strict";

const db = require("../db");
const { BadRequestError } = require("../expressError");

const KINDS = new Set(["text", "referral_request", "refer_agent", "share_contact", "share_professional"]);
const MAX_TEXT = 8000;
const MAX_SHORT = 500;

class ConversationMessage {
  static assertKind(kind) {
    if (!KINDS.has(kind)) {
      throw new BadRequestError(`kind must be one of: ${[...KINDS].join(", ")}`);
    }
  }

  static normalizePayload(kind, body) {
    if (kind === "text") {
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message) throw new BadRequestError("message is required");
      if (message.length > MAX_TEXT) throw new BadRequestError(`message must be at most ${MAX_TEXT} characters`);
      return { message };
    }

    if (kind === "referral_request") {
      const referralType = typeof body.referralType === "string" ? body.referralType.trim() : "";
      if (!referralType) throw new BadRequestError("referralType is required");
      const notes = typeof body.notes === "string" ? body.notes.trim() : "";
      if (notes.length > MAX_TEXT) throw new BadRequestError(`notes must be at most ${MAX_TEXT} characters`);
      return { referralType, notes };
    }

    if (kind === "refer_agent") {
      const referName = typeof body.referName === "string" ? body.referName.trim() : "";
      const referContact = typeof body.referContact === "string" ? body.referContact.trim() : "";
      const note = typeof body.referNote === "string" ? body.referNote.trim() : "";
      if (!referName) throw new BadRequestError("referName is required");
      if (!referContact) throw new BadRequestError("referContact is required");
      if (referName.length > MAX_SHORT) throw new BadRequestError("referName is too long");
      if (referContact.length > MAX_SHORT) throw new BadRequestError("referContact is too long");
      if (note.length > MAX_TEXT) throw new BadRequestError(`note must be at most ${MAX_TEXT} characters`);
      return { referName, referContact, note };
    }

    if (kind === "share_contact") {
      const contactId = parseInt(body.contactId, 10);
      if (!contactId || Number.isNaN(contactId)) throw new BadRequestError("contactId is required");
      return { contactId };
    }

    if (kind === "share_professional") {
      const professionalId = parseInt(body.professionalId, 10);
      if (!professionalId || Number.isNaN(professionalId)) throw new BadRequestError("professionalId is required");
      return { professionalId };
    }

    throw new BadRequestError(`Unsupported kind: ${kind}`);
  }

  static async create({ conversationId, senderUserId, kind, payload }) {
    this.assertKind(kind);
    const result = await db.query(
      `INSERT INTO conversation_messages (conversation_id, sender_user_id, kind, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, conversation_id AS "conversationId", sender_user_id AS "senderUserId",
                 kind, payload, created_at AS "createdAt"`,
      [conversationId, senderUserId, kind, JSON.stringify(payload)]
    );
    return result.rows[0];
  }

  /**
   * List messages in a conversation, newest first.
   * Supports cursor-based pagination with `before` (message id).
   */
  static async listByConversation(conversationId, { limit = 50, before } = {}) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    let sql;
    let params;

    if (before) {
      sql = `SELECT cm.id, cm.conversation_id AS "conversationId",
                    cm.sender_user_id AS "senderUserId",
                    u.name AS "senderName",
                    cm.kind, cm.payload, cm.created_at AS "createdAt"
             FROM conversation_messages cm
             JOIN users u ON u.id = cm.sender_user_id
             WHERE cm.conversation_id = $1 AND cm.id < $2
             ORDER BY cm.created_at DESC
             LIMIT $3`;
      params = [conversationId, before, lim];
    } else {
      sql = `SELECT cm.id, cm.conversation_id AS "conversationId",
                    cm.sender_user_id AS "senderUserId",
                    u.name AS "senderName",
                    cm.kind, cm.payload, cm.created_at AS "createdAt"
             FROM conversation_messages cm
             JOIN users u ON u.id = cm.sender_user_id
             WHERE cm.conversation_id = $1
             ORDER BY cm.created_at DESC
             LIMIT $2`;
      params = [conversationId, lim];
    }

    const result = await db.query(sql, params);
    return result.rows;
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT id, conversation_id AS "conversationId",
              sender_user_id AS "senderUserId",
              kind, payload, created_at AS "createdAt"
       FROM conversation_messages WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
}

module.exports = ConversationMessage;
