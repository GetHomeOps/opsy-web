"use strict";

const express = require("express");
const db = require("../db");
const { ensureLoggedIn, ensurePropertyAccess } = require("../middleware/auth");
const DocumentAnalysisJob = require("../models/documentAnalysisJob");
const DocumentAnalysisResult = require("../models/documentAnalysisResult");
const PropertyDocument = require("../models/propertyDocuments");
const System = require("../models/system");
const { enqueue } = require("../services/documentAnalysisQueue");
const {
  mergeSelectedFields,
  formatResultForApi,
  buildReviewFields,
} = require("../services/documentAnalysisFieldMapper");
const { checkAiFeaturesAllowed, checkAiTokenQuota } = require("../services/tierService");
const { assertDemoAiAllowed } = require("../helpers/demoEnvironment");
const { triggerReanalysisOnDocument } = require("../services/ai/propertyReanalysisService");

const router = express.Router();

async function assertPropertyAccess(propertyId, user) {
  if (user.role === "super_admin" || user.role === "admin") return;
  const accessCheck = await db.query(
    `SELECT 1 FROM property_users WHERE property_id = $1 AND user_id = $2`,
    [propertyId, user.id],
  );
  if (accessCheck.rows.length === 0) {
    throw new ForbiddenError("You do not have access to this property.");
  }
}

async function getSystemRow(propertyId, systemKey) {
  const rows = await System.get(propertyId);
  return rows.find((r) => r.system_key === systemKey) || null;
}

function inferMimeFromKey(key, fileName) {
  const name = (fileName || key || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".pdf")) return "application/pdf";
  return null;
}

function serializeJobResponse(job, resultRow, systemRow) {
  const response = {
    status: job.status,
    progress: job.progress,
    errorMessage: job.error_message,
    jobId: job.id,
    propertyDocumentId: job.property_document_id,
    systemKey: job.system_key,
    fileName: job.file_name,
  };
  if (job.status === "completed" && resultRow) {
    response.result = formatResultForApi(resultRow, systemRow);
  }
  return response;
}

/** POST /analyze — Start analysis for a filed property document. */
router.post("/analyze", ensureLoggedIn, async function (req, res, next) {
  try {
    assertDemoAiAllowed();
    const { propertyDocumentId } = req.body;
    const docId = parseInt(propertyDocumentId, 10);
    if (isNaN(docId)) throw new BadRequestError("propertyDocumentId is required");

    const doc = await PropertyDocument.get(docId);
    const user = res.locals.user;
    await assertPropertyAccess(doc.property_id, user);

    await checkAiFeaturesAllowed(user.id, user.role);
    await checkAiTokenQuota(user.id, user.role);

    const active = await DocumentAnalysisJob.getActiveForDocument(docId);
    if (active) {
      return res.status(202).json({ jobId: active.id });
    }

    const mimeType = inferMimeFromKey(doc.document_key, doc.document_name);

    const job = await DocumentAnalysisJob.create({
      property_id: doc.property_id,
      user_id: user.id,
      property_document_id: doc.id,
      s3_key: doc.document_key,
      file_name: doc.document_name,
      mime_type: mimeType,
      system_key: doc.system_key,
      document_type: doc.document_type,
    });

    enqueue(job.id);
    return res.status(202).json({ jobId: job.id });
  } catch (err) {
    return next(err);
  }
});

/** GET /jobs/:jobId — Poll job status and result. */
router.get("/jobs/:jobId", ensureLoggedIn, async function (req, res, next) {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) throw new BadRequestError("Invalid job ID");

    const job = await DocumentAnalysisJob.get(jobId);
    await assertPropertyAccess(job.property_id, res.locals.user);

    const resultRow = await DocumentAnalysisResult.getByJobId(jobId);
    let enriched = resultRow;
    if (resultRow) {
      const doc = await PropertyDocument.get(resultRow.property_document_id).catch(() => null);
      enriched = {
        ...resultRow,
        document_name: doc?.document_name,
        document_date: doc?.document_date,
        document_key: doc?.document_key,
        document_type: doc?.document_type,
      };
    }
    const systemRow = await getSystemRow(job.property_id, job.system_key);
    return res.json(serializeJobResponse(job, enriched, systemRow));
  } catch (err) {
    return next(err);
  }
});

/** GET /property/:propertyId — List analysis jobs/results for property. */
router.get(
  "/property/:propertyId",
  ensureLoggedIn,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const propertyId = parseInt(req.params.propertyId, 10);
      if (isNaN(propertyId)) throw new BadRequestError("Invalid property ID");

      const rows = await DocumentAnalysisJob.listByProperty(propertyId);
      const systems = await System.get(propertyId);
      const systemByKey = new Map(systems.map((s) => [s.system_key, s]));

      const items = rows.map((row) => {
        const systemRow = systemByKey.get(row.system_key) || null;
        if (!row.result_id) {
          return {
            jobId: row.id,
            status: row.status,
            progress: row.progress,
            errorMessage: row.error_message,
            propertyDocumentId: row.property_document_id,
            systemKey: row.system_key,
            fileName: row.file_name,
          };
        }
        return formatResultForApi(
          {
            id: row.result_id,
            job_id: row.id,
            property_id: row.property_id,
            property_document_id: row.property_document_id,
            system_key: row.system_key,
            detected_category: row.detected_category,
            findings: row.findings,
            review_status: row.review_status,
            applied_fields: row.applied_fields,
            created_at: row.result_created_at,
            updated_at: row.result_updated_at,
            document_name: row.document_name,
            document_date: row.document_date,
            document_key: row.document_key,
            document_type: row.document_type,
          },
          systemRow,
        );
      });

      return res.json({ items });
    } catch (err) {
      return next(err);
    }
  },
);

/** GET /system/:propertyId/:systemKey — Approved findings for system card. */
router.get(
  "/system/:propertyId/:systemKey",
  ensureLoggedIn,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const propertyId = parseInt(req.params.propertyId, 10);
      const { systemKey } = req.params;
      if (isNaN(propertyId) || !systemKey) {
        throw new BadRequestError("Invalid property or system key");
      }

      const rows = await DocumentAnalysisResult.listApprovedBySystem(propertyId, systemKey);
      const systemRow = await getSystemRow(propertyId, systemKey);
      const items = rows.map((row) => formatResultForApi(row, systemRow));
      const pending = await DocumentAnalysisResult.listPendingByProperty(propertyId);
      const pendingForSystem = pending.filter((p) => p.system_key === systemKey);
      const pendingItems = pendingForSystem.map((row) =>
        formatResultForApi(row, systemRow),
      );

      return res.json({
        items,
        pendingItems,
        pendingCount: pendingForSystem.length,
        totalApprovedCount: items.length,
      });
    } catch (err) {
      return next(err);
    }
  },
);

/** GET /results/:id — Get a single result for review modal. */
router.get("/results/:id", ensureLoggedIn, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid result ID");

    const row = await DocumentAnalysisResult.get(id);
    await assertPropertyAccess(row.property_id, res.locals.user);

    const doc = await PropertyDocument.get(row.property_document_id).catch(() => null);
    const enriched = {
      ...row,
      document_name: doc?.document_name,
      document_date: doc?.document_date,
      document_key: doc?.document_key,
      document_type: doc?.document_type,
    };
    const systemRow = await getSystemRow(row.property_id, row.system_key);
    return res.json({ result: formatResultForApi(enriched, systemRow) });
  } catch (err) {
    return next(err);
  }
});

/** POST /results/:id/apply — Apply selected extracted fields. */
router.post("/results/:id/apply", ensureLoggedIn, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid result ID");

    const { selectedFieldKeys } = req.body;
    if (!Array.isArray(selectedFieldKeys)) {
      throw new BadRequestError("selectedFieldKeys must be an array");
    }

    const row = await DocumentAnalysisResult.get(id);
    await assertPropertyAccess(row.property_id, res.locals.user);

    if (row.review_status === "rejected") {
      throw new BadRequestError("This analysis was rejected and cannot be applied.");
    }

    const systemRow = await getSystemRow(row.property_id, row.system_key);
    const { data, next_service_date, applied } = mergeSelectedFields(
      row.findings,
      selectedFieldKeys,
      systemRow,
    );

    await System.update({
      property_id: row.property_id,
      system_key: row.system_key,
      data,
      next_service_date,
    });

    const allKeys = buildReviewFields(row.system_key, row.findings, systemRow).map(
      (f) => f.fieldKey,
    );
    const reviewStatus =
      selectedFieldKeys.length >= allKeys.length ? "approved" : "partially_approved";

    const updated = await DocumentAnalysisResult.updateReview(id, {
      review_status: reviewStatus,
      applied_fields: applied,
    });

    triggerReanalysisOnDocument(row.property_id, row.property_document_id).catch((err) => {
      console.error("[documentAnalysis] reanalysis trigger failed:", err.message);
    });

    const doc = await PropertyDocument.get(row.property_document_id).catch(() => null);
    const enriched = {
      ...updated,
      document_name: doc?.document_name,
      document_date: doc?.document_date,
      document_key: doc?.document_key,
      document_type: doc?.document_type,
    };
    const freshSystem = await getSystemRow(row.property_id, row.system_key);

    return res.json({
      result: formatResultForApi(enriched, freshSystem),
      appliedCount: applied.length,
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /results/:id/reject — Reject findings without applying. */
router.post("/results/:id/reject", ensureLoggedIn, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid result ID");

    const row = await DocumentAnalysisResult.get(id);
    await assertPropertyAccess(row.property_id, res.locals.user);

    const updated = await DocumentAnalysisResult.updateReview(id, {
      review_status: "rejected",
      applied_fields: [],
    });

    const doc = await PropertyDocument.get(row.property_document_id).catch(() => null);
    const enriched = {
      ...updated,
      document_name: doc?.document_name,
      document_date: doc?.document_date,
      document_key: doc?.document_key,
      document_type: doc?.document_type,
    };
    const systemRow = await getSystemRow(row.property_id, row.system_key);

    return res.json({ result: formatResultForApi(enriched, systemRow) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
