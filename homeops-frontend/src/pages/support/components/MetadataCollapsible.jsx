import React, { useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";

/**
 * Collapsible section for secondary metadata (user info, plan, IDs, etc.).
 */
function MetadataCollapsible({ title, icon: Icon = User, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50/50 dark:bg-gray-800/30">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        {Icon && <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
        <span>{title}</span>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
          {children}
        </div>
      )}
    </div>
  );
}

export default MetadataCollapsible;
