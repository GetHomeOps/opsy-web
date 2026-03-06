import React, {useState} from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Upload,
  PanelLeftClose,
  File,
  FileText,
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
 * Tree view for documents organized by system.
 * Systems as parent nodes, documents nested underneath.
 * Only shows selected systems (same as Maintenance tab).
 */
function DocumentsTreeView({
  systemsToShow = [],
  documentTypes = [],
  documentsBySystem = {},
  selectedDocumentId,
  searchQuery,
  setSearchQuery,
  onSelectDocument,
  onUpload,
  onCollapse,
  getDocumentIcon,
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
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Documents
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
              {totalCount} document{totalCount !== 1 ? "s" : ""}
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

        {/* Search */}
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

        {/* Upload button */}
        <button
          onClick={onUpload}
          className="w-full btn-sm bg-[#456654] hover:bg-[#3a5548] text-white flex items-center justify-center gap-1.5 py-2"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto p-2">
        {systemsToShow.map((category) => {
          const categoryDocs = documentsBySystem[category.id] || [];
          const Icon = category.icon || File;
          const isExpanded = expandedSystems[category.id] ?? true;

          return (
            <div key={category.id} className="mb-1">
              {/* System header */}
              <div
                className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => toggleSystem(category.id)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSystem(category.id);
                  }}
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
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
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">
                  {category.label}
                </span>
                {categoryDocs.length > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    {categoryDocs.length}
                  </span>
                )}
              </div>

              {/* Documents list */}
              {isExpanded && (
                <div className="ml-8 pl-2 mt-1 space-y-1">
                  {categoryDocs.length > 0 ? (
                    categoryDocs.map((doc) => {
                      const isSelected = selectedDocumentId === doc.id;
                      const DocIcon = getDocumentIcon?.(doc.type) || FileText;
                      return (
                        <div
                          key={doc.id}
                          onClick={() => onSelectDocument?.(doc)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                            isSelected
                              ? "bg-slate-100/90 dark:bg-slate-700/40 border-slate-400/60 dark:border-slate-500/50"
                              : "border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          <DocIcon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div
                              className={`text-sm font-medium truncate ${
                                isSelected
                                  ? "text-slate-800 dark:text-slate-100"
                                  : "text-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {doc.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  getFileTypeColor?.(doc.type) ||
                                  "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                                }`}
                              >
                                {documentTypes.find((dt) => dt.id === doc.type)
                                  ?.label || doc.type}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDate(
                                  doc.document_date || doc.created_at
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
                      No documents
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DocumentsTreeView;
