import React from "react";

/**
 * Compact summary card for Systems / Issues / Recommendations top rows.
 * Self-contained so icon placement matches the screenshot cards.
 */
export default function SummaryStatCard({
  title,
  icon: Icon,
  iconClassName = "text-[#456564] bg-[#456564]/10",
  children,
  className = "",
}) {
  return (
    <section
      className={`rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 p-4 ${className}`}
      style={{boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"}}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </h3>
        {Icon && (
          <span
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${iconClassName}`}
          >
            <Icon className="w-4 h-4" aria-hidden />
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
