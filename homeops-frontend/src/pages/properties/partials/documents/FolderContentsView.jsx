import React from "react";
import {useDroppable} from "@dnd-kit/core";
import {ArrowLeft, Plus, FileText} from "lucide-react";
import DocumentPreviewCard from "./DocumentPreviewCard";

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
                <DocumentPreviewCard
                  enableDrag
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
