import React, { useCallback, useState } from "react";
import {
  FileText,
  Sparkles,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  ScanText,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import EmptyStateCard from "../passport/EmptyStateCard";
import { StatusBadge } from "../passport/StatusBadge";
import AppApi from "../../../../api/api";
import { useDocumentAnalysisStatus } from "../../../../hooks/useDocumentAnalysisStatus";
import {
  emitRequestDocumentAnalysis,
  emitReopenDocumentAnalysis,
  isLikelyInspectionReport,
} from "../../helpers/documentAnalysisFlow";
import DocumentPreviewCard from "../documents/DocumentPreviewCard";
import DocumentsViewToggle, {
  useDocumentsViewMode,
} from "../documents/DocumentsViewToggle";

const DOCUMENT_TYPE_LABELS = {
  inspection: "Inspection",
  receipt: "Receipt",
  warranty: "Warranty",
  manual: "Manual",
  invoice: "Invoice",
  other: "Other",
};

const SYSTEM_DOCUMENT_TYPES = Object.entries(DOCUMENT_TYPE_LABELS).map(
  ([id, label]) => ({ id, label }),
);

const FILE_TYPE_COLORS = {
  inspection:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  receipt:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  warranty:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  manual: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  invoice:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

function getFileTypeColor(type) {
  return FILE_TYPE_COLORS[type] || FILE_TYPE_COLORS.other;
}

function toPreviewDoc(doc) {
  return {
    id: doc.id,
    name: doc.document_name || "Untitled document",
    type: String(doc.document_type ?? "other").toLowerCase(),
    document_key: doc.document_key ?? doc.documentKey,
    document_date: doc.document_date,
    created_at: doc.created_at,
    system: doc.system_key,
  };
}

function formatDocumentDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function documentTypeLabel(type) {
  const key = String(type ?? "other").toLowerCase();
  return DOCUMENT_TYPE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function isImageDocument(doc) {
  const ref = String(doc.document_key ?? doc.document_name ?? "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].some((ext) =>
    ref.endsWith(ext),
  );
}

function AnalyzeButton({ analysisState, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={analysisState.disabled}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-neutral-200 dark:border-neutral-700 text-[#456564] hover:border-[#456564]/50 disabled:opacity-60 whitespace-nowrap"
      title={analysisState.title || analysisState.label}
    >
      {analysisState.analyzing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <ScanText className="w-3.5 h-3.5" />
      )}
      {analysisState.label}
    </button>
  );
}

export function SystemDocumentsTab({
  systemLabel,
  documents = [],
  aiInsightCount = 0,
  onUploadDocument,
  onOpenDocumentFindings,
  propertyId,
}) {
  const [openingKey, setOpeningKey] = useState(null);
  const [viewMode, setViewMode] = useDocumentsViewMode();
  const { getUiState, getAnalysisItem } = useDocumentAnalysisStatus(propertyId);

  const handleOpenDocument = async (doc) => {
    const key = doc.document_key ?? doc.documentKey;
    if (!key) return;
    setOpeningKey(key);
    try {
      const url = await AppApi.getPresignedPreviewUrl(key);
      if (url) window.open(url, "_blank", "noopener");
    } catch {
      // Preview unavailable
    } finally {
      setOpeningKey(null);
    }
  };

  const handleAnalyzeDocument = useCallback(
    (event, doc) => {
      event.preventDefault();
      event.stopPropagation();
      if (!propertyId || !doc) return;
      const analysisItem = getAnalysisItem(doc.id);
      const uiState = getUiState(doc.id);
      if (uiState.action === "reopen") {
        emitReopenDocumentAnalysis(propertyId, doc, analysisItem);
      } else if (!uiState.disabled) {
        emitRequestDocumentAnalysis(propertyId, doc);
      }
    },
    [propertyId, getAnalysisItem, getUiState],
  );

  if (documents.length === 0) {
    return (
      <EmptyStateCard
        title="No documents yet"
        description={`Upload inspection reports, warranties, or photos related to ${systemLabel ?? "this system"}.`}
        actionLabel="Upload document"
        onAction={onUploadDocument}
        icon={FileText}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard
        flat
        title="Documents"
        icon={FileText}
        action={
          <DocumentsViewToggle
            viewMode={viewMode}
            onChange={setViewMode}
            size="sm"
          />
        }
      >
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          {documents.length} document{documents.length !== 1 ? "s" : ""} filed
          under {systemLabel ?? "this system"} in the Documents tab.
        </p>
        {viewMode === "grid" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {documents.map((doc) => {
              const analysisState = getUiState(doc.id);
              const showAnalyze =
                propertyId &&
                analysisState.showAnalyze &&
                !isLikelyInspectionReport(doc);
              return (
                <div key={doc.id} className="flex justify-center">
                  <DocumentPreviewCard
                    doc={toPreviewDoc(doc)}
                    onSelect={() => handleOpenDocument(doc)}
                    onOpenInNewTab={() => handleOpenDocument(doc)}
                    documentTypes={SYSTEM_DOCUMENT_TYPES}
                    getFileTypeColor={getFileTypeColor}
                    footer={
                      showAnalyze ? (
                        <AnalyzeButton
                          analysisState={analysisState}
                          onClick={(event) => handleAnalyzeDocument(event, doc)}
                        />
                      ) : null
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-neutral-200/80 dark:border-neutral-700/50 overflow-hidden">
            {documents.map((doc) => {
              const key = doc.document_key ?? doc.documentKey;
              const isOpening = openingKey === key;
              const Icon = isImageDocument(doc) ? ImageIcon : FileText;
              const analysisState = getUiState(doc.id);
              const showAnalyze =
                propertyId &&
                analysisState.showAnalyze &&
                !isLikelyInspectionReport(doc);
              return (
                <li key={doc.id} className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => handleOpenDocument(doc)}
                    disabled={!key || isOpening}
                    className="min-w-0 flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors disabled:opacity-60"
                  >
                    <Icon className="w-4 h-4 text-[#456564] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                        {doc.document_name || "Untitled document"}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Added {formatDocumentDate(doc.document_date ?? doc.created_at)}
                      </p>
                    </div>
                    <StatusBadge tone="neutral" className="shrink-0 capitalize">
                      {documentTypeLabel(doc.document_type)}
                    </StatusBadge>
                    {isOpening ? (
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-400 shrink-0" />
                    ) : (
                      <ExternalLink className="w-4 h-4 text-neutral-400 shrink-0" />
                    )}
                  </button>
                  {showAnalyze && (
                    <div className="flex items-center pr-3">
                      <AnalyzeButton
                        analysisState={analysisState}
                        onClick={(event) => handleAnalyzeDocument(event, doc)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {aiInsightCount > 0 && (
        <SectionCard flat title="Document Insights" icon={Sparkles}>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            {aiInsightCount} document{aiInsightCount !== 1 ? "s" : ""} with
            AI-extracted insights for this system.
          </p>
          {onOpenDocumentFindings && (
            <button
              type="button"
              onClick={onOpenDocumentFindings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-primary transition-colors"
            >
              View document findings
            </button>
          )}
        </SectionCard>
      )}

      {onUploadDocument && (
        <button
          type="button"
          onClick={onUploadDocument}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50"
        >
          Upload another document
        </button>
      )}
    </div>
  );
}
