import React, {useCallback, useRef, useState} from "react";
import {
  Upload,
  Inbox,
  Trash2,
  CheckCheck,
  ChevronDown,
} from "lucide-react";
import InboxFileCard from "./InboxFileCard";
import {MAX_DOCUMENT_UPLOAD_LABEL} from "../../../../constants/documentUpload";

/**
 * DocumentsInboxView — main panel when no folder is selected.
 *
 * - Empty state: a large dashed dropzone (Box-style) with browse button.
 * - With staged files: header with counts + bulk actions, grid of cards.
 * - Whole panel accepts file drops from the OS at any time.
 */
function DocumentsInboxView({
  cards,
  loading,
  onAddFiles,
  onRemove,
  onRetry,
  onPatchProposed,
  onFileOne,
  onFileBulk,
  systemsToShow,
  documentTypes,
  systemUploadDisabledIds = [],
}) {
  const fileInputRef = useRef(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSystem, setBulkSystem] = useState("");
  const [bulkType, setBulkType] = useState("");
  const [bulkError, setBulkError] = useState(null);
  const [isDraggingFromOs, setIsDraggingFromOs] = useState(false);

  /* OS-level file drop on the panel */
  const handleOsDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDraggingFromOs(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) onAddFiles(files);
    },
    [onAddFiles],
  );

  const handleDragOver = useCallback((e) => {
    if (e.dataTransfer?.types?.includes("Files")) {
      e.preventDefault();
      setIsDraggingFromOs(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingFromOs(false);
  }, []);

  const toggleSelect = useCallback((clientId, additive) => {
    setSelected((prev) => {
      const next = new Set(additive ? prev : new Set());
      if (additive) {
        if (next.has(clientId)) next.delete(clientId);
        else next.add(clientId);
      } else {
        if (prev.has(clientId) && prev.size === 1) {
          // toggle off if clicking the single selected one
        } else {
          next.add(clientId);
        }
      }
      return next;
    });
  }, []);

  const clearSelection = () => setSelected(new Set());

  const selectedCards = cards.filter((c) => selected.has(c.clientId));
  const selectedCount = selectedCards.length;
  const readyCards = cards.filter((c) => c.status === "uploaded" && c.id);
  const allReadyComplete = readyCards.every(
    (c) =>
      c.proposed.system_key &&
      c.proposed.document_type &&
      c.proposed.document_name?.trim() &&
      c.proposed.document_date,
  );

  const handleFileAll = async () => {
    setBulkError(null);
    if (!readyCards.length) return;
    if (!allReadyComplete) {
      setBulkError(
        "Some cards are missing folder or type. Fill them in or use bulk-apply below.",
      );
      return;
    }
    setBulkBusy(true);
    try {
      await onFileBulk(
        readyCards.map((c) => ({
          clientId: c.clientId,
          system_key: c.proposed.system_key,
          document_type: c.proposed.document_type,
          document_name: c.proposed.document_name,
          document_date: c.proposed.document_date,
        })),
      );
      clearSelection();
    } catch (err) {
      setBulkError(err?.message || "Filing failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkMoveSelected = async () => {
    setBulkError(null);
    const eligible = selectedCards.filter((c) => c.status === "uploaded" && c.id);
    if (!eligible.length) {
      setBulkError("Select at least one ready card.");
      return;
    }
    if (!bulkSystem) {
      setBulkError("Pick a folder for the selection.");
      return;
    }
    setBulkBusy(true);
    try {
      await onFileBulk(
        eligible.map((c) => ({
          clientId: c.clientId,
          system_key: bulkSystem,
          document_type: bulkType || c.proposed.document_type || "other",
          document_name: c.proposed.document_name || c.name,
          document_date:
            c.proposed.document_date || new Date().toISOString().slice(0, 10),
        })),
      );
      clearSelection();
      setBulkSystem("");
      setBulkType("");
    } catch (err) {
      setBulkError(err?.message || "Filing failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkRemove = async () => {
    if (!selectedCards.length) return;
    if (
      !window.confirm(
        `Remove ${selectedCards.length} file${selectedCards.length === 1 ? "" : "s"} from the inbox? This deletes the uploaded files.`,
      )
    )
      return;
    for (const c of selectedCards) {
      await onRemove(c.clientId);
    }
    clearSelection();
  };

  const showEmpty = !loading && cards.length === 0;

  return (
    <div
      onDrop={handleOsDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      className="relative flex flex-col h-full bg-gray-50 dark:bg-gray-900/30 overflow-hidden"
    >
      {/* OS-drop overlay */}
      {isDraggingFromOs && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#456654]/[0.08] backdrop-blur-sm border-2 border-dashed border-[#456654]/60 rounded-lg pointer-events-none">
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto text-[#456654] dark:text-[#7a9a88] mb-2" />
            <p className="text-base font-semibold text-[#456654] dark:text-[#7a9a88]">
              Drop files to add to Inbox
            </p>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onAddFiles(files);
          e.target.value = "";
        }}
      />

      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Inbox className="w-4 h-4 text-[#456654] dark:text-[#7a9a88] flex-shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            Inbox
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {cards.length === 0
              ? "Drag files anywhere to upload"
              : `${cards.length} staged · drag to a folder`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-sm bg-[#456654] hover:bg-[#3a5548] text-white flex items-center gap-1.5 text-xs"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          {readyCards.length > 0 && (
            <button
              type="button"
              onClick={handleFileAll}
              disabled={bulkBusy || !allReadyComplete}
              className="btn-sm border border-[#456654]/40 text-[#456654] dark:text-[#7a9a88] hover:bg-[#456654]/10 dark:hover:bg-[#456654]/20 disabled:opacity-50 flex items-center gap-1.5 text-xs"
              title={
                allReadyComplete
                  ? `File all ${readyCards.length} ready cards`
                  : "Some cards are missing metadata"
              }
            >
              <CheckCheck className="w-3.5 h-3.5" />
              File all ({readyCards.length})
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedCount > 0 && (
        <div className="flex-shrink-0 px-5 py-2 border-b border-[#456654]/20 dark:border-[#456654]/30 bg-[#456654]/[0.06] dark:bg-[#456654]/15 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[#3a5548] dark:text-[#a8c0b4]">
            {selectedCount} selected
          </span>
          <select
            value={bulkSystem}
            onChange={(e) => setBulkSystem(e.target.value)}
            className="form-select text-xs py-1 px-2 bg-white dark:bg-gray-800 border-[#456654]/20 dark:border-[#456654]/40 rounded"
          >
            <option value="">Move to folder…</option>
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
            value={bulkType}
            onChange={(e) => setBulkType(e.target.value)}
            className="form-select text-xs py-1 px-2 bg-white dark:bg-gray-800 border-[#456654]/20 dark:border-[#456654]/40 rounded"
          >
            <option value="">Set type… (optional)</option>
            {documentTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkMoveSelected}
            disabled={bulkBusy || !bulkSystem}
            className="btn-sm bg-[#456654] hover:bg-[#3a5548] text-white text-xs disabled:opacity-50"
          >
            File selected
          </button>
          <button
            type="button"
            onClick={handleBulkRemove}
            disabled={bulkBusy}
            className="btn-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-xs text-[#456654] dark:text-[#7a9a88] hover:underline ml-auto"
          >
            Clear selection
          </button>
        </div>
      )}

      {bulkError && (
        <div className="flex-shrink-0 px-5 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          {bulkError}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        {showEmpty ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="block w-full max-w-3xl mx-auto h-full min-h-[280px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 hover:border-[#456654]/50 dark:hover:border-[#456654]/70 hover:bg-[#456654]/[0.04] dark:hover:bg-[#456654]/10 transition-colors group"
          >
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4 group-hover:text-[#456654] dark:group-hover:text-[#7a9a88] transition-colors" />
              <p className="text-base font-medium text-gray-700 dark:text-gray-200 mb-1">
                Drop files here to upload
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                or click to browse
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                PDF, JPG, PNG, GIF, WebP — up to {MAX_DOCUMENT_UPLOAD_LABEL} each
              </p>
              <p className="mt-6 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                Files staged here can be dragged into any folder
                <ChevronDown className="w-3 h-3 -rotate-90" />
              </p>
            </div>
          </button>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {cards.map((card) => (
              <div
                key={card.clientId}
                className="flex justify-center"
              >
                <InboxFileCard
                  card={card}
                  selected={selected.has(card.clientId)}
                  onToggleSelect={toggleSelect}
                  onRemove={onRemove}
                  onRetry={onRetry}
                  onPatchProposed={onPatchProposed}
                  onFile={onFileOne}
                  systemsToShow={systemsToShow}
                  documentTypes={documentTypes}
                  systemUploadDisabledIds={systemUploadDisabledIds}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentsInboxView;
