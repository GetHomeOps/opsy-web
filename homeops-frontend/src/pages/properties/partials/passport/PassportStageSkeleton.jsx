import React from "react";

function SkeletonBlock({className = ""}) {
  return (
    <div
      className={`bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse ${className}`}
      aria-hidden
    />
  );
}

/** Grey skeleton for Passport Completion stage while score data loads. */
function PassportStageSkeleton() {
  return (
    <div
      className="space-y-3"
      data-section-id="health-status"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading passport stage</span>
      <div className="flex items-start gap-3">
        <SkeletonBlock className="h-[100px] w-[80px] rounded-lg shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <SkeletonBlock className="h-4 w-40" />
          <div className="space-y-1.5 pt-0.5">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-[95%]" />
            <SkeletonBlock className="h-3 w-[88%]" />
            <SkeletonBlock className="h-3 w-[72%]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PassportStageSkeleton;
