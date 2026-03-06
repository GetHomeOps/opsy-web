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
  if (!res) return null;
  try {
    return parseInspectionAnalysis(res);
  } catch (err) {
    console.warn("[inspectionAnalysis] Parse error:", err);
    return null;
  }
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
