import React, {useState} from "react";
import {Star, X, ChevronDown, MapPin, Shield} from "lucide-react";
import {LANGUAGES} from "../data/mockData";

const RATING_OPTIONS = [
  {value: 4.5, label: "4.5 & up"},
  {value: 4, label: "4.0 & up"},
  {value: 3.5, label: "3.5 & up"},
  {value: 3, label: "3.0 & up"},
];

const RADIUS_OPTIONS = [
  {value: 10, label: "10 miles"},
  {value: 25, label: "25 miles"},
  {value: 50, label: "50 miles"},
  {value: 100, label: "100 miles"},
  {value: 200, label: "200 miles"},
];

const BUDGET_OPTIONS = [
  {value: "$$$$", label: "$$$$", description: "Premium"},
  {value: "$$$", label: "$$$", description: "High-end"},
  {value: "$$", label: "$$", description: "Mid-range"},
  {value: "$", label: "$", description: "Budget-friendly"},
];

function FilterSection({title, children, defaultOpen = true}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 dark:border-gray-700/40 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-3 text-left group"
      >
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
            open ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FiltersSidebar({filters, onFilterChange, onClearFilters, categories = []}) {
  const hasActiveFilters =
    filters.categoryId ||
    filters.minRating ||
    filters.language ||
    filters.radius ||
    filters.budget ||
    filters.verified;

  const updateFilter = (key, val) => {
    onFilterChange({...filters, [key]: val});
  };

  return (
    <aside className="w-full">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
            Filters
          </h3>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-medium text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] transition-colors inline-flex items-center gap-0.5"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>

        <FilterSection title="Category">
          <select
            value={filters.categoryId || ""}
            onChange={(e) => updateFilter("categoryId", e.target.value || null)}
            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-2.5 focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-all"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </FilterSection>

        <FilterSection title="Radius">
          <select
            value={filters.radius ?? ""}
            onChange={(e) =>
              updateFilter(
                "radius",
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-2.5 focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-all"
          >
            <option value="">No limit</option>
            {RADIUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FilterSection>

        <FilterSection title="Budget">
          <div className="space-y-1">
            {BUDGET_OPTIONS.map((opt) => {
              const isActive = filters.budget === opt.value;
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() =>
                      updateFilter("budget", isActive ? null : opt.value)
                    }
                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-[#456564] focus:ring-[#456564]/30 focus:ring-offset-0"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    <span className="font-semibold">{opt.label}</span>
                    <span className="text-gray-400 dark:text-gray-500"> – {opt.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection title="Language">
          <select
            value={filters.language || ""}
            onChange={(e) => updateFilter("language", e.target.value || null)}
            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-2 px-2.5 focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-all"
          >
            <option value="">Any Language</option>
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </FilterSection>

        <FilterSection title="Rating">
          <div className="space-y-1">
            {RATING_OPTIONS.map((opt) => {
              const isActive = filters.minRating === opt.value;
              const fullStars = Math.floor(opt.value);
              const hasHalf = opt.value % 1 !== 0;
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() =>
                      updateFilter("minRating", isActive ? null : opt.value)
                    }
                    className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-[#456564] focus:ring-[#456564]/30 focus:ring-offset-0"
                  />
                  <span className="flex items-center gap-1">
                    {Array.from({length: 5}, (_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < fullStars
                            ? "fill-amber-400 text-amber-400"
                            : i === fullStars && hasHalf
                              ? "fill-amber-400/50 text-amber-400"
                              : "fill-gray-200 dark:fill-gray-600 text-gray-200 dark:text-gray-600"
                        }`}
                      />
                    ))}
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-0.5">& up</span>
                  </span>
                </label>
              );
            })}
          </div>
        </FilterSection>

        <FilterSection title="Verified" defaultOpen={false}>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.verified || false}
              onChange={(e) =>
                updateFilter("verified", e.target.checked || null)
              }
              className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-[#456564] focus:ring-[#456564]/30 focus:ring-offset-0"
            />
            <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
              <Shield className="w-3 h-3 text-emerald-500" />
              Licensed & Verified only
            </span>
          </label>
        </FilterSection>
      </div>
    </aside>
  );
}

export default FiltersSidebar;
