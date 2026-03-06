import React, { useState, useRef, useEffect, useCallback } from "react";
import { MapPin, Search, X } from "lucide-react";
import { MOCK_LOCATIONS } from "../data/mockData";

function LocationBar({ value, onChange, className = "" }) {
  const [query, setQuery] = useState(value?.label || "");
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = query.trim()
    ? MOCK_LOCATIONS.filter((loc) =>
        loc.label.toLowerCase().includes(query.toLowerCase()),
      )
    : MOCK_LOCATIONS;

  useEffect(() => {
    setQuery(value?.label || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const select = useCallback(
    (loc) => {
      onChange(loc);
      setQuery(loc.label);
      setOpen(false);
      setHighlightIdx(-1);
    },
    [onChange],
  );

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      select(filtered[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const clear = () => {
    setQuery("");
    onChange(null);
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlightIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="ZIP code or city…"
          className="w-full pl-9 pr-16 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-all"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {query && (
            <button
              type="button"
              onClick={clear}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            className="p-1.5 rounded-lg bg-[#456564] text-white hover:bg-[#34514f] transition-colors"
            onClick={() => {
              if (filtered.length > 0 && query.trim()) select(filtered[0]);
            }}
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {filtered.map((loc, idx) => (
            <button
              key={loc.zip}
              type="button"
              onClick={() => select(loc)}
              className={`flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors ${
                idx === highlightIdx
                  ? "bg-[#456564]/10 dark:bg-[#456564]/20 text-[#456564] dark:text-[#7aa3a2]"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
              <span>{loc.label}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-[100] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
          No matching locations found
        </div>
      )}
    </div>
  );
}

export default LocationBar;
