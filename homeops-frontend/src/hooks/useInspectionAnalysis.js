/**
 * useInspectionAnalysis
 * Encapsulates loading, caching, and retry logic for inspection report analysis.
 */

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import AppApi from "../api/api";
import {
  fetchInspectionAnalysisState,
  createOrRefreshAnalysis,
  getJobStatus,
} from "../services/inspectionAnalysis/inspectionAnalysisApi";
import {
  getInspectionFlowState,
  inspectionFlowProgressMessage,
  INSPECTION_FLOW_EVENT,
} from "../pages/properties/helpers/inspectionFlowSession";

const POLL_INTERVAL_MS = 2500;
/** Backend keeps running after the modal closes; allow long reports without false timeouts. */
const MAX_POLL_DURATION_MS = 45 * 60 * 1000;
const INSPECTION_CHECKLIST_UPDATED_EVENT = "inspection-checklist:updated";
const INSPECTION_ANALYSIS_UPDATED_EVENT = "inspection-analysis:updated";

function emitInspectionAnalysisDerivedUpdates(propertyId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INSPECTION_CHECKLIST_UPDATED_EVENT));
  window.dispatchEvent(
    new CustomEvent(INSPECTION_ANALYSIS_UPDATED_EVENT, {
      detail: { propertyId: String(propertyId) },
    }),
  );
}

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

function metaFromReport(report) {
  return {
    s3Key: report.document_key ?? report.documentKey,
    fileName: report.document_name ?? report.name,
    mimeType: report.mime_type ?? "application/pdf",
    document_date: report.document_date ?? report.created_at,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string|number|null} propertyId - Property ID or UID
 * @returns {{
 *   status: 'idle'|'empty'|'loading'|'ready'|'ready_to_analyze'|'error'|'quota_exceeded',
 *   data: object|null,
 *   error: string|null,
 *   reportMeta: { s3Key, fileName?, document_date? }|null,
 *   analysisProgress: string|null,
 *   refresh: () => Promise<void>,
 *   load: () => Promise<void>,
 *   startAnalysis: () => Promise<void>,
 * }}
 */
export function useInspectionAnalysis(propertyId) {
  const [status, setStatus] = useState("idle");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reportMeta, setReportMeta] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(null);

  const cacheRef = useRef(new Map());
  const abortRef = useRef(null);
  const pollGenerationRef = useRef(0);
  const statusRef = useRef(status);

  useLayoutEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!propertyId || typeof window === "undefined") return;
    const onFlow = (e) => {
      if (String(e.detail?.propertyId) !== String(propertyId)) return;
      const s = statusRef.current;
      if (s !== "loading" && s !== "idle") return;
      const flow = getInspectionFlowState(propertyId);
      const msg = inspectionFlowProgressMessage(flow);
      if (msg) setAnalysisProgress(msg);
    };
    window.addEventListener(INSPECTION_FLOW_EVENT, onFlow);
    return () => window.removeEventListener(INSPECTION_FLOW_EVENT, onFlow);
  }, [propertyId]);

  useEffect(() => {
    return () => {
      pollGenerationRef.current += 1;
    };
  }, []);

  const pollJobUntilTerminal = useCallback(
    async (jobId, meta) => {
      const cacheKey = String(propertyId);
      const gen = ++pollGenerationRef.current;
      const startTime = Date.now();

      const poll = async () => {
        if (abortRef.current || gen !== pollGenerationRef.current) return;
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_POLL_DURATION_MS) {
          setStatus("ready_to_analyze");
          setAnalysisProgress(null);
          setError(
            "Analysis is taking longer than expected. Click Run AI Analysis to check status or try again.",
          );
          return;
        }
        let job;
        try {
          job = await getJobStatus(jobId);
        } catch (e) {
          if (abortRef.current || gen !== pollGenerationRef.current) return;
          setStatus("ready_to_analyze");
          setAnalysisProgress(null);
          setError(e?.message ?? "Could not check analysis status");
          return;
        }
        if (abortRef.current || gen !== pollGenerationRef.current) return;

        if (job.progress) {
          setAnalysisProgress(job.progress);
        } else if (
          job.status === "queued" ||
          job.status === "processing"
        ) {
          setAnalysisProgress((prev) => prev ?? "Analysis in progress…");
        }

        if (job.status === "completed" && job.result) {
          setData(job.result);
          setStatus("ready");
          setAnalysisProgress(null);
          cacheRef.current.set(cacheKey, { data: job.result, reportMeta: meta });
          emitInspectionAnalysisDerivedUpdates(propertyId);
          return;
        }
        if (job.status === "failed") {
          setStatus("ready_to_analyze");
          setAnalysisProgress(null);
          setError(job.errorMessage ?? "Analysis failed");
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      };

      await poll();
    },
    [propertyId],
  );

  const load = useCallback(async () => {
    if (!propertyId) {
      setStatus("empty");
      setReportMeta(null);
      setData(null);
      setError(null);
      setAnalysisProgress(null);
      return;
    }

    const cacheKey = String(propertyId);
    const cached = cacheRef.current.get(cacheKey);
    if (cached?.data) {
      setData(cached.data);
      setReportMeta(cached.reportMeta ?? null);
      setStatus("ready");
      setError(null);
      setAnalysisProgress(null);
      return;
    }

    setStatus("loading");
    setError(null);
    setData(null);
    setReportMeta(null);
    setAnalysisProgress(null);
    abortRef.current = null;
    pollGenerationRef.current += 1;
    const loadRunGen = pollGenerationRef.current;

    try {
      const fetchDocsAndState = async () => {
        const docsRes = await AppApi.getPropertyDocuments(propertyId).catch(
          () => [],
        );
        const documents = docsRes ?? [];
        const report = getMostRecentInspectionReport(documents);
        const reportS3Key = report?.document_key ?? report?.documentKey ?? null;
        const { analysis: analysisRes, pendingJob } =
          await fetchInspectionAnalysisState(propertyId, reportS3Key);
        return { documents, report, reportS3Key, analysisRes, pendingJob };
      };

      let { report, reportS3Key, analysisRes, pendingJob } =
        await fetchDocsAndState();

      if (loadRunGen !== pollGenerationRef.current) return;

      const PIPELINE_PHASES = new Set([
        "uploading",
        "saving",
        "starting_analysis",
      ]);
      let flow = getInspectionFlowState(propertyId);
      if (
        !analysisRes &&
        !pendingJob &&
        !report &&
        flow &&
        PIPELINE_PHASES.has(flow.phase)
      ) {
        const deadline = Date.now() + 5 * 60 * 1000;
        while (Date.now() < deadline) {
          if (loadRunGen !== pollGenerationRef.current) return;
          const msg = inspectionFlowProgressMessage(flow);
          if (msg) setAnalysisProgress(msg);
          await sleep(2000);
          if (loadRunGen !== pollGenerationRef.current) return;
          ({
            report,
            reportS3Key,
            analysisRes,
            pendingJob,
          } = await fetchDocsAndState());
          if (loadRunGen !== pollGenerationRef.current) return;
          if (analysisRes || pendingJob || report) break;
          flow = getInspectionFlowState(propertyId);
          if (!flow || !PIPELINE_PHASES.has(flow.phase)) break;
        }
      }

      if (loadRunGen !== pollGenerationRef.current) return;

      if (!analysisRes && !pendingJob && !report) {
        flow = getInspectionFlowState(propertyId);
        if (flow?.phase === "analyzing" && flow.jobId && flow.s3Key) {
          const meta = {
            s3Key: flow.s3Key,
            fileName: flow.fileName ?? null,
            mimeType: flow.mimeType ?? "application/pdf",
            document_date: null,
          };
          setReportMeta(meta);
          setStatus("loading");
          setAnalysisProgress(
            inspectionFlowProgressMessage(flow) ||
              "Resuming analysis — still running in the background…",
          );
          await pollJobUntilTerminal(flow.jobId, meta);
          return;
        }
        setStatus("empty");
        setReportMeta(null);
        setData(null);
        return;
      }

      if (analysisRes) {
        const meta = report
          ? metaFromReport(report)
          : {
              s3Key: reportS3Key || pendingJob?.s3Key || "",
              fileName: pendingJob?.fileName ?? null,
              mimeType: pendingJob?.mimeType ?? "application/pdf",
              document_date: null,
            };
        if (!meta.s3Key) {
          setStatus("error");
          setError("Analysis is available but the report file could not be resolved.");
          return;
        }
        setReportMeta(meta);
        setData(analysisRes);
        setStatus("ready");
        cacheRef.current.set(cacheKey, { data: analysisRes, reportMeta: meta });
        return;
      }

      if (pendingJob?.jobId != null) {
        const meta = report
          ? metaFromReport(report)
          : {
              s3Key: pendingJob.s3Key,
              fileName: pendingJob.fileName ?? null,
              mimeType: pendingJob.mimeType ?? "application/pdf",
              document_date: report?.document_date ?? report?.created_at ?? null,
            };
        if (!meta.s3Key) {
          setStatus("error");
          setError("Analysis is running but file information is missing.");
          return;
        }
        setReportMeta(meta);
        setStatus("loading");
        setAnalysisProgress(
          pendingJob.progress ||
            "Resuming analysis — still running in the background…",
        );
        await pollJobUntilTerminal(pendingJob.jobId, meta);
        return;
      }

      if (report && reportS3Key) {
        const meta = metaFromReport(report);
        if (!meta.s3Key) {
          setStatus("empty");
          setReportMeta(null);
          setError("Report has no file key");
          return;
        }
        setReportMeta(meta);
        setStatus("ready_to_analyze");
        return;
      }

      setStatus("empty");
      setReportMeta(null);
      setData(null);
    } catch (err) {
      if (abortRef.current) return;
      const isQuotaError =
        err?.status === 403 &&
        err?.message?.toLowerCase().includes("quota");
      setStatus(isQuotaError ? "quota_exceeded" : "error");
      setError(err?.message ?? "Failed to load analysis");
      setData(null);
      setAnalysisProgress(null);
    }
  }, [propertyId, pollJobUntilTerminal]);

  const refresh = useCallback(async () => {
    if (!propertyId) return;
    const cacheKey = String(propertyId);
    cacheRef.current.delete(cacheKey);
    abortRef.current = null;
    pollGenerationRef.current += 1;
    setData(null);
    setError(null);
    setAnalysisProgress(null);
    await load();
  }, [propertyId, load]);

  /** Start analysis when user clicks "Run AI Analysis". Suppresses TierLimitBanner so only one message shows. */
  const startAnalysis = useCallback(async () => {
    if (!propertyId || !reportMeta?.s3Key) return;
    const cacheKey = String(propertyId);
    const meta = reportMeta;

    setStatus("loading");
    setError(null);
    setAnalysisProgress("Starting analysis…");
    abortRef.current = null;
    pollGenerationRef.current += 1;

    const prevSuppress = AppApi._suppressTierEmit;
    AppApi._suppressTierEmit = true;
    try {
      const jobId = await createOrRefreshAnalysis(propertyId, meta);
      await pollJobUntilTerminal(jobId, meta);
    } catch (err) {
      if (abortRef.current) return;
      const isQuotaError =
        err?.status === 403 &&
        err?.message?.toLowerCase().includes("quota");
      setStatus(isQuotaError ? "quota_exceeded" : "ready_to_analyze");
      setError(err?.message ?? "Failed to load analysis");
      setData(null);
      setAnalysisProgress(null);
    } finally {
      AppApi._suppressTierEmit = prevSuppress;
    }
  }, [propertyId, reportMeta, pollJobUntilTerminal]);

  return {
    status,
    data,
    error,
    reportMeta,
    analysisProgress,
    refresh,
    load,
    startAnalysis,
    generate: refresh,
  };
}
