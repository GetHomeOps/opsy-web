import React from "react";
import {ChevronDown, ChevronRight} from "lucide-react";

/**
 * Simple collapsible section for Maintenance tab.
 * Used to wrap each system's maintenance records.
 */
function MaintenanceCollapsibleSection({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 hover:shadow-sm">
      <button
        onClick={onToggle}
        className="w-full p-4 md:p-5 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          {Icon && (
            <Icon
              className="h-4 w-4 flex-shrink-0"
              style={{color: "#456654"}}
            />
          )}
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
            {title}
          </h3>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" />
        )}
      </button>
      {isOpen && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

export default MaintenanceCollapsibleSection;
