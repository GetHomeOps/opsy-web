import React from "react";
import {AlertTriangle} from "lucide-react";
import {isDemoSite} from "../utils/demoSite";

/** Persistent banner on demo.heyopsy.com. */
export default function DemoEnvironmentBanner() {
  if (!isDemoSite()) return null;

  return (
    <div
      role="status"
      className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/60 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-100"
    >
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
        <span>
          Demo environment — Document upload and
          AI features are disabled. A full HeyOpsy account includes secure document storage,
          AI inspection analysis, and the Opsy assistant.
        </span>
      </div>
    </div>
  );
}
