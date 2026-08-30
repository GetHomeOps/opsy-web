import React, {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useDraggable} from "@dnd-kit/core";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  RotateCw,
  Mail,
  ExternalLink,
  MoreVertical,
  Check,
} from "lucide-react";
import {DocumentThumbContent} from "./documentThumbnailShared";
import {inferDocumentTypeFromFolder} from "./filenameHeuristics";

const MENU_WIDTH = 208;
const MENU_GAP = 4;
const VIEWPORT_PAD = 8;

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
      interactive={false}
    />
  );
}

/**
 * One staged document card. The whole card is a @dnd-kit drag source (drop
 * on a folder row to file). Classification lives in a ⋮ menu; clicking the
 * card toggles selection for bulk actions.
 */
function InboxFileCard({
  card,
  selected,
  onToggleSelect,
  onRemove,
  onRetry,
  onPatchProposed,
  onFile,
  onOpenInNewTab,
  systemsToShow,
  systemUploadDisabledIds = [],
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState(null);
  const menuTriggerRef = useRef(null);
  const menuPanelRef = useRef(null);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuCoords(null);
      return undefined;
    }

    const update = () => {
      const trigger = menuTriggerRef.current;
      if (!trigger) return;

      const tr = trigger.getBoundingClientRect();
      const panelHeight = menuPanelRef.current?.offsetHeight ?? 280;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = tr.right - MENU_WIDTH;
      left = Math.max(
        VIEWPORT_PAD,
        Math.min(left, vw - VIEWPORT_PAD - MENU_WIDTH),
      );

      let top = tr.bottom + MENU_GAP;
      if (top + panelHeight > vh - VIEWPORT_PAD) {
        top = tr.top - MENU_GAP - panelHeight;
      }
      top = Math.max(VIEWPORT_PAD, top);

      setMenuCoords({top, left});
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [menuOpen, systemsToShow.length, card.proposed.system_key]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handleClick = (e) => {
      if (
        menuTriggerRef.current?.contains(e.target) ||
        menuPanelRef.current?.contains(e.target)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const dndDisabled = !card.id || card.status !== "uploaded";

  const {attributes, listeners, setNodeRef, isDragging} = useDraggable({
    id: `inbox:${card.clientId}`,
    data: {
      type: "inbox",
      clientId: card.clientId,
      cardId: card.id,
      label: card.proposed?.document_name || card.name || "Document",
    },
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
  const canFileNow =
    isReady &&
    proposedSystem &&
    card.proposed.document_name?.trim() &&
    card.proposed.document_date;

  const folderLabel = systemsToShow.find((s) => s.id === proposedSystem)?.label;

  const handleFolderChange = (systemKey) => {
    onPatchProposed?.(card.clientId, {
      system_key: systemKey,
      document_type: inferDocumentTypeFromFolder(
        systemKey,
        card.proposed.document_type,
      ),
    });
  };

  const handleFile = (e) => {
    e.stopPropagation();
    if (canFileNow) {
      onFile?.(card.clientId);
      setMenuOpen(false);
    }
  };

  const menuDropdown =
    menuOpen &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={menuPanelRef}
        role="menu"
        aria-label="Classify document"
        style={
          menuCoords
            ? {
                position: "fixed",
                top: menuCoords.top,
                left: menuCoords.left,
                width: MENU_WIDTH,
                zIndex: 250,
              }
            : {
                position: "fixed",
                top: 0,
                left: 0,
                width: MENU_WIDTH,
                visibility: "hidden",
                pointerEvents: "none",
              }
        }
        className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2.5 py-2 border-b border-gray-100 dark:border-gray-800">
          <p
            className="text-[11px] font-medium text-gray-900 dark:text-gray-100 truncate"
            title={card.name}
          >
            {card.name}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            {formatBytes(card.sizeBytes)}
            {card.mimeType
              ? ` · ${card.mimeType.split("/")[1]?.toUpperCase()}`
              : ""}
            {card.source === "email" && (
              <span className="inline-flex items-center gap-0.5 ml-1 text-[#456654] dark:text-[#7a9a88]">
                <Mail className="w-2.5 h-2.5" /> email
              </span>
            )}
          </p>
        </div>
        <div className="p-1 max-h-48 overflow-y-auto">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Move to folder
          </p>
          {systemsToShow.map((s) => {
            const disabled = systemUploadDisabledIds.includes(s.id);
            const isSelected = proposedSystem === s.id;
            return (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) handleFolderChange(s.id);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[11px] transition-colors ${
                  disabled
                    ? "text-gray-300 dark:text-gray-600 cursor-not-allowed"
                    : isSelected
                      ? "bg-[#456654]/10 dark:bg-[#456654]/20 text-[#456654] dark:text-[#7a9a88] font-medium"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <span className="flex-1 truncate">
                  {s.label}
                  {disabled ? " (full)" : ""}
                </span>
                {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="p-1.5 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            role="menuitem"
            onClick={handleFile}
            disabled={!canFileNow}
            className={`w-full text-[11px] font-medium py-1.5 rounded-md transition-colors ${
              canFileNow
                ? "bg-[#456654] hover:bg-[#3a5548] text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            File document
          </button>
        </div>
      </div>,
      document.body,
    );

  return (
    <div
      ref={setNodeRef}
      {...(isReady ? {...attributes, ...listeners} : {})}
      onClick={(e) => {
        onToggleSelect?.(
          card.clientId,
          e.shiftKey || e.metaKey || e.ctrlKey,
        );
      }}
      className={`relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border ${ringClass} ${dragClass} transition-all shadow-sm hover:shadow-md overflow-hidden ${
        isReady ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      style={{width: 220, minHeight: 280}}
    >
      <div className="relative flex-1 min-h-[280px] bg-gray-50 dark:bg-gray-900 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <CardThumbnail card={card} />
        </div>

        {/* Status + classification badges */}
        <div className="absolute top-1.5 left-1.5 z-10 flex flex-col items-start gap-1 max-w-[calc(100%-3rem)]">
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
          {isReady && folderLabel && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-100/95 dark:bg-violet-900/80 text-violet-700 dark:text-violet-200 backdrop-blur-sm shadow-sm truncate max-w-full">
              {folderLabel}
            </span>
          )}
          {isReady && !folderLabel && (
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100/95 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 backdrop-blur-sm shadow-sm truncate max-w-full">
              Needs a folder
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="absolute top-1.5 right-1.5 z-20 flex items-center gap-1">
          {isReady && (
            <>
              <button
                ref={menuTriggerRef}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className={`p-1 rounded-md backdrop-blur-sm shadow-sm transition-colors ${
                  menuOpen
                    ? "bg-white dark:bg-gray-800 text-[#456654]"
                    : "bg-white/90 dark:bg-gray-900/80 text-gray-600 hover:text-[#456654] hover:bg-white dark:hover:bg-gray-800"
                }`}
                title="Classify document"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuDropdown}
            </>
          )}
          {isReady && card.documentKey && onOpenInNewTab && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onOpenInNewTab(card);
              }}
              className="p-1 rounded-md bg-white/90 dark:bg-gray-900/80 text-gray-600 hover:text-[#456654] hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-sm transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(card.clientId);
            }}
            className="p-1 rounded-md bg-white/90 dark:bg-gray-900/80 text-gray-500 hover:text-red-600 hover:bg-white dark:hover:bg-gray-800 backdrop-blur-sm shadow-sm transition-colors"
            title="Remove from inbox"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom overlay: name, progress, errors */}
        <div className="absolute bottom-0 inset-x-0 z-10 pointer-events-none">
          {card.status === "uploading" && (
            <div className="px-2 pt-3 pb-1 bg-gradient-to-t from-black/50 to-transparent">
              <div className="h-1 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-[#456654] transition-all"
                  style={{width: `${card.progress}%`}}
                />
              </div>
            </div>
          )}
          {card.status === "error" && (
            <div className="px-2 py-1.5 bg-gradient-to-t from-red-900/80 to-transparent">
              <p className="text-[10px] text-red-100 leading-tight truncate">
                {card.error || "Upload failed"}
              </p>
              {onRetry && card.file && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRetry(card.clientId);
                  }}
                  className="pointer-events-auto mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-white underline font-medium"
                >
                  <RotateCw className="w-2.5 h-2.5" /> Retry
                </button>
              )}
            </div>
          )}
          {(isReady || card.status === "queued") && (
            <div className="px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
              <p
                className="text-[10px] font-medium text-white truncate"
                title={card.name}
              >
                {card.name}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InboxFileCard;
