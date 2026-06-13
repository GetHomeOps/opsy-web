import React from "react";
import {PASSPORT_CARD_SHADOW} from "./SectionCard";
import {StatusBadge} from "./StatusBadge";

/**
 * Readonly placeholder card for features that are not implemented yet.
 * No data, no calculations — content is decorative and non-interactive.
 */
function ComingSoonCard({
  title,
  description,
  icon: Icon,
  placeholder = "—",
  compact = false,
  className = "",
}) {
  return (
    <section
      className={`relative rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 overflow-hidden ${className}`}
      style={{boxShadow: PASSPORT_CARD_SHADOW}}
      aria-disabled="true"
    >
      <div
        className={`${compact ? "px-4 py-3" : "px-4 md:px-5 py-4"} select-none`}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            {Icon && (
              <Icon className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
            )}
            <h3 className="text-[13px] font-semibold text-neutral-500 dark:text-neutral-400 truncate">
              {title}
            </h3>
          </div>
          <StatusBadge tone="neutral">Coming Soon</StatusBadge>
        </div>
        <div className="pointer-events-none">
          <p
            className={`${compact ? "text-lg" : "text-xl"} font-bold text-neutral-300 dark:text-neutral-600 tabular-nums`}
          >
            {placeholder}
          </p>
          {description && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default ComingSoonCard;
