"use strict";

const db = require("../db");

const COLS = `id, default_provider AS "defaultProvider",
  updated_at AS "updatedAt", updated_by AS "updatedBy"`;

class PlatformEmailSettings {
  static async get() {
    const result = await db.query(`SELECT ${COLS} FROM platform_email_settings WHERE id = 1`);
    if (result.rows[0]) return result.rows[0];
    const inserted = await db.query(
      `INSERT INTO platform_email_settings (id, default_provider)
       VALUES (1, 'ses')
       ON CONFLICT (id) DO NOTHING
       RETURNING ${COLS}`
    );
    if (inserted.rows[0]) return inserted.rows[0];
    const again = await db.query(`SELECT ${COLS} FROM platform_email_settings WHERE id = 1`);
    return again.rows[0] || { id: 1, defaultProvider: "ses" };
  }

  static async update({ defaultProvider, updatedBy }) {
    const result = await db.query(
      `INSERT INTO platform_email_settings (id, default_provider, updated_by, updated_at)
       VALUES (1, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE
         SET default_provider = EXCLUDED.default_provider,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
       RETURNING ${COLS}`,
      [defaultProvider, updatedBy ?? null]
    );
    return result.rows[0];
  }
}

module.exports = PlatformEmailSettings;
