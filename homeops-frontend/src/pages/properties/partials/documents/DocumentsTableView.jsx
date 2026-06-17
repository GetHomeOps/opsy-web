import React, {useEffect, useMemo, useState} from "react";
import {useDraggable} from "@dnd-kit/core";
import {
  Search,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Minus,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";

const PAGE_SIZE = 8;

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

function isImageDoc(doc) {
  const ref = (doc.document_key || doc.name || "").toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => ref.endsWith(ext));
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AiExtractionBadge({status, errorMessage}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Complete
      </span>
    );
  }
  if (status === "processing" || status === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Processing
      </span>
    );
  }
  if (status === "failed") {
    return (
      <div className="max-w-[14rem]">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
          title={errorMessage || "Analysis failed"}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Failed
        </span>
        {errorMessage ? (
          <p className="text-[10px] leading-snug text-red-600/90 dark:text-red-400/90 mt-0.5 line-clamp-2">
            {errorMessage}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
      <Minus className="w-3.5 h-3.5" />
      Not run
    </span>
  );
}

/** Draggable table row — same dnd data contract as the old tree rows so
 *  documents can still be dragged onto sidebar folders to move them. */
function DocumentRow({
  doc,
  documentTypes,
  getFileTypeColor,
  analysisStatus,
  analysisErrorMessage,
  onSelect,
  onOpenInNewTab,
  onDelete,
}) {
  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `filed:${doc.id}`,
    data: {type: "filed", documentId: doc.id, currentSystemKey: doc.system},
  });

  const FileIcon = isImageDoc(doc) ? ImageIcon : FileText;
  const typeLabel =
    documentTypes.find((t) => t.id === doc.type)?.label || doc.type || "Other";

  return (
    <tr
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect?.(doc)}
      className={`group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center shrink-0">
            <FileIcon className="w-4 h-4 text-[#456654] dark:text-[#7a9a88]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {doc.name}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              Uploaded {formatDate(doc.created_at || doc.document_date)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded ${
            getFileTypeColor?.(doc.type) ||
            "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
          }`}
        >
          {typeLabel}
        </span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <AiExtractionBadge
          status={analysisStatus}
          errorMessage={analysisErrorMessage}
        />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {formatDate(doc.document_date || doc.created_at)}
        </span>
      </td>
      <td className="px-2 py-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInNewTab?.(doc);
            }}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
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
            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            title="Delete document"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/**
 * Paginated document table: Name / Type / AI Extraction / Added.
 * Rows open the preview panel on click and remain draggable onto folders.
 */
function DocumentsTableView({
  title = "All Documents",
  documents = [],
  documentTypes = [],
  getFileTypeColor,
  getAnalysisStatus,
  getAnalysisErrorMessage,
  onSelectDocument,
  onOpenInNewTab,
  onDelete,
  searchQuery = "",
  setSearchQuery,
  selectedType = "all",
  setSelectedType,
  onUploadClick,
}) {
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);

  const sortedDocuments = useMemo(() => {
    const docs = [...documents];
    const dateOf = (d) =>
      new Date(d.document_date || d.created_at || 0).getTime() || 0;
    if (sortOrder === "newest") docs.sort((a, b) => dateOf(b) - dateOf(a));
    else if (sortOrder === "oldest") docs.sort((a, b) => dateOf(a) - dateOf(b));
    else if (sortOrder === "name")
      docs.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return docs;
  }, [documents, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(sortedDocuments.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [documents.length, searchQuery, selectedType, sortOrder, title]);

  const safePage = Math.min(page, pageCount);
  const pageDocs = sortedDocuments.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const rangeStart =
    sortedDocuments.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, sortedDocuments.length);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Header: title + search + filters */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 mr-auto">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {sortedDocuments.length} document
              {sortedDocuments.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents…"
              value={searchQuery}
              onChange={(e) => setSearchQuery?.(e.target.value)}
              className="w-44 sm:w-56 pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#456654] focus:border-transparent"
            />
          </div>
          {setSelectedType && (
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="form-select text-sm bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1.5"
            >
              <option value="all">All Types</option>
              {documentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="form-select text-sm bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-8 py-1.5"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {pageDocs.length > 0 ? (
          <table className="w-full table-auto">
            <thead className="sticky top-0 bg-gray-50/95 dark:bg-gray-900/80 backdrop-blur-sm text-[10px] uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">
                  AI Extraction
                </th>
                <th className="px-4 py-2.5 text-left font-semibold hidden lg:table-cell">
                  Added
                </th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {pageDocs.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  documentTypes={documentTypes}
                  getFileTypeColor={getFileTypeColor}
                  analysisStatus={getAnalysisStatus?.(doc.id)}
                  analysisErrorMessage={getAnalysisErrorMessage?.(doc.id)}
                  onSelect={onSelectDocument}
                  onOpenInNewTab={onOpenInNewTab}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              No documents found
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
              {searchQuery || selectedType !== "all"
                ? "Try adjusting your search or filters."
                : "Upload inspection reports, warranties, receipts and manuals to build your property records."}
            </p>
            {onUploadClick && !searchQuery && selectedType === "all" && (
              <button
                type="button"
                onClick={onUploadClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#456654] hover:bg-[#3a5548] text-white transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Document
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination footer */}
      {sortedDocuments.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {rangeStart} to {rangeEnd} of {sortedDocuments.length}{" "}
            document{sortedDocuments.length === 1 ? "" : "s"}
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({length: pageCount}, (_, i) => i + 1)
                .filter(
                  (n) =>
                    pageCount <= 7 ||
                    n === 1 ||
                    n === pageCount ||
                    Math.abs(n - safePage) <= 1,
                )
                .map((n, idx, arr) => (
                  <React.Fragment key={n}>
                    {idx > 0 && arr[idx - 1] !== n - 1 && (
                      <span className="px-1 text-xs text-gray-400">…</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPage(n)}
                      className={`min-w-[1.75rem] px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                        n === safePage
                          ? "bg-[#456654] text-white"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {n}
                    </button>
                  </React.Fragment>
                ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
                className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DocumentsTableView;
