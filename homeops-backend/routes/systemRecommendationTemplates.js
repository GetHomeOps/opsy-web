"use strict";

/**
 * Routes for the Default System Maintenance Recommendation library.
 * All endpoints are Super Admin only.
 *
 * GET    /                -> grouped templates ({ grouped, templates })
 * POST   /                -> create template
 * PATCH  /:id             -> update template
 * DELETE /:id             -> delete template (does not affect generated items)
 * PUT    /reorder         -> reorder { systemKey, orderedIds }
 */

const express = require("express");
const jsonschema = require("jsonschema");
const { ensureLoggedIn, ensureSuperAdmin } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const SystemRecommendationTemplate = require("../models/systemRecommendationTemplate");
const newSchema = require("../schemas/systemRecommendationTemplateNew.json");
const updateSchema = require("../schemas/systemRecommendationTemplateUpdate.json");

const router = express.Router();

/** GET / - List all templates (grouped by system + flat list). Super admin only. */
router.get("/", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const [grouped, templates] = await Promise.all([
      SystemRecommendationTemplate.getAllGrouped(),
      SystemRecommendationTemplate.getAll(),
    ]);
    return res.json({ grouped, templates });
  } catch (err) {
    return next(err);
  }
});

/** POST / - Create a template. Super admin only. */
router.post("/", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, newSchema);
    if (!validator.valid) {
      throw new BadRequestError(validator.errors.map((e) => e.stack));
    }
    const template = await SystemRecommendationTemplate.create(req.body);
    return res.status(201).json({ template });
  } catch (err) {
    return next(err);
  }
});

/** PUT /reorder - Reorder templates within a system. Super admin only. */
router.put("/reorder", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const { systemKey, orderedIds } = req.body || {};
    const templates = await SystemRecommendationTemplate.reorder(systemKey, orderedIds);
    return res.json({ templates });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id - Update a template. Super admin only. */
router.patch("/:id", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, updateSchema);
    if (!validator.valid) {
      throw new BadRequestError(validator.errors.map((e) => e.stack));
    }
    const template = await SystemRecommendationTemplate.update(Number(req.params.id), req.body);
    return res.json({ template });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:id - Delete a template. Super admin only. */
router.delete("/:id", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const deleted = await SystemRecommendationTemplate.remove(Number(req.params.id));
    return res.json({ deleted: deleted.id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
