"use strict";

/**
 * PrePurchaseNote Model
 *
 * Manages analysis-scoped notes in the `pre_purchase_notes` table.
 */

const db = require("../db");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../expressError");
const { isSafeS3Key } = require("../helpers/presignedUrls");
const { deleteFile } = require("../services/s3Service");

const MAX_NOTE_IMAGES = 2;

/** Normalize and validate image_keys: array of 0–2 safe S3 keys. */
function normalizeImageKeys(raw) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new BadRequestError("imageKeys must be an array");
  }
  if (raw.length > MAX_NOTE_IMAGES) {
    throw new BadRequestError(`At most ${MAX_NOTE_IMAGES} images allowed per note`);
  }
  const keys = [];
  for (const item of raw) {
    if (typeof item !== "string" || !item.trim()) {
      throw new BadRequestError("Each image key must be a non-empty string");
    }
    const trimmed = item.trim();
    if (!isSafeS3Key(trimmed)) {
      throw new BadRequestError("Invalid image key");
    }
    keys.push(trimmed);
  }
  return keys;
}

class PrePurchaseNote {
  /** List notes for an analysis, newest first. Includes author name. */
  static async getByAnalysisId(analysisId) {
    const result = await db.query(
      `SELECT n.id,
              n.analysis_id,
              n.user_id,
              n.body,
              n.image_keys,
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
              n.image_keys,
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
  static async create({ analysis_id, user_id, body, image_keys }) {
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!analysis_id) throw new BadRequestError("analysis_id is required");
    if (!user_id) throw new BadRequestError("user_id is required");
    if (!trimmed) throw new BadRequestError("body is required");

    const keys = normalizeImageKeys(image_keys);

    const result = await db.query(
      `INSERT INTO pre_purchase_notes (analysis_id, user_id, body, image_keys)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [analysis_id, user_id, trimmed, keys],
    );
    return this.get(result.rows[0].id);
  }

  /** Update a note body and/or image_keys. Only the author may update. */
  static async update(id, data, userId) {
    const existing = await this.get(id);
    if (Number(existing.user_id) !== Number(userId)) {
      throw new ForbiddenError("You can only edit your own notes");
    }

    const { body, image_keys } = data;
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) throw new BadRequestError("body is required");

    const keys =
      image_keys !== undefined
        ? normalizeImageKeys(image_keys)
        : existing.image_keys ?? [];

    await db.query(
      `UPDATE pre_purchase_notes
       SET body = $1, image_keys = $2, updated_at = NOW()
       WHERE id = $3`,
      [trimmed, keys, id],
    );
    return this.get(id);
  }

  /** Delete a note. Author or admin may delete. Best-effort S3 cleanup for images. */
  static async remove(id, userId, userRole) {
    const existing = await this.get(id);
    const isAdmin = ["admin", "super_admin"].includes(
      String(userRole ?? "").toLowerCase(),
    );
    if (!isAdmin && Number(existing.user_id) !== Number(userId)) {
      throw new ForbiddenError("You can only delete your own notes");
    }

    const keys = Array.isArray(existing.image_keys) ? existing.image_keys : [];
    await db.query(`DELETE FROM pre_purchase_notes WHERE id = $1`, [id]);

    for (const key of keys) {
      if (!key || typeof key !== "string") continue;
      try {
        await deleteFile(key);
      } catch (err) {
        console.warn("[pre-purchase-notes] S3 delete failed:", err.message);
      }
    }

    return { deleted: id };
  }
}

module.exports = PrePurchaseNote;
module.exports.normalizeImageKeys = normalizeImageKeys;
module.exports.MAX_NOTE_IMAGES = MAX_NOTE_IMAGES;
