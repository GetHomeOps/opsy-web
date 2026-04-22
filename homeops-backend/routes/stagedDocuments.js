"use strict";

/**
 * Staged Documents Routes (Documents tab inbox)
 *
 * The Documents tab now offers a batch-upload "inbox": users drop many
 * files at once, see them as cards, then drag each card into a system
 * folder. While staged, files live in S3 + this table; on filing they
 * are atomically moved into property_documents.
 *
 * Endpoints:
 *   POST   /                  - create staged row (after S3 upload)
 *   GET    /property/:id      - list staged rows for a property
 *   PATCH  /:id               - update proposed metadata
 *   DELETE /:id               - remove from inbox + delete S3 object
 *   POST   /:id/file          - move single staged row into a folder
 *   POST   /file-bulk         - move many staged rows in one transaction
 */

const express = require("express");
const router = express.Router();

const StagedDocument = require("../models/stagedDocuments");
const PropertyDocument = require("../models/propertyDocuments");
const db = require("../db");
const {
  ensureLoggedIn,
  ensurePropertyAccess,
} = require("../middleware/auth");
const {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} = require("../expressError");
const { deleteFile } = require("../services/s3Service");
const { canUploadDocumentToSystem } = require("../services/tierService");
const { logStorageUsage } = require("../services/usageService");
const documentRagService = require("../services/documentRagService");
const {
  triggerReanalysisOnDocument,
} = require("../services/ai/propertyReanalysisService");

const MAX_BULK_FILE_ITEMS = 50;

/** Load a staged row and stamp req.params.propertyId for ensurePropertyAccess. */
async function loadPropertyIdFromStaged(req, res, next) {
  try {
    const row = await StagedDocument.get(req.params.id);
    req.params.propertyId = row.property_id;
    res.locals.stagedRow = row;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Best-effort S3 cleanup that never throws. */
async function bestEffortDeleteS3(key) {
  if (!key) return;
  try {
    await deleteFile(key);
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[stagedDocuments] S3 cleanup failed for ${key}:`,
        err.message,
      );
    }
  }
}

/**
 * Create a property document from a staged row inside an existing client/transaction.
 * - Enforces inspection-report singleton.
 * - Runs RAG ingestion only for inspection reports (per product decision).
 * - Logs storage usage (the file already pays storage; we count it on file).
 */
async function fileStagedRow(client, stagedRow, payload, user) {
  const {
    system_key,
    document_type,
    document_name,
    document_date,
  } = payload;

  if (!system_key) throw new BadRequestError("system_key is required");
  if (!document_type) throw new BadRequestError("document_type is required");
  if (!document_name) throw new BadRequestError("document_name is required");
  if (!document_date) throw new BadRequestError("document_date is required");

  if (system_key === "inspectionReport") {
    const exists = await client.query(
      `SELECT 1 FROM property_documents
       WHERE property_id = $1 AND system_key = 'inspectionReport'
       LIMIT 1`,
      [stagedRow.property_id],
    );
    if (exists.rows.length) {
      throw new BadRequestError(
        "This property already has an inspection report. Delete it before filing another.",
      );
    }
  }

  const role = user?.role;
  const accRes = await client.query(
    `SELECT account_id FROM properties WHERE id = $1`,
    [stagedRow.property_id],
  );
  const accountId = accRes.rows[0]?.account_id ?? null;

  if (role !== "super_admin" && role !== "admin" && accountId) {
    const tier = await canUploadDocumentToSystem(
      accountId,
      stagedRow.property_id,
      system_key,
      role,
    );
    if (!tier.allowed) {
      throw new ForbiddenError(
        `Document limit reached for this system (${tier.current}/${tier.max}). Upgrade your plan.`,
      );
    }
  }

  const insertRes = await client.query(
    `INSERT INTO property_documents (
      property_id, document_name, document_date, document_key,
      document_type, system_key, maintenance_record_id
    ) VALUES ($1, $2, $3, $4, $5, $6, NULL)
    RETURNING *`,
    [
      stagedRow.property_id,
      document_name,
      document_date,
      stagedRow.document_key,
      document_type,
      system_key,
    ],
  );
  const created = insertRes.rows[0];

  await client.query(`DELETE FROM staged_documents WHERE id = $1`, [
    stagedRow.id,
  ]);

  // Side-effects (non-blocking, fire-and-forget after the transaction commits)
  return {
    document: created,
    sideEffects: () => {
      if (accountId && user?.id) {
        logStorageUsage({
          accountId,
          userId: user.id,
          fileSizeBytes: stagedRow.file_size_bytes || 0,
          fileKey: stagedRow.document_key,
        }).catch(() => {});
      }

      if (system_key === "inspectionReport") {
        documentRagService
          .ingestDocument(stagedRow.property_id, created.id)
          .catch((err) => {
            if (!err?.message?.includes("pgvector not available")) {
              console.error(
                "[stagedDocuments] RAG ingest failed:",
                err.message,
              );
            }
          });
        triggerReanalysisOnDocument(stagedRow.property_id, created.id).catch(
          (err) => {
            console.error(
              "[stagedDocuments] reanalysis trigger failed:",
              err.message,
            );
          },
        );
      }
    },
  };
}

/**
 * POST /
 *
 * Create a staged document row after a successful S3 upload.
 * Body: {
 *   property_id, document_key, original_name,
 *   file_size_bytes?, mime_type?,
 *   proposed_system_key?, proposed_document_type?,
 *   proposed_document_name?, proposed_document_date?
 * }
 */
router.post(
  "/",
  ensureLoggedIn,
  ensurePropertyAccess({ fromBody: "property_id", param: "propertyId" }),
  async (req, res, next) => {
    try {
      const userId = res.locals.user?.id;
      const propertyId =
        res.locals.resolvedPropertyId ?? req.body.property_id;
      const {
        document_key,
        original_name,
        file_size_bytes,
        mime_type,
        proposed_system_key,
        proposed_document_type,
        proposed_document_name,
        proposed_document_date,
      } = req.body;

      const row = await StagedDocument.create({
        property_id: propertyId,
        user_id: userId,
        document_key,
        original_name,
        file_size_bytes,
        mime_type,
        proposed_system_key,
        proposed_document_type,
        proposed_document_name,
        proposed_document_date,
      });

      return res.status(201).json({ stagedDocument: row });
    } catch (err) {
      return next(err);
    }
  },
);

/** GET /property/:propertyId - list inbox for a property. */
router.get(
  "/property/:propertyId",
  ensureLoggedIn,
  ensurePropertyAccess({ param: "propertyId" }),
  async (req, res, next) => {
    try {
      const rows = await StagedDocument.getByPropertyId(req.params.propertyId);
      return res.json({ stagedDocuments: rows });
    } catch (err) {
      return next(err);
    }
  },
);

/** PATCH /:id - update proposed_* metadata for a staged row. */
router.patch(
  "/:id",
  ensureLoggedIn,
  loadPropertyIdFromStaged,
  ensurePropertyAccess({ param: "propertyId" }),
  async (req, res, next) => {
    try {
      const updated = await StagedDocument.update(req.params.id, req.body);
      return res.json({ stagedDocument: updated });
    } catch (err) {
      return next(err);
    }
  },
);

/** DELETE /:id - remove from inbox and delete the S3 object (best-effort). */
router.delete(
  "/:id",
  ensureLoggedIn,
  loadPropertyIdFromStaged,
  ensurePropertyAccess({ param: "propertyId" }),
  async (req, res, next) => {
    try {
      const removed = await StagedDocument.remove(req.params.id);
      bestEffortDeleteS3(removed.document_key);
      return res.json({ deleted: removed.id });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * POST /:id/file
 *
 * Atomically move one staged row into property_documents.
 * Body: { system_key, document_type, document_name, document_date }
 */
router.post(
  "/:id/file",
  ensureLoggedIn,
  loadPropertyIdFromStaged,
  ensurePropertyAccess({ param: "propertyId" }),
  async (req, res, next) => {
    const client = await db.connect();
    let runSideEffects = null;
    try {
      await client.query("BEGIN");
      const result = await fileStagedRow(
        client,
        res.locals.stagedRow,
        req.body,
        res.locals.user,
      );
      await client.query("COMMIT");
      runSideEffects = result.sideEffects;
      return res.status(201).json({ document: result.document });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
      return next(err);
    } finally {
      client.release();
      if (typeof runSideEffects === "function") runSideEffects();
    }
  },
);

/**
 * POST /file-bulk
 *
 * Atomically file many staged rows in one transaction.
 * Body: { items: [{ id, system_key, document_type, document_name, document_date }] }
 * Returns: { filed: [{ id, document }], errors: [{ id, message }] }
 *
 * One bad item rolls the whole batch back. (Predictable: users get an
 * "all or nothing" guarantee. They can retry after fixing the bad item.)
 */
router.post(
  "/file-bulk",
  ensureLoggedIn,
  async (req, res, next) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return next(new BadRequestError("items array is required"));
    }
    if (items.length > MAX_BULK_FILE_ITEMS) {
      return next(
        new BadRequestError(
          `Cannot file more than ${MAX_BULK_FILE_ITEMS} items at once.`,
        ),
      );
    }

    const ids = items.map((it) => Number(it?.id)).filter((n) => Number.isFinite(n));
    if (ids.length !== items.length) {
      return next(new BadRequestError("Every item needs a numeric staged id"));
    }

    const client = await db.connect();
    const sideEffects = [];
    try {
      await client.query("BEGIN");

      // Fetch + access-check all staged rows in one query
      const rowsRes = await client.query(
        `SELECT * FROM staged_documents WHERE id = ANY($1::int[])`,
        [ids],
      );
      const stagedById = new Map(rowsRes.rows.map((r) => [r.id, r]));
      if (stagedById.size !== ids.length) {
        throw new NotFoundError("One or more staged documents were not found.");
      }

      const propertyIds = [...new Set(rowsRes.rows.map((r) => r.property_id))];
      const user = res.locals.user;
      if (user.role !== "super_admin" && user.role !== "admin") {
        const accessRes = await client.query(
          `SELECT property_id FROM property_users
           WHERE user_id = $1 AND property_id = ANY($2::int[])`,
          [user.id, propertyIds],
        );
        const allowed = new Set(accessRes.rows.map((r) => r.property_id));
        if (allowed.size !== propertyIds.length) {
          throw new ForbiddenError(
            "You do not have access to one or more of these properties.",
          );
        }
      }

      const filed = [];
      for (const item of items) {
        const stagedRow = stagedById.get(Number(item.id));
        const result = await fileStagedRow(client, stagedRow, item, user);
        filed.push({ id: stagedRow.id, document: result.document });
        sideEffects.push(result.sideEffects);
      }

      await client.query("COMMIT");
      return res.status(201).json({ filed, errors: [] });
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
      return next(err);
    } finally {
      client.release();
      sideEffects.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
    }
  },
);

module.exports = router;
