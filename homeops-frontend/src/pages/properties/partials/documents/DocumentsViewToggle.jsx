import React from "react";
import {LayoutGrid, List} from "lucide-react";
import useLocalStorage from "../../../../hooks/useLocalStorage";

export const DOCUMENTS_VIEW_MODE_KEY = "documents-view-mode";

/** Shared list/grid preference for the Documents tab and system Documents & Media. */
export function useDocumentsViewMode() {
  const [stored, setStored] = useLocalStorage(DOCUMENTS_VIEW_MODE_KEY, "list");
  const viewMode = stored === "grid" ? "grid" : "list";
  return [viewMode, setStored];
}

function DocumentsViewToggle({viewMode, onChange, size = "md", className = ""}) {
  const pad = size === "sm" ? "px-2 py-1.5" : "px-2.5 py-2";

  return (
    <div
      className={`flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden shrink-0 ${className}`}
      role="group"
      aria-label="Document view"
    >
      <button
        type="button"
        onClick={() => onChange("grid")}
        className={`${pad} transition-colors ${
          viewMode === "grid"
            ? "btn-segment-active"
            : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
        title="Grid view"
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`${pad} transition-colors ${
          viewMode === "list"
            ? "btn-segment-active"
            : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        }`}
        title="List view"
        aria-label="List view"
        aria-pressed={viewMode === "list"}
      >
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}

export default DocumentsViewToggle;
