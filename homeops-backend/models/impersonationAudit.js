"use strict";

const db = require("../db");

class ImpersonationAudit {
  /** Record the start of an impersonation session. Returns the audit row id. */
  static async logStart({ impersonatorId, targetUserId, ipAddress, userAgent }) {
    const result = await db.query(
      `INSERT INTO impersonation_audit
         (impersonator_id, target_user_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [impersonatorId, targetUserId, ipAddress || null, userAgent || null]
    );
    return result.rows[0]?.id;
  }

  /** Close the most recent open impersonation session for this pair. */
  static async logEnd({ impersonatorId, targetUserId }) {
    const result = await db.query(
      `UPDATE impersonation_audit
       SET ended_at = NOW()
       WHERE id = (
         SELECT id FROM impersonation_audit
         WHERE impersonator_id = $1
           AND target_user_id = $2
           AND ended_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1
       )
       RETURNING id`,
      [impersonatorId, targetUserId]
    );
    return result.rows[0]?.id || null;
  }
}

module.exports = ImpersonationAudit;
