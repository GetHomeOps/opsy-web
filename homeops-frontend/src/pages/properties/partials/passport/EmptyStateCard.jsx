import React from "react";

/**
 * Polished empty state used inside cards: icon, one-liner, optional CTA.
 * The CTA must be wired to an existing handler only.
 */
function EmptyStateCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50/40 dark:bg-neutral-800/30 px-4 py-6 ${className}`}
    >
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-2">
          <Icon className="w-5 h-5 text-neutral-400 dark:text-neutral-500" />
        </div>
      )}
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {title}
      </p>
      {description && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#456564] hover:bg-[#34514f] transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default EmptyStateCard;
