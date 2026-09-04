import React, {useCallback, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Pencil} from "lucide-react";
import {useDynamicPosition} from "../../../../hooks/useDynamicPosition";

const DEFAULT_TOOLTIP = "Public record — not directly editable.";
const TOOLTIP_GAP = 8;
const TOOLTIP_LEAVE_DELAY = 150;

const lockBtnClass =
  "inline-flex items-center justify-center rounded-md p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200";

/**
 * Lock on public-record financial cards. Homeowners see a tooltip, and optionally
 * a data-adjustment CTA. Admin/super_admin can toggle unlock when `canUnlock` is true.
 */
function PublicRecordLock({
  canUnlock = false,
  unlocked = false,
  onToggle,
  tooltip = DEFAULT_TOOLTIP,
  requestUrl,
  requestLabel = "Request data adjustment",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerId = useId();
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const leaveTimeoutRef = useRef(null);

  const {top, left} = useDynamicPosition({
    triggerRef: wrapperRef,
    floatingRef: tooltipRef,
    isVisible: isOpen && Boolean(requestUrl) && !canUnlock,
    preferredPosition: "top",
    gap: TOOLTIP_GAP,
  });

  const openRequest = useCallback(() => {
    if (!requestUrl) return;
    window.open(requestUrl, "_blank", "noopener,noreferrer");
  }, [requestUrl]);

  const handleTriggerLeave = useCallback(() => {
    leaveTimeoutRef.current = setTimeout(() => setIsOpen(false), TOOLTIP_LEAVE_DELAY);
  }, []);

  const handleTooltipEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsOpen(true);
  }, []);

  if (canUnlock && typeof onToggle === "function") {
    const label = unlocked
      ? "Lock public-record fields"
      : "Unlock to edit public-record fields";
    return (
      <button type="button" onClick={onToggle} title={label} aria-label={label} className={lockBtnClass}>
        <Pencil className="w-3.5 h-3.5" />
      </button>
    );
  }

  if (!requestUrl) {
    return (
      <span className={`${lockBtnClass} cursor-help`} title={tooltip} aria-label={tooltip}>
        <Pencil className="w-3.5 h-3.5" />
      </span>
    );
  }

  const portalContainer = typeof document !== "undefined" ? document.body : null;

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => {
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current);
          leaveTimeoutRef.current = null;
        }
        setIsOpen(true);
      }}
      onMouseLeave={handleTriggerLeave}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={(e) => {
        if (!wrapperRef.current?.contains(e.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        id={triggerId}
        type="button"
        onClick={openRequest}
        className={lockBtnClass}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={tooltip}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      {isOpen &&
        portalContainer &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            aria-labelledby={triggerId}
            className="fixed z-[9999] w-64 rounded-xl border border-gray-200/90 dark:border-gray-700/70 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 shadow-xl pointer-events-auto"
            style={{top, left, transform: "translateX(-50%)"}}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={() => setIsOpen(false)}
          >
            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{tooltip}</p>
            <button
              type="button"
              onClick={openRequest}
              className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:text-[#456564] dark:hover:text-emerald-300 focus:outline-none focus:underline"
            >
              {requestLabel}
            </button>
          </div>,
          portalContainer,
        )}
    </span>
  );
}

export default PublicRecordLock;
