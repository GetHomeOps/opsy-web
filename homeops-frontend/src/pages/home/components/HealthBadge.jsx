import React from "react";

/**
 * Compact health score badge with progress bar and label.
 * Used on Agent home (property cards and health distribution).
 */
function HealthBadge({ score }) {
  const label =
    score >= 80
      ? "Excellent"
      : score >= 60
        ? "Good"
        : score >= 40
          ? "Fair"
          : "Needs Attention";
  const colorClass =
    score >= 80
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
      : score >= 60
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400";
  const barColor =
    score >= 80
      ? "bg-emerald-500"
      : score >= 60
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap ${colorClass}`}
      >
        {score}
      </span>
    </div>
  );
}

export default HealthBadge;
