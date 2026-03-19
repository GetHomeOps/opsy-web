"use strict";

const express = require("express");
const router = express.Router();
const PropertyDocument = require("../models/propertyDocuments");
const { ensureLoggedIn, ensurePropertyAccess } = require("../middleware/auth");
const { BadRequestError, ForbiddenError } = require("../expressError");
const documentRagService = require("../services/documentRagService");
const { triggerReanalysisOnDocument } = require("../services/ai/propertyReanalysisService");
const { canUploadDocumentToSystem } = require("../services/tierService");
const db = require("../db");

/** Set req.params.propertyId from document id so ensurePropertyAccess can run. */
async function loadPropertyIdFromDocument(req, res, next) {
  try {
    const doc = await PropertyDocument.get(req.params.id);
    req.params.propertyId = doc.property_id;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** POST / - Create document record. Body: property_id, document_name, document_date, document_key, document_type, system_key. */
router.post("/", ensureLoggedIn, ensurePropertyAccess({ fromBody: "property_id", param: "propertyId" }), async (req, res, next) => {
  try {
    const { property_id: bodyPropertyId, document_name, document_date, document_key, document_type, system_key: rawSystemKey } = req.body;
    const system_key = rawSystemKey || "general";
    let propertyId = res.locals.resolvedPropertyId ?? req.params.propertyId ?? bodyPropertyId;
    // If still a UID string (fallback when middleware didn't set resolvedPropertyId), resolve to numeric id
    if (propertyId != null && /^[A-Za-z0-9_-]{6,12}$/.test(String(propertyId)) && !/^\d+$/.test(String(propertyId))) {
      const propRes = await db.query(`SELECT id FROM properties WHERE property_uid = $1`, [propertyId]);
      if (propRes.rows[0]) propertyId = propRes.rows[0].id;
    }
    if (typeof propertyId === "string" && /^\d+$/.test(propertyId)) propertyId = parseInt(propertyId, 10);

    const systemKey = system_key || "general";
    const missing = [];
    if (propertyId == null || (typeof propertyId === "string" && !/^\d+$/.test(propertyId))) missing.push("property_id");
    if (!document_name) missing.push("document_name");
    if (!document_date) missing.push("document_date");
    if (!document_key) missing.push("document_key");
    if (!document_type) missing.push("document_type");
    if (missing.length) {
      throw new BadRequestError(`Missing required fields: ${missing.join(", ")}`);
    }

    if (systemKey === "inspectionReport") {
      const n = await PropertyDocument.countByPropertyAndSystemKey(propertyId, "inspectionReport");
      if (n >= 1) {
        throw new BadRequestError(
          "This property already has an inspection report. Delete it before uploading another."
        );
      }
    }

    const userRole = res.locals.user?.role;
    if (systemKey && userRole !== "super_admin" && userRole !== "admin") {
      const accRes = await db.query(
        `SELECT account_id FROM properties WHERE id = $1`,
        [propertyId]
      );
      const accountId = accRes.rows[0]?.account_id;
      if (accountId) {
        const tierCheck = await canUploadDocumentToSystem(accountId, propertyId, systemKey, userRole);
        if (!tierCheck.allowed) {
          throw new ForbiddenError(`Document limit reached for this system (${tierCheck.current}/${tierCheck.max}). Upgrade your plan.`);
        }
      }
    }

    const document = await PropertyDocument.create({
      property_id: propertyId,
      document_name,
      document_date,
      document_key,
      document_type,
      system_key: systemKey,
    });
    documentRagService.ingestDocument(propertyId, document.id).catch((err) => {
      if (!err?.message?.includes("pgvector not available")) {
        console.error("[documentRag] Ingest on upload failed:", err.message);
      }
    });
    // Trigger AI reanalysis when new document is added (async, non-blocking)
    triggerReanalysisOnDocument(propertyId, document.id).catch((err) => {
      console.error("[propertyReanalysis] Document trigger failed:", err.message);
    });
    return res.status(201).json({ document });
  } catch (err) {
    return next(err);
  }
});

/** GET /property/:propertyId - List documents for property. */
router.get("/property/:propertyId", ensureLoggedIn, ensurePropertyAccess({ param: "propertyId" }), async (req, res, next) => {
  try {
    const documents = await PropertyDocument.getByPropertyId(req.params.propertyId);
    return res.json({ documents });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id - Get single document. */
router.get("/:id", ensureLoggedIn, loadPropertyIdFromDocument, ensurePropertyAccess({ param: "propertyId" }), async (req, res, next) => {
  try {
    const document = await PropertyDocument.get(req.params.id);
    return res.json({ document });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:id - Remove document record. */
router.delete("/:id", ensureLoggedIn, loadPropertyIdFromDocument, ensurePropertyAccess({ param: "propertyId" }), async (req, res, next) => {
  try {
    const result = await PropertyDocument.remove(req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
