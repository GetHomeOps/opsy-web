"use strict";

const db = require("../db");
const PropertyDocument = require("../models/propertyDocuments");
const DocumentAnalysisJob = require("../models/documentAnalysisJob");
const { enqueue } = require("./documentAnalysisQueue");
const { checkAiFeaturesAllowed, checkAiTokenQuota } = require("./tierService");

function inferMimeFromKey(key, fileName) {
  const name = (fileName || key || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".pdf")) return "application/pdf";
  return null;
}

/**
 * Kick off AI document analysis for a newly filed maintenance document.
 * Respects tier/quota limits; failures are logged but never block the sync.
 */
async function startAnalysisForDocument(doc, user) {
  if (!user?.id) return;
  try {
    await checkAiFeaturesAllowed(user.id, user.role);
    await checkAiTokenQuota(user.id, user.role);

    const active = await DocumentAnalysisJob.getActiveForDocument(doc.id);
    if (active) return;

    const job = await DocumentAnalysisJob.create({
      property_id: doc.property_id,
      user_id: user.id,
      property_document_id: doc.id,
      s3_key: doc.document_key,
      file_name: doc.document_name,
      mime_type: inferMimeFromKey(doc.document_key, doc.document_name),
      system_key: doc.system_key,
      document_type: doc.document_type,
    });
    enqueue(job.id);
  } catch (err) {
    console.error(
      "[maintenanceRecordDocuments] AI analysis skipped:",
      err.message
    );
  }
}

/**
 * Syncs files from a maintenance record's data.files to property_documents.
 * Files in data.files should have format { key, name, size } where key is the S3 document_key.
 * - Removes property_documents linked to this record whose keys are no longer in files
 * - Creates property_document for each file with a key that isn't already linked
 * - Optionally starts AI document analysis for newly filed documents (options.analyzeUser)
 */
async function syncMaintenanceRecordDocuments(record, options = {}) {
  const recordId = record.id;
  const propertyId = record.property_id;
  const systemKey = record.system_key || "general";
  const data = record.data;
  const files = Array.isArray(data?.files) ? data.files : [];

  const fileKeys = files
    .map((f) => f?.key ?? f?.document_key)
    .filter(Boolean);

  // Remove documents linked to this record that are no longer in files
  if (fileKeys.length > 0) {
    await db.query(
      `DELETE FROM property_documents
       WHERE maintenance_record_id = $1
         AND document_key != ALL($2::text[])`,
      [recordId, fileKeys]
    );
  } else {
    await db.query(
      `DELETE FROM property_documents WHERE maintenance_record_id = $1`,
      [recordId]
    );
  }

  // For each file with key, ensure a property_document exists for this record
  for (const file of files) {
    const documentKey = file?.key ?? file?.document_key;
    if (!documentKey) continue;

    const documentName = file?.name || documentKey.split("/").pop() || "Document";
    const documentDate = record.completed_at
      ? new Date(record.completed_at).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // Check if we already have this document linked to this record
    const existing = await db.query(
      `SELECT id FROM property_documents
       WHERE maintenance_record_id = $1 AND document_key = $2`,
      [recordId, documentKey]
    );

    if (existing.rows.length > 0) continue;

    const doc = await PropertyDocument.create({
      property_id: propertyId,
      document_name: documentName,
      document_date: documentDate,
      document_key: documentKey,
      document_type: "receipt",
      system_key: systemKey,
      maintenance_record_id: recordId,
    });

    if (doc && options.analyzeUser) {
      startAnalysisForDocument(doc, options.analyzeUser).catch((err) =>
        console.error(
          "[maintenanceRecordDocuments] AI analysis failed:",
          err.message
        )
      );
    }
  }
}

module.exports = {
  syncMaintenanceRecordDocuments,
};
