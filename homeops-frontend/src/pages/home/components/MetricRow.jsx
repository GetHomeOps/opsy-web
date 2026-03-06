import React from "react";

/**
 * Row for label + value with optional icon. Used in SuperAdmin KPI breakdowns.
 */
function MetricRow({ label, value, icon: Icon, color = "text-gray-400" }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

export default MetricRow;
