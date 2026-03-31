import React from "react";
import { Paperclip } from "lucide-react";

/**
 * Derives attachment count from ticket.attachmentKeys (Postgres TEXT[] → JS array).
 */
export function getTicketAttachmentCount(ticketOrKeys) {
  if (ticketOrKeys == null) return 0;
  const keys = Array.isArray(ticketOrKeys)
    ? ticketOrKeys
    : ticketOrKeys.attachmentKeys;
  if (!Array.isArray(keys)) return 0;
  return keys.filter(Boolean).length;
}

/**
 * Subtle paperclip when a ticket has files; shows a numeric count when there are 2+ (or always if showCount).
 * Omits entirely when there are no attachments.
 */
function TicketAttachmentIndicator({
  attachmentKeys,
  /** When true, always show the count next to the icon (including "1"). */
  showCount = false,
  size = "default",
  className = "",
}) {
  const count = getTicketAttachmentCount(attachmentKeys);
  if (count < 1) return null;

  const iconClass = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const textClass = size === "sm" ? "text-[11px]" : "text-xs";
  const displayCount = showCount || count > 1;

  return (
    <span
      className={`inline-flex items-center gap-1 text-gray-500 dark:text-gray-400 tabular-nums ${textClass} ${className}`.trim()}
      title={`${count} attachment${count === 1 ? "" : "s"}`}
      aria-label={`${count} attachment${count === 1 ? "" : "s"}`}
    >
      <Paperclip className={`${iconClass} flex-shrink-0 opacity-85`} strokeWidth={2} aria-hidden />
      {displayCount && <span className="font-medium">{count}</span>}
    </span>
  );
}

export default TicketAttachmentIndicator;
