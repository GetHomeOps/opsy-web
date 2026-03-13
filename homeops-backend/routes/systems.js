"use strict";

const express = require("express");
const jsonschema = require("jsonschema");
const { ensureLoggedIn, ensurePropertyAccess } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const System = require("../models/system");
const InspectionAnalysisResult = require("../models/inspectionAnalysisResult");
const { enrichSystemsWithAiCondition } = require("../helpers/aiConditionFromAnalysis");
const { getAiSummaryForProperty } = require("../services/ai/propertyReanalysisService");
const systemNewSchema = require("../schemas/systemNew.json");
const systemUpdateSchema = require("../schemas/systemUpdate.json");

const router = express.Router();

/** POST /:propertyId - Create system for property. */
router.post("/:propertyId", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, systemNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }
    const system = await System.create(req.body);
    return res.status(201).json({ system });
  } catch (err) {
    return next(err);
  }
});

/** GET /:propertyId - List systems for property. Enriches each system with aiCondition from reanalysis or inspection. */
router.get("/:propertyId", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async function (req, res, next) {
  try {
    const propertyId = req.params.propertyId;
    const [systems, analysis, aiSummary] = await Promise.all([
      System.get(propertyId),
      InspectionAnalysisResult.getByPropertyId(propertyId),
      getAiSummaryForProperty(propertyId),
    ]);
    const enriched = enrichSystemsWithAiCondition(systems, analysis, aiSummary);
    const response = { systems: enriched };
    if (aiSummary?.lastReanalysisAt) {
      response.aiSummaryUpdatedAt = aiSummary.lastReanalysisAt;
    }
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

/** PUT /:propertyId/batch - Batch upsert systems for a property in a single request.
 *  Body: { systems: [{ system_key, data, next_service_date, included }, ...] }
 *  Returns { systems: [...] } with AI condition enrichment. */
router.put("/:propertyId/batch", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async function (req, res, next) {
  try {
    const { propertyId } = req.params;
    if (!propertyId || propertyId === "undefined" || propertyId === "null") {
      throw new BadRequestError("Valid property ID is required");
    }
    const { systems: incoming } = req.body;
    if (!Array.isArray(incoming)) {
      throw new BadRequestError("systems array is required");
    }
    for (const sys of incoming) {
      if (!sys.system_key) throw new BadRequestError("Each system must have a system_key");
      if (sys.next_service_date == null || sys.next_service_date === "") {
        sys.next_service_date = null;
      }
    }

    const t0 = Date.now();
    const upserted = await System.batchUpsert(propertyId, incoming);
    const tUpsert = Date.now();

    const [analysis, aiSummary] = await Promise.all([
      InspectionAnalysisResult.getByPropertyId(propertyId),
      getAiSummaryForProperty(propertyId),
    ]);
    const enriched = enrichSystemsWithAiCondition(upserted, analysis, aiSummary);
    const response = { systems: enriched };
    if (aiSummary?.lastReanalysisAt) {
      response.aiSummaryUpdatedAt = aiSummary.lastReanalysisAt;
    }
    if (process.env.NODE_ENV !== "production") {
      console.log(`[perf] PUT /systems/${propertyId}/batch: upsert ${incoming.length} systems ${tUpsert - t0}ms | enrich ${Date.now() - tUpsert}ms | total ${Date.now() - t0}ms`);
    }
    return res.json(response);
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:propertyId - Update system (upsert by system_key). Body: system_key, data, next_service_date, etc. */
router.patch("/:propertyId", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async function (req, res, next) {
  try {
    const { propertyId } = req.params;
    if (!propertyId || propertyId === "undefined" || propertyId === "null") {
      throw new BadRequestError("Valid property ID is required");
    }

    const validator = jsonschema.validate(req.body, systemUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const system_key = req.body.system_key;
    if (!system_key) {
      throw new BadRequestError("system_key is required");
    }

    const body = { ...req.body };
    if (body.next_service_date == null || body.next_service_date === "") {
      body.next_service_date = null;
    }
    const system = await System.update({
      property_id: propertyId,
      system_key,
      ...body,
    });
    return res.json({ system });

  } catch (err) {
    return next(err);
  }
});

module.exports = router;