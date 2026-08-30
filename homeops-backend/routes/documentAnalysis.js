"use strict";

const express = require("express");
const db = require("../db");
const { ensureLoggedIn, ensurePropertyAccess } = require("../middleware/auth");
const DocumentAnalysisJob = require("../models/documentAnalysisJob");
const DocumentAnalysisResult = require("../models/documentAnalysisResult");
const PropertyDocument = require("../models/propertyDocuments");
const System = require("../models/system");
const { BadRequestError, ForbiddenError } = require("../expressError");
const Contact = require("../models/contact");
const { enqueue } = require("../services/documentAnalysisQueue");
const {
  mergeSelectedFields,
  mergeSelectedIdentityFields,
  formatResultForApi,
  buildReviewFields,
  collectInstallerContactDetails,
  snapshotQuoteFields,
} = require("../services/documentAnalysisFieldMapper");
const Property = require("../models/property");
const {
  canProposePropertyIdentity,
  resolveDeclaredCategory,
  canonicalDocumentTypeForCategory,
  shouldSyncDocumentType,
  shouldWriteExtractedFieldsToSystem,
} = require("../services/documentAnalysisClassification");
const { checkAiFeaturesAllowed, checkAiTokenQuota } = require("../services/tierService");
const { assertDemoAiAllowed } = require("../helpers/demoEnvironment");
const { triggerReanalysisOnDocument } = require("../services/ai/propertyReanalysisService");
const { isAdminRole } = require("../helpers/roles");
const { ensureInstallerTag } = require("../services/installerTagService");

const router = express.Router();

const MAX_DOCUMENT_ANALYSIS_RUNS_PER_DOCUMENT =
  DocumentAnalysisJob.MAX_COMPLETED_RUNS_PER_DOCUMENT;

const DOCUMENT_ANALYSIS_RUN_LIMIT_MESSAGE = `This document has already been analyzed ${MAX_DOCUMENT_ANALYSIS_RUNS_PER_DOCUMENT} times.`;

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

async function getPropertyAccountId(propertyId) {
  const res = await db.query(`SELECT account_id FROM properties WHERE id = $1`, [
    propertyId,
  ]);
  return res.rows[0]?.account_id || null;
}

async function getPropertyContacts(propertyId) {
  const accountId = await getPropertyAccountId(propertyId);
  if (!accountId) return [];
  try {
    return await Contact.getByAccountId(accountId);
  } catch {
    return [];
  }
}

function installerContactName(raw) {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw).trim();
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const nested = raw.name || raw.company || raw.companyName || raw.installer;
    if (nested != null) return installerContactName(nested);
  }
  return String(raw).trim();
}

function contactCreatePayload(name, details) {
  const payload = {
    name,
    type: 2,
    role: "Installer",
  };
  if (!details) return payload;
  if (details.phone) payload.phone = details.phone;
  if (details.email) payload.email = details.email;
  if (details.website) payload.website = details.website;
  if (details.street1) payload.street1 = details.street1;
  if (details.street2) payload.street2 = details.street2;
  if (details.city) payload.city = details.city;
  if (details.state) payload.state = details.state;
  if (details.zip_code) payload.zip_code = details.zip_code;
  if (details.country) payload.country = details.country;
  if (details.country_code) payload.country_code = details.country_code;
  return payload;
}

function emptyContactFieldPatch(contact, details) {
  if (!contact || !details) return null;
  const patch = {};
  const keys = [
    "phone",
    "email",
    "website",
    "street1",
    "street2",
    "city",
    "state",
    "zip_code",
    "country",
    "country_code",
  ];
  for (const key of keys) {
    const next = details[key];
    if (next == null || String(next).trim() === "") continue;
    const current = contact[key];
    if (current == null || String(current).trim() === "") patch[key] = next;
  }
  return Object.keys(patch).length ? patch : null;
}

async function createInstallerContactsForApply({
  propertyId,
  systemKey,
  findings,
  systemRow,
  contacts,
  selectedFieldKeys,
  fieldOverrides,
  createContactFieldKeys,
  userId,
}) {
  const createdContacts = [];
  if (!Array.isArray(createContactFieldKeys) || createContactFieldKeys.length === 0) {
    return { contacts, createdContacts };
  }

  const accountId = await getPropertyAccountId(propertyId);
  if (!accountId) return { contacts, createdContacts };

  const selected = new Set(selectedFieldKeys);
  const overrides =
    fieldOverrides && typeof fieldOverrides === "object" ? fieldOverrides : {};
  const reviewFields = buildReviewFields(systemKey, findings, systemRow, { contacts });
  const nextContacts = [...contacts];
  const contactDetails = collectInstallerContactDetails(findings);

  for (const fieldKey of createContactFieldKeys) {
    if (!selected.has(fieldKey)) continue;
    const field = reviewFields.find((f) => f.fieldKey === fieldKey);
    if (!field?.canCreateInstallerContact) continue;
    const raw = Object.prototype.hasOwnProperty.call(overrides, fieldKey)
      ? overrides[fieldKey]
      : field.proposedValue;
    const name = installerContactName(raw);
    if (name.length < 3) continue;
    const existing = nextContacts.find((c) => {
      const cn = String(c.name || "").trim().toLowerCase().replace(/\s+/g, " ");
      return cn && cn === name.toLowerCase().replace(/\s+/g, " ");
    });
    if (existing) {
      const patch = emptyContactFieldPatch(existing, contactDetails);
      if (patch) {
        const updated = await Contact.update(existing.id, patch);
        const idx = nextContacts.findIndex((c) => c.id === existing.id);
        if (idx >= 0) nextContacts[idx] = updated;
      }
      await ensureInstallerTag(existing.id, accountId);
      continue;
    }
    const contact = await Contact.create(contactCreatePayload(name, contactDetails));
    await Contact.addToAccount({
      contactId: contact.id,
      accountId,
      addedByUserId: userId ?? null,
    });
    await ensureInstallerTag(contact.id, accountId);
    nextContacts.push(contact);
    createdContacts.push(contact);
  }

  return { contacts: nextContacts, createdContacts };
}

async function getPropertyRow(propertyId) {
  try {
    return await Property.get(propertyId);
  } catch {
    return null;
  }
}

async function formatEnrichedResult(row, systemRow) {
  const [contacts, property] = await Promise.all([
    getPropertyContacts(row.property_id),
    getPropertyRow(row.property_id),
  ]);
  return formatResultForApi(row, systemRow, { contacts, property });
}

function completedRunCountsByDocument(rows) {
  const counts = {};
  for (const row of rows) {
    const docId = row.property_document_id;
    if (!docId) continue;
    if (row.status === "completed") {
      counts[docId] = (counts[docId] || 0) + 1;
    }
  }
  return counts;
}

function withAnalysisRunLimit(item, completedRunCount) {
  return {
    ...item,
    completedRunCount: completedRunCount || 0,
    maxAnalysisRuns: MAX_DOCUMENT_ANALYSIS_RUNS_PER_DOCUMENT,
  };
}

function serializeJobResponse(job, resultRow, systemRow, contacts, property) {
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
    response.result = formatResultForApi(resultRow, systemRow, {
      contacts,
      property,
    });
  }
  return response;
}

/** POST /analyze — Start analysis for a filed property document. */
router.post("/analyze", ensureLoggedIn, async function (req, res, next) {
  try {
    assertDemoAiAllowed();
    const { propertyDocumentId, category } = req.body;
    const docId = parseInt(propertyDocumentId, 10);
    if (isNaN(docId)) throw new BadRequestError("propertyDocumentId is required");

    const doc = await PropertyDocument.get(docId);
    const user = res.locals.user;
    await assertPropertyAccess(doc.property_id, user);
    const declaredCategory = resolveDeclaredCategory(category);

    await checkAiFeaturesAllowed(user.id, user.role);
    await checkAiTokenQuota(user.id, user.role);

    const active = await DocumentAnalysisJob.getActiveForDocument(docId);
    if (active) {
      return res.status(202).json({ jobId: active.id });
    }

    if (!isAdminRole(user.role)) {
      const completedRuns = await DocumentAnalysisJob.countCompletedByDocument(docId);
      if (completedRuns >= MAX_DOCUMENT_ANALYSIS_RUNS_PER_DOCUMENT) {
        throw new ForbiddenError(DOCUMENT_ANALYSIS_RUN_LIMIT_MESSAGE);
      }
    }

    const mimeType = inferMimeFromKey(doc.document_key, doc.document_name);
    let documentType = doc.document_type;
    if (declaredCategory) {
      const nextType = canonicalDocumentTypeForCategory(declaredCategory);
      if (nextType && shouldSyncDocumentType(documentType, declaredCategory)) {
        await PropertyDocument.update(doc.id, { document_type: nextType });
        documentType = nextType;
      } else if (nextType && nextType !== "other") {
        documentType = nextType;
      }
    }

    const job = await DocumentAnalysisJob.create({
      property_id: doc.property_id,
      user_id: user.id,
      property_document_id: doc.id,
      s3_key: doc.document_key,
      file_name: doc.document_name,
      mime_type: mimeType,
      system_key: doc.system_key,
      document_type: documentType,
    });

    enqueue(job.id, { declaredCategory });
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
        checklist_item_id: doc?.checklist_item_id,
      };
    }
    const systemRow = await getSystemRow(job.property_id, job.system_key);
    const [contacts, property] = await Promise.all([
      getPropertyContacts(job.property_id),
      getPropertyRow(job.property_id),
    ]);
    return res.json(serializeJobResponse(job, enriched, systemRow, contacts, property));
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
      const [contacts, property] = await Promise.all([
        getPropertyContacts(propertyId),
        getPropertyRow(propertyId),
      ]);
      const completedByDoc = completedRunCountsByDocument(rows);

      const items = rows.map((row) => {
        const systemRow = systemByKey.get(row.system_key) || null;
        const runLimit = completedByDoc[row.property_document_id] || 0;
        if (!row.result_id) {
          return withAnalysisRunLimit(
            {
              jobId: row.id,
              status: row.status,
              progress: row.progress,
              errorMessage: row.error_message,
              propertyDocumentId: row.property_document_id,
              systemKey: row.system_key,
              fileName: row.file_name,
            },
            runLimit,
          );
        }
        return withAnalysisRunLimit(
          formatResultForApi(
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
            { contacts, property },
          ),
          runLimit,
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
      const [contacts, property] = await Promise.all([
        getPropertyContacts(propertyId),
        getPropertyRow(propertyId),
      ]);
      const items = rows.map((row) =>
        formatResultForApi(row, systemRow, { contacts, property }),
      );
      const pending = await DocumentAnalysisResult.listPendingByProperty(propertyId);
      const pendingForSystem = pending.filter((p) => p.system_key === systemKey);
      const pendingItems = pendingForSystem.map((row) =>
        formatResultForApi(row, systemRow, { contacts, property }),
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
        checklist_item_id: doc?.checklist_item_id,
      };
    const systemRow = await getSystemRow(row.property_id, row.system_key);
    return res.json({ result: await formatEnrichedResult(enriched, systemRow) });
  } catch (err) {
    return next(err);
  }
});

/** POST /results/:id/apply — Apply selected extracted fields. */
router.post("/results/:id/apply", ensureLoggedIn, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid result ID");

    const { selectedFieldKeys, fieldOverrides, createContactFieldKeys } = req.body;
    if (!Array.isArray(selectedFieldKeys)) {
      throw new BadRequestError("selectedFieldKeys must be an array");
    }

    const row = await DocumentAnalysisResult.get(id);
    await assertPropertyAccess(row.property_id, res.locals.user);

    if (row.review_status === "rejected") {
      throw new BadRequestError("This analysis was rejected and cannot be applied.");
    }

    const doc = await PropertyDocument.get(row.property_document_id).catch(() => null);
    const systemRow = await getSystemRow(row.property_id, row.system_key);

    if (!shouldWriteExtractedFieldsToSystem(row.detected_category)) {
      const applied = snapshotQuoteFields(row.findings);
      const updated = await DocumentAnalysisResult.updateReview(id, {
        review_status: "approved",
        applied_fields: applied,
      });
      const [contacts, propertyForReview] = await Promise.all([
        getPropertyContacts(row.property_id),
        getPropertyRow(row.property_id),
      ]);
      const enriched = {
        ...updated,
        document_name: doc?.document_name,
        document_date: doc?.document_date,
        document_key: doc?.document_key,
        document_type: doc?.document_type,
        checklist_item_id: doc?.checklist_item_id,
      };
      return res.json({
        result: formatResultForApi(enriched, systemRow, {
          contacts,
          property: propertyForReview,
        }),
        appliedCount: applied.length,
        createdContacts: [],
      });
    }

    const existingContacts = await getPropertyContacts(row.property_id);
    const { contacts, createdContacts } = await createInstallerContactsForApply({
      propertyId: row.property_id,
      systemKey: row.system_key,
      findings: row.findings,
      systemRow,
      contacts: existingContacts,
      selectedFieldKeys,
      fieldOverrides,
      createContactFieldKeys,
      userId: res.locals.user?.id,
    });
    const mergeOptions = {
      contacts,
      fieldOverrides:
        fieldOverrides && typeof fieldOverrides === "object" ? fieldOverrides : {},
      systemKey: row.system_key,
      source: {
        propertyDocumentId: row.property_document_id,
        documentName: doc?.document_name,
        documentKey: doc?.document_key,
        analysisResultId: row.id,
      },
    };
    const { data, next_service_date, applied } = mergeSelectedFields(
      row.findings,
      selectedFieldKeys,
      { ...(systemRow || {}), system_key: row.system_key },
      mergeOptions,
    );

    await System.update({
      property_id: row.property_id,
      system_key: row.system_key,
      data,
      next_service_date,
    });

    let identityApplied = [];
    if (canProposePropertyIdentity(row.detected_category)) {
      const propertyRow = await getPropertyRow(row.property_id);
      const identityMerge = mergeSelectedIdentityFields(
        row.findings,
        selectedFieldKeys,
        propertyRow,
        {
          ...mergeOptions,
          category: row.detected_category,
        },
      );
      if (Object.keys(identityMerge.columns).length) {
        await Property.updateProperty(row.property_id, identityMerge.columns);
      }
      identityApplied = identityMerge.applied;
    }

    const allApplied = [...applied, ...identityApplied];

    const propertyForReview = await getPropertyRow(row.property_id);
    const allKeys = formatResultForApi(row, systemRow, {
      contacts,
      property: propertyForReview,
      documentName: doc?.document_name,
    }).reviewFields.map((f) => f.fieldKey);
    const reviewStatus =
      selectedFieldKeys.length >= allKeys.length ? "approved" : "partially_approved";

    const updated = await DocumentAnalysisResult.updateReview(id, {
      review_status: reviewStatus,
      applied_fields: allApplied,
    });

    triggerReanalysisOnDocument(row.property_id, row.property_document_id).catch((err) => {
      console.error("[documentAnalysis] reanalysis trigger failed:", err.message);
    });

    const enriched = {
      ...updated,
      document_name: doc?.document_name,
      document_date: doc?.document_date,
        document_key: doc?.document_key,
        document_type: doc?.document_type,
        checklist_item_id: doc?.checklist_item_id,
      };
    const freshSystem = await getSystemRow(row.property_id, row.system_key);

    return res.json({
      result: formatResultForApi(enriched, freshSystem, {
        contacts,
        property: propertyForReview,
      }),
      appliedCount: allApplied.length,
      createdContacts,
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
        checklist_item_id: doc?.checklist_item_id,
      };
    const systemRow = await getSystemRow(row.property_id, row.system_key);

    return res.json({ result: await formatEnrichedResult(enriched, systemRow) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
