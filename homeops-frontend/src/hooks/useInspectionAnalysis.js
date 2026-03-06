/**
 * useInspectionAnalysis
 * Encapsulates loading, caching, and retry logic for inspection report analysis.
 */

import { useState, useCallback, useRef } from "react";
import AppApi from "../api/api";
import {
  getAnalysis,
  createOrRefreshAnalysis,
  getJobStatus,
} from "../services/inspectionAnalysis/inspectionAnalysisApi";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_DURATION_MS = 60000;

function isInspectionReport(doc) {
  const sys = (doc.system_key ?? doc.system ?? "").toLowerCase();
  const type = (doc.document_type ?? doc.type ?? "").toLowerCase();
  return (
    sys === "inspectionreport" ||
    sys === "inspection_report" ||
    type === "inspection"
  );
}

function getMostRecentInspectionReport(documents) {
  if (!Array.isArray(documents)) return null;
  const reports = documents.filter(isInspectionReport);
  if (reports.length === 0) return null;
  reports.sort((a, b) => {
    const da = new Date(a.document_date ?? a.created_at ?? 0);
    const db = new Date(b.document_date ?? b.created_at ?? 0);
    return db - da;
  });
  return reports[0];
}

/**
 * @param {string|number|null} propertyId - Property ID or UID
 * @returns {{
 *   status: 'idle'|'empty'|'loading'|'ready'|'error',
 *   data: object|null,
 *   error: string|null,
 *   reportMeta: { s3Key, fileName?, document_date? }|null,
 *   refresh: () => Promise<void>,
 *   load: () => Promise<void>,
 * }}
 */
export function useInspectionAnalysis(propertyId) {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reportMeta, setReportMeta] = useState(null);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    if (!propertyId) {
      setStatus("empty");
      setReportMeta(null);
      setData(null);
      setError(null);
      return;
    }

    const cacheKey = String(propertyId);
    const cached = cacheRef.current.get(cacheKey);
    if (cached?.data) {
      setData(cached.data);
      setReportMeta(cached.reportMeta ?? null);
      setStatus("ready");
      setError(null);
      return;
    }

    setStatus("loading");
    setError(null);
    setData(null);
    setReportMeta(null);

    try {
      const [analysisRes, docsRes] = await Promise.all([
        getAnalysis(propertyId).catch(() => null),
        AppApi.getPropertyDocuments(propertyId).catch(() => []),
      ]);

      const documents = docsRes ?? [];
      const report = getMostRecentInspectionReport(documents);

      if (!report) {
        setStatus("empty");
        setReportMeta(null);
        setData(null);
        return;
      }

      const meta = {
        s3Key: report.document_key ?? report.documentKey,
        fileName: report.document_name ?? report.name,
        mimeType: report.mime_type ?? "application/pdf",
        document_date: report.document_date ?? report.created_at,
      };

      if (!meta.s3Key) {
        setStatus("empty");
        setReportMeta(null);
        setError("Report has no file key");
        return;
      }

      setReportMeta(meta);

      if (analysisRes) {
        setData(analysisRes);
        setStatus("ready");
        cacheRef.current.set(cacheKey, { data: analysisRes, reportMeta: meta });
        return;
      }

      setStatus("loading");
      const jobId = await createOrRefreshAnalysis(propertyId, meta);

      const startTime = Date.now();
      const poll = async () => {
        if (abortRef.current) return;
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_POLL_DURATION_MS) {
          setStatus("error");
          setError("Analysis is taking longer than expected. Click Retry to try again.");
          return;
        }

        const job = await getJobStatus(jobId);
        if (abortRef.current) return;

        if (job.status === "completed" && job.result) {
          setData(job.result);
          setStatus("ready");
          cacheRef.current.set(cacheKey, { data: job.result, reportMeta: meta });
          return;
        }

        if (job.status === "failed") {
          setStatus("error");
          setError(job.errorMessage ?? "Analysis failed");
          return;
        }

        setTimeout(poll, POLL_INTERVAL_MS);
      };

      await poll();
    } catch (err) {
      if (abortRef.current) return;
      const isQuotaError = err?.status === 403 && err?.message?.toLowerCase().includes("quota");
      setStatus(isQuotaError ? "quota_exceeded" : "error");
      setError(err?.message ?? "Failed to load analysis");
      setData(null);
    }
  }, [propertyId]);

  const refresh = useCallback(async () => {
    if (!propertyId) return;
    const cacheKey = String(propertyId);
    cacheRef.current.delete(cacheKey);
    abortRef.current = null;
    setData(null);
    setError(null);
    await load();
  }, [propertyId, load]);

  return {
    status,
    data,
    error,
    reportMeta,
    refresh,
    load,
    generate: refresh,
  };
}
