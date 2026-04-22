import React from "react";
import {useDraggable} from "@dnd-kit/core";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  RotateCw,
} from "lucide-react";
import {DocumentThumbContent} from "./documentThumbnailShared";

function formatBytes(n) {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function CardThumbnail({card}) {
  return (
    <DocumentThumbContent
      name={card.name}
      mimeType={card.mimeType}
      documentKey={card.documentKey}
      localPreviewUrl={card.previewUrl}
      fetchEnabled={card.status === "uploaded" && !!card.documentKey}
    />
  );
}

/**
 * One staged document card. Drag source for @dnd-kit (drop on a folder row
 * to file). Has inline metadata edits; clicking the card toggles selection
 * for bulk actions.
 */
function InboxFileCard({
  card,
  selected,
  onToggleSelect,
  onRemove,
  onRetry,
  onPatchProposed,
  onFile,
  systemsToShow,
  documentTypes,
  systemUploadDisabledIds = [],
}) {
  // Cards that haven't finished uploading aren't draggable yet
  const dndDisabled = !card.id || card.status !== "uploaded";

  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `inbox:${card.clientId}`,
    data: {type: "inbox", clientId: card.clientId, cardId: card.id},
    disabled: dndDisabled,
  });

  const ringClass = selected
    ? "ring-2 ring-[#456654]/60 border-[#456654]"
    : card.status === "error"
      ? "border-red-300 dark:border-red-700"
      : "border-gray-200 dark:border-gray-700";

  const dragClass = isDragging ? "opacity-30" : "";

  const isReady = card.status === "uploaded";
  const proposedSystem = card.proposed.system_key || "";
  const proposedType = card.proposed.document_type || "";
  const canFileNow =
    isReady &&
    proposedSystem &&
    proposedType &&
    card.proposed.document_name?.trim() &&
    card.proposed.document_date;

  return (
    <div
      ref={setNodeRef}
      className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border ${ringClass} ${dragClass} transition-all overflow-hidden shadow-sm hover:shadow-md`}
      style={{width: 220, minHeight: 300}}
    >
      {/* Drag handle / preview region */}
      <div
        {...(isReady ? {...attributes, ...listeners} : {})}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect?.(card.clientId, e.shiftKey || e.metaKey || e.ctrlKey);
        }}
        className={`relative h-44 flex items-center justify-center bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-hidden ${
          isReady ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
      >
        <CardThumbnail card={card} />

        {/* Status badge */}
        <div className="absolute top-1.5 left-1.5 z-10">
          {card.status === "queued" && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/90 dark:bg-gray-900/80 text-gray-600 dark:text-gray-300 backdrop-blur-sm shadow-sm">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Queued
            </span>
          )}
          {card.status === "uploading" && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/90 dark:bg-gray-900/80 text-[#456654] dark:text-[#7a9a88] backdrop-blur-sm shadow-sm">
              <Loader2 className="w-2.5 h-2.5 animate-spin" /> {card.progress}%
            </span>
          )}
          {card.status === "uploaded" && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/90 dark:bg-gray-900/80 text-[#456654] dark:text-[#7a9a88] backdrop-blur-sm shadow-sm">
              <CheckCircle2 className="w-2.5 h-2.5" /> Ready
            </span>
          )}
          {card.status === "error" && (
            <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/90 dark:bg-gray-900/80 text-red-600 dark:text-red-300 backdrop-blur-sm shadow-sm">
              <AlertCircle className="w-2.5 h-2.5" /> Error
            </span>
          )}
        </div>
        {/* Remove button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(card.clientId);
          }}
          className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md bg-white/90 dark:bg-gray-900/80 text-gray-500 hover:text-red-600 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-sm transition-colors"
          title="Remove from inbox"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-2.5 flex-1 flex flex-col gap-1.5 min-h-0">
        <div
          className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate"
          title={card.name}
        >
          {card.name}
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400">
          {formatBytes(card.sizeBytes)}
          {card.mimeType ? ` · ${card.mimeType.split("/")[1]?.toUpperCase()}` : ""}
        </div>

        {card.status === "uploading" && (
          <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-1">
            <div
              className="h-full bg-[#456654] transition-all"
              style={{width: `${card.progress}%`}}
            />
          </div>
        )}

        {card.status === "error" && (
          <div className="text-[10px] text-red-600 dark:text-red-400 leading-tight">
            {card.error || "Upload failed"}
            {onRetry && card.file && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(card.clientId);
                }}
                className="ml-1 inline-flex items-center gap-0.5 underline font-medium"
              >
                <RotateCw className="w-2.5 h-2.5" /> Retry
              </button>
            )}
          </div>
        )}

        {/* Inline edit controls — shown once uploaded */}
        {isReady && (
          <div className="mt-auto pt-1 space-y-1">
            <select
              value={proposedSystem}
              onChange={(e) =>
                onPatchProposed?.(card.clientId, {system_key: e.target.value})
              }
              className="form-select w-full text-[11px] py-1 px-1.5 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Pick folder…</option>
              {systemsToShow.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                  disabled={systemUploadDisabledIds.includes(s.id)}
                >
                  {s.label}
                  {systemUploadDisabledIds.includes(s.id) ? " (full)" : ""}
                </option>
              ))}
            </select>
            <select
              value={proposedType}
              onChange={(e) =>
                onPatchProposed?.(card.clientId, {document_type: e.target.value})
              }
              className="form-select w-full text-[11px] py-1 px-1.5 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Pick type…</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (canFileNow) onFile?.(card.clientId);
              }}
              disabled={!canFileNow}
              className={`w-full text-[11px] font-medium py-1 rounded transition-colors ${
                canFileNow
                  ? "bg-[#456654] hover:bg-[#3a5548] text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
              }`}
              title={
                canFileNow
                  ? "File this document"
                  : "Choose folder + type first"
              }
            >
              File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default InboxFileCard;
