import React, {useRef, useCallback} from "react";
import {format} from "date-fns";
import {GripVertical} from "lucide-react";
import StatusBadge, {
  SUPPORT_STATUS_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

/**
 * Kanban card: quick click opens detail; click-and-hold to drag.
 * Uses default cursor (no pointer/grab hand) for consistent UX.
 */
function TicketCard({
  ticket,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
  variant = "support",
}) {
  const labels =
    variant === "feedback" ? FEEDBACK_STATUS_LABELS : SUPPORT_STATUS_LABELS;
  const typeBadgeClass =
    ticket.type === "feedback"
      ? "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300"
      : ticket.type === "data_adjustment"
        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
        : "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300";
  const tierBadgeClass =
    "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300";

  const didDragRef = useRef(false);

  const handleDragStart = useCallback(
    (e) => {
      didDragRef.current = true;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(ticket.id));
      onDragStart?.(e, ticket);
    },
    [ticket, onDragStart],
  );

  const handleDragEnd = useCallback(
    (e) => {
      onDragEnd?.(e);
    },
    [onDragEnd],
  );

  const handleClick = useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onClick?.();
  }, [onClick]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    },
    [onClick],
  );

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`group rounded-lg border border-gray-200/80 dark:border-gray-600/60 bg-white dark:bg-gray-800/95 p-3 transition-all select-none cursor-default ${
        isDragging
          ? "opacity-90 scale-[1.02] shadow-lg ring-2 ring-violet-400/40 dark:ring-violet-500/40 z-50"
          : "shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          className="flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity"
          aria-hidden
        >
          <GripVertical className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
      <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ${typeBadgeClass}`}
        >
          {ticket.type || variant}
        </span>
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium capitalize ${tierBadgeClass}`}
        >
          {ticket.subscriptionTier || "Free"}
        </span>
        {ticket.priority && variant === "support" && (
          <PriorityBadge priority={ticket.priority} />
        )}
      </div>
      </div>
      <p className="font-medium text-gray-900 dark:text-white text-sm line-clamp-2">
        {ticket.subject}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {ticket.createdByName || ticket.createdByEmail}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {ticket.accountName}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {format(new Date(ticket.createdAt), "MMM d, yyyy")}
      </p>
      <div className="mt-2">
        <StatusBadge status={ticket.status} labels={labels} />
      </div>
    </div>
  );
}

export default TicketCard;
