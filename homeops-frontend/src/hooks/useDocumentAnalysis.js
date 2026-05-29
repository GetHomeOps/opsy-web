/**
 * useDocumentAnalysis — poll a document analysis job and apply/reject results.
 */

import { useCallback, useRef, useState } from "react";
import AppApi from "../api/api";
import { emitDocumentAnalysisUpdated } from "../pages/properties/helpers/documentAnalysisFlow";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 10 * 60 * 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function useDocumentAnalysis(propertyId) {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const pollGen = useRef(0);

  const pollJob = useCallback(async (jobId) => {
    const gen = ++pollGen.current;
    const start = Date.now();

    while (gen === pollGen.current) {
      if (Date.now() - start > MAX_POLL_MS) {
        setStatus("error");
        setError("Analysis is taking longer than expected. Please try again.");
        setProgress(null);
        return null;
      }

      let job;
      try {
        job = await AppApi.getDocumentAnalysisJob(jobId);
      } catch (err) {
        setStatus("error");
        setError(err?.message || "Could not check analysis status");
        setProgress(null);
        return null;
      }

      if (gen !== pollGen.current) return null;

      if (job.progress) setProgress(job.progress);
      else if (job.status === "queued" || job.status === "processing") {
        setProgress((p) => p || "Analyzing document…");
      }

      if (job.status === "completed" && job.result) {
        setResult(job.result);
        setStatus("ready");
        setProgress(null);
        setError(null);
        if (propertyId) emitDocumentAnalysisUpdated(propertyId);
        return job.result;
      }

      if (job.status === "failed") {
        setStatus("error");
        setError(job.errorMessage || "Analysis failed");
        setProgress(null);
        return null;
      }

      await sleep(POLL_INTERVAL_MS);
    }
    return null;
  }, [propertyId]);

  const startAnalysis = useCallback(
    async (propertyDocumentId) => {
      setStatus("loading");
      setError(null);
      setProgress("Starting analysis…");
      setResult(null);
      pollGen.current += 1;
      const gen = pollGen.current;

      const prevSuppress = AppApi._suppressTierEmit;
      AppApi._suppressTierEmit = true;
      try {
        const jobId = await AppApi.startDocumentAnalysis(propertyDocumentId);
        if (gen !== pollGen.current) return null;
        if (propertyId) emitDocumentAnalysisUpdated(propertyId);
        return await pollJob(jobId);
      } catch (err) {
        if (gen !== pollGen.current) return null;
        const isQuota =
          err?.status === 403 && err?.message?.toLowerCase().includes("quota");
        setStatus(isQuota ? "quota_exceeded" : "error");
        setError(err?.message || "Failed to start analysis");
        setProgress(null);
        return null;
      } finally {
        AppApi._suppressTierEmit = prevSuppress;
      }
    },
    [pollJob],
  );

  const applySelected = useCallback(
    async (resultId, selectedFieldKeys) => {
      const res = await AppApi.applyDocumentAnalysis(resultId, selectedFieldKeys);
      setResult(res.result);
      setStatus("applied");
      if (propertyId) emitDocumentAnalysisUpdated(propertyId);
      return res;
    },
    [propertyId],
  );

  const rejectResult = useCallback(
    async (resultId) => {
      const updated = await AppApi.rejectDocumentAnalysis(resultId);
      setResult(updated);
      setStatus("rejected");
      if (propertyId) emitDocumentAnalysisUpdated(propertyId);
      return updated;
    },
    [propertyId],
  );

  const resumeJob = useCallback(
    async (jobId) => {
      setStatus("loading");
      setError(null);
      setProgress("Analyzing document…");
      setResult(null);
      pollGen.current += 1;
      return pollJob(jobId);
    },
    [pollJob],
  );

  const loadResult = useCallback(async (resultId) => {
    pollGen.current += 1;
    const gen = pollGen.current;
    setStatus("loading");
    setError(null);
    setProgress(null);
    setResult(null);
    try {
      const loaded = await AppApi.getDocumentAnalysisResult(resultId);
      if (gen !== pollGen.current) return null;
      setResult(loaded);
      setStatus("ready");
      setError(null);
      return loaded;
    } catch (err) {
      if (gen !== pollGen.current) return null;
      setStatus("error");
      setError(err?.message || "Could not load analysis results");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    pollGen.current += 1;
    setStatus("idle");
    setProgress(null);
    setError(null);
    setResult(null);
  }, []);

  return {
    status,
    progress,
    error,
    result,
    startAnalysis,
    resumeJob,
    loadResult,
    applySelected,
    rejectResult,
    reset,
  };
}
