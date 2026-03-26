import React, {useState, useRef} from "react";
import {createPortal} from "react-dom";
import Transition from "../utils/Transition";
import {useDynamicPosition} from "../hooks/useDynamicPosition";

const TOOLTIP_GAP = 8;

function Tooltip({
  children,
  className,
  bg,
  size,
  position,
  content,
  gap: gapProp,
  panelClassName,
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const isVertical = position === "bottom" || position === "top" || !position;

  const {top, left, effectivePosition} = useDynamicPosition({
    triggerRef,
    floatingRef: tooltipRef,
    isVisible: tooltipOpen && !!content,
    preferredPosition: position || "bottom",
    gap: gapProp ?? TOOLTIP_GAP,
  });

  const handleEnter = () => {
    setTooltipOpen(true);
  };

  const handleLeave = () => {
    setTooltipOpen(false);
  };

  /** For portal: vertical uses translateX(-50%) to center; horizontal uses no transform. */
  const portalTransform =
    isVertical || effectivePosition === "top" || effectivePosition === "bottom"
      ? "translateX(-50%)"
      : "none";

  const sizeClasses = (s) => {
    switch (s) {
      case "xl":
        return "min-w-64 max-w-sm px-4 py-2 text-sm";
      case "lg":
        return "min-w-32 px-3 py-2 text-sm";
      case "md":
        return "min-w-24 px-3 py-2 text-sm";
      case "sm":
        return "min-w-16 px-3 py-2 text-xs whitespace-nowrap";
      default:
        return "px-3 py-2 text-xs whitespace-nowrap";
    }
  };

  const colorClasses = (b) => {
    switch (b) {
      case "light":
        return "bg-white text-gray-600 border-gray-200";
      case "dark":
        return "bg-gray-800 text-gray-100 border-gray-700/60";
      default:
        return "text-gray-600 bg-white dark:bg-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700/60";
    }
  };

  /** Horizontal placement uses `gap` from useDynamicPosition only — margin here was not
   * included in width measurement and caused the tooltip to overlap the trigger. */
  const positionInnerClasses = (pos) => {
    switch (pos) {
      case "right":
      case "left":
        return "";
      case "top":
        return "mb-2";
      case "bottom":
      default:
        return "mt-2";
    }
  };

  const tooltipContent = content && (
    <Transition
      show={tooltipOpen}
      tag="div"
      className={`rounded-lg border overflow-hidden shadow-lg ${sizeClasses(
        size,
      )} ${colorClasses(bg)} ${positionInnerClasses(effectivePosition)} ${
        panelClassName || ""
      }`.trim()}
      enter="transition ease-out duration-200 transform"
      enterStart="opacity-0 -translate-y-2"
      enterEnd="opacity-100 translate-y-0"
      leave="transition ease-out duration-200"
      leaveStart="opacity-100"
      leaveEnd="opacity-0"
    >
      <div ref={tooltipRef}>{content}</div>
    </Transition>
  );

  const portalContainer =
    typeof document !== "undefined" ? document.body : null;

  return (
    <div
      ref={triggerRef}
      className={`pl-2 relative inline-block ${className || ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {content &&
        portalContainer &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              top,
              left,
              transform: portalTransform,
            }}
          >
            {tooltipContent}
          </div>,
          portalContainer,
        )}
    </div>
  );
}

export default Tooltip;
