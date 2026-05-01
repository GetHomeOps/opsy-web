import React, {useState, useRef, useEffect} from "react";

import useDropdownAlignment from "../hooks/useDropdownAlignment";

/**
 * Reusable Odoo-style filter dropdown.
 * @param {Object} props
 * @param {Array<{type: string, labelKey: string}>} props.filterCategories - Categories to filter by
 * @param {Object} props.filterOptions - Options keyed by category type: { [type]: [{value, label, dot?}] }
 * @param {Array<{type: string, value: string, label?: string}>} props.activeFilters
 * @param {Function} props.onAdd - (filter) => void
 * @param {Function} props.onRemove - (filter) => void
 * @param {Function} props.t - Translation function
 */
function FilterDropdown({
  filterCategories,
  filterOptions,
  activeFilters,
  onAdd,
  onRemove,
  t,
}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const align = useDropdownAlignment(buttonRef, open);

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
      onRemove({type, value});
    } else {
      onAdd({type, value, label});
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setActiveCategory(null);
        }}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        {t("filter")}
        {activeFilters.length > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
            {activeFilters.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1.5 z-30 min-w-[200px] max-w-[calc(100vw-1.5rem)] bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
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
                      <span>{t(cat.labelKey)}</span>
                      <span className="flex items-center gap-1 text-gray-400">
                        {count > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400">
                            {count}
                          </span>
                        )}
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
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
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t(
                  filterCategories.find((c) => c.type === activeCategory)
                    ?.labelKey,
                )}
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
                        {opt.dot && (
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{backgroundColor: opt.dot}}
                          />
                        )}
                        <span className="truncate">{opt.label}</span>
                      </button>
                    </li>
                  );
                })}
                {(filterOptions[activeCategory] ?? []).length === 0 && (
                  <li className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">
                    {t("noItemsFound")}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FilterDropdown;
