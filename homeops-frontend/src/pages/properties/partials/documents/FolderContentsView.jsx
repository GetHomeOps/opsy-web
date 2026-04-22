import React from "react";
import {useDraggable, useDroppable} from "@dnd-kit/core";
import {
  ArrowLeft,
  Plus,
  FileText,
  ExternalLink,
  Trash2,
} from "lucide-react";
import {DocumentThumbContent} from "./documentThumbnailShared";

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Filed-document preview card. Visually mirrors the InboxFileCard:
 * tall thumbnail on top, name + type/date metadata below. Hovering reveals
 * "open in new tab" / "delete" actions in the corner of the thumbnail.
 *
 * Drag source: filed:list — drop on another folder row to move.
 */
function FolderDocumentCard({
  doc,
  isSelected,
  onSelect,
  onOpenInNewTab,
  onDelete,
  documentTypes,
  getFileTypeColor,
}) {
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `filed-list:${doc.id}`,
    data: {type: "filed", documentId: doc.id, currentSystemKey: doc.system},
  });

  const ringClass = isSelected
    ? "ring-2 ring-[#456654]/60 border-[#456654]"
    : "border-gray-200 dark:border-gray-700";

  const dragClass = isDragging ? "opacity-30" : "";

  const typeLabel =
    documentTypes.find((dt) => dt.id === doc.type)?.label || doc.type;
  const typeBadgeClass =
    getFileTypeColor?.(doc.type) ||
    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border ${ringClass} ${dragClass} transition-all overflow-hidden shadow-sm hover:shadow-md`}
      style={{width: 220, minHeight: 260}}
    >
      {/* Thumbnail / drag handle */}
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(doc);
        }}
        className="relative h-44 flex items-center justify-center bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-hidden cursor-grab active:cursor-grabbing"
      >
        <DocumentThumbContent
          name={doc.name}
          documentKey={doc.document_key}
          fetchEnabled={!!doc.document_key}
        />

        {/* Hover actions */}
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInNewTab?.(doc);
            }}
            className="p-1 rounded-md bg-white/90 dark:bg-gray-900/80 text-gray-600 hover:text-[#456654] hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-sm transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(doc.id);
            }}
            className="p-1 rounded-md bg-white/90 dark:bg-gray-900/80 text-gray-500 hover:text-red-600 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-sm transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="p-2.5 flex-1 flex flex-col gap-1.5 min-h-0 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(doc);
        }}
      >
        <div
          className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate"
          title={doc.name}
        >
          {doc.name}
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${typeBadgeClass}`}>
            {typeLabel}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {formatDate(doc.document_date || doc.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Browse-by-folder view: shows the contents of one selected folder as a
 * grid of preview cards. Acts as a drop target so users can also drop
 * inbox cards or other folders' files in here.
 */
function FolderContentsView({
  folder,
  documents,
  onBack,
  onUploadForSystem,
  onSelectDocument,
  selectedDocumentId,
  onOpenInNewTab,
  onDelete,
  documentTypes,
  getFileTypeColor,
  isUploadDisabled,
  uploadDisabledReason,
}) {
  const {isOver, setNodeRef} = useDroppable({
    id: `folder-pane:${folder.id}`,
    data: {type: "folder", systemKey: folder.id, label: folder.label},
    disabled: isUploadDisabled,
  });

  const Icon = folder.icon || FileText;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-full bg-gray-50 dark:bg-gray-900/30 transition-colors ${
        isOver
          ? isUploadDisabled
            ? "bg-red-50 dark:bg-red-900/20"
            : "bg-[#456654]/[0.06] dark:bg-[#456654]/10"
          : ""
      }`}
    >
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          title="Back to inbox"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Icon className={`w-4 h-4 ${folder.color || "text-gray-500"}`} />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1">
          {folder.label}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {documents.length} file{documents.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => onUploadForSystem?.(folder.id)}
          disabled={isUploadDisabled}
          className="btn-sm bg-[#456654] hover:bg-[#3a5548] text-white text-xs flex items-center gap-1 disabled:opacity-50"
          title={isUploadDisabled ? uploadDisabledReason : `Upload to ${folder.label}`}
        >
          <Plus className="w-3.5 h-3.5" /> Upload here
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {documents.length === 0 ? (
          <div
            className={`max-w-2xl mx-auto h-full min-h-[200px] flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-center px-6 transition-colors ${
              isOver && !isUploadDisabled
                ? "border-[#456654]/50 bg-[#456654]/[0.06] dark:bg-[#456654]/15"
                : "border-gray-300 dark:border-gray-700"
            }`}
          >
            <Icon
              className={`w-10 h-10 mb-3 ${folder.color || "text-gray-400"}`}
            />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              No documents in {folder.label} yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Drop a file here or use Upload here above
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="flex justify-center">
                <FolderDocumentCard
                  doc={doc}
                  isSelected={selectedDocumentId === doc.id}
                  onSelect={onSelectDocument}
                  onOpenInNewTab={onOpenInNewTab}
                  onDelete={onDelete}
                  documentTypes={documentTypes}
                  getFileTypeColor={getFileTypeColor}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FolderContentsView;
