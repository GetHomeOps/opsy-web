import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import AppApi from "../../../api/api";
import { useDocumentAnalysis } from "../../../hooks/useDocumentAnalysis";
import { DOCUMENT_ANALYSIS_UPDATED_EVENT } from "../helpers/documentAnalysisFlow";
import DocumentAnalysisResultsModal from "./documents/DocumentAnalysisResultsModal";
import {
  DOCUMENT_ANALYSIS_MODAL_BODY,
  DOCUMENT_ANALYSIS_MODAL_INNER,
  DOCUMENT_ANALYSIS_MODAL_SHELL,
  DocumentAnalysisEmptyState,
  OpsyModalIcon,
  formatAnalysisValue,
  formatFieldLabel,
  isLineItemsField,
  LineItemsList,
} from "./documents/documentAnalysisModalShared";

const CATEGORY_TABS = [
  { id: "bid", label: "Bids" },
  { id: "maintenance_report", label: "Maintenance" },
  { id: "inspection_report", label: "Inspection" },
  { id: "installation_invoice", label: "Installation" },
  { id: "other", label: "Other" },
];

function resolveCategory(item) {
  return item.detectedCategory || "other";
}

function formatValue(val, fieldKey, label) {
  return formatAnalysisValue(val, { fieldKey, label });
}

function SystemDocumentFindingsModal({
  open,
  onClose,
  propertyId,
  systemKey,
  systemLabel,
  onSystemsUpdated,
}) {
  const [activeTab, setActiveTab] = useState("bid");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const analysis = useDocumentAnalysis(propertyId);
  const {
    status: analysisStatus,
    progress: analysisProgress,
    error: analysisError,
    result: analysisResult,
    loadResult,
    applySelected,
    rejectResult,
    reset: resetAnalysis,
  } = analysis;

  const load = useCallback(async () => {
    if (!propertyId || !systemKey) return;
    setLoading(true);
    try {
      const res = await AppApi.getDocumentAnalysisBySystem(propertyId, systemKey);
      setItems(res.items ?? []);
      setPendingItems(res.pendingItems ?? []);
      setPendingCount(res.pendingCount ?? 0);
    } catch (err) {
      console.warn("[SystemDocumentFindingsModal]", err.message);
      setItems([]);
      setPendingItems([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId, systemKey]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handler = (e) => {
      if (String(e.detail?.propertyId) === String(propertyId)) load();
    };
    window.addEventListener(DOCUMENT_ANALYSIS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(DOCUMENT_ANALYSIS_UPDATED_EVENT, handler);
  }, [open, propertyId, load]);

  useEffect(() => {
    if (!open) {
      setReviewOpen(false);
      resetAnalysis();
    }
  }, [open, resetAnalysis]);

  const allItems = useMemo(
    () => [...pendingItems, ...items],
    [items, pendingItems],
  );

  const itemsByCategory = useMemo(() => {
    const map = new Map(CATEGORY_TABS.map((tab) => [tab.id, []]));
    for (const item of allItems) {
      const cat = resolveCategory(item);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(item);
    }
    return map;
  }, [allItems]);

  const visibleTabs = useMemo(
    () => CATEGORY_TABS.filter((tab) => (itemsByCategory.get(tab.id)?.length ?? 0) > 0),
    [itemsByCategory],
  );

  useEffect(() => {
    if (!open || visibleTabs.length === 0) return;
    if (!visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [open, visibleTabs, activeTab]);

  const activeCategoryItems = itemsByCategory.get(activeTab) ?? [];
  const activePendingItems = activeCategoryItems.filter(
    (item) => item.reviewStatus === "pending_review",
  );
  const activeAppliedItems = activeCategoryItems.filter(
    (item) => item.reviewStatus !== "pending_review",
  );

  const totalCount = items.length + pendingItems.length;

  const handleReviewPending = useCallback(
    async (item) => {
      if (!item?.id) return;
      setReviewOpen(true);
      await loadResult(item.id);
    },
    [loadResult],
  );

  const handleCloseReview = useCallback(() => {
    setReviewOpen(false);
    resetAnalysis();
  }, [resetAnalysis]);

  const handleApply = useCallback(
    async (resultId, selectedFieldKeys) => {
      setApplying(true);
      try {
        await applySelected(resultId, selectedFieldKeys);
        onSystemsUpdated?.();
        setReviewOpen(false);
        resetAnalysis();
        await load();
      } finally {
        setApplying(false);
      }
    },
    [applySelected, onSystemsUpdated, load, resetAnalysis],
  );

  const handleReject = useCallback(
    async (resultId) => {
      setApplying(true);
      try {
        await rejectResult(resultId);
        setReviewOpen(false);
        resetAnalysis();
        await load();
      } finally {
        setApplying(false);
      }
    },
    [rejectResult, load, resetAnalysis],
  );

  const handleOpenDocument = useCallback(async (key) => {
    try {
      const url = await AppApi.getPresignedPreviewUrl(key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.warn("[SystemDocumentFindingsModal] preview failed:", err.message);
    }
  }, []);

  function renderFindingList(item) {
    const labelByKey = new Map(
      (item.findings || []).map((f) => [f.fieldKey || f.key, f.label]),
    );
    const fields = item.appliedFields?.length
      ? item.appliedFields
      : item.reviewFields?.length
        ? item.reviewFields
        : item.findings || [];
    return fields.map((f, i) => {
      const fieldKey = f.fieldKey || f.key;
      const label = formatFieldLabel(fieldKey, f.label || labelByKey.get(fieldKey));
      const finding = (item.findings || []).find(
        (entry) => (entry.fieldKey || entry.key) === fieldKey,
      );
      let rawValue = f.value ?? f.proposedValue;
      if (isLineItemsField(fieldKey) && finding?.value != null) {
        rawValue = finding.value;
      } else if (
        typeof rawValue === "string" &&
        rawValue.includes("[object Object]") &&
        finding?.value != null
      ) {
        rawValue = finding.value;
      }

      if (isLineItemsField(fieldKey)) {
        return (
          <li key={fieldKey || i}>
            <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
            <LineItemsList items={rawValue} />
          </li>
        );
      }

      const formattedValue = formatValue(rawValue, fieldKey, label);
      return (
        <li key={fieldKey || i} className="whitespace-pre-wrap">
          <span className="font-medium text-gray-700 dark:text-gray-300">{label}: </span>
          {formattedValue}
        </li>
      );
    });
  }

  function renderDocumentCard(item, { compact = false } = {}) {
    const isPending = item.reviewStatus === "pending_review";
    return (
      <div
        key={item.id}
        className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {item.documentName || "Document"}
          </p>
          <span
            className={`text-[10px] uppercase tracking-wide shrink-0 ${
              isPending
                ? "text-amber-600 dark:text-amber-400"
                : "text-[#456564]"
            }`}
          >
            {isPending ? "Pending review" : item.categoryLabel}
          </span>
        </div>
        <ul
          className={`space-y-1.5 text-gray-600 dark:text-gray-400 ${
            compact ? "text-xs" : "text-xs"
          }`}
        >
          {renderFindingList(item)}
        </ul>
        {isPending && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              type="button"
              onClick={() => handleReviewPending(item)}
              className="btn-sm btn-primary-outline flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Review
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <ModalBlank
        modalOpen={open}
        setModalOpen={(isOpen) => !isOpen && !reviewOpen && onClose?.()}
        contentClassName={DOCUMENT_ANALYSIS_MODAL_SHELL}
      >
        <div className={DOCUMENT_ANALYSIS_MODAL_INNER}>
          <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3 min-w-0">
              <OpsyModalIcon />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  AI document insights
                </h2>
                <p className="text-xs text-gray-500 truncate">
                  {systemLabel || systemKey}
                  {totalCount
                    ? ` · ${totalCount} document${totalCount === 1 ? "" : "s"}`
                    : ""}
                  {pendingCount > 0 ? ` · ${pendingCount} pending review` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {totalCount > 0 && visibleTabs.length > 0 && (
            <nav className="flex-shrink-0 flex border-b border-gray-200 dark:border-gray-700 px-5 overflow-x-auto">
              {visibleTabs.map((tab) => {
                const count = itemsByCategory.get(tab.id)?.length ?? 0;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? "border-[#456564] text-[#456564]"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                    {count > 0 ? ` (${count})` : ""}
                  </button>
                );
              })}
            </nav>
          )}

          <div className={DOCUMENT_ANALYSIS_MODAL_BODY}>
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-[#456564] mb-3" />
                <p className="text-sm">Loading insights…</p>
              </div>
            )}
            {!loading && totalCount === 0 && (
              <DocumentAnalysisEmptyState systemLabel={systemLabel || systemKey} />
            )}

            {!loading && totalCount > 0 && (
              <div className="space-y-4">
                {activeCategoryItems.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No documents in this category.
                  </p>
                ) : (
                  <>
                    {activePendingItems.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-2">
                          Pending review
                        </h3>
                        <div className="space-y-3">
                          {activePendingItems.map((item) => renderDocumentCard(item))}
                        </div>
                      </div>
                    )}
                    {activeAppliedItems.length > 0 && (
                      <div>
                        {activePendingItems.length > 0 && (
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                            Applied insights
                          </h3>
                        )}
                        <div className="space-y-3">
                          {activeAppliedItems.map((item) => renderDocumentCard(item))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </ModalBlank>

      <DocumentAnalysisResultsModal
        open={reviewOpen}
        onClose={handleCloseReview}
        result={analysisResult}
        status={analysisStatus}
        progress={analysisProgress}
        error={analysisError}
        systemLabel={systemLabel || systemKey}
        onApply={handleApply}
        onReject={handleReject}
        onOpenDocument={handleOpenDocument}
        applying={applying}
        backdropZClassName="z-[210]"
        dialogZClassName="z-[210]"
      />
    </>
  );
}

export default SystemDocumentFindingsModal;
