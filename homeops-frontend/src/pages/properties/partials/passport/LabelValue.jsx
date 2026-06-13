import React from "react";

/** Stacked label/value pair for read-only passport cards. */
function LabelValue({label, value, className = ""}) {
  const isEmpty =
    value == null || (typeof value === "string" && value.trim() === "");
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
        {label}
      </div>
      <div
        className={`text-sm mt-0.5 break-words ${
          isEmpty
            ? "text-neutral-400 dark:text-neutral-600"
            : "font-medium text-neutral-900 dark:text-white"
        }`}
      >
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}

export default LabelValue;
