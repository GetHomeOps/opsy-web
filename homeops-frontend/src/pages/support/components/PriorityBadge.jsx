import React from "react";

export const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_CLASSES = {
  low: "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400",
  medium: "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300",
  high: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
  urgent: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

/**
 * Reusable priority badge.
 * @param {string} priority - low | medium | high | urgent
 */
function PriorityBadge({ priority }) {
  const normalized = (priority || "low").toLowerCase();
  const label = PRIORITY_LABELS[normalized] ?? priority ?? "Low";
  const className = PRIORITY_CLASSES[normalized] ?? PRIORITY_CLASSES.low;

  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export default PriorityBadge;
