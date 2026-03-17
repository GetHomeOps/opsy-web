import React from "react";
import {AnimatePresence, motion} from "framer-motion";

const COLUMN_COLORS = {
  new: {
    dot: "bg-blue-500",
    dropBg: "bg-blue-50/60 dark:bg-blue-900/15",
    dropBorder: "border-blue-300 dark:border-blue-700",
    countBg: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  },
  in_progress: {
    dot: "bg-amber-500",
    dropBg: "bg-amber-50/60 dark:bg-amber-900/15",
    dropBorder: "border-amber-300 dark:border-amber-700",
    countBg:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  },
  completed: {
    dot: "bg-emerald-500",
    dropBg: "bg-emerald-50/60 dark:bg-emerald-900/15",
    dropBorder: "border-emerald-300 dark:border-emerald-700",
    countBg:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  },
  closed: {
    dot: "bg-gray-400",
    dropBg: "bg-gray-50/60 dark:bg-gray-800/30",
    dropBorder: "border-gray-300 dark:border-gray-600",
    countBg: "bg-gray-100 dark:bg-gray-700/40 text-gray-600 dark:text-gray-400",
  },
};

function KanbanColumn({
  id,
  title,
  count,
  children,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const colors = COLUMN_COLORS[id] || COLUMN_COLORS.new;

  return (
    <div
      className={`flex-shrink-0 w-[300px] flex flex-col rounded-xl transition-all duration-200 ${
        isDragOver
          ? `${colors.dropBg} ${colors.dropBorder} border-2 border-dashed shadow-inner`
          : "bg-gray-50/60 dark:bg-gray-800/20 border border-gray-200/40 dark:border-gray-700/30"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div className="px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-[13px] tracking-wide uppercase">
            {title}
          </h3>
        </div>
        <span
          className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-semibold tabular-nums ${colors.countBg}`}
        >
          {count}
        </span>
      </div>

      {/* Cards container */}
      <div className="px-2.5 pb-3 space-y-2.5 min-h-[80px] flex-1">
        <AnimatePresence mode="popLayout">{children}</AnimatePresence>
      </div>
    </div>
  );
}

export default KanbanColumn;
