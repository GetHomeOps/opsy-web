import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import SectionCard from "../passport/SectionCard";
import EmptyStateCard from "../passport/EmptyStateCard";
import { StatusBadge } from "../passport/StatusBadge";
import AppApi from "../../../../api/api";

const DOCUMENT_TYPE_LABELS = {
  inspection: "Inspection",
  receipt: "Receipt",
  warranty: "Warranty",
  manual: "Manual",
  invoice: "Invoice",
  other: "Other",
};

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

export function SystemDocumentsTab({
  systemLabel,
  documents = [],
  aiInsightCount = 0,
  onUploadDocument,
  onOpenDocumentFindings,
}) {
  const [openingKey, setOpeningKey] = useState(null);

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
      <SectionCard flat title="Documents" icon={FileText}>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
          {documents.length} document{documents.length !== 1 ? "s" : ""} filed
          under {systemLabel ?? "this system"} in the Documents tab.
        </p>
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-neutral-200/80 dark:border-neutral-700/50 overflow-hidden">
          {documents.map((doc) => {
            const key = doc.document_key ?? doc.documentKey;
            const isOpening = openingKey === key;
            const Icon = isImageDocument(doc) ? ImageIcon : FileText;
            return (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => handleOpenDocument(doc)}
                  disabled={!key || isOpening}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors disabled:opacity-60"
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
              </li>
            );
          })}
        </ul>
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
