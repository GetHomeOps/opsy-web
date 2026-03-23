"use strict";

const db = require("../db");
const { NotFoundError } = require("../expressError");

class Notification {
  /** Create a notification for a user */
  static async create(data) {
    const {
      userId,
      type = "resource_sent",
      resourceId,
      communicationId,
      title,
      invitationId,
      maintenanceRecordId,
      homeownerInquiryId,
    } = data;
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, resource_id, communication_id, title, invitation_id, maintenance_record_id, homeowner_inquiry_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id AS "userId", type, resource_id AS "resourceId", communication_id AS "communicationId", title, invitation_id AS "invitationId", maintenance_record_id AS "maintenanceRecordId", homeowner_inquiry_id AS "homeownerInquiryId", read_at AS "readAt", created_at AS "createdAt"`,
      [
        userId,
        type,
        resourceId || null,
        communicationId || null,
        title || null,
        invitationId || null,
        maintenanceRecordId || null,
        homeownerInquiryId || null,
      ]
    );
    return result.rows[0];
  }

  /** Create notifications for multiple users (e.g. when resource is sent) */
  static async createForUsers(userIds, data) {
    if (!userIds?.length) return [];
    const { type = "resource_sent", resourceId, communicationId, title } = data;
    const rows = [];
    for (const userId of userIds) {
      const r = await db.query(
        `INSERT INTO notifications (user_id, type, resource_id, communication_id, title, homeowner_inquiry_id)
         VALUES ($1, $2, $3, $4, $5, NULL)
         RETURNING id, user_id AS "userId", type, resource_id AS "resourceId", communication_id AS "communicationId", title, homeowner_inquiry_id AS "homeownerInquiryId", read_at AS "readAt", created_at AS "createdAt"`,
        [userId, type, resourceId || null, communicationId || null, title || null]
      );
      rows.push(r.rows[0]);
    }
    return rows;
  }

  /** List notifications for a user (unread first, then by date) */
  static async listForUser(userId, { limit = 20 } = {}) {
    const result = await db.query(
      `SELECT n.id, n.user_id AS "userId", n.type, n.resource_id AS "resourceId", n.communication_id AS "communicationId", n.title, n.invitation_id AS "invitationId", n.maintenance_record_id AS "maintenanceRecordId", n.homeowner_inquiry_id AS "homeownerInquiryId", n.read_at AS "readAt", n.created_at AS "createdAt",
              r.subject AS "resourceSubject", r.type AS "resourceType",
              p.property_uid AS "propertyUid", a.url AS "accountUrl",
              p_maint.property_uid AS "maintenancePropertyUid", a_maint.url AS "maintenanceAccountUrl"
       FROM notifications n
       LEFT JOIN resources r ON r.id = n.resource_id
       LEFT JOIN invitations i ON i.id = n.invitation_id AND n.type = 'property_invitation'
       LEFT JOIN properties p ON p.id = i.property_id
       LEFT JOIN accounts a ON a.id = i.account_id
       LEFT JOIN property_maintenance pm ON pm.id = n.maintenance_record_id
       LEFT JOIN properties p_maint ON p_maint.id = pm.property_id
       LEFT JOIN accounts a_maint ON a_maint.id = p_maint.account_id
       WHERE n.user_id = $1
       ORDER BY n.read_at IS NULL DESC, n.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  /** Count unread for user */
  static async countUnread(userId) {
    const result = await db.query(
      `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return result.rows[0].count;
  }

  /** Mark notification as read */
  static async markRead(id, userId) {
    const result = await db.query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    if (!result.rows[0]) throw new NotFoundError(`Notification not found: ${id}`);
    return result.rows[0];
  }

  /** Mark all as read for user */
  static async markAllRead(userId) {
    await db.query(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
  }

  /** Remove in-app bell notifications for a property invitation (accept / decline / revoke). */
  static async deletePropertyInvitationNotifications(invitationId) {
    if (!invitationId) return;
    await db.query(
      `DELETE FROM notifications WHERE invitation_id = $1 AND type = 'property_invitation'`,
      [invitationId]
    );
  }
}

module.exports = Notification;
