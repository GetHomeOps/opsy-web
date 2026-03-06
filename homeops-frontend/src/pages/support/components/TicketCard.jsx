import React, {useRef, useCallback} from "react";
import {format} from "date-fns";
import StatusBadge, {
  SUPPORT_STATUS_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

/**
 * Kanban card: click-and-hold anywhere to drag, quick click opens detail.
 * Uses mousedown timing to distinguish click (navigate) from hold (drag).
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
      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 transition-all select-none cursor-grab active:cursor-grabbing ${
        isDragging
          ? "opacity-90 scale-[1.02] shadow-xl ring-2 ring-violet-400/50 dark:ring-violet-500/50 z-50"
          : "shadow hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex flex-wrap gap-1.5 mb-2">
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
