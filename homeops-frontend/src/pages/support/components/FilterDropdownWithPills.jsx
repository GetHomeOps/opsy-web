import React, {useState, useEffect, useRef} from "react";
import {Search, Filter, ChevronRight, ChevronLeft, X} from "lucide-react";

/**
 * PropertiesList-style filter: single dropdown with multiple categories,
 * pills showing active filters, and clear all option.
 *
 * filterCategories: [{ type, label }]
 * filterOptions: { [type]: [{ value, label }] }
 * activeFilters: [{ type, value, label }]
 */
function FilterDropdownWithPills({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterCategories = [],
  filterOptions = {},
  activeFilters = [],
  onAddFilter,
  onRemoveFilter,
  onClearFilters,
  sortOptions = [],
  sortBy,
  onSortChange,
  extraActions,
}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setActiveCategory(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isFilterActive = (type, value) =>
    activeFilters.some((f) => f.type === type && f.value === value);

  const toggleFilter = (type, value, label) => {
    if (isFilterActive(type, value)) {
      onRemoveFilter({type, value});
    } else {
      onAddFilter({type, value, label});
    }
  };

  const getCategoryLabel = (type) =>
    filterCategories.find((c) => c.type === type)?.label ?? type;

  return (
    <div className="space-y-3">
      {/* Search + Filter button + Sort */}
      <div className="flex flex-wrap items-center gap-2">
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

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setActiveCategory(null);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filter
            {activeFilters.length > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                {activeFilters.length}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1.5 z-30 min-w-[200px] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
              {!activeCategory ? (
                <ul className="py-1.5">
                  {filterCategories.map((cat) => {
                    const count = activeFilters.filter(
                      (f) => f.type === cat.type,
                    ).length;
                    return (
                      <li key={cat.type}>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          onClick={() => setActiveCategory(cat.type)}
                        >
                          <span>{cat.label}</span>
                          <span className="flex items-center gap-1 text-gray-400">
                            {count > 0 && (
                              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                                {count}
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700/60 transition-colors"
                    onClick={() => setActiveCategory(null)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    {getCategoryLabel(activeCategory)}
                  </button>
                  <ul className="py-1.5 max-h-64 overflow-y-auto">
                    {(filterOptions[activeCategory] ?? []).map((opt) => {
                      const active = isFilterActive(activeCategory, opt.value);
                      return (
                        <li key={opt.value}>
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                            onClick={() =>
                              toggleFilter(activeCategory, opt.value, opt.label)
                            }
                          >
                            <span
                              className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                active
                                  ? "bg-violet-500 border-violet-500"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {active && (
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={3}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{opt.label}</span>
                          </button>
                        </li>
                      );
                    })}
                    {(filterOptions[activeCategory] ?? []).length === 0 && (
                      <li className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">
                        No options
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {sortOptions.length > 0 && (
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="form-select text-sm py-2 pl-3 pr-8 rounded-lg border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 min-w-[130px]"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}

        {extraActions}
      </div>

      {/* Active filter pills + Clear all */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((f) => (
            <span
              key={`${f.type}-${f.value}`}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20"
            >
              <span className="text-violet-500 dark:text-violet-400 font-normal">
                {getCategoryLabel(f.type)}:
              </span>
              {f.label}
              <button
                type="button"
                onClick={() => onRemoveFilter({type: f.type, value: f.value})}
                className="ml-0.5 p-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/20 transition-colors"
                aria-label="Remove filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

export default FilterDropdownWithPills;
