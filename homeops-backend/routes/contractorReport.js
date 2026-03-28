"use strict";

/**
 * Contractor Report Routes (PUBLIC — no JWT required)
 *
 * These endpoints are accessed by contractors via a token link sent by email.
 * Authentication is done via the token itself (hashed, with expiry).
 *
 * GET  /contractor-report/:token  — Load report form data for the contractor
 * POST /contractor-report/:token  — Submit the completed report
 * PATCH /contractor-report/:token — Save draft
 * POST /contractor-report/:token/upload — Upload attachment (multipart)
 */

const express = require("express");
const multer = require("multer");
const { ulid } = require("ulid");
const ContractorReportToken = require("../models/contractorReportToken");
const MaintenanceRecord = require("../models/maintenanceRecord");
const { syncMaintenanceRecordDocuments } = require("../services/maintenanceRecordDocumentsService");
const Notification = require("../models/notification");
const { uploadFile } = require("../services/s3Service");
const { AWS_S3_BUCKET } = require("../config");
const { BadRequestError } = require("../expressError");
const { MAX_DOCUMENT_UPLOAD_BYTES } = require("../constants/documentUpload");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new BadRequestError("Invalid file type"), false);
  },
});

const SYSTEM_LABELS = {
  roof: "Roof", gutters: "Gutters", foundation: "Foundation",
  exterior: "Exterior", windows: "Windows", heating: "Heating",
  ac: "Air Conditioning", waterHeating: "Water Heating",
  electrical: "Electrical", plumbing: "Plumbing",
  safety: "Safety", inspections: "Inspections",
};

/** POST /:token/upload — Upload attachment. Multipart form-data with "file" field. */
router.post("/:token/upload", upload.single("file"), async function (req, res, next) {
  try {
    const tokenData = await ContractorReportToken.validateToken(req.params.token);
    if (!AWS_S3_BUCKET) {
      throw new BadRequestError("File upload is not configured.");
    }
    if (!req.file) {
      throw new BadRequestError("No file provided");
    }
    const ext = req.file.originalname.split(".").pop() || "bin";
    const key = `documents/contractor-report/${tokenData.maintenanceRecordId}/${Date.now()}-${ulid().slice(-8)}.${ext}`;
    const { key: s3Key } = await uploadFile(req.file.buffer, key, req.file.mimetype);
    res.status(201).json({
      document: {
        key: s3Key,
        name: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** Normalize materialsUsed to array of { material, description, cost } for contractor form. */
function normalizeMaterialsUsedForContractor(value) {
  if (Array.isArray(value)) {
    return value.map((row) => ({
      material: String(row?.material ?? "").trim(),
      description: String(row?.description ?? "").trim(),
      cost: String(row?.cost ?? "").trim(),
    }));
  }
  if (value != null && String(value).trim()) {
    return [{ material: String(value).trim(), description: "", cost: "" }];
  }
  return [];
}

/** GET /:token — Load the maintenance record data for the contractor to fill out */
router.get("/:token", async function (req, res, next) {
  try {
    const tokenData = await ContractorReportToken.validateToken(req.params.token);

    const data = tokenData.recordData || {};
    res.json({
      tokenId: tokenData.id,
      maintenanceRecordId: tokenData.maintenanceRecordId,
      contractorName: tokenData.contractorName,
      contractorEmail: tokenData.contractorEmail,
      propertyAddress: [tokenData.propertyAddress, tokenData.propertyCity, tokenData.propertyState].filter(Boolean).join(", "),
      propertyName: tokenData.propertyName,
      systemKey: tokenData.systemKey,
      systemName: SYSTEM_LABELS[tokenData.systemKey] || tokenData.systemKey,
      existingData: {
        description: data.description || "",
        workOrderNumber: data.workOrderNumber || "",
        priority: data.priority || "Medium",
        cost: data.cost || "",
        materialsUsed: normalizeMaterialsUsedForContractor(data.materialsUsed),
        notes: data.notes || "",
        files: Array.isArray(data.files) ? data.files : [],
        contractor: data.contractor || tokenData.contractorName || "",
        contractorEmail: data.contractorEmail || tokenData.contractorEmail || "",
        contractorPhone: data.contractorPhone || "",
      },
      status: tokenData.recordStatus || "Pending Contractor",
      completedAt: tokenData.completedAt,
    });
  } catch (err) {
    return next(err);
  }
});

/** POST /:token — Contractor submits their completed report */
router.post("/:token", async function (req, res, next) {
  try {
    const tokenData = await ContractorReportToken.validateToken(req.params.token);

    const {
      description, workOrderNumber, cost, materialsUsed,
      notes, status, completedAt, nextServiceDate, files,
    } = req.body;

    if (!description || !description.trim()) {
      throw new BadRequestError("Work description is required");
    }

    const existingRecord = await MaintenanceRecord.getByRecordId(tokenData.maintenanceRecordId);
    const existingData = existingRecord.data || {};

    const normalizedMaterials =
      materialsUsed !== undefined
        ? normalizeMaterialsUsedForContractor(materialsUsed)
        : normalizeMaterialsUsedForContractor(existingData.materialsUsed);

    const mergedFiles = Array.isArray(files) && files.length > 0
      ? files
      : (existingData.files ?? []);

    const updatedData = {
      ...existingData,
      description: description?.trim() || existingData.description,
      workOrderNumber: workOrderNumber ?? existingData.workOrderNumber,
      cost: cost ?? existingData.cost,
      materialsUsed: normalizedMaterials,
      notes: notes ?? existingData.notes,
      files: mergedFiles,
      contractorSubmittedAt: new Date().toISOString(),
    };

    const updatedRecord = await MaintenanceRecord.update(tokenData.maintenanceRecordId, {
      property_id: existingRecord.property_id,
      system_key: existingRecord.system_key,
      completed_at: completedAt || existingRecord.completed_at || new Date().toISOString(),
      next_service_date: nextServiceDate || existingRecord.next_service_date,
      data: updatedData,
      status: status || "Completed",
      record_status: "contractor_completed",
    });

    syncMaintenanceRecordDocuments(updatedRecord).catch((err) =>
      console.error("[maintenanceRecordDocuments] Sync failed:", err.message)
    );
    await ContractorReportToken.markCompleted(tokenData.id);

    // Notify the user who sent the report to the contractor
    if (tokenData.createdBy) {
      const propResult = await require("../db").query(
        `SELECT address, city, state, property_name FROM properties WHERE id = $1`,
        [tokenData.propertyId]
      );
      const prop = propResult.rows[0];
      const addr = prop ? [prop.address, prop.city, prop.state].filter(Boolean).join(", ") : "your property";
      const title = `Contractor submitted maintenance report for ${addr}`;
      await Notification.create({
        userId: tokenData.createdBy,
        type: "contractor_report_submitted",
        title,
        maintenanceRecordId: updatedRecord.id,
      }).catch((err) => console.error("[contractorReport] Notification create failed:", err.message));
    }

    res.json({
      success: true,
      message: "Report submitted successfully. The homeowner will be notified.",
      record: {
        id: updatedRecord.id,
        status: updatedRecord.status,
        record_status: updatedRecord.record_status,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:token — Contractor saves draft (does not submit; can return to edit later) */
router.patch("/:token", async function (req, res, next) {
  try {
    const tokenData = await ContractorReportToken.validateToken(req.params.token);

    const {
      description, workOrderNumber, cost, materialsUsed,
      notes, status, completedAt, nextServiceDate, files,
    } = req.body;

    const existingRecord = await MaintenanceRecord.getByRecordId(tokenData.maintenanceRecordId);
    const existingData = existingRecord.data || {};

    const updatedData = { ...existingData };
    if (description !== undefined) updatedData.description = description?.trim() ?? existingData.description;
    if (workOrderNumber !== undefined) updatedData.workOrderNumber = workOrderNumber ?? existingData.workOrderNumber;
    if (cost !== undefined) updatedData.cost = cost ?? existingData.cost;
    if (materialsUsed !== undefined) updatedData.materialsUsed = normalizeMaterialsUsedForContractor(materialsUsed);
    if (notes !== undefined) updatedData.notes = notes ?? existingData.notes;
    if (files !== undefined) updatedData.files = Array.isArray(files) ? files : (existingData.files ?? []);
    updatedData.contractorDraftSavedAt = new Date().toISOString();

    const maintenance = await MaintenanceRecord.update(tokenData.maintenanceRecordId, {
      property_id: existingRecord.property_id,
      system_key: existingRecord.system_key,
      completed_at: completedAt ?? existingRecord.completed_at,
      next_service_date: nextServiceDate ?? existingRecord.next_service_date,
      data: updatedData,
      status: status ?? existingRecord.status,
      record_status: existingRecord.record_status,
    });

    syncMaintenanceRecordDocuments(maintenance).catch((err) =>
      console.error("[maintenanceRecordDocuments] Sync failed:", err.message)
    );

    res.json({
      success: true,
      message: "Draft saved. You can return to this link to continue or submit when ready.",
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
