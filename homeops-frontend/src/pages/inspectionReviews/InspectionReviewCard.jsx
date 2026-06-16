import React, {useRef, useCallback} from "react";
import {motion} from "framer-motion";
import {format} from "date-fns";
import {
  GripVertical,
  Building2,
  User as UserIcon,
  Calendar,
  MessageSquare,
} from "lucide-react";

const STATUS_STYLES = {
  pending_review: {
    bg: "bg-blue-50 dark:bg-blue-900/25",
    text: "text-blue-700 dark:text-blue-300",
    label: "New",
  },
  revision_requested: {
    bg: "bg-amber-50 dark:bg-amber-900/25",
    text: "text-amber-700 dark:text-amber-300",
    label: "Further review",
  },
  approved: {
    bg: "bg-emerald-50 dark:bg-emerald-900/25",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Approved",
  },
};

function InspectionReviewCard({
  item,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
  suggestFurtherReview = false,
}) {
  const didDragRef = useRef(false);
  const statusStyle =
    STATUS_STYLES[item.reviewStatus] || STATUS_STYLES.pending_review;

  const handleDragStart = useCallback(
    (e) => {
      didDragRef.current = true;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(item.id));
      onDragStart?.(e, item);
    },
    [item, onDragStart],
  );

  const handleClick = useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onClick?.();
  }, [onClick]);

  return (
    <motion.div
      layout
      initial={{opacity: 0, y: 8}}
      animate={{opacity: isDragging ? 0.5 : 1, y: 0}}
      exit={{opacity: 0, scale: 0.95}}
      transition={{duration: 0.2}}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
      className={`group cursor-pointer rounded-xl border bg-white dark:bg-gray-800 p-3.5 shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 ${
        suggestFurtherReview
          ? "border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-200/80 dark:ring-amber-800/40"
          : "border-gray-200/80 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
        <div className="min-w-0 flex-1">
          {suggestFurtherReview && (
            <p className="flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 mb-2">
              <MessageSquare className="w-3 h-3 shrink-0" />
              Has feedback — move to Further Review
            </p>
          )}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
            >
              {statusStyle.label}
            </span>
            <span className="text-[10px] text-gray-400">#{item.id}</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 flex items-start gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
            {item.propertyAddress}
          </p>
          <div className="mt-2 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
            <p className="flex items-center gap-1 truncate">
              <UserIcon className="w-3 h-3 shrink-0" />
              {item.customerName}
            </p>
            <p className="flex items-center gap-1">
              <Calendar className="w-3 h-3 shrink-0" />
              {item.uploadedAt
                ? format(new Date(item.uploadedAt), "MMM d, yyyy")
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default InspectionReviewCard;
