import React from "react";
import {Loader2} from "lucide-react";

function SkeletonBlock({className = ""}) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`}
      aria-hidden
    />
  );
}

function DocumentRowSkeleton({titleWidthClass}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="flex-1 min-w-0 space-y-1.5">
        <SkeletonBlock className={`h-3.5 ${titleWidthClass}`} />
        <div className="flex items-center gap-2">
          <SkeletonBlock className="h-3.5 w-12 rounded" />
          <SkeletonBlock className="h-3 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}

function SystemGroupSkeleton({docTitleWidths}) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-2 px-2 py-2 rounded-lg">
        <SkeletonBlock className="w-4 h-4 flex-shrink-0" />
        <SkeletonBlock className="w-4 h-4 flex-shrink-0" />
        <SkeletonBlock className="h-4 flex-1 max-w-[min(160px,85%)]" />
        <SkeletonBlock className="h-4 w-6 rounded" />
        <SkeletonBlock className="w-4 h-4 flex-shrink-0 rounded-md" />
      </div>
      <div className="ml-8 pl-2 mt-1 space-y-1">
        {docTitleWidths.map((w, i) => (
          <DocumentRowSkeleton key={i} titleWidthClass={w} />
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors DocumentsTreeView chrome (header, search, upload, tree rows) while documents load.
 */
export default function DocumentsTreeSkeleton() {
  return (
    <div
      className="relative flex flex-col h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <SkeletonBlock className="h-4 w-24" />
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-5 w-16 rounded-full" />
            <SkeletonBlock className="w-7 h-7 rounded-lg" />
          </div>
        </div>
        <div className="mb-3">
          <SkeletonBlock className="h-10 w-full rounded-lg" />
        </div>
        <SkeletonBlock className="h-9 w-full rounded-lg" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <SystemGroupSkeleton docTitleWidths={["w-[92%]", "w-[68%]"]} />
        <SystemGroupSkeleton docTitleWidths={["w-[80%]"]} />
        <SystemGroupSkeleton
          docTitleWidths={["w-[88%]", "w-[55%]", "w-[72%]"]}
        />
      </div>

      {/* Centered loader — matches pre-skeleton prominence; skeleton shows through softly behind */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-[1px]">
        <Loader2
          className="w-10 h-10 text-indigo-500 animate-spin mb-2"
          aria-hidden
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 px-4 text-center">
          Loading documents…
        </p>
      </div>
    </div>
  );
}
