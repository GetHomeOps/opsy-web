import React, {useState} from "react";
import {useDroppable, useDraggable} from "@dnd-kit/core";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Upload,
  PanelLeftClose,
  File,
  Plus,
  Inbox,
} from "lucide-react";

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Folder row in the tree. The whole row is a @dnd-kit droppable so users
 * can drop inbox cards (or already-filed documents) onto it.
 */
function FolderRow({
  category,
  documents,
  isExpanded,
  isSelected,
  isDropDisabled,
  dropDisabledReason,
  selectedDocumentId,
  onToggle,
  onSelectFolder,
  onSelectDocument,
  onUploadForSystem,
  documentTypes,
  getFileTypeColor,
}) {
  const Icon = category.icon || File;
  const {isOver, setNodeRef} = useDroppable({
    id: `folder:${category.id}`,
    data: {type: "folder", systemKey: category.id, label: category.label},
    disabled: isDropDisabled,
  });

  const dropHighlight = isOver
    ? isDropDisabled
      ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 ring-2 ring-red-300/40"
      : "bg-[#456654]/[0.08] dark:bg-[#456654]/20 border-[#456654]/50 ring-2 ring-[#456654]/30"
    : "border-transparent";

  return (
    <div className="mb-1">
      <div
        ref={setNodeRef}
        onClick={() => onSelectFolder?.(category.id)}
        className={`group flex items-center gap-2 px-2 py-2.5 rounded-lg cursor-pointer transition-all border-2 ${dropHighlight} ${
          isSelected
            ? "bg-[#456654]/[0.06] dark:bg-[#456654]/15"
            : "hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
        title={isDropDisabled && isOver ? dropDisabledReason : undefined}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex-shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>
        <Icon
          className={`w-4 h-4 flex-shrink-0 ${category.color || "text-gray-500"}`}
        />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">
          {category.label}
        </span>
        {documents.length > 0 && (
          <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {documents.length}
          </span>
        )}
        {isOver && !isDropDisabled && (
          <span className="text-[10px] font-medium text-[#3a5548] dark:text-[#a8c0b4] bg-[#456654]/15 dark:bg-[#456654]/30 px-1.5 py-0.5 rounded">
            Drop
          </span>
        )}
        {onUploadForSystem && !isOver && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isDropDisabled) onUploadForSystem(category.id);
            }}
            disabled={isDropDisabled}
            className="p-1 rounded-md text-gray-400 opacity-0 group-hover:opacity-100 hover:text-[#456654] hover:bg-[#456654]/10 dark:hover:bg-[#456654]/20 disabled:opacity-40 disabled:pointer-events-none transition-opacity"
            title={
              isDropDisabled
                ? dropDisabledReason
                : `Upload to ${category.label}`
            }
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="ml-7 pl-2 mt-1 space-y-1">
          {documents.length > 0 ? (
            documents.map((doc) => (
              <FiledDocumentRow
                key={doc.id}
                doc={doc}
                isSelected={selectedDocumentId === doc.id}
                onSelect={onSelectDocument}
                documentTypes={documentTypes}
                getFileTypeColor={getFileTypeColor}
              />
            ))
          ) : (
            <div className="px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500 italic border border-dashed border-gray-200 dark:border-gray-700 rounded-md">
              No documents — drop files here
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A single filed document row inside an expanded folder. Both clickable
 * (open in preview) and draggable (move to another folder).
 */
function FiledDocumentRow({doc, isSelected, onSelect, documentTypes, getFileTypeColor}) {
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `filed:${doc.id}`,
    data: {type: "filed", documentId: doc.id, currentSystemKey: doc.system},
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect?.(doc)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors border ${
        isDragging ? "opacity-40" : ""
      } ${
        isSelected
          ? "bg-slate-100/90 dark:bg-slate-700/40 border-slate-400/60 dark:border-slate-500/50"
          : "border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div
          className={`text-xs font-medium truncate ${
            isSelected
              ? "text-slate-800 dark:text-slate-100"
              : "text-gray-800 dark:text-gray-200"
          }`}
        >
          {doc.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className={`text-[10px] px-1 py-0.5 rounded ${
              getFileTypeColor?.(doc.type) ||
              "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {documentTypes.find((dt) => dt.id === doc.type)?.label || doc.type}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
            {formatDate(doc.document_date || doc.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Inbox row pinned at the top of the tree. Acts as a drop target so users can
 *  also "unfile" by dragging a doc here (kept simple: just navigates the user
 *  to the inbox view, doesn't actually unfile). */
function InboxRow({count, isSelected, onSelect}) {
  return (
    <div
      onClick={() => onSelect?.()}
      className={`flex items-center gap-2 px-2 py-2.5 rounded-lg cursor-pointer transition-colors border-2 border-transparent mb-2 ${
        isSelected
          ? "bg-[#456654]/[0.08] dark:bg-[#456654]/15"
          : "hover:bg-gray-100 dark:hover:bg-gray-700"
      }`}
    >
      <Inbox
        className={`w-4 h-4 ${
          isSelected
            ? "text-[#456654] dark:text-[#7a9a88]"
            : "text-gray-500"
        }`}
      />
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">
        Inbox
      </span>
      {count > 0 && (
        <span className="text-[10px] font-medium text-[#3a5548] dark:text-[#a8c0b4] bg-[#456654]/15 dark:bg-[#456654]/30 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * Tree view for documents organized by system, with drag-and-drop targets.
 *
 * Each system row is a droppable; dropping inbox cards or filed documents
 * onto a row fires `onDrop({systemKey, payload})`. The actual drop dispatch
 * is handled by `<DndContext>` higher up — this component only renders.
 */
function DocumentsTreeView({
  systemsToShow = [],
  documentTypes = [],
  documentsBySystem = {},
  selectedDocumentId,
  selectedFolderId,
  inboxCount = 0,
  inboxSelected = false,
  onSelectInbox,
  searchQuery,
  setSearchQuery,
  onSelectDocument,
  onSelectFolder,
  onUpload,
  onUploadForSystem,
  systemUploadDisabledIds = [],
  onCollapse,
  getFileTypeColor,
}) {
  const [expandedSystems, setExpandedSystems] = useState(() => {
    const initial = {};
    systemsToShow.forEach((cat) => {
      const docs = documentsBySystem[cat.id] || [];
      if (docs.length > 0) initial[cat.id] = true;
    });
    return initial;
  });

  const totalCount = Object.values(documentsBySystem).flat().length;

  const toggleSystem = (systemId) => {
    setExpandedSystems((prev) => ({
      ...prev,
      [systemId]: !prev[systemId],
    }));
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Folders
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {totalCount}
            </span>
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#456654] focus:border-transparent"
          />
        </div>

        <button
          onClick={onUpload}
          className="w-full btn-sm bg-[#456654] hover:bg-[#3a5548] text-white flex items-center justify-center gap-1.5 py-2"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <InboxRow
          count={inboxCount}
          isSelected={inboxSelected}
          onSelect={onSelectInbox}
        />

        {systemsToShow.map((category) => {
          const categoryDocs = documentsBySystem[category.id] || [];
          const isExpanded = expandedSystems[category.id] ?? true;
          const disabled = systemUploadDisabledIds.includes(category.id);
          const disabledReason = disabled
            ? "This property already has an inspection report"
            : null;
          return (
            <FolderRow
              key={category.id}
              category={category}
              documents={categoryDocs}
              isExpanded={isExpanded}
              isSelected={selectedFolderId === category.id}
              isDropDisabled={disabled}
              dropDisabledReason={disabledReason}
              selectedDocumentId={selectedDocumentId}
              onToggle={() => toggleSystem(category.id)}
              onSelectFolder={onSelectFolder}
              onSelectDocument={onSelectDocument}
              onUploadForSystem={onUploadForSystem}
              documentTypes={documentTypes}
              getFileTypeColor={getFileTypeColor}
            />
          );
        })}
      </div>
    </div>
  );
}

export default DocumentsTreeView;
