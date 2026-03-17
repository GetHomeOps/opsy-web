import React, {useRef, useCallback} from "react";
import {motion} from "framer-motion";
import {format} from "date-fns";
import {GripVertical, User, Calendar, UserCircle} from "lucide-react";
import {
  supportToColumnStatus,
  feedbackToColumnStatus,
  dataAdjustmentToColumnStatus,
} from "../kanbanConfig";
import PriorityBadge from "./PriorityBadge";

const TYPE_STYLES = {
  support: {
    bg: "bg-sky-50 dark:bg-sky-900/25",
    text: "text-sky-700 dark:text-sky-300",
    label: "Support",
  },
  feedback: {
    bg: "bg-violet-50 dark:bg-violet-900/25",
    text: "text-violet-700 dark:text-violet-300",
    label: "Feedback",
  },
  data_adjustment: {
    bg: "bg-amber-50 dark:bg-amber-900/25",
    text: "text-amber-700 dark:text-amber-300",
    label: "Data Adj.",
  },
};

function TicketCard({
  ticket,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
  variant = "support",
}) {
  const didDragRef = useRef(false);
  const typeStyle = TYPE_STYLES[ticket.type || variant] || TYPE_STYLES.support;

  const toColumnStatus =
    variant === "feedback"
      ? feedbackToColumnStatus
      : variant === "data_adjustment"
        ? dataAdjustmentToColumnStatus
        : supportToColumnStatus;
  const isNewColumn = toColumnStatus(ticket.status) === "new";
  const hasUserReply =
    (ticket.replyCount || 0) > 0 && ticket.lastReplyRole === "user";
  const showActivityDot = isNewColumn || hasUserReply;

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
    <motion.div
      layout
      initial={{opacity: 0, scale: 0.96}}
      animate={{opacity: 1, scale: 1}}
      exit={{opacity: 0, scale: 0.96}}
      transition={{duration: 0.2, ease: "easeOut"}}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`group relative rounded-xl border bg-white dark:bg-gray-800/95 p-3.5 transition-all duration-150 select-none cursor-default ${
        isDragging
          ? "opacity-40 scale-[0.97] border-violet-300 dark:border-violet-600 shadow-xl ring-2 ring-violet-400/30 z-50"
          : "border-gray-200/70 dark:border-gray-700/50 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 hover:-translate-y-[1px]"
      }`}
    >
      {/* Activity indicator: green dot when newly created or has new user response */}
      {showActivityDot && (
        <span
          className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.3)]"
          aria-label="New or has new response"
        />
      )}

      {/* Drag handle + badges row */}
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="flex-shrink-0 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          aria-hidden
        >
          <GripVertical className="w-3.5 h-3.5" strokeWidth={2.5} />
        </span>
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${typeStyle.bg} ${typeStyle.text}`}
          >
            {typeStyle.label}
          </span>
          {ticket.subscriptionTier && (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 capitalize">
              {ticket.subscriptionTier}
            </span>
          )}
          {ticket.priority && variant === "support" && (
            <PriorityBadge priority={ticket.priority} />
          )}
        </div>
      </div>

      {/* Subject */}
      <p className="font-medium text-gray-900 dark:text-white text-sm leading-snug line-clamp-2 mb-2.5">
        {ticket.subject}
      </p>

      {/* Meta row */}
      <div className="flex flex-col gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 truncate">
            <User className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
            <span className="truncate">
              {ticket.createdByName || ticket.createdByEmail}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 flex-shrink-0">
            <Calendar className="w-3 h-3" strokeWidth={2} />
            {format(new Date(ticket.createdAt), "MMM d")}
          </span>
        </div>
        {ticket.assignedTo != null && (
          <span className="inline-flex items-center gap-1 truncate text-gray-500 dark:text-gray-400">
            <UserCircle className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
            <span className="truncate">{ticket.assignedToName || "Assigned"}</span>
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default TicketCard;
