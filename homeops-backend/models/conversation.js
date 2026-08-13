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

  /**
   * Find or create a property-less 1:1 conversation between two users on an account.
   * Participants are stored as LEAST / GREATEST in homeowner_user_id / agent_user_id.
   */
  static async findOrCreateDirect({ accountId, userAId, userBId }) {
    if (!accountId || userAId == null || userBId == null) {
      throw new BadRequestError("accountId and both user ids are required");
    }
    const a = Number(userAId);
    const b = Number(userBId);
    if (!a || !b || Number.isNaN(a) || Number.isNaN(b)) {
      throw new BadRequestError("Invalid user ids");
    }
    if (a === b) {
      throw new BadRequestError("Cannot message yourself.");
    }
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);

    const existing = await db.query(
      `SELECT id, account_id AS "accountId", property_id AS "propertyId",
              homeowner_user_id AS "homeownerUserId", agent_user_id AS "agentUserId",
              homeowner_last_read_at AS "homeownerLastReadAt",
              agent_last_read_at AS "agentLastReadAt",
              last_message_at AS "lastMessageAt", created_at AS "createdAt"
       FROM conversations
       WHERE account_id = $1 AND property_id IS NULL
         AND homeowner_user_id = $2 AND agent_user_id = $3`,
      [accountId, lo, hi]
    );
    if (existing.rows[0]) return existing.rows[0];

    try {
      const result = await db.query(
        `INSERT INTO conversations (account_id, property_id, homeowner_user_id, agent_user_id)
         VALUES ($1, NULL, $2, $3)
         RETURNING id, account_id AS "accountId", property_id AS "propertyId",
                   homeowner_user_id AS "homeownerUserId", agent_user_id AS "agentUserId",
                   homeowner_last_read_at AS "homeownerLastReadAt",
                   agent_last_read_at AS "agentLastReadAt",
                   last_message_at AS "lastMessageAt", created_at AS "createdAt"`,
        [accountId, lo, hi]
      );
      if (result.rows[0]) return result.rows[0];
    } catch (err) {
      if (err.code !== "23505") throw err;
    }

    const retry = await db.query(
      `SELECT id, account_id AS "accountId", property_id AS "propertyId",
              homeowner_user_id AS "homeownerUserId", agent_user_id AS "agentUserId",
              homeowner_last_read_at AS "homeownerLastReadAt",
              agent_last_read_at AS "agentLastReadAt",
              last_message_at AS "lastMessageAt", created_at AS "createdAt"
       FROM conversations
       WHERE account_id = $1 AND property_id IS NULL
         AND homeowner_user_id = $2 AND agent_user_id = $3`,
      [accountId, lo, hi]
    );
    return retry.rows[0];
  }

  /** True if the user is on the account (account_users or a property team). */
  static async userBelongsToAccount(userId, accountId) {
    const result = await db.query(
      `SELECT 1
       WHERE EXISTS (
         SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2
       ) OR EXISTS (
         SELECT 1
         FROM property_users pu
         JOIN properties p ON p.id = pu.property_id
         WHERE p.account_id = $1 AND pu.user_id = $2
       )
       LIMIT 1`,
      [accountId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Ensure both users are on the property team and the agent is actually an agent.
   */
  static async verifyParticipantsOnProperty(propertyInternalId, homeownerUserId, agentUserId) {
    if (!propertyInternalId || homeownerUserId == null || agentUserId == null) {
      throw new BadRequestError("property, homeowner, and agent are required");
    }
    if (Number(homeownerUserId) === Number(agentUserId)) {
      throw new BadRequestError("Homeowner and agent must be different users.");
    }

    const result = await db.query(
      `SELECT u.id, u.role AS global_role, pu.role AS property_role
       FROM property_users pu
       JOIN users u ON u.id = pu.user_id
       WHERE pu.property_id = $1`,
      [propertyInternalId]
    );
    const rows = result.rows;

    const homeownerRow = rows.find((r) => Number(r.id) === Number(homeownerUserId));
    if (!homeownerRow) {
      throw new ForbiddenError("That homeowner is not assigned to this property.");
    }

    const agentRow = rows.find((r) => Number(r.id) === Number(agentUserId));
    if (!agentRow) {
      throw new ForbiddenError("That agent is not assigned to this property.");
    }

    const agentGlobal = String(agentRow.global_role || "").toLowerCase();
    const agentProperty = String(agentRow.property_role || "").toLowerCase();
    if (agentGlobal !== "agent" && agentProperty !== "agent") {
      throw new BadRequestError("The selected user is not an agent on this property.");
    }

    const homeownerGlobal = String(homeownerRow.global_role || "").toLowerCase();
    if (homeownerGlobal !== "homeowner") {
      throw new BadRequestError("The selected user is not a homeowner on this property.");
    }

    return true;
  }

  /**
   * Related people the current user can start a conversation with.
   * Homeowner: agents on their properties. Agent: homeowners on assigned properties.
   * Admin: users on the given account. Super admin: all active users except self.
   */
  static async listPartners({ userId, role, accountId } = {}) {
    const normalizedRole = String(role || "").toLowerCase();
    if (
      normalizedRole !== "homeowner" &&
      normalizedRole !== "agent" &&
      normalizedRole !== "admin" &&
      normalizedRole !== "super_admin"
    ) {
      return [];
    }

    if (normalizedRole === "super_admin") {
      const result = await db.query(
        `SELECT u.id AS "userId",
                COALESCE(NULLIF(u.name, ''), u.email, 'User') AS name,
                u.role::text AS role
         FROM users u
         WHERE u.is_active = true
           AND u.id <> $1
         ORDER BY name`,
        [userId]
      );
      return result.rows;
    }

    if (normalizedRole === "admin") {
      if (!accountId) return [];
      const result = await db.query(
        `SELECT DISTINCT u.id AS "userId",
                COALESCE(NULLIF(u.name, ''), u.email, 'User') AS name,
                u.role::text AS role
         FROM users u
         WHERE u.is_active = true
           AND u.id <> $2
           AND (
             EXISTS (
               SELECT 1 FROM account_users au
               WHERE au.account_id = $1 AND au.user_id = u.id
             )
             OR EXISTS (
               SELECT 1
               FROM property_users pu
               JOIN properties p ON p.id = pu.property_id
               WHERE p.account_id = $1 AND pu.user_id = u.id
             )
           )
         ORDER BY name`,
        [accountId, userId]
      );
      return result.rows;
    }

    if (normalizedRole === "homeowner") {
      const result = await db.query(
        `SELECT ua.id AS "userId",
                COALESCE(NULLIF(ua.name, ''), ua.email, 'Agent') AS name,
                p.property_uid AS "propertyUid",
                p.account_id AS "accountId",
                p.address,
                p.property_name AS "propertyName"
         FROM property_users pu_me
         JOIN properties p ON p.id = pu_me.property_id
         JOIN property_users pu_agent
           ON pu_agent.property_id = p.id
          AND pu_agent.user_id <> pu_me.user_id
         JOIN users ua ON ua.id = pu_agent.user_id
         WHERE pu_me.user_id = $1
           AND ua.is_active = true
           AND (
             LOWER(ua.role::text) = 'agent'
             OR LOWER(pu_agent.role::text) = 'agent'
           )
         ORDER BY ua.name NULLS LAST, p.address NULLS LAST, p.property_name NULLS LAST`,
        [userId]
      );
      return result.rows;
    }

    const result = await db.query(
      `SELECT u.id AS "userId",
              COALESCE(NULLIF(u.name, ''), u.email, 'Homeowner') AS name,
              p.property_uid AS "propertyUid",
              p.account_id AS "accountId",
              p.address,
              p.property_name AS "propertyName"
       FROM properties p
       JOIN property_users pu_agent
         ON pu_agent.property_id = p.id
        AND pu_agent.user_id = $1
       JOIN users ua ON ua.id = pu_agent.user_id
       JOIN property_users pu_ho
         ON pu_ho.property_id = p.id
        AND pu_ho.user_id <> $1
       JOIN users u ON u.id = pu_ho.user_id
       WHERE u.role = 'homeowner'
         AND u.is_active = true
         AND (
           LOWER(ua.role::text) = 'agent'
           OR LOWER(pu_agent.role::text) = 'agent'
         )
       ORDER BY u.name NULLS LAST, p.address NULLS LAST, p.property_name NULLS LAST`,
      [userId]
    );
    return result.rows;
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
   * or an account admin / super_admin. Direct DMs: participants or super_admin only.
   */
  static async ensureAccess(conversationId, userId, userRole) {
    const conv = await this.getById(conversationId);
    const isDirect = conv.propertyId == null;
    const isParticipant =
      Number(conv.homeownerUserId) === Number(userId) ||
      Number(conv.agentUserId) === Number(userId);

    if (userRole === "super_admin") return conv;

    if (isDirect) {
      if (isParticipant) return conv;
      throw new ForbiddenError("Not authorized to access this conversation.");
    }

    if (userRole === "admin") {
      const ok = await Account.isUserLinkedToAccount(userId, conv.accountId);
      if (!ok) throw new ForbiddenError("Not authorized to access this conversation.");
      return conv;
    }
    if (isParticipant) return conv;
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
      whereClause = `c.account_id = $1 AND (
        c.property_id IS NOT NULL
        OR c.homeowner_user_id = $2
        OR c.agent_user_id = $2
      )`;
      params = [accountId, viewerUserId, lim];
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
                 AND cm.sender_user_id <> $2
                 AND cm.created_at > COALESCE(
                   CASE
                     WHEN c.homeowner_user_id = $2 THEN c.homeowner_last_read_at
                     ELSE c.agent_last_read_at
                   END,
                   '1970-01-01'
                 )
              ) AS "unreadCount"
       FROM conversations c
       JOIN users ho ON ho.id = c.homeowner_user_id
       JOIN users ag ON ag.id = c.agent_user_id
       LEFT JOIN properties p ON p.id = c.property_id
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
   * List conversations where the current user is the assigned agent,
   * across all client (homeowner) accounts.
   */
  static async listForAgent({ agentUserId, limit = 50 }) {
    const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
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
                 AND cm.sender_user_id <> $1
                 AND cm.created_at > COALESCE(
                   CASE
                     WHEN c.homeowner_user_id = $1 THEN c.homeowner_last_read_at
                     ELSE c.agent_last_read_at
                   END,
                   '1970-01-01'
                 )
              ) AS "unreadCount"
       FROM conversations c
       JOIN users ho ON ho.id = c.homeowner_user_id
       JOIN users ag ON ag.id = c.agent_user_id
       LEFT JOIN properties p ON p.id = c.property_id
       LEFT JOIN LATERAL (
         SELECT cm.kind, cm.payload, cm.sender_user_id, cm.created_at
         FROM conversation_messages cm
         WHERE cm.conversation_id = c.id
         ORDER BY cm.created_at DESC
         LIMIT 1
       ) lm ON true
       WHERE c.agent_user_id = $1
          OR (c.property_id IS NULL AND c.homeowner_user_id = $1)
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
       LIMIT $2`,
      [agentUserId, lim]
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
              ho.name AS "homeownerName", ho.email AS "homeownerEmail",
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
                 AND cm.sender_user_id <> $1
                 AND cm.created_at > COALESCE(
                   CASE
                     WHEN c.homeowner_user_id = $1 THEN c.homeowner_last_read_at
                     ELSE c.agent_last_read_at
                   END,
                   '1970-01-01'
                 )
              ) AS "unreadCount"
       FROM conversations c
       JOIN users ho ON ho.id = c.homeowner_user_id
       JOIN users ag ON ag.id = c.agent_user_id
       LEFT JOIN properties p ON p.id = c.property_id
       LEFT JOIN LATERAL (
         SELECT cm.kind, cm.payload, cm.sender_user_id, cm.created_at
         FROM conversation_messages cm
         WHERE cm.conversation_id = c.id
         ORDER BY cm.created_at DESC
         LIMIT 1
       ) lm ON true
       WHERE c.homeowner_user_id = $1
          OR (c.property_id IS NULL AND c.agent_user_id = $1)
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
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
