import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import DocumentAnalysisPromptModal from "./documents/DocumentAnalysisPromptModal";
import InspectionOpsymizationPromptModal from "./documents/InspectionOpsymizationPromptModal";
import PendingAnalysisBanner from "./documents/PendingAnalysisBanner";
import DocumentAnalysisResultsModal from "./documents/DocumentAnalysisResultsModal";
import SystemDocumentFindingsModal from "./SystemDocumentFindingsModal";
import { useDocumentAnalysis } from "../../../hooks/useDocumentAnalysis";
import {
  DOCUMENT_ANALYSIS_FILED_EVENT,
  REQUEST_DOCUMENT_ANALYSIS_EVENT,
  REOPEN_DOCUMENT_ANALYSIS_EVENT,
  OPEN_DOCUMENT_FINDINGS_EVENT,
  emitDocumentsFiled,
  emitOpenDocumentFindings,
  emitRequestInspectionOpsymization,
  isLikelyInspectionReport,
  toFiledDocumentForAnalysis,
} from "../helpers/documentAnalysisFlow";
import { resolveDeclaredAnalysisCategory } from "../helpers/documentAnalysisUi";
import {canUseAiOnDemo} from "../../../utils/demoSite";
import ContactContext from "../../../context/ContactContext";

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
  const [findingsModal, setFindingsModal] = useState(null);
  const { refreshContacts } = useContext(ContactContext) || {};

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
    if (!canUseAiOnDemo()) return;
    setCurrentDoc(doc);
    setPromptSource(source);
    setPromptOpen(false);
    setResultsOpen(false);
    setOpsymizationPromptOpen(true);
  }, []);

  const showAnalysisPromptFor = useCallback((doc, source = "queue") => {
    if (!canUseAiOnDemo()) return;
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

  const openFindingsModal = useCallback(
    ({ systemKey, systemLabel, categoryFilter = null, initialCategory = null }) => {
      if (!systemKey) return;
      setFindingsModal({
        systemKey,
        systemLabel: systemLabel || systemLabelFor(systemKey),
        categoryFilter,
        initialCategory: initialCategory || categoryFilter || "bid",
      });
    },
    [systemLabelFor],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !propertyId) return;
    const handler = (e) => {
      if (String(e.detail?.propertyId) !== String(propertyId)) return;
      openFindingsModal(e.detail || {});
    };
    window.addEventListener(OPEN_DOCUMENT_FINDINGS_EVENT, handler);
    return () => window.removeEventListener(OPEN_DOCUMENT_FINDINGS_EVENT, handler);
  }, [propertyId, openFindingsModal]);

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

  const handleAnalyze = useCallback(async (selectedCategory) => {
    if (!currentDoc?.id) return;
    const category = resolveDeclaredAnalysisCategory(selectedCategory);
    setPromptBusy(true);
    setPromptOpen(false);
    setResultsOpen(true);
    setQueue((prev) => prev.filter((d) => d.id !== currentDoc.id));
    analysis.reset();
    const result = await analysis.startAnalysis(currentDoc.id, { category });
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
    async (resultId, selectedFieldKeys, fieldOverrides, createContactFieldKeys) => {
      setApplying(true);
      try {
        const applied = await analysis.applySelected(
          resultId,
          selectedFieldKeys,
          fieldOverrides,
          createContactFieldKeys,
        );
        if (createContactFieldKeys?.length) refreshContacts?.();
        await onSystemsUpdated?.();
        setResultsOpen(false);
        analysis.reset();
        const savedDoc = currentDoc;
        if (savedDoc) clearCurrentDoc(savedDoc.id);
        if (applied?.result?.detectedCategory === "bid" && savedDoc) {
          emitOpenDocumentFindings(propertyId, {
            systemKey: savedDoc.system_key || applied.result.systemKey,
            systemLabel: systemLabelFor(
              savedDoc.system_key || applied.result.systemKey,
            ),
            categoryFilter: "bid",
            initialCategory: "bid",
          });
        }
      } finally {
        setApplying(false);
      }
    },
    [
      analysis,
      onSystemsUpdated,
      currentDoc,
      clearCurrentDoc,
      refreshContacts,
      propertyId,
      systemLabelFor,
    ],
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
        onViewQuotes={() => {
          const systemKey =
            currentDoc?.system_key || analysis.result?.systemKey;
          if (!propertyId || !systemKey) return;
          emitOpenDocumentFindings(propertyId, {
            systemKey,
            systemLabel: systemLabelFor(systemKey),
            categoryFilter: "bid",
            initialCategory: "bid",
          });
        }}
        applying={applying}
      />

      <SystemDocumentFindingsModal
        open={!!findingsModal}
        onClose={() => setFindingsModal(null)}
        propertyId={propertyId}
        systemKey={findingsModal?.systemKey}
        systemLabel={findingsModal?.systemLabel}
        initialCategory={findingsModal?.initialCategory}
        categoryFilter={findingsModal?.categoryFilter}
        onSystemsUpdated={onSystemsUpdated}
      />
    </>
  );
}

/** Helper for filing paths — re-export for convenience */
export { emitDocumentsFiled };

export default DocumentAnalysisOrchestrator;
