import React from "react";

/**
 * Kanban column with distinctive gray background (Pipedrive-style).
 * White cards pop from the gray column; column has subtle shadow and elevation.
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
      className={`flex-shrink-0 w-[280px] min-h-[320px] rounded-xl shadow-sm border border-gray-200/60 dark:border-gray-700/50 transition-colors duration-150 ${
        isDragOver
          ? "bg-gray-200 dark:bg-gray-700/50"
          : "bg-gray-100 dark:bg-gray-800/60"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="px-4 py-3 border-b border-gray-200/60 dark:border-gray-700/50">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {count} {count === 1 ? "ticket" : "tickets"}
        </p>
      </div>
      <div className="px-2 pb-3 pt-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        {children}
      </div>
    </div>
  );
}

export default KanbanColumn;
