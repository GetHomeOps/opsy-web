"use strict";

const express = require("express");
const db = require("../db");
const { ensureLoggedIn, ensurePropertyAccess } = require("../middleware/auth");
const { BadRequestError, ForbiddenError } = require("../expressError");
const PropertyNote = require("../models/propertyNote");
const { isPropertyUid } = require("../helpers/properties");

const router = express.Router();

/** Resolve property_uid or numeric id to numeric primary key. */
async function resolvePropertyId(req, res, next) {
  try {
    const raw = req.params.propertyId;
    if (!raw) return next();
    const rawStr = String(raw);
    if (isPropertyUid(rawStr)) {
      const propRes = await db.query(
        `SELECT id FROM properties WHERE property_uid = $1`,
        [rawStr],
      );
      if (propRes.rows.length === 0) throw new ForbiddenError("Property not found.");
      req.params.propertyId = propRes.rows[0].id;
      return next();
    }
    if (/^\d+$/.test(rawStr)) {
      req.params.propertyId = parseInt(rawStr, 10);
      return next();
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

async function loadPropertyIdFromNote(req, res, next) {
  try {
    const note = await PropertyNote.get(req.params.noteId);
    req.params.propertyId = note.property_id;
    req._propertyNote = note;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** GET /property/:propertyId - List notes for property. */
router.get(
  "/property/:propertyId",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const notes = await PropertyNote.getByPropertyId(req.params.propertyId);
      return res.json({ notes });
    } catch (err) {
      return next(err);
    }
  },
);

/** POST /property/:propertyId - Create a note. */
router.post(
  "/property/:propertyId",
  ensureLoggedIn,
  resolvePropertyId,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const body = req.body?.body ?? req.body?.content;
      if (!body || !String(body).trim()) {
        throw new BadRequestError("body is required");
      }
      const note = await PropertyNote.create({
        property_id: req.params.propertyId,
        user_id: res.locals.user.id,
        body,
      });
      return res.status(201).json({ note });
    } catch (err) {
      return next(err);
    }
  },
);

/** PATCH /:noteId - Update a note. */
router.patch(
  "/:noteId",
  ensureLoggedIn,
  loadPropertyIdFromNote,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const body = req.body?.body ?? req.body?.content;
      if (!body || !String(body).trim()) {
        throw new BadRequestError("body is required");
      }
      const note = await PropertyNote.update(
        req.params.noteId,
        { body },
        res.locals.user.id,
      );
      return res.json({ note });
    } catch (err) {
      return next(err);
    }
  },
);

/** DELETE /:noteId - Delete a note. */
router.delete(
  "/:noteId",
  ensureLoggedIn,
  loadPropertyIdFromNote,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      await PropertyNote.remove(
        req.params.noteId,
        res.locals.user.id,
        res.locals.user.role,
      );
      return res.json({ deleted: req.params.noteId });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
