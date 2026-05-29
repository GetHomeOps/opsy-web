import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DocumentAnalysisPromptModal from "./documents/DocumentAnalysisPromptModal";
import InspectionOpsymizationPromptModal from "./documents/InspectionOpsymizationPromptModal";
import PendingAnalysisBanner from "./documents/PendingAnalysisBanner";
import DocumentAnalysisResultsModal from "./documents/DocumentAnalysisResultsModal";
import { useDocumentAnalysis } from "../../../hooks/useDocumentAnalysis";
import {
  DOCUMENT_ANALYSIS_FILED_EVENT,
  REQUEST_DOCUMENT_ANALYSIS_EVENT,
  REOPEN_DOCUMENT_ANALYSIS_EVENT,
  emitDocumentsFiled,
  emitRequestInspectionOpsymization,
  isLikelyInspectionReport,
  toFiledDocumentForAnalysis,
} from "../helpers/documentAnalysisFlow";

/**
 * Orchestrates post-file AI analysis prompts and results modals.
 * Mount once per property form (Documents tab area or container).
 */
function DocumentAnalysisOrchestrator({
  propertyId,
  systemsToShow = [],
  onOpenDocument,
  onSystemsUpdated,
}) {
  const [queue, setQueue] = useState([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [opsymizationPromptOpen, setOpsymizationPromptOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [currentDoc, setCurrentDoc] = useState(null);
  const [applying, setApplying] = useState(false);
  const [promptBusy, setPromptBusy] = useState(false);
  const [opsymizationBusy, setOpsymizationBusy] = useState(false);
  const [promptSource, setPromptSource] = useState(null);

  const analysis = useDocumentAnalysis(propertyId);
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;
  const currentDocRef = useRef(currentDoc);
  currentDocRef.current = currentDoc;

  const systemLabelFor = useCallback(
    (systemKey) =>
      systemsToShow.find((s) => s.id === systemKey)?.label || systemKey,
    [systemsToShow],
  );

  const showOpsymizationPromptFor = useCallback((doc, source = "queue") => {
    setCurrentDoc(doc);
    setPromptSource(source);
    setPromptOpen(false);
    setResultsOpen(false);
    setOpsymizationPromptOpen(true);
  }, []);

  const showAnalysisPromptFor = useCallback((doc, source = "queue") => {
    setCurrentDoc(doc);
    setPromptSource(source);
    setOpsymizationPromptOpen(false);
    setResultsOpen(false);
    if (isLikelyInspectionReport(doc)) {
      setOpsymizationPromptOpen(true);
      setPromptOpen(false);
    } else {
      setPromptOpen(true);
      setOpsymizationPromptOpen(false);
    }
  }, []);

  const enqueueDocuments = useCallback((documents) => {
    const normalized = (documents || []).filter((d) => d?.id);
    if (!normalized.length) return;
    setQueue((prev) => {
      const existingIds = new Set(prev.map((d) => d.id));
      const added = normalized.filter((d) => !existingIds.has(d.id));
      return [...prev, ...added];
    });
    setBannerDismissed(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !propertyId) return;
    const handler = (e) => {
      if (String(e.detail?.propertyId) !== String(propertyId)) return;
      enqueueDocuments(e.detail?.documents);
    };
    window.addEventListener(DOCUMENT_ANALYSIS_FILED_EVENT, handler);
    return () => window.removeEventListener(DOCUMENT_ANALYSIS_FILED_EVENT, handler);
  }, [propertyId, enqueueDocuments]);

  useEffect(() => {
    if (typeof window === "undefined" || !propertyId) return;
    const handler = (e) => {
      if (String(e.detail?.propertyId) !== String(propertyId)) return;
      const doc = e.detail?.document;
      if (!doc?.id) return;
      const active = analysisRef.current;
      if (
        currentDocRef.current?.id === doc.id &&
        (active.status === "loading" ||
          active.status === "ready" ||
          active.status === "error" ||
          active.status === "quota_exceeded")
      ) {
        setCurrentDoc(doc);
        setPromptOpen(false);
        setOpsymizationPromptOpen(false);
        setResultsOpen(true);
        return;
      }
      showAnalysisPromptFor(doc, "manual");
    };
    window.addEventListener(REQUEST_DOCUMENT_ANALYSIS_EVENT, handler);
    return () =>
      window.removeEventListener(REQUEST_DOCUMENT_ANALYSIS_EVENT, handler);
  }, [propertyId, showAnalysisPromptFor]);

  const handleReopenAnalysis = useCallback(
    async (doc, analysisItem) => {
      const normalized = toFiledDocumentForAnalysis(doc) || doc;
      setCurrentDoc(normalized);
      setPromptSource("manual");
      setPromptOpen(false);
      setOpsymizationPromptOpen(false);
      setResultsOpen(true);

      const active = analysisRef.current;
      const sameDocActive =
        currentDocRef.current?.id === normalized.id &&
        (active.status === "loading" ||
          active.status === "ready" ||
          active.status === "error" ||
          active.status === "quota_exceeded");

      if (sameDocActive) return;

      if (
        analysisItem?.jobId &&
        (analysisItem.status === "queued" || analysisItem.status === "processing")
      ) {
        analysis.reset();
        await analysis.resumeJob(analysisItem.jobId);
        return;
      }

      if (analysisItem?.id && analysisItem.reviewStatus === "pending_review") {
        analysis.reset();
        await analysis.loadResult(analysisItem.id);
      }
    },
    [analysis],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !propertyId) return;
    const handler = (e) => {
      if (String(e.detail?.propertyId) !== String(propertyId)) return;
      const doc = e.detail?.document;
      if (!doc?.id) return;
      handleReopenAnalysis(doc, e.detail?.analysisItem);
    };
    window.addEventListener(REOPEN_DOCUMENT_ANALYSIS_EVENT, handler);
    return () =>
      window.removeEventListener(REOPEN_DOCUMENT_ANALYSIS_EVENT, handler);
  }, [propertyId, handleReopenAnalysis]);

  const showBanner =
    queue.length >= 2 &&
    !bannerDismissed &&
    !promptOpen &&
    !opsymizationPromptOpen &&
    !resultsOpen;

  const beginSinglePrompt = useCallback(() => {
    if (!queue.length) return;
    showAnalysisPromptFor(queue[0], "queue");
  }, [queue, showAnalysisPromptFor]);

  useEffect(() => {
    if (
      queue.length === 1 &&
      !promptOpen &&
      !opsymizationPromptOpen &&
      !resultsOpen &&
      !bannerDismissed
    ) {
      beginSinglePrompt();
    }
  }, [
    queue.length,
    promptOpen,
    opsymizationPromptOpen,
    resultsOpen,
    bannerDismissed,
    beginSinglePrompt,
  ]);

  const advanceQueue = useCallback((docId) => {
    setQueue((prev) => {
      const next = prev.filter((d) => d.id !== docId);
      if (next.length === 1) {
        setTimeout(() => {
          showAnalysisPromptFor(next[0], "queue");
        }, 300);
      }
      return next;
    });
  }, [showAnalysisPromptFor]);

  const clearCurrentDoc = useCallback(
    (docId) => {
      if (promptSource === "queue" && docId) {
        advanceQueue(docId);
      }
      setCurrentDoc(null);
      setPromptSource(null);
    },
    [promptSource, advanceQueue],
  );

  const handleSkip = useCallback(() => {
    const docId = currentDoc?.id;
    clearCurrentDoc(docId);
    setPromptOpen(false);
  }, [currentDoc, clearCurrentDoc]);

  const handleOpsymizationSkip = useCallback(() => {
    const docId = currentDoc?.id;
    clearCurrentDoc(docId);
    setOpsymizationPromptOpen(false);
  }, [currentDoc, clearCurrentDoc]);

  const handleOpsymizationAccept = useCallback(async () => {
    if (!currentDoc || !propertyId) return;
    setOpsymizationBusy(true);
    try {
      emitRequestInspectionOpsymization(propertyId, currentDoc);
      const docId = currentDoc.id;
      setOpsymizationPromptOpen(false);
      clearCurrentDoc(docId);
    } finally {
      setOpsymizationBusy(false);
    }
  }, [currentDoc, propertyId, clearCurrentDoc]);

  const handleAnalyze = useCallback(async () => {
    if (!currentDoc?.id) return;
    setPromptBusy(true);
    setPromptOpen(false);
    setResultsOpen(true);
    setQueue((prev) => prev.filter((d) => d.id !== currentDoc.id));
    analysis.reset();
    const result = await analysis.startAnalysis(currentDoc.id);
    setPromptBusy(false);

    if (result?.detectedCategory === "inspection_report") {
      setResultsOpen(false);
      analysis.reset();
      showOpsymizationPromptFor(currentDoc, promptSource || "manual");
    }
  }, [currentDoc, analysis, showOpsymizationPromptFor, promptSource]);

  const handleReviewAll = useCallback(() => {
    if (!queue.length) return;
    beginSinglePrompt();
  }, [queue, beginSinglePrompt]);

  const handleApply = useCallback(
    async (resultId, selectedFieldKeys) => {
      setApplying(true);
      try {
        await analysis.applySelected(resultId, selectedFieldKeys);
        onSystemsUpdated?.();
        setResultsOpen(false);
        analysis.reset();
        if (currentDoc) clearCurrentDoc(currentDoc.id);
      } finally {
        setApplying(false);
      }
    },
    [analysis, onSystemsUpdated, currentDoc, clearCurrentDoc],
  );

  const handleReject = useCallback(
    async (resultId) => {
      setApplying(true);
      try {
        await analysis.rejectResult(resultId);
        setResultsOpen(false);
        analysis.reset();
        if (currentDoc) clearCurrentDoc(currentDoc.id);
      } finally {
        setApplying(false);
      }
    },
    [analysis, currentDoc, clearCurrentDoc],
  );

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
    setQueue([]);
  }, []);

  const resultsSystemLabel = useMemo(
    () => systemLabelFor(currentDoc?.system_key || analysis.result?.systemKey),
    [currentDoc, analysis.result, systemLabelFor],
  );

  return (
    <>
      {showBanner && (
        <PendingAnalysisBanner
          count={queue.length}
          onReview={handleReviewAll}
          onDismiss={handleDismissBanner}
        />
      )}

      <InspectionOpsymizationPromptModal
        open={opsymizationPromptOpen && !!currentDoc}
        document={currentDoc}
        onAccept={handleOpsymizationAccept}
        onSkip={handleOpsymizationSkip}
        busy={opsymizationBusy}
      />

      <DocumentAnalysisPromptModal
        open={promptOpen && !!currentDoc}
        document={currentDoc}
        systemLabel={systemLabelFor(currentDoc?.system_key)}
        onAnalyze={handleAnalyze}
        onSkip={handleSkip}
        busy={promptBusy}
      />

      <DocumentAnalysisResultsModal
        open={resultsOpen}
        onClose={() => {
          setResultsOpen(false);
        }}
        result={analysis.result}
        status={analysis.status}
        progress={analysis.progress}
        error={analysis.error}
        systemLabel={resultsSystemLabel}
        onApply={handleApply}
        onReject={handleReject}
        onOpenDocument={onOpenDocument}
        applying={applying}
      />
    </>
  );
}

/** Helper for filing paths — re-export for convenience */
export { emitDocumentsFiled };

export default DocumentAnalysisOrchestrator;
