import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText, MoreVertical, Sparkles, Trash2 } from "lucide-react";

const MENU_GAP = 4;
const VIEWPORT_PAD = 8;
const FALLBACK_PANEL_WIDTH = 160;

export default function ActionItemRowMenu({
  onAddRecord,
  onEditFrequency,
  onClearSchedule,
  onAIPrompt,
  onDelete,
  showAddRecord = false,
  addRecordLabel = "Add / link record",
  showEditFrequency = false,
  editFrequencyLabel = "Edit frequency",
  showClearSchedule = false,
  clearScheduleLabel = "Clear schedule",
  showAI = false,
  showDelete = false,
}) {
  const [open, setOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const hasItems =
    (showAddRecord && onAddRecord) ||
    (showEditFrequency && onEditFrequency) ||
    (showClearSchedule && onClearSchedule) ||
    (showAI && onAIPrompt) ||
    (showDelete && onDelete);

  const menuItemCount = [
    showAddRecord && onAddRecord,
    showEditFrequency && onEditFrequency,
    showClearSchedule && onClearSchedule,
    showAI && onAIPrompt,
    showDelete && onDelete,
  ].filter(Boolean).length;

  useLayoutEffect(() => {
    if (!open) {
      setMenuCoords(null);
      return undefined;
    }

    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const tr = trigger.getBoundingClientRect();
      const panelWidth =
        panelRef.current?.offsetWidth || FALLBACK_PANEL_WIDTH;
      const panelHeight = panelRef.current?.offsetHeight ?? menuItemCount * 40;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = tr.right - panelWidth;
      left = Math.max(
        VIEWPORT_PAD,
        Math.min(left, vw - VIEWPORT_PAD - panelWidth),
      );

      let top = tr.bottom + MENU_GAP;
      if (top + panelHeight > vh - VIEWPORT_PAD) {
        top = tr.top - MENU_GAP - panelHeight;
      }
      top = Math.max(VIEWPORT_PAD, top);

      setMenuCoords({ top, left });
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
  }, [open, menuItemCount]);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        panelRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!hasItems) return null;

  const menuDropdown =
    open &&
    typeof document !== "undefined" &&
    createPortal(
      <div
        ref={panelRef}
        role="menu"
        style={
          menuCoords
            ? {
                position: "fixed",
                top: menuCoords.top,
                left: menuCoords.left,
                zIndex: 250,
              }
            : {
                position: "fixed",
                top: 0,
                left: 0,
                visibility: "hidden",
                pointerEvents: "none",
              }
        }
        className="w-max min-w-[10rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
        onClick={(e) => e.stopPropagation()}
      >
        {showAddRecord && onAddRecord && (
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 whitespace-nowrap"
            onClick={() => {
              onAddRecord();
              setOpen(false);
            }}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            {addRecordLabel}
          </button>
        )}
        {showEditFrequency && onEditFrequency && (
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 whitespace-nowrap"
            onClick={() => {
              onEditFrequency();
              setOpen(false);
            }}
          >
            {editFrequencyLabel}
          </button>
        )}
        {showClearSchedule && onClearSchedule && (
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 whitespace-nowrap"
            onClick={() => {
              onClearSchedule();
              setOpen(false);
            }}
          >
            {clearScheduleLabel}
          </button>
        )}
        {showAI && onAIPrompt && (
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 whitespace-nowrap"
            onClick={() => {
              onAIPrompt();
              setOpen(false);
            }}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            Ask AI
          </button>
        )}
        {showDelete && onDelete && (
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 whitespace-nowrap"
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            Delete
          </button>
        )}
      </div>,
      document.body,
    );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {menuDropdown}
    </div>
  );
}
