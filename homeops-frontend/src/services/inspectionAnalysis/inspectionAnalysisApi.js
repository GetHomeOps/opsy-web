/**
 * Inspection Analysis API
 * Fetches existing analysis and triggers generation.
 */

import AppApi from "../../api/api";
import { parseInspectionAnalysis } from "./inspectionAnalysisSchema";

/**
 * Get existing analysis for a property.
 * @param {string|number} propertyId - Property ID or UID
 * @returns {Promise<object|null>} Normalized analysis or null
 */
export async function getAnalysis(propertyId) {
  if (!propertyId) return null;
  const res = await AppApi.getInspectionAnalysisByProperty(propertyId);
  const raw = res?.analysis ?? null;
  if (!raw) return null;
  try {
    return parseInspectionAnalysis(raw);
  } catch (err) {
    console.warn("[inspectionAnalysis] Parse error:", err);
    return null;
  }
}

/**
 * Analysis row + optional in-flight job (resume after modal close).
 * @param {string|number} propertyId
 * @param {string|null} reportS3Key - When set, pending job must match this file; when omitted, any active job for the property is returned.
 * @returns {Promise<{ analysis: object|null, pendingJob: object|null }>}
 */
export async function fetchInspectionAnalysisState(propertyId, reportS3Key) {
  if (!propertyId) {
    return { analysis: null, pendingJob: null };
  }
  const query = reportS3Key ? { reportS3Key } : {};
  const envelope = await AppApi.getInspectionAnalysisByProperty(
    propertyId,
    query,
  );
  const raw = envelope?.analysis ?? null;
  let analysis = null;
  if (raw) {
    try {
      analysis = parseInspectionAnalysis(raw);
    } catch (err) {
      console.warn("[inspectionAnalysis] Parse error:", err);
      analysis = null;
    }
  }
  const pj = envelope?.pendingJob ?? null;
  const pendingJob =
    pj && pj.jobId != null
      ? {
          jobId: pj.jobId,
          status: pj.status ?? "queued",
          progress: pj.progress ?? null,
          s3Key: pj.s3Key ?? pj.s3_key ?? null,
          fileName: pj.fileName ?? pj.file_name ?? null,
          mimeType: pj.mimeType ?? pj.mime_type ?? null,
        }
      : null;
  return { analysis, pendingJob };
}

/**
 * Start or refresh analysis for a report.
 * @param {string|number} propertyId - Property ID or UID
 * @param {object} reportMeta - { s3Key, fileName?, mimeType? }
 * @returns {Promise<string>} Job ID for polling
 */
export async function createOrRefreshAnalysis(propertyId, reportMeta) {
  if (!propertyId || !reportMeta?.s3Key) {
    throw new Error("propertyId and reportMeta.s3Key are required");
  }
  const jobId = await AppApi.startInspectionAnalysis(propertyId, {
    s3Key: reportMeta.s3Key,
    fileName: reportMeta.fileName ?? null,
    mimeType: reportMeta.mimeType ?? null,
  });
  return jobId;
}

/**
 * Get job status and result when completed.
 * @param {string|number} jobId - Job ID
 * @returns {Promise<{ status, progress?, errorMessage?, result? }>}
 */
export async function getJobStatus(jobId) {
  if (!jobId) throw new Error("jobId is required");
  const res = await AppApi.getInspectionAnalysisJob(jobId);
  const out = {
    status: res.status ?? "unknown",
    progress: res.progress ?? null,
    errorMessage: res.errorMessage ?? res.error_message ?? null,
  };
  if (res.status === "completed" && res.result) {
    out.result = parseInspectionAnalysis(res.result);
  }
  return out;
}
