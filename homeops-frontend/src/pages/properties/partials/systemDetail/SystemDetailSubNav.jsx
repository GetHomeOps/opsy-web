import React from "react";

export const SYSTEM_DETAIL_TABS = [
  { id: "overview", label: "Overview" },
  { id: "action-items", label: "Action Items" },
  { id: "maintenance", label: "Maintenance & Inspections" },
  { id: "documents", label: "Documents & Media" },
  { id: "history", label: "History" },
];

/**
 * Secondary tab navigation for a single-system detail view (Systems tab).
 */
export function SystemDetailSubNav({ activeTab, onTabChange, actionItemCount = 0 }) {
  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-neutral-100 dark:border-neutral-800 -mx-1"
      aria-label="System sections"
    >
      {SYSTEM_DETAIL_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`py-2.5 px-3 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
            activeTab === tab.id
              ? "border-[#456564] text-[#456564] dark:text-[#5a7a78] dark:border-[#5a7a78]"
              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          }`}
        >
          {tab.label}
          {tab.id === "action-items" && actionItemCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            >
              {actionItemCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
