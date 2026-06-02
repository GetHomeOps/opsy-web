import React, {useState, useRef, useEffect, useCallback} from "react";
import {ChevronDown, Search, Loader2} from "lucide-react";

/** ~5 option rows visible; list scrolls beyond this */
const OPTIONS_LIST_MAX_HEIGHT = "max-h-[11.5rem]";

function formatOptionLabel(option) {
  if (!option) return "";
  if (option.label) return option.label;
  const parts = [option.name];
  if (option.city || option.state) {
    parts.push([option.city, option.state].filter(Boolean).join(", "));
  }
  if (option.website) parts.push(option.website);
  return parts.filter(Boolean).join(" · ");
}

function SearchableAffiliationDropdown({
  label,
  value,
  onChange,
  options = [],
  onSearch,
  loading = false,
  disabled = false,
  placeholder = "Search...",
  footerAction = null,
  emptyMessage = "No results found",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const debounceRef = useRef(null);

  const selected = options.find((o) => String(o.id) === String(value));

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const runSearch = useCallback(
    (term) => {
      if (onSearch) onSearch(term);
    },
    [onSearch],
  );

  // Debounce typed search only — initial fetch runs in handleToggle to avoid double requests.
  useEffect(() => {
    if (!isOpen || disabled || search === "") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(search), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, isOpen, disabled, runSearch]);

  const handleToggle = () => {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setSearch("");
    setIsOpen(true);
    runSearch("");
  };

  const handleSelect = (option) => {
    onChange?.(option.id);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative" ref={ref}>
        <button
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          className={`form-select w-full text-left flex items-center justify-between py-2 px-3 ${
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          }`}
        >
          <span className="flex items-center gap-2 min-w-0 truncate text-sm">
            {selected?.logoDisplayUrl ? (
              <img
                src={selected.logoDisplayUrl}
                alt=""
                className="w-6 h-6 rounded object-cover shrink-0 border border-gray-200 dark:border-gray-600"
              />
            ) : null}
            <span
              className={`truncate ${
                selected ? "text-gray-900 dark:text-gray-100" : "text-gray-400"
              }`}
            >
              {selected ? formatOptionLabel(selected) : placeholder}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl flex flex-col overflow-hidden">
            <div className="shrink-0 p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search..."
                  className="form-input w-full pl-8 text-sm py-1.5"
                  autoFocus
                />
              </div>
            </div>
            <div
              className={`min-h-0 overflow-y-auto overscroll-contain py-1 ${OPTIONS_LIST_MAX_HEIGHT} [scrollbar-width:thin]`}
            >
              <ul role="listbox">
                {loading && options.length === 0 ? (
                  <li className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </li>
                ) : options.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-gray-500 text-center">
                    {emptyMessage}
                  </li>
                ) : (
                  options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={String(value) === String(option.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 ${
                          String(value) === String(option.id)
                            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20"
                            : "text-gray-900 dark:text-gray-100"
                        }`}
                        onClick={() => handleSelect(option)}
                      >
                        {option.logoDisplayUrl ? (
                          <img
                            src={option.logoDisplayUrl}
                            alt=""
                            className="w-7 h-7 rounded object-cover shrink-0 border border-gray-200 dark:border-gray-600"
                          />
                        ) : null}
                        <span className="truncate">{formatOptionLabel(option)}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
            {footerAction && (
              <div className="shrink-0 border-t border-gray-100 dark:border-gray-700 p-1">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-medium"
                  onClick={() => {
                    setIsOpen(false);
                    footerAction.onClick();
                  }}
                >
                  {footerAction.label}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchableAffiliationDropdown;
