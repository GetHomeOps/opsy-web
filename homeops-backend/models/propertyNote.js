"use strict";

/**
 * PropertyNote Model
 *
 * Manages property notes in the `property_notes` table.
 */

const db = require("../db");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../expressError");
class PropertyNote {
  /** List notes for a property, newest first. Includes author name. */
  static async getByPropertyId(propertyId) {
    const result = await db.query(
      `SELECT n.id,
              n.property_id,
              n.user_id,
              n.body,
              n.created_at,
              n.updated_at,
              u.name AS author_name,
              u.email AS author_email
       FROM property_notes n
       JOIN users u ON u.id = n.user_id
       WHERE n.property_id = $1
       ORDER BY n.updated_at DESC, n.id DESC`,
      [propertyId],
    );
    return result.rows;
  }

  /** Get a single note by id. */
  static async get(id) {
    const result = await db.query(
      `SELECT n.id,
              n.property_id,
              n.user_id,
              n.body,
              n.created_at,
              n.updated_at,
              u.name AS author_name,
              u.email AS author_email
       FROM property_notes n
       JOIN users u ON u.id = n.user_id
       WHERE n.id = $1`,
      [id],
    );
    const note = result.rows[0];
    if (!note) throw new NotFoundError(`Note not found: ${id}`);
    return note;
  }

  /** Create a note. */
  static async create({ property_id, user_id, body }) {
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!property_id) throw new BadRequestError("property_id is required");
    if (!user_id) throw new BadRequestError("user_id is required");
    if (!trimmed) throw new BadRequestError("body is required");

    const result = await db.query(
      `INSERT INTO property_notes (property_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, property_id, user_id, body, created_at, updated_at`,
      [property_id, user_id, trimmed],
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
      `UPDATE property_notes SET body = $1, updated_at = NOW() WHERE id = $2`,
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
    await db.query(`DELETE FROM property_notes WHERE id = $1`, [id]);
    return { deleted: id };
  }
}

module.exports = PropertyNote;
