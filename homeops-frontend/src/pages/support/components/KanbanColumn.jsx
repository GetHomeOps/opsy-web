import React from "react";

/**
 * Kanban column with light, subtle background (modern ticketing style).
 * White cards pop from the soft column; clean borders and minimal elevation.
 */
function KanbanColumn({
  title,
  count,
  children,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  return (
    <div
      className={`flex-shrink-0 w-[280px] rounded-xl border border-gray-200/50 dark:border-gray-600/40 transition-colors duration-150 ${
        isDragOver
          ? "bg-gray-100 dark:bg-gray-700/30"
          : "bg-gray-50/80 dark:bg-gray-800/25"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-600/40">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {count} {count === 1 ? "ticket" : "tickets"}
        </p>
      </div>
      <div className="px-2 pb-3 pt-2 space-y-2">
        {children}
      </div>
    </div>
  );
}

export default KanbanColumn;
