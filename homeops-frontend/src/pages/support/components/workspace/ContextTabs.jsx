import React from "react";

function ContextTabs({ tabs, activeTab, onTabChange }) {
  return (
    <div className="flex border-b border-gray-200 dark:border-gray-700/60 px-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative ${
            activeTab === tab.id
              ? "text-[#456564] dark:text-[#7a9e9c]"
              : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#456564] dark:bg-[#7a9e9c] rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

export default ContextTabs;
