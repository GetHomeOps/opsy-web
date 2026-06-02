import React from "react";

function SkeletonBlock({className = ""}) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`}
      aria-hidden
    />
  );
}

export default function AgencyFormSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading agency</span>
      {/* Header card — logo + summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0 w-full">
            <SkeletonBlock className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-3 pt-1">
              <SkeletonBlock className="h-7 w-48 max-w-full" />
              <SkeletonBlock className="h-4 w-56 max-w-full" />
              <SkeletonBlock className="h-4 w-40 max-w-full" />
              <SkeletonBlock className="h-4 w-32 max-w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs + form body */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex flex-wrap gap-x-8 gap-y-2 py-4">
            <SkeletonBlock className="h-4 w-14" />
            <SkeletonBlock className="h-4 w-16" />
            <SkeletonBlock className="h-4 w-14" />
          </div>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 space-y-6">
            <SkeletonBlock className="h-5 w-44" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="md:col-span-2 space-y-2">
                <SkeletonBlock className="h-3.5 w-24" />
                <SkeletonBlock className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <SkeletonBlock className="h-3.5 w-16" />
                <SkeletonBlock className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <SkeletonBlock className="h-3.5 w-14" />
                <SkeletonBlock className="h-9 w-full rounded-md" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <SkeletonBlock className="h-3.5 w-20" />
                <SkeletonBlock className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <SkeletonBlock className="h-3.5 w-10" />
                <SkeletonBlock className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <SkeletonBlock className="h-3.5 w-12" />
                <SkeletonBlock className="h-9 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <SkeletonBlock className="h-3.5 w-14" />
                <SkeletonBlock className="h-9 w-full rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
