"use strict";

const db = require("../db");
const { BadRequestError, ForbiddenError, NotFoundError } = require("../expressError");
const Account = require("./account");

class Conversation {
  /**
   * Find an existing conversation for the triple, or create one.
   * Returns the conversation row.
   */
  static async findOrCreate({ accountId, propertyId, homeownerUserId, agentUserId }) {
    if (!accountId || !propertyId || !homeownerUserId || !agentUserId) {
      throw new BadRequestError("accountId, propertyId, homeownerUserId, and agentUserId are required");
    }

    const existing = await db.query(
      `SELECT id, account_id AS "accountId", property_id AS "propertyId",
              homeowner_user_id AS "homeownerUserId", agent_user_id AS "agentUserId",
              homeowner_last_read_at AS "homeownerLastReadAt",
              agent_last_read_at AS "agentLastReadAt",
              last_message_at AS "lastMessageAt", created_at AS "createdAt"
       FROM conversations
       WHERE property_id = $1 AND homeowner_user_id = $2 AND agent_user_id = $3`,
      [propertyId, homeownerUserId, agentUserId]
    );

    if (existing.rows[0]) return existing.rows[0];

    const result = await db.query(
      `INSERT INTO conversations (account_id, property_id, homeowner_user_id, agent_user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (property_id, homeowner_user_id, agent_user_id) DO NOTHING
       RETURNING id, account_id AS "accountId", property_id AS "propertyId",
                 homeowner_user_id AS "homeownerUserId", agent_user_id AS "agentUserId",
                 homeowner_last_read_at AS "homeownerLastReadAt",
                 agent_last_read_at AS "agentLastReadAt",
                 last_message_at AS "lastMessageAt", created_at AS "createdAt"`,
      [accountId, propertyId, homeownerUserId, agentUserId]
    );

    if (result.rows[0]) return result.rows[0];

    // Race condition: another request inserted between SELECT and INSERT
    const retry = await db.query(
      `SELECT id, account_id AS "accountId", property_id AS "propertyId",
              homeowner_user_id AS "homeownerUserId", agent_user_id AS "agentUserId",
              homeowner_last_read_at AS "homeownerLastReadAt",
              agent_last_read_at AS "agentLastReadAt",
              last_message_at AS "lastMessageAt", created_at AS "createdAt"
       FROM conversations
       WHERE property_id = $1 AND homeowner_user_id = $2 AND agent_user_id = $3`,
      [propertyId, homeownerUserId, agentUserId]
    );
    return retry.rows[0];
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT id, account_id AS "accountId", property_id AS "propertyId",
              homeowner_user_id AS "homeownerUserId", agent_user_id AS "agentUserId",
              homeowner_last_read_at AS "homeownerLastReadAt",
              agent_last_read_at AS "agentLastReadAt",
              last_message_at AS "lastMessageAt", created_at AS "createdAt"
       FROM conversations WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`Conversation not found: ${id}`);
    return result.rows[0];
  }

  /**
   * Verify that the requesting user is a participant (homeowner or agent)
   * or an account admin / super_admin.
   */
  static async ensureAccess(conversationId, userId, userRole) {
    const conv = await this.getById(conversationId);
    if (userRole === "super_admin") return conv;
    if (userRole === "admin") {
      const ok = await Account.isUserLinkedToAccount(userId, conv.accountId);
      if (!ok) throw new ForbiddenError("Not authorized to access this conversation.");
      return conv;
    }
    if (Number(conv.homeownerUserId) === Number(userId) || Number(conv.agentUserId) === Number(userId)) {
      return conv;
    }
    throw new ForbiddenError("Not authorized to access this conversation.");
  }

  /**
   * List conversations for a given account viewer.
   * Agents see only their own; admins see all in the account.
   * Returns conversations with last message preview and unread count.
   */
  static async listForAccountViewer({ accountId, viewerUserId, viewerRole, limit = 50 }) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const isSuperAdmin = viewerRole === "super_admin";
    const isAdmin = viewerRole === "admin";

    if (!isSuperAdmin && isAdmin) {
      const ok = await Account.isUserLinkedToAccount(viewerUserId, accountId);
      if (!ok) throw new ForbiddenError("Not authorized to view this account.");
    }

    let whereClause;
    let params;

    if (isSuperAdmin || isAdmin) {
      whereClause = "c.account_id = $1";
      params = [accountId, lim];
    } else {
      whereClause = "c.account_id = $1 AND c.agent_user_id = $2";
      params = [accountId, viewerUserId, lim];
    }

    const limParam = `$${params.length}`;

    const result = await db.query(
      `SELECT c.id, c.account_id AS "accountId", c.property_id AS "propertyId",
              p.property_uid AS "propertyUid", p.address,
              c.homeowner_user_id AS "homeownerUserId",
              ho.name AS "homeownerName", ho.email AS "homeownerEmail",
              c.agent_user_id AS "agentUserId",
              ag.name AS "agentName",
              c.homeowner_last_read_at AS "homeownerLastReadAt",
              c.agent_last_read_at AS "agentLastReadAt",
              c.last_message_at AS "lastMessageAt",
              c.created_at AS "createdAt",
              lm.kind AS "lastMessageKind",
              lm.payload AS "lastMessagePayload",
              lm.sender_user_id AS "lastMessageSenderId",
              lm.created_at AS "lastMessageCreatedAt",
              (SELECT COUNT(*)::int FROM conversation_messages cm
               WHERE cm.conversation_id = c.id
                 AND cm.created_at > COALESCE(c.agent_last_read_at, '1970-01-01')
                 AND cm.sender_user_id = c.homeowner_user_id
              ) AS "unreadCount"
       FROM conversations c
       JOIN users ho ON ho.id = c.homeowner_user_id
       JOIN users ag ON ag.id = c.agent_user_id
       JOIN properties p ON p.id = c.property_id
       LEFT JOIN LATERAL (
         SELECT cm.kind, cm.payload, cm.sender_user_id, cm.created_at
         FROM conversation_messages cm
         WHERE cm.conversation_id = c.id
         ORDER BY cm.created_at DESC
         LIMIT 1
       ) lm ON true
       WHERE ${whereClause}
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
       LIMIT ${limParam}`,
      params
    );
    return result.rows;
  }

  /**
   * List conversations where the current user is the homeowner.
   * Used by homeowner-side views.
   */
  static async listForHomeowner({ homeownerUserId, limit = 50 }) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const result = await db.query(
      `SELECT c.id, c.account_id AS "accountId", c.property_id AS "propertyId",
              p.property_uid AS "propertyUid", p.address,
              c.homeowner_user_id AS "homeownerUserId",
              c.agent_user_id AS "agentUserId",
              ag.name AS "agentName", ag.email AS "agentEmail",
              c.homeowner_last_read_at AS "homeownerLastReadAt",
              c.last_message_at AS "lastMessageAt",
              c.created_at AS "createdAt",
              lm.kind AS "lastMessageKind",
              lm.payload AS "lastMessagePayload",
              lm.sender_user_id AS "lastMessageSenderId",
              lm.created_at AS "lastMessageCreatedAt",
              (SELECT COUNT(*)::int FROM conversation_messages cm
               WHERE cm.conversation_id = c.id
                 AND cm.created_at > COALESCE(c.homeowner_last_read_at, '1970-01-01')
                 AND cm.sender_user_id != $1
              ) AS "unreadCount"
       FROM conversations c
       JOIN users ag ON ag.id = c.agent_user_id
       JOIN properties p ON p.id = c.property_id
       LEFT JOIN LATERAL (
         SELECT cm.kind, cm.payload, cm.sender_user_id, cm.created_at
         FROM conversation_messages cm
         WHERE cm.conversation_id = c.id
         ORDER BY cm.created_at DESC
         LIMIT 1
       ) lm ON true
       WHERE c.homeowner_user_id = $1
       ORDER BY c.last_message_at DESC NULLS LAST
       LIMIT $2`,
      [homeownerUserId, lim]
    );
    return result.rows;
  }

  static async markRead(conversationId, userId, userRole) {
    const conv = await this.ensureAccess(conversationId, userId, userRole);
    const isHomeowner = Number(conv.homeownerUserId) === Number(userId);
    const col = isHomeowner ? "homeowner_last_read_at" : "agent_last_read_at";
    await db.query(
      `UPDATE conversations SET ${col} = NOW() WHERE id = $1`,
      [conversationId]
    );
    return { ok: true };
  }

  static async updateLastMessageAt(conversationId) {
    await db.query(
      `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
      [conversationId]
    );
  }
}

module.exports = Conversation;
