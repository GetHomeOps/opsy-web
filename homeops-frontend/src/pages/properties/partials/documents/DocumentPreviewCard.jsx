import React from "react";
import {useDraggable} from "@dnd-kit/core";
import {ExternalLink, Trash2} from "lucide-react";
import {DocumentThumbContent} from "./documentThumbnailShared";

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DocumentPreviewCardInner({
  doc,
  isSelected,
  onSelect,
  onOpenInNewTab,
  onDelete,
  documentTypes = [],
  getFileTypeColor,
  footer,
  setNodeRef,
  dragAttributes,
  dragListeners,
  isDragging = false,
  enableDrag = false,
}) {
  const ringClass = isSelected
    ? "ring-2 ring-[#456654]/60 border-[#456654]"
    : "border-gray-200 dark:border-gray-700";

  const dragClass = isDragging ? "opacity-30" : "";

  const typeLabel =
    documentTypes.find((dt) => dt.id === doc.type)?.label ||
    doc.type ||
    "Other";
  const typeBadgeClass =
    getFileTypeColor?.(doc.type) ||
    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";

  const showHoverActions = onOpenInNewTab || onDelete;
  const footerCursor = enableDrag
    ? "cursor-grab active:cursor-grabbing"
    : "cursor-pointer";

  const handleSelect = (e) => {
    e.stopPropagation();
    onSelect?.(doc);
  };

  return (
    <div
      ref={setNodeRef}
      className={`group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border ${ringClass} ${dragClass} transition-all overflow-hidden shadow-sm hover:shadow-md`}
      style={{width: 220, minHeight: 260}}
    >
      <div className="relative h-44 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-hidden">
        <div
          className="absolute inset-0 overflow-y-auto overscroll-contain"
          onClick={handleSelect}
        >
          <DocumentThumbContent
            name={doc.name}
            documentKey={doc.document_key}
            fetchEnabled={!!doc.document_key}
          />
        </div>

        {showHoverActions && (
          <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onOpenInNewTab && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenInNewTab(doc);
                }}
                className="p-1 rounded-md bg-white/90 dark:bg-gray-900/80 text-gray-600 hover:text-[#456654] hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-sm transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(doc.id);
                }}
                className="p-1 rounded-md bg-white/90 dark:bg-gray-900/80 text-gray-500 hover:text-red-600 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-sm transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        {...(enableDrag ? {...dragAttributes, ...dragListeners} : {})}
        className={`p-2.5 flex-1 flex flex-col gap-1.5 min-h-0 ${footerCursor}`}
        onClick={handleSelect}
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
        {footer ? <div onClick={(e) => e.stopPropagation()}>{footer}</div> : null}
      </div>
    </div>
  );
}

function DraggableDocumentPreviewCard(props) {
  const {doc} = props;
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `filed-list:${doc.id}`,
    data: {
      type: "filed",
      documentId: doc.id,
      currentSystemKey: doc.system,
      label: doc.name || doc.document_name || "Document",
    },
  });

  return (
    <DocumentPreviewCardInner
      {...props}
      enableDrag
      setNodeRef={setNodeRef}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
    />
  );
}

/**
 * Filed-document preview card. Visually mirrors InboxFileCard: tall thumbnail
 * on top, name + type/date below. Optional drag, hover actions, and footer.
 */
function DocumentPreviewCard({enableDrag = false, ...props}) {
  if (enableDrag) {
    return <DraggableDocumentPreviewCard {...props} />;
  }
  return <DocumentPreviewCardInner {...props} />;
}

export default DocumentPreviewCard;
