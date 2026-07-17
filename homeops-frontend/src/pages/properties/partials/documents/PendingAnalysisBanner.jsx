import React from "react";
import { Sparkles, X } from "lucide-react";

function PendingAnalysisBanner({ count, onReview, onDismiss }) {
  if (!count || count < 2) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[min(100%,36rem)] mx-4 flex items-start gap-2 rounded-lg border border-[#456564]/30 dark:border-[#456564]/50 bg-[#456564]/5 dark:bg-[#456564]/15 px-3 py-2.5 text-sm shadow-lg">
      <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#456564]" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100">
          {count} documents filed — ready for AI review
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
          Run AI analysis to extract dates, findings, pricing, and maintenance
          recommendations.
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onReview}
          className="text-xs font-medium px-2.5 py-1 rounded-md btn-primary"
        >
          Review now
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-gray-500"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default PendingAnalysisBanner;
