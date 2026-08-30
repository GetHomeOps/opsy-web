import React, {useCallback, useMemo, useRef, useState} from "react";
import {
  Upload,
  Inbox,
  Trash2,
  CheckCheck,
  ChevronDown,
  Mail,
  Copy,
  Check,
  Camera,
} from "lucide-react";
import InboxFileCard from "./InboxFileCard";
import ModalBlank from "../../../../components/ModalBlank";
import {MAX_DOCUMENT_UPLOAD_LABEL} from "../../../../constants/documentUpload";
import {
  canUploadDocumentsOnDemo,
  DEMO_UPLOAD_UNAVAILABLE_MESSAGE,
} from "../../../../utils/demoSite";
import {inferDocumentTypeFromFolder} from "./filenameHeuristics";
import {fileAllItemFromCard} from "./inboxDocuments";

/**
 * Default inbound-email domain. Override at build time with
 * `VITE_INBOUND_EMAIL_DOMAIN` to point at a different MX-receiving subdomain
 * (e.g. staging vs production); the local-part is fixed to `documents` to
 * match `INBOUND_EMAIL_LOCAL_PART` in homeops-backend/config.js.
 */
const INBOUND_EMAIL_DOMAIN =
  (import.meta.env.VITE_INBOUND_EMAIL_DOMAIN || "inbox.heyopsy.com").trim();
const INBOUND_EMAIL_LOCAL_PART = "documents";

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
  onOpenCapture,
  onRemove,
  onRetry,
  onPatchProposed,
  onFileOne,
  onFileBulk,
  onOpenInNewTab,
  systemsToShow,
  systemUploadDisabledIds = [],
  propertyUid,
  onUploadBlocked,
}) {
  const uploadDisabled = !canUploadDocumentsOnDemo();
  const fileInputRef = useRef(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSystem, setBulkSystem] = useState("");
  const [bulkError, setBulkError] = useState(null);
  const [isDraggingFromOs, setIsDraggingFromOs] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [inboxRemoveModalOpen, setInboxRemoveModalOpen] = useState(false);
  const [inboxRemoveClientIds, setInboxRemoveClientIds] = useState([]);
  const [inboxRemoveBusy, setInboxRemoveBusy] = useState(false);

  /**
   * Per-property email address. Built from the public 8-digit property_uid so
   * it matches what the backend will look up. `null` when we don't yet know
   * the uid (legacy callers that don't pass it through).
   */
  const propertyEmailAddress = useMemo(() => {
    if (!propertyUid) return null;
    return `${INBOUND_EMAIL_LOCAL_PART}+${propertyUid}@${INBOUND_EMAIL_DOMAIN}`;
  }, [propertyUid]);

  const handleCopyEmail = useCallback(async () => {
    if (!propertyEmailAddress) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(propertyEmailAddress);
      } else {
        // Fallback for non-secure contexts (older Safari, file://). We
        // intentionally avoid `document.execCommand` in modern code paths.
        const ta = document.createElement("textarea");
        ta.value = propertyEmailAddress;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 1500);
    } catch (err) {
      console.warn("[DocumentsInboxView] copy email failed:", err.message);
    }
  }, [propertyEmailAddress]);

  /* OS-level file drop on the panel */
  const handleOsDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDraggingFromOs(false);
      if (uploadDisabled) {
        onUploadBlocked?.();
        return;
      }
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length) onAddFiles(files);
    },
    [onAddFiles, onUploadBlocked, uploadDisabled],
  );

  const handleDragOver = useCallback((e) => {
    if (uploadDisabled) return;
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
  const missingFolderCount = readyCards.filter(
    (c) => !c.proposed.system_key,
  ).length;

  const handleFileAll = async () => {
    setBulkError(null);
    if (!readyCards.length) return;
    setBulkBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await onFileBulk(readyCards.map((c) => fileAllItemFromCard(c, today)));
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
          document_type: inferDocumentTypeFromFolder(
            bulkSystem,
            c.proposed.document_type,
          ),
          document_name: c.proposed.document_name || c.name,
          document_date:
            c.proposed.document_date || new Date().toISOString().slice(0, 10),
        })),
      );
      clearSelection();
      setBulkSystem("");
    } catch (err) {
      setBulkError(err?.message || "Filing failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const openInboxRemoveModal = useCallback(() => {
    if (!selectedCards.length) return;
    setInboxRemoveClientIds(selectedCards.map((c) => c.clientId));
    setInboxRemoveModalOpen(true);
  }, [selectedCards]);

  const confirmInboxRemove = async () => {
    if (!inboxRemoveClientIds.length) return;
    setInboxRemoveBusy(true);
    try {
      for (const clientId of inboxRemoveClientIds) {
        await onRemove(clientId);
      }
      clearSelection();
      setInboxRemoveModalOpen(false);
      setInboxRemoveClientIds([]);
    } finally {
      setInboxRemoveBusy(false);
    }
  };

  const inboxRemoveCount = inboxRemoveClientIds.length;

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
          if (uploadDisabled) {
            onUploadBlocked?.();
            e.target.value = "";
            return;
          }
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
          {onOpenCapture && (
            <button
              type="button"
              onClick={() => (uploadDisabled ? onUploadBlocked?.() : onOpenCapture())}
              disabled={uploadDisabled}
              className="btn-sm h-8 border border-[#456654]/40 text-[#456654] dark:text-[#7a9a88] hover:bg-[#456654]/10 dark:hover:bg-[#456654]/20 flex items-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="Capture document photo"
            >
              <Camera className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Camera</span>
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              uploadDisabled ? onUploadBlocked?.() : fileInputRef.current?.click()
            }
            disabled={uploadDisabled}
            className="btn-sm h-8 bg-[#456654] hover:bg-[#3a5548] text-white flex items-center gap-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
          {readyCards.length > 0 && (
            <button
              type="button"
              onClick={handleFileAll}
              disabled={bulkBusy}
              className="btn-sm border border-[#456654]/40 text-[#456654] dark:text-[#7a9a88] hover:bg-[#456654]/10 dark:hover:bg-[#456654]/20 disabled:opacity-50 flex items-center gap-1.5 text-xs"
              title={
                missingFolderCount
                  ? `${missingFolderCount} without a folder will go to Other`
                  : `File all ${readyCards.length} ready cards`
              }
            >
              <CheckCheck className="w-3.5 h-3.5" />
              File all ({readyCards.length})
            </button>
          )}
        </div>
      </div>

      {uploadDisabled && (
        <div className="flex-shrink-0 px-5 py-2 border-b border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-100">
          {DEMO_UPLOAD_UNAVAILABLE_MESSAGE}
        </div>
      )}

      {/* Property inbound-email address. Renders only when the public uid is
          known (so we don't show a half-built address). Members and pending
          invitees can email attachments here and they land in this inbox. */}
      {propertyEmailAddress && (
        <div className="flex-shrink-0 px-5 py-2 border-b border-gray-200 dark:border-gray-700 bg-[#456654]/[0.04] dark:bg-[#456654]/10 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Mail className="w-3.5 h-3.5 text-[#456654] dark:text-[#7a9a88] flex-shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-300">
            Or email documents to
          </span>
          <code
            className="text-xs font-mono text-[#3a5548] dark:text-[#a8c0b4] bg-white dark:bg-gray-800 px-2 py-0.5 rounded border border-[#456654]/20 dark:border-[#456654]/40 select-all"
            title="Property inbound email address"
          >
            {propertyEmailAddress}
          </code>
          <button
            type="button"
            onClick={handleCopyEmail}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#456654] dark:text-[#7a9a88] hover:underline"
            aria-label={emailCopied ? "Email address copied" : "Copy email address"}
          >
            {emailCopied ? (
              <>
                <Check className="w-3 h-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy
              </>
            )}
          </button>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-auto">
            Attachments from property members appear here automatically.
          </span>
        </div>
      )}

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
            onClick={openInboxRemoveModal}
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
          uploadDisabled ? (
            <div className="block w-full max-w-3xl mx-auto h-full min-h-[280px] border-2 border-dashed border-amber-200 dark:border-amber-800/50 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <Upload className="w-12 h-12 text-amber-400 dark:text-amber-600 mb-4" />
                <p className="text-sm text-amber-900 dark:text-amber-100 max-w-md">
                  {DEMO_UPLOAD_UNAVAILABLE_MESSAGE}
                </p>
              </div>
            </div>
          ) : (
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
          )
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
                  onOpenInNewTab={onOpenInNewTab}
                  systemsToShow={systemsToShow}
                  systemUploadDisabledIds={systemUploadDisabledIds}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalBlank
        id="inbox-remove-confirm-modal"
        modalOpen={inboxRemoveModalOpen}
        setModalOpen={(open) => {
          if (!open && inboxRemoveBusy) return;
          setInboxRemoveModalOpen(open);
          if (!open) setInboxRemoveClientIds([]);
        }}
        backdropZClassName="z-[300]"
        dialogZClassName="z-[300]"
        contentClassName="max-w-lg"
      >
        <div className="p-5 flex space-x-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-red-50 dark:bg-red-900/30">
            <Trash2
              className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0"
              aria-hidden
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Remove from inbox?
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              {inboxRemoveCount === 1
                ? "Remove 1 file from the inbox? This deletes the uploaded file."
                : `Remove ${inboxRemoveCount} files from the inbox? This deletes the uploaded files.`}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                onClick={() => {
                  setInboxRemoveModalOpen(false);
                  setInboxRemoveClientIds([]);
                }}
                disabled={inboxRemoveBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                onClick={confirmInboxRemove}
                disabled={inboxRemoveBusy}
              >
                {inboxRemoveBusy ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      </ModalBlank>
    </div>
  );
}

export default DocumentsInboxView;
