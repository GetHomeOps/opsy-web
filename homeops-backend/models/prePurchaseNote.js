"use strict";

/**
 * PrePurchaseNote Model
 *
 * Manages analysis-scoped notes in the `pre_purchase_notes` table.
 */

const db = require("../db");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../expressError");

class PrePurchaseNote {
  /** List notes for an analysis, newest first. Includes author name. */
  static async getByAnalysisId(analysisId) {
    const result = await db.query(
      `SELECT n.id,
              n.analysis_id,
              n.user_id,
              n.body,
              n.created_at,
              n.updated_at,
              u.name AS author_name,
              u.email AS author_email
       FROM pre_purchase_notes n
       JOIN users u ON u.id = n.user_id
       WHERE n.analysis_id = $1
       ORDER BY n.updated_at DESC, n.id DESC`,
      [analysisId],
    );
    return result.rows;
  }

  /** Get a single note by id. */
  static async get(id) {
    const result = await db.query(
      `SELECT n.id,
              n.analysis_id,
              n.user_id,
              n.body,
              n.created_at,
              n.updated_at,
              u.name AS author_name,
              u.email AS author_email
       FROM pre_purchase_notes n
       JOIN users u ON u.id = n.user_id
       WHERE n.id = $1`,
      [id],
    );
    const note = result.rows[0];
    if (!note) throw new NotFoundError(`Note not found: ${id}`);
    return note;
  }

  /** Create a note. */
  static async create({ analysis_id, user_id, body }) {
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!analysis_id) throw new BadRequestError("analysis_id is required");
    if (!user_id) throw new BadRequestError("user_id is required");
    if (!trimmed) throw new BadRequestError("body is required");

    const result = await db.query(
      `INSERT INTO pre_purchase_notes (analysis_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [analysis_id, user_id, trimmed],
    );
    return this.get(result.rows[0].id);
  }

  /** Update a note body. Only the author may update. */
  static async update(id, data, userId) {
    const existing = await this.get(id);
    if (Number(existing.user_id) !== Number(userId)) {
      throw new ForbiddenError("You can only edit your own notes");
    }

    const { body } = data;
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) throw new BadRequestError("body is required");

    await db.query(
      `UPDATE pre_purchase_notes SET body = $1, updated_at = NOW() WHERE id = $2`,
      [trimmed, id],
    );
    return this.get(id);
  }

  /** Delete a note. Author or admin may delete. */
  static async remove(id, userId, userRole) {
    const existing = await this.get(id);
    const isAdmin = ["admin", "super_admin"].includes(
      String(userRole ?? "").toLowerCase(),
    );
    if (!isAdmin && Number(existing.user_id) !== Number(userId)) {
      throw new ForbiddenError("You can only delete your own notes");
    }
    await db.query(`DELETE FROM pre_purchase_notes WHERE id = $1`, [id]);
    return { deleted: id };
  }
}

module.exports = PrePurchaseNote;
