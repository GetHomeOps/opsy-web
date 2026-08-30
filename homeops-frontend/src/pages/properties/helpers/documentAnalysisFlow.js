/**
 * Cross-surface events for post-file document AI analysis.
 */

export const DOCUMENT_ANALYSIS_UPDATED_EVENT = "document-analysis:updated";
export const DOCUMENT_ANALYSIS_FILED_EVENT = "document-analysis:filed";
export const REQUEST_DOCUMENT_ANALYSIS_EVENT = "document-analysis:request-analysis";
export const REOPEN_DOCUMENT_ANALYSIS_EVENT = "document-analysis:reopen";
export const OPEN_DOCUMENT_FINDINGS_EVENT = "document-analysis:open-findings";
export const REQUEST_INSPECTION_OPSYMIZATION_EVENT =
  "document-analysis:request-opsymization";

/** @typedef {{ id, document_name?, document_key?, system_key?, document_type?, document_date?, mime_type?, checklist_item_id?, declaredAnalysisCategory? }} FiledDocument */

/**
 * Heuristic: filed doc is probably a property inspection report.
 */
export function isLikelyInspectionReport(doc) {
  if (!doc) return false;
  const sys = String(doc.system_key || doc.system || "").toLowerCase();
  const type = String(doc.document_type || doc.type || "").toLowerCase();
  if (sys === "inspectionreport" || sys === "inspection_report") return true;
  if (sys === "inspections") return true;
  if (type === "inspection") return true;
  const name = String(doc.document_name || doc.name || "").toLowerCase();
  return /inspect|home inspection|property inspection|inspection report/.test(name);
}

/**
 * Open Passport Opsymization analysis for a specific filed document.
 */
export function emitRequestInspectionOpsymization(propertyId, document) {
  if (typeof window === "undefined" || !propertyId || !document) return;
  window.dispatchEvent(
    new CustomEvent(REQUEST_INSPECTION_OPSYMIZATION_EVENT, {
      detail: { propertyId: String(propertyId), document },
    }),
  );
}

/**
 * Call after one or more property documents are filed/created.
 * @param {string|number} propertyId
 * @param {FiledDocument[]} documents
 */
export function emitDocumentsFiled(propertyId, documents) {
  if (typeof window === "undefined" || !documents?.length) return;
  window.dispatchEvent(
    new CustomEvent(DOCUMENT_ANALYSIS_FILED_EVENT, {
      detail: { propertyId: String(propertyId), documents },
    }),
  );
}

export function emitDocumentAnalysisUpdated(propertyId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DOCUMENT_ANALYSIS_UPDATED_EVENT, {
      detail: { propertyId: String(propertyId) },
    }),
  );
}

/** Normalize a UI or API document row for analysis orchestration. */
export function toFiledDocumentForAnalysis(doc) {
  if (!doc?.id) return null;
  const declaredAnalysisCategory =
    doc.declaredAnalysisCategory || doc.declared_analysis_category || null;
  return {
    id: doc.id,
    document_name: doc.document_name || doc.name,
    document_key: doc.document_key,
    system_key: doc.system_key || doc.system,
    document_type: doc.document_type || doc.type,
    document_date: doc.document_date,
    mime_type: doc.mime_type,
    checklist_item_id: doc.checklist_item_id ?? doc.checklistItemId ?? null,
    declaredAnalysisCategory: declaredAnalysisCategory || null,
  };
}

/**
 * Open the AI analysis prompt for a filed document (e.g. from document preview).
 */
export function emitRequestDocumentAnalysis(propertyId, document) {
  const normalized = toFiledDocumentForAnalysis(document);
  if (typeof window === "undefined" || !propertyId || !normalized) return;
  window.dispatchEvent(
    new CustomEvent(REQUEST_DOCUMENT_ANALYSIS_EVENT, {
      detail: { propertyId: String(propertyId), document: normalized },
    }),
  );
}

export function emitOpenDocumentFindings(
  propertyId,
  {
    systemKey,
    systemLabel,
    categoryFilter = null,
    initialCategory = null,
    checklistItemId = null,
  } = {},
) {
  if (typeof window === "undefined" || !propertyId || !systemKey) return;
  window.dispatchEvent(
    new CustomEvent(OPEN_DOCUMENT_FINDINGS_EVENT, {
      detail: {
        propertyId: String(propertyId),
        systemKey,
        systemLabel: systemLabel || null,
        categoryFilter,
        initialCategory: initialCategory || categoryFilter || null,
        checklistItemId,
      },
    }),
  );
}

/** User-facing label when AI document analysis did not succeed (avoid "failed"). */
export const DOCUMENT_ANALYSIS_TROUBLE_LABEL = "Hard to analyze";

const ANALYSIS_FAILURE_DISMISS_STORAGE_KEY =
  "opsy-doc-analysis-failure-dismissed";

function readAnalysisFailureDismissMap() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ANALYSIS_FAILURE_DISMISS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAnalysisFailureDismissMap(map) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ANALYSIS_FAILURE_DISMISS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Stable key so a new analysis attempt re-shows the banner after dismiss. */
export function getDocumentAnalysisFailureDismissSignature(analysisItem) {
  if (!analysisItem) return "";
  const id = analysisItem.id ?? analysisItem.documentAnalysisId ?? "";
  const msg =
    analysisItem.errorMessage ??
    analysisItem.error_message ??
    "";
  return `${id}:${msg}`;
}

export function isDocumentAnalysisFailureDismissed(documentId, analysisItem) {
  if (!documentId || !analysisItem) return false;
  const map = readAnalysisFailureDismissMap();
  const signature = getDocumentAnalysisFailureDismissSignature(analysisItem);
  return map[String(documentId)] === signature;
}

export function dismissDocumentAnalysisFailure(documentId, analysisItem) {
  if (!documentId || !analysisItem) return;
  const map = readAnalysisFailureDismissMap();
  map[String(documentId)] = getDocumentAnalysisFailureDismissSignature(analysisItem);
  writeAnalysisFailureDismissMap(map);
}

/** User-facing message when AI document analysis did not succeed. */
export function getDocumentAnalysisFailureMessage(analysisItem) {
  if (!analysisItem || analysisItem.status !== "failed") return null;
  const raw =
    analysisItem.errorMessage ??
    analysisItem.error_message ??
    null;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "We're having a hard time reading this document. Try a clearer scan or re-upload.";
}

/** Successful analysis jobs per document (initial run + re-runs). */
export const MAX_DOCUMENT_ANALYSIS_RUNS = 4;

export const DOCUMENT_ANALYSIS_RUN_LIMIT_MESSAGE = `This document has already been analyzed ${MAX_DOCUMENT_ANALYSIS_RUNS} times.`;

function applyAnalysisRunLimit(base, analysisItem, { isAdmin = false } = {}) {
  const completedRunCount =
    typeof analysisItem?.completedRunCount === "number"
      ? analysisItem.completedRunCount
      : 0;
  const maxAnalysisRuns =
    typeof analysisItem?.maxAnalysisRuns === "number"
      ? analysisItem.maxAnalysisRuns
      : MAX_DOCUMENT_ANALYSIS_RUNS;
  const atRunLimit = !isAdmin && completedRunCount >= maxAnalysisRuns;
  const disabled = Boolean(base.analyzing) || (base.action === "start" && atRunLimit);
  const title =
    base.action === "start" && atRunLimit
      ? DOCUMENT_ANALYSIS_RUN_LIMIT_MESSAGE
      : base.label;
  return { ...base, atRunLimit, disabled, title };
}

/**
 * @returns {{ showAnalyze: boolean, analyzing: boolean, label: string, action: "start" | "reopen", atRunLimit: boolean, disabled: boolean, title: string }}
 */
export function getDocumentAnalysisUiState(analysisItem, options = {}) {
  if (!analysisItem) {
    return applyAnalysisRunLimit(
      {
        showAnalyze: true,
        analyzing: false,
        label: "Analyze Document",
        action: "start",
      },
      analysisItem,
      options,
    );
  }

  if (analysisItem.reviewStatus) {
    if (analysisItem.reviewStatus === "pending_review") {
      return applyAnalysisRunLimit(
        {
          showAnalyze: true,
          analyzing: false,
          label: "Review findings",
          action: "reopen",
        },
        analysisItem,
        options,
      );
    }
    if (analysisItem.reviewStatus === "rejected") {
      return applyAnalysisRunLimit(
        {
          showAnalyze: true,
          analyzing: false,
          label: "Analyze Document",
          action: "start",
        },
        analysisItem,
        options,
      );
    }
    return applyAnalysisRunLimit(
      {
        showAnalyze: true,
        analyzing: false,
        label: "Analyze again",
        action: "start",
      },
      analysisItem,
      options,
    );
  }

  if (analysisItem.status === "queued" || analysisItem.status === "processing") {
    return applyAnalysisRunLimit(
      {
        showAnalyze: true,
        analyzing: true,
        label: "Analyzing…",
        action: "reopen",
      },
      analysisItem,
      options,
    );
  }

  if (analysisItem.status === "failed") {
    return applyAnalysisRunLimit(
      {
        showAnalyze: true,
        analyzing: false,
        label: "Retry analysis",
        action: "start",
      },
      analysisItem,
      options,
    );
  }

  return applyAnalysisRunLimit(
    {
      showAnalyze: true,
      analyzing: false,
      label: "Analyze Document",
      action: "start",
    },
    analysisItem,
    options,
  );
}

/**
 * Reopen the analysis progress or results modal for an in-flight or completed analysis.
 */
export function emitReopenDocumentAnalysis(propertyId, document, analysisItem) {
  const normalized = toFiledDocumentForAnalysis(document);
  if (typeof window === "undefined" || !propertyId || !normalized) return;
  window.dispatchEvent(
    new CustomEvent(REOPEN_DOCUMENT_ANALYSIS_EVENT, {
      detail: {
        propertyId: String(propertyId),
        document: normalized,
        analysisItem: analysisItem || null,
      },
    }),
  );
}
