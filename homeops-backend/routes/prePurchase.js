"use strict";

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const jsonschema = require("jsonschema");
const OpenAI = require("openai");
const {
  ensureLoggedIn,
  ensureAdminOrSuperAdmin,
} = require("../middleware/auth");
const { BadRequestError, ForbiddenError, NotFoundError } = require("../expressError");
const { isAllowedS3KeyPrefix } = require("../constants/s3Upload");
const { deleteFile, copyFile } = require("../services/s3Service");
const {
  checkAiFeaturesAllowed,
  checkAiTokenQuota,
  checkPrePurchaseAllowed,
} = require("../services/tierService");
const { assertDemoAiAllowed } = require("../helpers/demoEnvironment");
const { enqueue } = require("../services/prePurchaseAnalysisQueue");
const { enqueue: enqueueInspectionAnalysis } = require("../services/inspectionAnalysisQueue");
const { enqueue: enqueueAttomLookup } = require("../services/attomLookupQueue");
const PrePurchaseAnalysis = require("../models/prePurchaseAnalysis");
const Account = require("../models/account");
const Property = require("../models/property");
const PropertyDocument = require("../models/propertyDocuments");
const InspectionAnalysisJob = require("../models/inspectionAnalysisJob");
const AttomLookupJob = require("../models/attomLookupJob");
const documentRagService = require("../services/documentRagService");
const ApiUsage = require("../models/apiUsage");
const { logAiUsage } = require("../services/usageService");
const {
  MAX_RESPONSE_TOKENS,
  CHAT_TEMPERATURE,
  sanitizeResponse,
} = require("../services/aiChatService");

const prePurchaseAnalysisNewSchema = require("../schemas/prePurchaseAnalysisNew.json");
const prePurchaseAnalysisUpdateSchema = require("../schemas/prePurchaseAnalysisUpdate.json");
const prePurchaseDocumentNewSchema = require("../schemas/prePurchaseDocumentNew.json");

const router = express.Router();

/** CamelCase identity_data keys → properties table columns. */
const IDENTITY_DATA_TO_PROPERTY = {
  taxId: "tax_id",
  county: "county",
  ownerName: "owner_name",
  ownerName2: "owner_name_2",
  ownerCity: "owner_city",
  occupantName: "occupant_name",
  occupantType: "occupant_type",
  ownerPhone: "owner_phone",
  propertyType: "property_type",
  subType: "sub_type",
  roofType: "roof_type",
  yearBuilt: "year_built",
  sqFtTotal: "sq_ft_total",
  sqFtFinished: "sq_ft_finished",
  garageSqFt: "garage_sq_ft",
  totalDwellingSqFt: "total_dwelling_sq_ft",
  lotSize: "lot_size",
  bedCount: "bed_count",
  bathCount: "bath_count",
  fullBaths: "full_baths",
  threeQuarterBaths: "three_quarter_baths",
  halfBaths: "half_baths",
  numberOfShowers: "number_of_showers",
  numberOfBathtubs: "number_of_bathtubs",
  fireplaces: "fireplaces",
  fireplaceTypes: "fireplace_types",
  basement: "basement",
  parkingType: "parking_type",
  totalCoveredParking: "total_covered_parking",
  totalUncoveredParking: "total_uncovered_parking",
  schoolDistrict: "school_district",
  elementarySchool: "elementary_school",
  juniorHighSchool: "junior_high_school",
  seniorHighSchool: "senior_high_school",
};

/** Alias keys sometimes present in lookup payloads → canonical camelCase keys. */
const IDENTITY_FIELD_ALIASES = {
  taxId: ["parcelTaxId"],
  bedCount: ["rooms"],
  bathCount: ["bathrooms"],
  sqFtTotal: ["squareFeet"],
};

function normalizeIdentityData(raw) {
  if (raw == null) return {};
  let data = raw;
  // JSONB can arrive as an object or (rarely) a double-encoded string.
  while (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return {};
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  return data;
}

function resolveIdentityFieldValue(identity, camelKey) {
  const direct = identity[camelKey];
  if (direct != null && !(typeof direct === "string" && direct.trim() === "")) {
    return direct;
  }
  const aliases = IDENTITY_FIELD_ALIASES[camelKey] || [];
  for (const alt of aliases) {
    const v = identity[alt];
    if (v != null && !(typeof v === "string" && v.trim() === "")) return v;
  }
  return undefined;
}

function buildPropertyPayloadFromAnalysis(analysis) {
  const street = analysis.street || analysis.display_name;
  const identity = normalizeIdentityData(analysis.identity_data);

  const payload = {
    account_id: analysis.account_id,
    property_name: analysis.display_name || street,
    address: street,
    address_line_1: street,
    city: analysis.city || identity.city || null,
    state: analysis.state || identity.state || null,
    zip: analysis.zip || identity.zip || null,
    main_photo: analysis.photo_key || null,
  };

  const populatedKeys = [];
  for (const [camelKey, column] of Object.entries(IDENTITY_DATA_TO_PROPERTY)) {
    const value = resolveIdentityFieldValue(identity, camelKey);
    if (value === undefined) continue;
    payload[column] = value;
    populatedKeys.push(camelKey);
  }

  // Only mark as vendor-sourced when identity columns were actually written.
  if (populatedKeys.length) {
    payload.identity_lookup_populated_keys = populatedKeys;
    if (analysis.identity_data_source) {
      payload.identity_data_source = analysis.identity_data_source;
    }
  }

  return payload;
}

function hasCompleteAddressForAttom(payload) {
  return !!(
    String(payload.address_line_1 || payload.address || "").trim() &&
    String(payload.city || "").trim() &&
    String(payload.state || "").trim() &&
    String(payload.zip || "").trim()
  );
}

function pickInspectionDocument(docs = []) {
  if (!Array.isArray(docs) || docs.length === 0) return null;
  const withKey = docs.filter((d) => d?.document_key);
  if (!withKey.length) return null;
  const inspection = withKey.find((d) => d.document_type === "inspection");
  return inspection || withKey[0] || null;
}

function buildPropertyDocumentKey(sourceKey, propertyId) {
  const ext = path.extname(sourceKey || "") || ".pdf";
  const safeExt = ext.slice(0, 12);
  return `property_documents/${propertyId}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`;
}

async function migrateInspectionReportAndStartAnalysis({
  analysis,
  propertyId,
  userId,
}) {
  const docs = await PrePurchaseAnalysis.getDocuments(analysis.id);
  const sourceDoc = pickInspectionDocument(docs);
  if (!sourceDoc?.document_key) {
    return { document: null, jobId: null, hadSourceDocs: docs.length > 0 };
  }

  const destKey = buildPropertyDocumentKey(sourceDoc.document_key, propertyId);
  await copyFile(sourceDoc.document_key, destKey);

  const documentDate = sourceDoc.created_at
    ? new Date(sourceDoc.created_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const document = await PropertyDocument.create({
    property_id: propertyId,
    document_name: sourceDoc.document_name || "Inspection Report",
    document_date: documentDate,
    document_key: destKey,
    document_type: "inspection",
    system_key: "inspectionReport",
  });

  documentRagService.ingestDocument(propertyId, document.id).catch((err) => {
    if (!err?.message?.includes("pgvector not available")) {
      console.error("[pre-purchase convert] RAG ingest failed:", err.message);
    }
  });

  const job = await InspectionAnalysisJob.create({
    property_id: propertyId,
    user_id: userId,
    s3_key: destKey,
    file_name: sourceDoc.document_name || null,
    mime_type: sourceDoc.mime_type || null,
  });
  enqueueInspectionAnalysis(job.id);

  return { document, jobId: job.id, hadSourceDocs: true };
}

async function enqueueAttomIfIdentitySparse({
  propertyId,
  accountId,
  userId,
  propertyPayload,
}) {
  const populated = Array.isArray(propertyPayload.identity_lookup_populated_keys)
    ? propertyPayload.identity_lookup_populated_keys
    : [];
  if (populated.length > 0) return null;
  if (!hasCompleteAddressForAttom(propertyPayload)) return null;

  try {
    const lookupCount = await AttomLookupJob.countForProperty(propertyId);
    if (lookupCount >= AttomLookupJob.MAX_LOOKUPS_PER_PROPERTY) return null;
    const job = await AttomLookupJob.create({
      property_id: propertyId,
      account_id: accountId,
      user_id: userId || null,
      trigger: "bulk_import",
    });
    enqueueAttomLookup(job.id);
    return job.id;
  } catch (err) {
    console.error("[pre-purchase convert] ATTOM enqueue failed:", err.message);
    return null;
  }
}

async function assertAccountAccess(user, accountId) {
  if (!accountId) throw new BadRequestError("accountId is required");
  if (user.role === "super_admin" || user.role === "admin") return;
  const ok = await Account.isUserLinkedToAccount(user.id, accountId);
  if (!ok) throw new ForbiddenError("You do not have access to this account.");
}

async function getAuthorizedAnalysis(id, user) {
  const analysis = await PrePurchaseAnalysis.get(id);
  await assertAccountAccess(user, analysis.account_id);
  return analysis;
}

function serializeAnalysis(row, extras = {}) {
  return {
    id: row.id,
    accountId: row.account_id,
    propertyId: row.property_id,
    createdBy: row.created_by,
    displayName: row.display_name,
    street: row.street,
    city: row.city,
    state: row.state,
    zip: row.zip,
    photoKey: row.photo_key,
    identityData: row.identity_data || null,
    identityDataSource: row.identity_data_source || null,
    status: row.status,
    progressPct: row.progress_pct,
    progressMessage: row.progress_message,
    errorMessage: row.error_message,
    overallConditionScore: row.overall_condition_score,
    overallConditionRating: row.overall_condition_rating,
    executiveSummary: row.executive_summary,
    repairCostLow: row.repair_cost_low != null ? Number(row.repair_cost_low) : null,
    repairCostHigh: row.repair_cost_high != null ? Number(row.repair_cost_high) : null,
    repairConfidence: row.repair_confidence,
    positiveFindings: row.positive_findings || [],
    topConcerns: row.top_concerns || [],
    disclaimerVersion: row.disclaimer_version,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    majorIssuesCount: row.major_issues_count,
    documentCount: row.document_count,
    ...extras,
  };
}

function serializeDocument(d) {
  return {
    id: d.id,
    analysisId: d.analysis_id,
    documentName: d.document_name,
    documentType: d.document_type,
    documentKey: d.document_key,
    mimeType: d.mime_type,
    pageCount: d.page_count,
    fileSizeBytes: d.file_size_bytes,
    analysisStatus: d.analysis_status,
    uploadedBy: d.uploaded_by,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function serializeSystem(s) {
  return {
    id: s.id,
    analysisId: s.analysis_id,
    systemKey: s.system_key,
    systemLabel: s.system_label,
    condition: s.condition,
    conditionConfidence: s.condition_confidence != null ? Number(s.condition_confidence) : null,
    issuesCount: s.issues_count,
    repairCostLow: s.repair_cost_low != null ? Number(s.repair_cost_low) : null,
    repairCostHigh: s.repair_cost_high != null ? Number(s.repair_cost_high) : null,
    urgency: s.urgency,
    evidenceSummary: s.evidence_summary,
    evidenceSources: s.evidence_sources || [],
    details: s.details || {},
    sortOrder: s.sort_order,
  };
}

function serializeFinding(f) {
  return {
    id: f.id,
    analysisId: f.analysis_id,
    systemId: f.system_id,
    documentId: f.document_id,
    systemKey: f.system_key,
    systemLabel: f.system_label,
    severity: f.severity,
    urgency: f.urgency,
    title: f.title,
    description: f.description,
    evidence: f.evidence,
    sourceExcerpt: f.source_excerpt,
    pageReference: f.page_reference,
    estimatedCostLow: f.estimated_cost_low != null ? Number(f.estimated_cost_low) : null,
    estimatedCostHigh: f.estimated_cost_high != null ? Number(f.estimated_cost_high) : null,
    recommendedAction: f.recommended_action,
    confidence: f.confidence != null ? Number(f.confidence) : null,
    sortOrder: f.sort_order,
  };
}

function serializeRecommendation(r) {
  return {
    id: r.id,
    analysisId: r.analysis_id,
    findingId: r.finding_id,
    systemKey: r.system_key,
    urgencyGroup: r.urgency_group,
    title: r.title,
    description: r.description,
    sortOrder: r.sort_order,
  };
}

function serializeProfessionalMatch(m) {
  return {
    id: m.id,
    analysisId: m.analysis_id,
    recommendationId: m.recommendation_id,
    findingId: m.finding_id,
    systemKey: m.system_key,
    professionalId: m.professional_id,
    matchReason: m.match_reason,
    matchScore: m.match_score != null ? Number(m.match_score) : 0,
    companyName: m.company_name,
    contactName: m.contact_name,
    firstName: m.first_name,
    lastName: m.last_name,
    city: m.professional_city,
    state: m.professional_state,
    serviceArea: m.service_area,
    rating: m.rating != null ? Number(m.rating) : null,
    reviewCount: m.review_count,
    profilePhotoUrl: m.profile_photo,
    phone: m.phone,
    email: m.email,
    isVerified: m.is_verified,
    yearsInBusiness: m.years_in_business,
    categoryName: m.category_name,
    subcategoryName: m.subcategory_name,
  };
}

async function hydratePropertyAddress(propertyId, accountId) {
  if (!propertyId) return null;
  const prop = await Property.get(propertyId);
  if (!prop) throw new NotFoundError(`No property with id: ${propertyId}`);
  const propAccountId = prop.account_id ?? prop.accountId;
  if (accountId && propAccountId && Number(propAccountId) !== Number(accountId)) {
    throw new ForbiddenError("Property does not belong to this account.");
  }
  return {
    display_name: prop.property_name || null,
    street: prop.address_line_1 || prop.address || null,
    city: prop.city || null,
    state: prop.state || null,
    zip: prop.zip || null,
    photo_key: prop.main_photo || null,
  };
}

/** Require plan entitlement for Pre-Purchase (admins/super_admins always allowed). */
async function ensurePrePurchaseAllowed(req, res, next) {
  try {
    const user = res.locals.user;
    if (!user?.id) throw new ForbiddenError("Authentication required.");
    const result = await checkPrePurchaseAllowed(user.id, user.role);
    if (!result.allowed) {
      throw new ForbiddenError(
        result.message || "Pre-Purchase Analysis is not included in your current plan."
      );
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

router.use(ensureLoggedIn, ensureAdminOrSuperAdmin, ensurePrePurchaseAllowed);

/** GET / — list analyses + stats */
router.get("/", async function (req, res, next) {
  try {
    const accountId = parseInt(req.query.accountId || req.query.account_id, 10);
    if (isNaN(accountId)) throw new BadRequestError("accountId is required");
    await assertAccountAccess(res.locals.user, accountId);

    const { analyses, total } = await PrePurchaseAnalysis.list({
      accountId,
      status: req.query.status || null,
      search: req.query.search || null,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    const stats = await PrePurchaseAnalysis.getStats(accountId);

    return res.json({
      analyses: analyses.map((a) => serializeAnalysis(a)),
      total,
      stats: {
        total: stats.total,
        inProgress: stats.in_progress,
        completed: stats.completed,
        failed: stats.failed,
        draft: stats.draft,
        criticalIssues: stats.critical_issues,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** POST / — create draft analysis */
router.post("/", async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, prePurchaseAnalysisNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs.join("; "));
    }

    const user = res.locals.user;
    const accountId = req.body.accountId;
    await assertAccountAccess(user, accountId);

    const address = {
      display_name: req.body.displayName || null,
      street: req.body.street || null,
      city: req.body.city || null,
      state: req.body.state || null,
      zip: req.body.zip || null,
      photo_key: req.body.photoKey || null,
    };

    const analysis = await PrePurchaseAnalysis.create({
      account_id: accountId,
      created_by: user.id,
      property_id: null,
      ...address,
      identity_data: req.body.identityData || null,
      identity_data_source: req.body.identityDataSource || null,
    });

    return res.status(201).json({ analysis: serializeAnalysis(analysis) });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id — full analysis payload */
router.get("/:id", async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid analysis id");
    await getAuthorizedAnalysis(id, res.locals.user);
    const full = await PrePurchaseAnalysis.getFull(id);

    return res.json({
      analysis: serializeAnalysis(full, {
        documents: (full.documents || []).map(serializeDocument),
        systems: (full.systems || []).map(serializeSystem),
        findings: (full.findings || []).map(serializeFinding),
        recommendations: (full.recommendations || []).map(serializeRecommendation),
        professionalMatches: (full.professionalMatches || []).map(serializeProfessionalMatch),
        issueCounts: full.issueCounts,
      }),
    });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id — update draft address / property link */
router.patch("/:id", async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid analysis id");
    const analysis = await getAuthorizedAnalysis(id, res.locals.user);

    if (analysis.status !== "draft" && analysis.status !== "failed") {
      throw new BadRequestError("Only draft or failed analyses can be edited");
    }

    const validator = jsonschema.validate(req.body, prePurchaseAnalysisUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs.join("; "));
    }

    const data = { ...req.body };
    if (data.propertyId) {
      const fromProp = await hydratePropertyAddress(data.propertyId, analysis.account_id);
      if (fromProp) {
        data.displayName = data.displayName ?? fromProp.display_name;
        data.street = data.street ?? fromProp.street;
        data.city = data.city ?? fromProp.city;
        data.state = data.state ?? fromProp.state;
        data.zip = data.zip ?? fromProp.zip;
        data.photoKey = data.photoKey ?? fromProp.photo_key;
      }
    }

    const updated = await PrePurchaseAnalysis.update(id, data);
    return res.json({ analysis: serializeAnalysis(updated) });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/documents — attach uploaded document metadata */
router.post("/:id/documents", async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid analysis id");
    const analysis = await getAuthorizedAnalysis(id, res.locals.user);

    if (
      ![
        "draft",
        "failed",
        "completed",
        ...PrePurchaseAnalysis.IN_PROGRESS_STATUSES,
      ].includes(analysis.status)
    ) {
      throw new BadRequestError("Cannot attach documents in the current status");
    }
    if (PrePurchaseAnalysis.IN_PROGRESS_STATUSES.includes(analysis.status) &&
        analysis.status !== "uploading") {
      throw new BadRequestError("Cannot attach documents while analysis is in progress");
    }

    const validator = jsonschema.validate(req.body, prePurchaseDocumentNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs.join("; "));
    }

    if (!isAllowedS3KeyPrefix(req.body.documentKey)) {
      throw new BadRequestError("Invalid document key");
    }
    if (!String(req.body.documentKey).startsWith("pre_purchase/")) {
      throw new BadRequestError("Document must be uploaded to the pre_purchase folder");
    }

    const doc = await PrePurchaseAnalysis.addDocument({
      analysis_id: id,
      document_name: req.body.documentName,
      document_type: req.body.documentType || "other",
      document_key: req.body.documentKey,
      mime_type: req.body.mimeType || null,
      page_count: req.body.pageCount ?? null,
      file_size_bytes: req.body.fileSizeBytes ?? null,
      uploaded_by: res.locals.user.id,
    });

    // Keep draft until /analyze runs — do not flip to "uploading" on attach
    // (that falsely blocked start and left analyses stuck at 5%).

    return res.status(201).json({ document: serializeDocument(doc) });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:id/documents/:docId */
router.delete(
  "/:id/documents/:docId",
  async function (req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const docId = parseInt(req.params.docId, 10);
      if (isNaN(id) || isNaN(docId)) throw new BadRequestError("Invalid id");
      const analysis = await getAuthorizedAnalysis(id, res.locals.user);

      if (
        PrePurchaseAnalysis.IN_PROGRESS_STATUSES.includes(analysis.status) &&
        analysis.status !== "uploading"
      ) {
        throw new BadRequestError("Cannot remove documents while analysis is in progress");
      }

      const doc = await PrePurchaseAnalysis.getDocument(docId);
      if (doc.analysis_id !== id) throw new NotFoundError("Document not found on this analysis");

      await PrePurchaseAnalysis.removeDocument(docId);
      try {
        await deleteFile(doc.document_key);
      } catch (err) {
        console.warn("[pre-purchase] S3 delete failed:", err.message);
      }

      return res.json({ deleted: docId });
    } catch (err) {
      return next(err);
    }
  }
);

async function startAnalysis(id, user) {
  assertDemoAiAllowed();
  const analysis = await getAuthorizedAnalysis(id, user);

  // True AI job statuses — idempotent: return current row instead of 400.
  const RUNNING = [
    "extracting",
    "identifying_systems",
    "detecting_issues",
    "generating_recommendations",
  ];
  if (RUNNING.includes(analysis.status)) {
    return analysis;
  }

  // Allow start from draft, legacy stuck "uploading", failed, or completed (refresh).
  const docs = await PrePurchaseAnalysis.getDocuments(id);
  if (!docs.length) throw new BadRequestError("Upload at least one document before starting analysis");

  await checkAiFeaturesAllowed(user.id, user.role);
  await checkAiTokenQuota(user.id, user.role);

  await PrePurchaseAnalysis.update(id, {
    status: "extracting",
    progressPct: 8,
    progressMessage: "Queued for analysis",
    errorMessage: null,
    startedAt: new Date().toISOString(),
  });

  enqueue(id);
  return PrePurchaseAnalysis.get(id);
}

/** POST /:id/analyze — start or refresh analysis */
router.post("/:id/analyze", async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid analysis id");
    const analysis = await startAnalysis(id, res.locals.user);
    return res.json({ analysis: serializeAnalysis(analysis) });
  } catch (err) {
    return next(err);
  }
});

/** POST /:id/retry — retry failed analysis */
router.post("/:id/retry", async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid analysis id");
    const existing = await getAuthorizedAnalysis(id, res.locals.user);
    if (existing.status !== "failed") {
      throw new BadRequestError("Only failed analyses can be retried");
    }
    const analysis = await startAnalysis(id, res.locals.user);
    return res.json({ analysis: serializeAnalysis(analysis) });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /:id/convert-to-property
 * Create a regular property from this analysis:
 * - migrate address + public-records identity fields
 * - copy the inspection report into property_documents
 * - enqueue a fresh property inspection analysis (do not reuse pre-purchase results)
 * Idempotent when property_id is already set (retries inspection migration if missing).
 */
router.post("/:id/convert-to-property", async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid analysis id");
    const analysis = await getAuthorizedAnalysis(id, res.locals.user);
    const user = res.locals.user;

    if (!analysis.street && !analysis.display_name) {
      throw new BadRequestError("Analysis needs an address or display name before converting");
    }

    // Idempotent path: property already linked — retry inspection migration if needed.
    if (analysis.property_id) {
      const existing = await Property.get(String(analysis.property_id));
      let inspectionMigration = { document: null, jobId: null };
      const existingInspectionCount =
        await PropertyDocument.countByPropertyAndSystemKey(
          existing.id,
          "inspectionReport"
        );
      if (existingInspectionCount === 0) {
        const sourceDocs = await PrePurchaseAnalysis.getDocuments(analysis.id);
        if (sourceDocs.some((d) => d?.document_key)) {
          try {
            inspectionMigration = await migrateInspectionReportAndStartAnalysis({
              analysis,
              propertyId: existing.id,
              userId: user.id,
            });
          } catch (err) {
            console.error(
              "[pre-purchase convert] inspection migration retry failed:",
              err.message
            );
            throw new BadRequestError(
              `Could not move the inspection report to the property: ${err.message}`
            );
          }
        }
      }
      return res.json({
        property: {
          id: existing.id,
          propertyUid: existing.property_uid,
          propertyName: existing.property_name,
          address: existing.address || existing.address_line_1,
          city: existing.city,
          state: existing.state,
          zip: existing.zip,
        },
        analysis: serializeAnalysis(analysis),
        inspectionAnalysisJobId: inspectionMigration.jobId,
        migratedDocumentId: inspectionMigration.document?.id ?? null,
      });
    }

    const propertyPayload = buildPropertyPayloadFromAnalysis(analysis);
    const created = await Property.create(propertyPayload);

    await Property.addUserToProperty({
      property_id: created.id,
      user_id: analysis.created_by || user.id,
      role: "owner",
    });

    const sourceDocs = await PrePurchaseAnalysis.getDocuments(analysis.id);
    const hasMigratableDocs = sourceDocs.some((d) => d?.document_key);

    let inspectionMigration = { document: null, jobId: null };
    try {
      inspectionMigration = await migrateInspectionReportAndStartAnalysis({
        analysis,
        propertyId: created.id,
        userId: user.id,
      });
      if (hasMigratableDocs && !inspectionMigration.document) {
        throw new Error(
          "Inspection document was found but could not be copied to the property"
        );
      }
    } catch (err) {
      console.error(
        "[pre-purchase convert] inspection migration/analysis failed:",
        err.message
      );
      try {
        await Property.remove(String(created.id));
      } catch (cleanupErr) {
        console.error(
          "[pre-purchase convert] property cleanup failed:",
          cleanupErr.message
        );
      }
      throw new BadRequestError(
        `Could not move the inspection report to the property: ${err.message}`
      );
    }

    const attomJobId = await enqueueAttomIfIdentitySparse({
      propertyId: created.id,
      accountId: analysis.account_id,
      userId: user.id,
      propertyPayload,
    });

    const updated = await PrePurchaseAnalysis.update(id, {
      propertyId: created.id,
    });

    return res.status(201).json({
      property: {
        id: created.id,
        propertyUid: created.property_uid,
        propertyName: propertyPayload.property_name,
        address: propertyPayload.address,
        city: propertyPayload.city || null,
        state: propertyPayload.state || null,
        zip: propertyPayload.zip || null,
      },
      analysis: serializeAnalysis(updated),
      inspectionAnalysisJobId: inspectionMigration.jobId,
      migratedDocumentId: inspectionMigration.document?.id ?? null,
      attomLookupJobId: attomJobId,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * Build compact LLM context from a pre-purchase analysis (no property required).
 */
function buildPrePurchaseChatContext(full, systemContext = null) {
  const parts = [];
  const address = [full.street, full.city, full.state, full.zip].filter(Boolean).join(", ");
  const name = full.display_name || address || "Unnamed analysis";
  parts.push(`Pre-purchase analysis: ${name}${address ? ` at ${address}` : ""}`);

  if (full.overall_condition_rating || full.overall_condition_score != null) {
    parts.push(
      `Overall condition: ${full.overall_condition_rating || "n/a"}` +
        (full.overall_condition_score != null ? ` (score ${full.overall_condition_score})` : "")
    );
  }
  if (full.executive_summary) {
    parts.push(`Executive summary: ${full.executive_summary}`);
  }
  if (full.repair_cost_low != null || full.repair_cost_high != null) {
    parts.push(
      `Estimated repair range: $${full.repair_cost_low ?? "?"}` +
        `–$${full.repair_cost_high ?? "?"} (${full.repair_confidence || "unknown"} confidence)`
    );
  }

  const systemKey = systemContext?.systemId || systemContext?.systemKey || null;
  const systems = full.systems || [];
  const findings = full.findings || [];
  const recommendations = full.recommendations || [];

  const filteredSystems = systemKey
    ? systems.filter((s) => s.system_key === systemKey)
    : systems;
  if (filteredSystems.length) {
    parts.push(
      `Systems: ${filteredSystems
        .map(
          (s) =>
            `${s.system_label || s.system_key} (${s.condition || "unknown"}, ${s.issues_count || 0} issues)`
        )
        .join("; ")}`
    );
  }

  const filteredFindings = systemKey
    ? findings.filter((f) => f.system_key === systemKey)
    : findings;
  if (filteredFindings.length) {
    const capped = filteredFindings.slice(0, 25);
    parts.push(
      `Findings: ${capped
        .map((f) => {
          let line = `${f.title} [${f.severity}/${f.urgency || "n/a"}]`;
          if (f.description) line += ` — ${String(f.description).slice(0, 180)}`;
          if (f.recommended_action) line += ` Action: ${String(f.recommended_action).slice(0, 120)}`;
          return line;
        })
        .join("; ")}`
    );
  }

  const filteredRecs = systemKey
    ? recommendations.filter((r) => r.system_key === systemKey)
    : recommendations;
  if (filteredRecs.length) {
    parts.push(
      `Recommendations: ${filteredRecs
        .slice(0, 15)
        .map((r) => `${r.title}${r.description ? ` — ${String(r.description).slice(0, 120)}` : ""}`)
        .join("; ")}`
    );
  }

  return parts.join("\n");
}

function buildPrePurchaseSystemPrompt(systemContext = null) {
  const systemName = systemContext?.systemName || systemContext?.systemId || null;
  let prompt = `You are a pre-purchase home inspection advisor. Answer only the specific question asked. Do not summarize the entire analysis unless explicitly requested.

Respond in clean, professional plain text. Do not use markdown formatting such as asterisks, bold, italic, headings, or special characters. Use plain dashes for lists.

Use ONLY the pre-purchase analysis context provided. Cite specific findings when relevant. Do not invent facts. If information is not in the context, say so.

Be natural and helpful. Be thorough but concise. Do not offer to schedule maintenance or book contractors — this analysis is not yet linked to a property calendar.`;

  if (systemName) {
    prompt += `

You MUST discuss ONLY the ${systemName} system unless the user explicitly changes topic. Do NOT return the full inspection summary — focus only on ${systemName}.

Structure your response: Current condition, Risk level, Recommended action, Optional cost estimate range.`;
  }

  return prompt;
}

/** POST /:id/chat — ephemeral Opsy chat scoped to this analysis (no property required). */
router.post("/:id/chat", async function (req, res, next) {
  try {
    assertDemoAiAllowed();
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid analysis id");

    const { message, history, systemContext } = req.body || {};
    if (!message || typeof message !== "string") {
      throw new BadRequestError("message is required");
    }

    const user = res.locals.user;
    await getAuthorizedAnalysis(id, user);

    await checkAiFeaturesAllowed(user.id, user.role);
    await checkAiTokenQuota(user.id, user.role);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new BadRequestError("AI chat is not configured. Set OPENAI_API_KEY.");
    }

    const full = await PrePurchaseAnalysis.getFull(id);
    const contextBlock = buildPrePurchaseChatContext(full, systemContext || null);
    const systemPrompt = buildPrePurchaseSystemPrompt(systemContext || null);

    const safeHistory = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-12)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: `Pre-purchase context:\n${contextBlock}\n\nUser: ${message}` },
    ];

    const openai = new OpenAI({ apiKey });
    const chatModel = process.env.AI_CHAT_MODEL || "gpt-4o-mini";
    const completion = await openai.chat.completions.create({
      model: chatModel,
      messages: llmMessages,
      temperature: CHAT_TEMPERATURE,
      max_tokens: MAX_RESPONSE_TOKENS,
    });

    let assistantMessage =
      completion.choices[0]?.message?.content || "I couldn't generate a response.";
    assistantMessage = sanitizeResponse(assistantMessage);

    const usage = completion.usage;
    if (usage?.prompt_tokens != null && usage?.completion_tokens != null) {
      ApiUsage.record({
        userId: user.id,
        endpoint: "pre-purchase/chat",
        model: chatModel,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
      }).catch(() => {});

      if (full.account_id) {
        logAiUsage({
          accountId: full.account_id,
          userId: user.id,
          model: `openai/${chatModel}`,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          endpoint: "pre-purchase/chat",
        }).catch(() => {});
      }
    }

    return res.json({
      assistantMessage,
      analysisId: id,
    });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:id — remove analysis */
router.delete("/:id", async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid analysis id");
    const analysis = await getAuthorizedAnalysis(id, res.locals.user);
    if (PrePurchaseAnalysis.IN_PROGRESS_STATUSES.includes(analysis.status)) {
      throw new BadRequestError("Cannot delete an analysis that is in progress");
    }
    const docs = await PrePurchaseAnalysis.getDocuments(id);
    await PrePurchaseAnalysis.remove(id);
    for (const doc of docs) {
      try {
        await deleteFile(doc.document_key);
      } catch {
        /* best-effort */
      }
    }
    return res.json({ deleted: id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
