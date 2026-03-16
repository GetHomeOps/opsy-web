"use strict";

const db = require("../db");
const { NotFoundError } = require("../expressError");
const { encrypt, decrypt } = require("../helpers/encryption");

/** Calendar integrations: OAuth connections for Google Calendar and Outlook. */
class CalendarIntegration {
  /**
   * Create a calendar integration (after OAuth callback).
   * @param {Object} data - { userId, provider, accessToken, refreshToken?, tokenExpiresAt?, calendarId? }
   */
  static async create(data) {
    const {
      userId,
      provider,
      accessToken,
      refreshToken = null,
      tokenExpiresAt = null,
      calendarId = "primary",
    } = data;

    const accessEncrypted = encrypt(accessToken);
    const refreshEncrypted = refreshToken ? encrypt(refreshToken) : null;

    const result = await db.query(
      `INSERT INTO calendar_integrations
         (user_id, provider, access_token_encrypted, refresh_token_encrypted,
          token_expires_at, calendar_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, provider) DO UPDATE SET
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, calendar_integrations.refresh_token_encrypted),
         token_expires_at = EXCLUDED.token_expires_at,
         calendar_id = EXCLUDED.calendar_id,
         updated_at = NOW()
       RETURNING id, user_id, provider, calendar_id, sync_enabled, last_synced_at, created_at, updated_at`,
      [userId, provider, accessEncrypted, refreshEncrypted, tokenExpiresAt, calendarId]
    );
    return result.rows[0];
  }

  /** Get integrations for a user (no decrypted tokens). */
  static async getByUserId(userId) {
    const result = await db.query(
      `SELECT id, user_id, provider, calendar_id, sync_enabled, last_synced_at, created_at, updated_at
       FROM calendar_integrations WHERE user_id = $1 ORDER BY provider`,
      [userId]
    );
    return result.rows;
  }

  /** Get a single integration by id (for sync). */
  static async getById(id, userId = null) {
    let sql = `SELECT * FROM calendar_integrations WHERE id = $1`;
    const params = [id];
    if (userId) {
      sql += ` AND user_id = $2`;
      params.push(userId);
    }
    const result = await db.query(sql, params);
    const row = result.rows[0];
    if (!row) throw new NotFoundError(`Calendar integration not found: ${id}`);
    return row;
  }

  /** Get integration with decrypted tokens (internal use only). */
  static async getWithTokens(id) {
    const row = await this.getById(id);
    try {
      row.access_token = decrypt(row.access_token_encrypted);
      row.refresh_token = row.refresh_token_encrypted ? decrypt(row.refresh_token_encrypted) : null;
    } catch (err) {
      throw new Error("Failed to decrypt calendar tokens");
    }
    return row;
  }

  /** Update tokens (after refresh). */
  static async updateTokens(id, { accessToken, refreshToken, tokenExpiresAt }) {
    const accessEncrypted = encrypt(accessToken);
    const refreshEncrypted = refreshToken ? encrypt(refreshToken) : null;
    const result = await db.query(
      `UPDATE calendar_integrations SET
         access_token_encrypted = $1,
         refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
         token_expires_at = $3,
         updated_at = NOW()
       WHERE id = $4 RETURNING id`,
      [accessEncrypted, refreshEncrypted, tokenExpiresAt, id]
    );
    if (!result.rows[0]) throw new NotFoundError(`Calendar integration not found: ${id}`);
    return result.rows[0];
  }

  /** Update last_synced_at. */
  static async touchLastSynced(id) {
    await db.query(
      `UPDATE calendar_integrations SET last_synced_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
  }

  /** Delete an integration (disconnect). */
  static async delete(id, userId) {
    const result = await db.query(
      `DELETE FROM calendar_integrations WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );
    if (!result.rows[0]) throw new NotFoundError(`Calendar integration not found: ${id}`);
    return { deleted: id };
  }

  /** Record an event sync. */
  static async recordEventSync(maintenanceEventId, calendarIntegrationId, externalEventId, provider) {
    await db.query(
      `INSERT INTO event_calendar_syncs (maintenance_event_id, calendar_integration_id, external_event_id, provider)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (maintenance_event_id, calendar_integration_id) DO UPDATE SET
         external_event_id = EXCLUDED.external_event_id`,
      [maintenanceEventId, calendarIntegrationId, externalEventId, provider]
    );
  }

  /** Get external event ID for an event + integration. */
  static async getExternalEventId(maintenanceEventId, calendarIntegrationId) {
    const result = await db.query(
      `SELECT external_event_id FROM event_calendar_syncs
       WHERE maintenance_event_id = $1 AND calendar_integration_id = $2`,
      [maintenanceEventId, calendarIntegrationId]
    );
    return result.rows[0]?.external_event_id || null;
  }

  /** Get all sync records for an event (for deletion from external calendars). */
  static async getEventSyncs(maintenanceEventId) {
    const result = await db.query(
      `SELECT ecs.calendar_integration_id, ecs.external_event_id, ci.provider, ci.user_id
       FROM event_calendar_syncs ecs
       JOIN calendar_integrations ci ON ci.id = ecs.calendar_integration_id
       WHERE ecs.maintenance_event_id = $1`,
      [maintenanceEventId]
    );
    return result.rows;
  }

  /** Remove sync records for an event (on delete). */
  static async deleteEventSyncs(maintenanceEventId) {
    await db.query(
      `DELETE FROM event_calendar_syncs WHERE maintenance_event_id = $1`,
      [maintenanceEventId]
    );
  }
}

module.exports = CalendarIntegration;
