import React from "react";
import {Loader2} from "lucide-react";

/**
 * In-progress ATTOM public-records fetch. Shown on Financials and Overview
 * while attomStatus is loading or an identity lookup job is active.
 */
function AttomSyncBanner({compact = false, className = ""}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border border-[#456564]/20 bg-[#456564]/5 dark:bg-[#456564]/10 px-3.5 py-3 ${className}`}
    >
      <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin text-[#456564]" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
          Pulling public records and market estimates…
        </p>
        {!compact && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            You can keep using this page. Values will appear as they arrive.
          </p>
        )}
      </div>
    </div>
  );
}

export default AttomSyncBanner;
