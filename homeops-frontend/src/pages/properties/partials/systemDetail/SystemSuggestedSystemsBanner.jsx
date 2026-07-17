import React from "react";
import { Sparkles, Plus } from "lucide-react";

/**
 * CTA when the inspection report identified systems not yet tracked on the property.
 */
export function SystemSuggestedSystemsBanner({
  title,
  description,
  actionLabel = "Add systems",
  onAction,
}) {
  if (!onAction) return null;

  return (
    <div
      className="rounded-xl border border-amber-200/90 dark:border-amber-800/50 bg-amber-50/70 dark:bg-amber-900/15 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">
            {title}
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-primary transition-colors shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
        {actionLabel}
      </button>
    </div>
  );
}
