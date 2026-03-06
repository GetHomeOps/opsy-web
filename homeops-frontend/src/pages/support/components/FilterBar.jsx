import React from "react";
import { Search, X } from "lucide-react";

/**
 * Odoo-style filter bar: search + compact filter dropdowns.
 * Visually pleasing, minimal, integrated.
 */
function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search tickets...",
  filters = [],
  activeFilters = {},
  onFilterChange,
  onClearFilters,
  sortOptions = [],
  sortBy,
  onSortChange,
  extraActions,
}) {
  const hasActiveFilters = Object.values(activeFilters).some((v) => v && v !== "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="form-input pl-9 pr-4 py-2 text-sm w-full rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <select
              key={f.key}
              value={activeFilters[f.key] ?? ""}
              onChange={(e) => onFilterChange(f.key, e.target.value)}
              className="form-select text-sm py-2 pl-3 pr-8 rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 min-w-[120px] hover:border-gray-300 dark:hover:border-gray-500"
            >
              <option value="">{f.label}</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ))}

          {sortOptions.length > 0 && (
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="form-select text-sm py-2 pl-3 pr-8 rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 min-w-[130px]"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {extraActions}
      </div>
    </div>
  );
}

export default FilterBar;
