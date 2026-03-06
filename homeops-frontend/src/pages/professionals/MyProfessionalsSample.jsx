import React, {useState, useMemo, useCallback} from "react";
import {useNavigate} from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  Bookmark,
  Search,
  LayoutGrid,
  List,
  Star,
  X,
  Users,
} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {ProfessionalCard} from "./components";
import {MOCK_PROFESSIONALS, SERVICE_CATEGORIES} from "./data/mockData";

const RATING_OPTIONS = [
  {value: 4.5, label: "4.5+"},
  {value: 4, label: "4+"},
  {value: 3.5, label: "3.5+"},
];

function MyProfessionalsSample() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterRating, setFilterRating] = useState(null);
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";

  const [professionals, setProfessionals] = useState(MOCK_PROFESSIONALS);

  const toggleSave = useCallback((proId) => {
    setProfessionals((prev) =>
      prev.map((p) => (p.id === proId ? {...p, saved: !p.saved} : p)),
    );
  }, []);

  const allSaved = useMemo(
    () => professionals.filter((p) => p.saved),
    [professionals],
  );

  const savedCategories = useMemo(() => {
    const counts = {};
    allSaved.forEach((pro) => {
      counts[pro.categoryId] = (counts[pro.categoryId] || 0) + 1;
    });
    return SERVICE_CATEGORIES.filter((c) => counts[c.id])
      .map((c) => ({...c, count: counts[c.id]}))
      .sort((a, b) => b.count - a.count);
  }, [allSaved]);

  const savedPros = useMemo(() => {
    let list = allSaved;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.companyName.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q),
      );
    }
    if (filterCategoryId) {
      list = list.filter((p) => p.categoryId === filterCategoryId);
    }
    if (filterRating != null) {
      list = list.filter((p) => p.rating >= filterRating);
    }
    return list;
  }, [allSaved, searchTerm, filterCategoryId, filterRating]);

  const groupedByCategory = useMemo(() => {
    const groups = {};
    savedPros.forEach((pro) => {
      if (!groups[pro.categoryId]) {
        const cat = SERVICE_CATEGORIES.find((c) => c.id === pro.categoryId);
        groups[pro.categoryId] = {
          categoryId: pro.categoryId,
          categoryName: cat?.name || pro.categoryName,
          imageUrl: cat?.imageUrl,
          pros: [],
        };
      }
      groups[pro.categoryId].pros.push(pro);
    });
    return Object.values(groups).sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName),
    );
  }, [savedPros]);

  const toggleCategory = (catId) => {
    setExpandedCategories((prev) => ({...prev, [catId]: !prev[catId]}));
  };

  const isExpanded = (catId) => expandedCategories[catId] !== false;

  const hasActiveFilters = filterCategoryId || filterRating != null;

  const clearFilters = () => {
    setFilterCategoryId("");
    setFilterRating(null);
    setSearchTerm("");
  };

  const goToSampleDirectory = () =>
    navigate(
      accountUrl ? `/${accountUrl}/professionals-sample` : "/professionals-sample",
    );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50 dark:bg-gray-900">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            <button
              type="button"
              onClick={goToSampleDirectory}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#456564] dark:text-[#7aa3a2] hover:text-[#34514f] dark:hover:text-[#9ec5c4] transition-colors mb-5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Directory
            </button>

            {/* Header card with filters */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/60 dark:border-gray-700/50 shadow-sm p-5 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
                    <Bookmark className="w-5 h-5 text-[#456564] dark:text-[#7aa3a2]" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                      My Professionals
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {allSaved.length} saved across{" "}
                      {savedCategories.length} categor
                      {savedCategories.length !== 1 ? "ies" : "y"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search saved pros…"
                      className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] focus:bg-white dark:focus:bg-gray-800 transition-all"
                    />
                  </div>
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`px-2.5 py-2 transition-colors ${
                        viewMode === "grid"
                          ? "bg-[#456564] text-white"
                          : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      }`}
                      title="Grid view"
                      aria-label="Grid view"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`px-2.5 py-2 transition-colors ${
                        viewMode === "list"
                          ? "bg-[#456564] text-white"
                          : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      }`}
                      title="List view"
                      aria-label="List view"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Category pills */}
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700/50">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                  Category
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterCategoryId("")}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 ${
                      !filterCategoryId
                        ? "border-[#456564] bg-[#456564] text-white shadow-sm"
                        : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#456564]/40 hover:text-[#456564] dark:hover:text-[#7aa3a2] bg-white dark:bg-gray-700"
                    }`}
                  >
                    <Users className="w-3 h-3" />
                    All
                    <span
                      className={`ml-0.5 text-[10px] ${!filterCategoryId ? "text-white/70" : "text-gray-400 dark:text-gray-500"}`}
                    >
                      {allSaved.length}
                    </span>
                  </button>
                  {savedCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setFilterCategoryId(
                          filterCategoryId === cat.id ? "" : cat.id,
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 ${
                        filterCategoryId === cat.id
                          ? "border-[#456564] bg-[#456564] text-white shadow-sm"
                          : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#456564]/40 hover:text-[#456564] dark:hover:text-[#7aa3a2] bg-white dark:bg-gray-700"
                      }`}
                    >
                      {cat.name}
                      <span
                        className={`ml-0.5 text-[10px] ${filterCategoryId === cat.id ? "text-white/70" : "text-gray-400 dark:text-gray-500"}`}
                      >
                        {cat.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating filter pills */}
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2.5">
                  Minimum Rating
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {RATING_OPTIONS.map((opt) => {
                    const isActive = filterRating === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setFilterRating(isActive ? null : opt.value)
                        }
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-200 ${
                          isActive
                            ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 shadow-sm"
                            : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-amber-300 hover:text-amber-600 dark:hover:text-amber-400 bg-white dark:bg-gray-700"
                        }`}
                      >
                        <Star
                          className={`w-3 h-3 ${isActive ? "fill-amber-400 text-amber-400" : "fill-gray-300 dark:fill-gray-500 text-gray-300 dark:text-gray-500"}`}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-[#456564] dark:hover:text-[#7aa3a2] transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Clear all
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Results summary */}
            {hasActiveFilters && savedPros.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Showing{" "}
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {savedPros.length}
                </span>{" "}
                of {allSaved.length} saved professionals
              </p>
            )}

            {/* Content */}
            {savedPros.length > 0 ? (
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {savedPros.map((pro) => (
                    <ProfessionalCard
                      key={pro.id}
                      professional={pro}
                      onToggleSave={toggleSave}
                      variant="grid"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {groupedByCategory.map((group) => (
                    <div key={group.categoryId}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(group.categoryId)}
                        className="flex items-center gap-3 w-full mb-3 group/header"
                      >
                        {group.imageUrl && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-gray-200/80 dark:ring-gray-700/50">
                            <img
                              src={group.imageUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white group-hover/header:text-[#456564] dark:group-hover/header:text-[#7aa3a2] transition-colors truncate">
                            {group.categoryName}
                          </h3>
                          <span className="shrink-0 text-[11px] font-semibold text-[#456564] dark:text-[#7aa3a2] bg-[#456564]/10 dark:bg-[#456564]/20 px-2 py-0.5 rounded-full">
                            {group.pros.length}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${
                            isExpanded(group.categoryId)
                              ? "rotate-0"
                              : "-rotate-90"
                          }`}
                        />
                      </button>
                      <div
                        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                          isExpanded(group.categoryId)
                            ? "grid-rows-[1fr]"
                            : "grid-rows-[0fr]"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="space-y-3 pb-2">
                            {group.pros.map((pro) => (
                              <ProfessionalCard
                                key={pro.id}
                                professional={pro}
                                onToggleSave={toggleSave}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                  <Bookmark className="w-7 h-7 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {searchTerm || hasActiveFilters
                    ? "No matching professionals"
                    : "No saved professionals yet"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
                  {searchTerm || hasActiveFilters
                    ? "Try adjusting your search or filters"
                    : "Browse the directory and save professionals you'd like to keep track of"}
                </p>
                {searchTerm || hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm font-medium text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] transition-colors"
                  >
                    Clear all filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goToSampleDirectory}
                    className="text-sm font-medium bg-[#456564] text-white px-5 py-2.5 rounded-lg hover:bg-[#34514f] transition-colors shadow-sm"
                  >
                    Browse Directory
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default MyProfessionalsSample;
