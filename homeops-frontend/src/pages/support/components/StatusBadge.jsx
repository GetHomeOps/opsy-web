import React from "react";

/** Status display labels for support tickets (4 columns) */
export const SUPPORT_STATUS_LABELS = {
  new: "New",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
  open: "New",
  working_on_it: "In Progress",
  solved: "Completed",
  resolved: "Completed",
};

/** Status display labels for feedback (4 columns) */
export const FEEDBACK_STATUS_LABELS = {
  new: "New",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
  under_review: "In Progress",
  planned: "In Progress",
  implemented: "Completed",
  rejected: "Closed",
};

const STATUS_CLASSES = {
  new: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
  in_progress: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  completed: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
  closed: "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300",
  working_on_it: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  solved: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
  resolved: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
  under_review: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  planned: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  implemented: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
  rejected: "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400",
};

/**
 * Reusable status badge for support and feedback tickets.
 * @param {string} status - Raw status value (e.g. 'new', 'working_on_it', 'solved')
 * @param {object} labels - Optional map of status -> display label (default: SUPPORT_STATUS_LABELS)
 */
function StatusBadge({ status, labels = SUPPORT_STATUS_LABELS }) {
  const normalized = (status || "").toLowerCase().replace(/-/g, "_");
  const label = labels[normalized] ?? labels[status] ?? status ?? "—";
  const className = STATUS_CLASSES[normalized] ?? "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300";

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${className}`}>
      {label}
    </span>
  );
}

export default StatusBadge;
