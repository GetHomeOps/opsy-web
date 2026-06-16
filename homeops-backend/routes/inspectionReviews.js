"use strict";

/**
 * AI Inspection Analysis Review (Super Admin only).
 *
 * Super Admins validate AI-generated inspection analyses before they are released to
 * customers. Until approved, the analysis stays in `pending_review` and is hidden from
 * the customer (see the gating in routes/properties.js + routes/inspectionAnalysis.js).
 */

const express = require("express");
const { ensureLoggedIn, ensureSuperAdmin } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const InspectionAnalysisResult = require("../models/inspectionAnalysisResult");
const InspectionChecklistItem = require("../models/inspectionChecklistItem");
const { getPresignedUrl } = require("../services/s3Service");
const { isSafeS3Key } = require("../helpers/presignedUrls");
const { triggerReanalysisOnInspection } = require("../services/ai/propertyReanalysisService");
const { notifyCustomerApproved } = require("../services/inspectionReviewNotifyService");

const router = express.Router();

function formatPropertyAddress(row) {
  const line =
    row.address ||
    [row.address_line_1, row.city, row.state, row.zip].filter(Boolean).join(", ");
  return (
    line ||
    row.property_name ||
    (row.property_uid ? `Property ${row.property_uid}` : `Property #${row.property_id}`)
  );
}

function serializeQueueItem(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    propertyId: row.property_id,
    propertyUid: row.property_uid,
    propertyAddress: formatPropertyAddress(row),
    accountUrl: row.account_url,
    customerName: row.uploader_name || row.owner_name || "Customer",
    customerEmail: row.uploader_email || null,
    conditionRating: row.condition_rating,
    reviewStatus: row.review_status,
    reviewNotes: row.review_notes,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    reviewSubmittedAt: row.review_submitted_at,
    reviewedAt: row.reviewed_at,
    reviewerName: row.reviewer_name || null,
    createdAt: row.created_at,
  };
}

function serializeDetail(row, reportUrl) {
  return {
    id: row.id,
    jobId: row.job_id,
    propertyId: row.property_id,
    propertyUid: row.property_uid,
    propertyAddress: formatPropertyAddress(row),
    propertyName: row.property_name,
    accountUrl: row.account_url,
    accountName: row.account_name,
    customer: {
      name: row.uploader_name || row.owner_name || "Customer",
      email: row.uploader_email || null,
      ownerName: row.owner_name || null,
    },
    reviewStatus: row.review_status,
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    reviewSubmittedAt: row.review_submitted_at,
    reviewer: row.reviewer_name ? { name: row.reviewer_name, email: row.reviewer_email } : null,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
    report: {
      fileName: row.file_name,
      mimeType: row.mime_type,
      url: reportUrl,
    },
    analysis: {
      conditionRating: row.condition_rating,
      conditionConfidence: row.condition_confidence,
      conditionRationale: row.condition_rationale,
      systemsDetected: row.systems_detected,
      needsAttention: row.needs_attention,
      suggestedSystemsToAdd: row.suggested_systems_to_add,
      maintenanceSuggestions: row.maintenance_suggestions,
      summary: row.summary,
      citations: row.citations,
    },
  };
}

function parseReviewNotes(raw) {
  if (!raw) return {comment: "", suggestedImprovements: ""};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        comment: parsed.comment || "",
        suggestedImprovements: parsed.suggestedImprovements || "",
      };
    }
  } catch {
    // legacy plain-text notes
  }
  return {comment: String(raw), suggestedImprovements: ""};
}

function serializeReviewNotes({comment, suggestedImprovements}) {
  return JSON.stringify({
    comment: String(comment || "").trim(),
    suggestedImprovements: String(suggestedImprovements || "").trim(),
  });
}

/** GET / — Review queue (pending_review + revision_requested). Optional ?status=. */
router.get("/", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const rows = await InspectionAnalysisResult.listForReview({ status });
    return res.json({ items: rows.map(serializeQueueItem) });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id — Full review detail (analysis output + property/customer context + report URL). */
router.get("/:id", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid review ID");

    const row = await InspectionAnalysisResult.getReviewDetail(id);

    let reportUrl = null;
    if (row.s3_key && isSafeS3Key(row.s3_key)) {
      reportUrl = await getPresignedUrl(row.s3_key).catch(() => null);
    }

    return res.json({ review: serializeDetail(row, reportUrl) });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /:id/approve — Approve the analysis and release it (and its dependent outputs) to the customer.
 */
router.post("/:id/approve", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid review ID");

    const existing = await InspectionAnalysisResult.get(id);

    const updated = await InspectionAnalysisResult.setReview(id, {
      review_status: "approved",
      reviewed_by: res.locals.user.id,
      review_notes: existing.review_notes,
    });

    // Release dependent / generated outputs that were withheld during review:
    // (1) the trackable inspection checklist, (2) property AI reanalysis.
    try {
      await InspectionChecklistItem.deleteByAnalysisResult(updated.id);
      await InspectionChecklistItem.generateFromAnalysis(updated);
    } catch (err) {
      console.error("[inspectionReview] checklist generation failed:", err.message);
    }

    triggerReanalysisOnInspection(updated.property_id, updated).catch((err) =>
      console.error("[inspectionReview] reanalysis trigger failed:", err.message)
    );

    // Notify the customer (in-app + email) that results are ready.
    try {
      const detail = await InspectionAnalysisResult.getReviewDetail(id);
      notifyCustomerApproved(detail).catch((err) =>
        console.error("[inspectionReview] customer notify failed:", err.message)
      );
    } catch (err) {
      console.error("[inspectionReview] customer notify setup failed:", err.message);
    }

    return res.json({
      review: {
        id: updated.id,
        reviewStatus: updated.review_status,
        reviewedAt: updated.reviewed_at,
      },
      wasAlreadyApproved: existing.review_status === "approved",
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /:id/analysis — Save edited analysis content without changing review status.
 * Body may include summary, conditionRating, conditionConfidence, conditionRationale,
 * systemsDetected, needsAttention, maintenanceSuggestions, suggestedSystemsToAdd, citations.
 */
router.patch("/:id/analysis", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid review ID");

    const {
      summary,
      conditionRating,
      conditionConfidence,
      conditionRationale,
      systemsDetected,
      needsAttention,
      maintenanceSuggestions,
      suggestedSystemsToAdd,
      citations,
    } = req.body || {};

    const validConditions = ["excellent", "good", "fair", "poor", "unknown"];
    if (conditionRating !== undefined && !validConditions.includes(conditionRating)) {
      throw new BadRequestError(`Invalid conditionRating: ${conditionRating}`);
    }
    if (needsAttention !== undefined && !Array.isArray(needsAttention)) {
      throw new BadRequestError("needsAttention must be an array");
    }
    if (maintenanceSuggestions !== undefined && !Array.isArray(maintenanceSuggestions)) {
      throw new BadRequestError("maintenanceSuggestions must be an array");
    }
    if (systemsDetected !== undefined && !Array.isArray(systemsDetected)) {
      throw new BadRequestError("systemsDetected must be an array");
    }
    if (suggestedSystemsToAdd !== undefined && !Array.isArray(suggestedSystemsToAdd)) {
      throw new BadRequestError("suggestedSystemsToAdd must be an array");
    }
    if (citations !== undefined && !Array.isArray(citations)) {
      throw new BadRequestError("citations must be an array");
    }

    await InspectionAnalysisResult.get(id);

    const updated = await InspectionAnalysisResult.updateAnalysis(id, {
      summary,
      condition_rating: conditionRating,
      condition_confidence: conditionConfidence,
      condition_rationale: conditionRationale,
      systems_detected: systemsDetected,
      needs_attention: needsAttention,
      maintenance_suggestions: maintenanceSuggestions,
      suggested_systems_to_add: suggestedSystemsToAdd,
      citations,
    });

    const detail = await InspectionAnalysisResult.getReviewDetail(updated.id);
    let reportUrl = null;
    if (detail.s3_key && isSafeS3Key(detail.s3_key)) {
      reportUrl = await getPresignedUrl(detail.s3_key).catch(() => null);
    }

    return res.json({ review: serializeDetail(detail, reportUrl) });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /:id/feedback — Save reviewer comment and suggested improvements (internal notes).
 * Moves non-approved tickets to Further Review (revision_requested).
 */
router.patch("/:id/feedback", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid review ID");

    const { comment, suggestedImprovements } = req.body || {};
    const hasComment = comment !== undefined && String(comment).trim();
    const hasImprovements =
      suggestedImprovements !== undefined && String(suggestedImprovements).trim();
    if (!hasComment && !hasImprovements) {
      throw new BadRequestError("Comment or suggested improvements required");
    }

    const existing = await InspectionAnalysisResult.get(id);

    const reviewNotes = serializeReviewNotes({
      comment: comment ?? "",
      suggestedImprovements: suggestedImprovements ?? "",
    });

    // Feedback implies additional review — move to Further Review unless already approved.
    const updated =
      existing.review_status === "approved"
        ? await InspectionAnalysisResult.updateReviewFeedback(id, {
            review_notes: reviewNotes,
            reviewed_by: res.locals.user.id,
          })
        : await InspectionAnalysisResult.setReview(id, {
            review_status: "revision_requested",
            reviewed_by: res.locals.user.id,
            review_notes: reviewNotes,
          });

    const detail = await InspectionAnalysisResult.getReviewDetail(updated.id);
    let reportUrl = null;
    if (detail.s3_key && isSafeS3Key(detail.s3_key)) {
      reportUrl = await getPresignedUrl(detail.s3_key).catch(() => null);
    }

    return res.json({ review: serializeDetail(detail, reportUrl) });
  } catch (err) {
    return next(err);
  }
});

/**
 * PATCH /:id/status — Move a review back to under review (pending_review).
 * Approving is handled by POST /:id/approve.
 */
router.patch("/:id/status", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid review ID");

    const { status } = req.body || {};
    const valid = ["pending_review", "revision_requested"];
    if (!valid.includes(status)) {
      throw new BadRequestError(`Invalid status: ${status}`);
    }

    await InspectionAnalysisResult.get(id);

    const updated = await InspectionAnalysisResult.setReview(id, {
      review_status: status,
      reviewed_by: res.locals.user.id,
      review_notes: null,
    });

    return res.json({
      review: {
        id: updated.id,
        reviewStatus: updated.review_status,
        reviewedAt: updated.reviewed_at,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /:id/request-revisions — Flag issues. Keeps the analysis hidden from the customer.
 * Body: { notes?: string, needsAttention?: array, maintenanceSuggestions?: array }
 * needsAttention / maintenanceSuggestions allow the reviewer to add/remove action items.
 */
router.post("/:id/request-revisions", ensureLoggedIn, ensureSuperAdmin, async function (req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new BadRequestError("Invalid review ID");

    const { notes, needsAttention, maintenanceSuggestions } = req.body || {};

    if (needsAttention !== undefined && !Array.isArray(needsAttention)) {
      throw new BadRequestError("needsAttention must be an array");
    }
    if (maintenanceSuggestions !== undefined && !Array.isArray(maintenanceSuggestions)) {
      throw new BadRequestError("maintenanceSuggestions must be an array");
    }

    await InspectionAnalysisResult.get(id);

    // Apply edited action items (add/remove) if provided.
    if (needsAttention !== undefined || maintenanceSuggestions !== undefined) {
      await InspectionAnalysisResult.updateFindings(id, {
        needs_attention: needsAttention,
        maintenance_suggestions: maintenanceSuggestions,
      });
    }

    const updated = await InspectionAnalysisResult.setReview(id, {
      review_status: "revision_requested",
      reviewed_by: res.locals.user.id,
      review_notes: notes ? String(notes).trim() : null,
    });

    return res.json({
      review: {
        id: updated.id,
        reviewStatus: updated.review_status,
        reviewNotes: updated.review_notes,
        reviewedAt: updated.reviewed_at,
        needsAttention: updated.needs_attention,
        maintenanceSuggestions: updated.maintenance_suggestions,
      },
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
