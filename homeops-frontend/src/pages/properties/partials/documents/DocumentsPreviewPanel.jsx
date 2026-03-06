import React, {useState, useEffect} from "react";
import {
  X,
  ExternalLink,
  Trash2,
  FileText,
  Folder,
  Loader2,
  AlertCircle,
  PanelRightOpen,
  PanelRightClose,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

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
 * Right panel: document preview with metadata in a side column.
 * Metadata on the left, preview takes main space.
 */
function DocumentsPreviewPanel({
  selectedDocument,
  presignedPreviewUrl,
  presignedLoading,
  presignedError,
  fetchPresignedPreview,
  InlineDocumentPreview,
  onClose,
  onOpenInNewTab,
  onDelete,
  onOpenAIReport,
  getDocumentIcon,
  getFileTypeColor,
  systemCategories = [],
  documentTypes = [],
}) {
  // Hooks must run before any early return to satisfy Rules of Hooks
  // Smaller screens: collapsed by default (more space for preview). 1440px+: open by default.
  const [metadataOpen, setMetadataOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1440px)");
    const handleChange = (e) => {
      setMetadataOpen(e.matches);
    };
    handleChange(mq); // set initial state on mount
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  if (!selectedDocument) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900/50 text-center px-6">
        <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
          No document selected
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          Select a document from the tree to preview
        </p>
      </div>
    );
  }

  const DocIcon = getDocumentIcon?.(selectedDocument.type) || FileText;
  const SystemIcon =
    systemCategories.find((sc) => sc.id === selectedDocument.system)?.icon ||
    Folder;
  const systemColor =
    systemCategories.find((sc) => sc.id === selectedDocument.system)?.color ||
    "text-gray-500";

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate pr-2 min-w-0">
          Document Preview
        </h3>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setMetadataOpen((o) => !o)}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
            title={metadataOpen ? "Hide details" : "Show details"}
          >
            {metadataOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content: on small screens metadata on top, on lg+ metadata left | preview right */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Metadata - on small: top, collapsible accordion; on lg+: left sidebar */}
        {metadataOpen ? (
          <div className="flex-shrink-0 w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50/50 dark:bg-gray-900/30 overflow-y-auto order-first lg:order-none">
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                    <DocIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words">
                    {selectedDocument.name}
                  </h4>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      getFileTypeColor?.(selectedDocument.type) ||
                      "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {documentTypes.find((dt) => dt.id === selectedDocument.type)
                      ?.label || selectedDocument.type}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 block">
                    System
                  </label>
                  <div className="flex items-center gap-2">
                    <SystemIcon className={`w-4 h-4 ${systemColor}`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {systemCategories.find(
                        (sc) => sc.id === selectedDocument.system,
                      )?.label || "General"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 block">
                    Document Date
                  </label>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {formatDate(
                      selectedDocument.document_date ||
                        selectedDocument.created_at,
                    )}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
                <button
                  onClick={() => onOpenInNewTab?.(selectedDocument)}
                  className="w-full btn-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in new tab
                </button>
                {(selectedDocument.system === "inspectionReport" ||
                  selectedDocument.type === "inspection") &&
                  onOpenAIReport && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenAIReport();
                    }}
                    className="w-full btn-sm border border-[#456564] text-[#456564] dark:border-[#5a7a78] dark:text-[#5a7a78] hover:bg-[#456564]/10 dark:hover:bg-[#5a7a78]/20 flex items-center justify-center gap-1.5"
                    title="View report analysis in AI"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Report Analysis
                  </button>
                )}
                <button
                  onClick={() => onDelete?.(selectedDocument.id)}
                  className="w-full btn-sm border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700 text-red-600 dark:text-red-400 flex items-center justify-center gap-1.5"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setMetadataOpen(false)}
                  className="lg:hidden w-full btn-sm border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center gap-1.5"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  Collapse details
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Mobile: slim collapsible "Details" bar when metadata is hidden - tap to expand */}
        {!metadataOpen && (
          <div className="lg:hidden flex-shrink-0">
            <button
              type="button"
              onClick={() => setMetadataOpen(true)}
              className="w-full px-3 py-2 flex items-center justify-between gap-2 bg-gray-50/80 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700 transition-colors"
            >
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Details
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            </button>
          </div>
        )}

        {/* Preview - main area, fills height to bottom */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {/* Compact actions when metadata collapsed - keeps Open/Delete accessible */}
          {!metadataOpen && (
            <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate min-w-0 flex-1">
                {selectedDocument.name}
              </span>
              {(selectedDocument.system === "inspectionReport" ||
                selectedDocument.type === "inspection") &&
                onOpenAIReport && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenAIReport();
                  }}
                  className="btn-sm border border-[#456564] text-[#456564] dark:border-[#5a7a78] dark:text-[#5a7a78] hover:bg-[#456564]/10 flex items-center gap-1 px-2 py-1 text-xs flex-shrink-0"
                  title="View report analysis in AI"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI
                </button>
              )}
              <button
                onClick={() => onOpenInNewTab?.(selectedDocument)}
                className="btn-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 px-2 py-1 text-xs flex-shrink-0"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open
              </button>
              <button
                onClick={() => onDelete?.(selectedDocument.id)}
                className="btn-sm border-gray-200 dark:border-gray-700 hover:border-red-300 text-red-600 dark:text-red-400 flex items-center gap-1 px-2 py-1 text-xs flex-shrink-0"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {selectedDocument.document_key && presignedLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-2" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Loading preview…
                </p>
              </div>
            ) : presignedError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {presignedError}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    fetchPresignedPreview?.(selectedDocument.document_key)
                  }
                  className="btn-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="h-full min-h-[500px]">
                <InlineDocumentPreview
                  url={
                    selectedDocument.document_key
                      ? presignedPreviewUrl
                      : selectedDocument.document_url
                  }
                  fileName={selectedDocument.name}
                  fillHeight
                  narrowerPdf
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentsPreviewPanel;
