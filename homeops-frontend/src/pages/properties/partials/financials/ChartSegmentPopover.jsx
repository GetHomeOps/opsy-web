import React, {useState} from "react";
import {createPortal} from "react-dom";
import {formatCurrency, formatPercent} from "./financialsFormat";

const CURSOR_GAP = 12;
const VIEWPORT_PAD = 8;

function tooltipStyle(x, y) {
  if (x == null || y == null) return {left: 0, top: 0, visibility: "hidden"};
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const nearRight = vw > 0 && x > vw - 200;
  const nearBottom = vh > 0 && y > vh - 88;
  let left = nearRight ? x - CURSOR_GAP : x + CURSOR_GAP;
  let top = nearBottom ? y - CURSOR_GAP : y + CURSOR_GAP;
  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - VIEWPORT_PAD));
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - VIEWPORT_PAD));
  return {
    left,
    top,
    transform: `${nearRight ? "translateX(-100%)" : ""} ${nearBottom ? "translateY(-100%)" : ""}`.trim() || undefined,
  };
}

/**
 * Cursor-following chart tooltip, portaled to body so it is not clipped by cards.
 */
export function ChartHoverTooltip({label, amount, percent, x, y}) {
  if (x == null || y == null || !label) return null;
  const portalContainer = typeof document !== "undefined" ? document.body : null;
  if (!portalContainer) return null;

  return createPortal(
    <div
      role="tooltip"
      className="fixed z-[9999] pointer-events-none whitespace-nowrap rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1.5 shadow-lg text-xs"
      style={tooltipStyle(x, y)}
    >
      <p className="font-medium text-neutral-900 dark:text-white">{label}</p>
      <p className="tabular-nums text-neutral-600 dark:text-neutral-300 mt-0.5">
        {formatCurrency(amount) ?? "—"}
        {percent != null && Number.isFinite(Number(percent)) && (
          <span className="text-neutral-400 ml-1.5">{formatPercent(percent, 0)}</span>
        )}
      </p>
    </div>,
    portalContainer,
  );
}

/**
 * Hover/focus popover for a chart segment. Wrapper stays layout-neutral aside from `relative`.
 */
function ChartSegmentPopover({
  label,
  amount,
  percent,
  children,
  className = "",
  style,
}) {
  const [cursor, setCursor] = useState(null);

  const show = (e) => {
    const point = e?.clientX != null ? {x: e.clientX, y: e.clientY} : null;
    if (point) setCursor(point);
    else {
      const rect = e?.currentTarget?.getBoundingClientRect?.();
      if (rect) setCursor({x: rect.left + rect.width / 2, y: rect.top});
    }
  };
  const move = (e) => {
    if (e?.clientX != null) setCursor({x: e.clientX, y: e.clientY});
  };
  const hide = () => setCursor(null);

  return (
    <div
      className={`relative outline-none ${className}`.trim()}
      style={style}
      tabIndex={0}
      aria-label={
        percent != null
          ? `${label}: ${formatCurrency(amount) ?? "—"} (${formatPercent(percent, 0)})`
          : `${label}: ${formatCurrency(amount) ?? "—"}`
      }
      onMouseEnter={show}
      onMouseMove={move}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <ChartHoverTooltip
        label={label}
        amount={amount}
        percent={percent}
        x={cursor?.x}
        y={cursor?.y}
      />
    </div>
  );
}

export default ChartSegmentPopover;
