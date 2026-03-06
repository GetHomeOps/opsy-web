import React, {useState, useEffect, useMemo} from "react";
import {useSearchParams, useNavigate} from "react-router-dom";
import {ArrowLeft, SlidersHorizontal, X, Search} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {LocationBar, ProfessionalCard, FiltersSidebar} from "./components";
import {
  MOCK_PROFESSIONALS,
  SERVICE_CATEGORIES,
} from "./data/mockData";

const RESULTS_PER_PAGE = 10;

const EMPTY_FILTERS = {
  categoryId: null,
  minRating: null,
  language: null,
  radius: null,
  budget: null,
  verified: null,
};

const flatCategories = SERVICE_CATEGORIES.map((c) => ({id: c.id, name: c.name}));

function CategoryDirectoryPageSample() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || "";

  const categoryParam = searchParams.get("category");
  const cityParam = searchParams.get("city");
  const stateParam = searchParams.get("state");

  const [location, setLocation] = useState(() => {
    if (cityParam && stateParam) {
      return {
        label: `${cityParam}, ${stateParam}`,
        city: cityParam,
        state: stateParam,
      };
    }
    return null;
  });

  const [filters, setFilters] = useState({
    ...EMPTY_FILTERS,
    categoryId: categoryParam || null,
  });

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [professionals, setProfessionals] = useState(MOCK_PROFESSIONALS);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      categoryId: categoryParam || prev.categoryId,
    }));
  }, [categoryParam]);

  const filtered = useMemo(() => {
    let list = [...professionals];

    if (filters.categoryId) {
      list = list.filter((p) => p.categoryId === filters.categoryId);
    }
    if (location?.city && location?.state) {
      list = list.filter(
        (p) =>
          p.location?.city === location.city &&
          p.location?.state === location.state,
      );
    }
    if (searchDebounced.trim()) {
      const q = searchDebounced.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.companyName && p.companyName.toLowerCase().includes(q)) ||
          (p.categoryName && p.categoryName.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)),
      );
    }
    if (filters.minRating != null) {
      list = list.filter((p) => p.rating >= filters.minRating);
    }
    if (filters.language) {
      list = list.filter(
        (p) => p.languages && p.languages.includes(filters.language),
      );
    }

    return list;
  }, [professionals, filters, location, searchDebounced]);

  const toggleSave = (proId) => {
    setProfessionals((prev) =>
      prev.map((p) =>
        p.id === proId ? {...p, saved: !p.saved} : p,
      ),
    );
  };

  const totalPages = Math.ceil(filtered.length / RESULTS_PER_PAGE);
  const paginated = filtered.slice(
    (page - 1) * RESULTS_PER_PAGE,
    page * RESULTS_PER_PAGE,
  );

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setLocation(null);
    setPage(1);
  };

  const categoryName =
    flatCategories.find((c) => String(c.id) === String(filters.categoryId))
      ?.name || "All Professionals";

  const activeFilterCount = [
    filters.categoryId,
    filters.minRating,
    filters.language,
    filters.radius,
    filters.budget,
    filters.verified,
  ].filter(Boolean).length;

  const backUrl = accountUrl ? `/${accountUrl}/professionals-sample` : "/professionals-sample";

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden bg-gray-50/50 dark:bg-gray-900">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {/* Breadcrumb & Title */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => navigate(backUrl)}
                className="inline-flex items-center gap-2 text-sm font-medium text-[#456564] dark:text-[#7aa3a2] hover:text-[#34514f] dark:hover:text-[#9ec5c4] transition-colors mb-3"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Directory
              </button>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {categoryName}
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {filtered.length} professional
                    {filtered.length !== 1 ? "s" : ""} found
                    {location?.city
                      ? ` in ${location.city}, ${location.state}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by name or keyword…"
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                    className="xl:hidden relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#456564] text-white text-[9px] font-bold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-6">
              {/* Left sidebar filters */}
              <div className="hidden xl:block w-60 shrink-0">
                <div className="sticky top-8 space-y-3">
                  <LocationBar
                    value={location}
                    onChange={(loc) => {
                      setLocation(loc);
                      setPage(1);
                    }}
                  />
                  <FiltersSidebar
                    filters={filters}
                    onFilterChange={(f) => {
                      setFilters(f);
                      setPage(1);
                    }}
                    onClearFilters={clearFilters}
                    categories={flatCategories}
                  />
                </div>
              </div>

              {/* Mobile filters drawer */}
              {mobileFiltersOpen && (
                <div className="fixed inset-0 z-50 xl:hidden">
                  <div
                    className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                    onClick={() => setMobileFiltersOpen(false)}
                  />
                  <div className="absolute right-0 top-0 bottom-0 w-72 max-w-[80vw] bg-white dark:bg-gray-900 overflow-y-auto shadow-2xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                        Filters
                      </h3>
                      <button
                        type="button"
                        onClick={() => setMobileFiltersOpen(false)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-3 space-y-3">
                      <LocationBar
                        value={location}
                        onChange={(loc) => {
                          setLocation(loc);
                          setPage(1);
                        }}
                      />
                      <FiltersSidebar
                        filters={filters}
                        onFilterChange={(f) => {
                          setFilters(f);
                          setPage(1);
                        }}
                        onClearFilters={clearFilters}
                        categories={flatCategories}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              <div className="flex-1 min-w-0">
                {paginated.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      {paginated.map((pro) => (
                        <ProfessionalCard
                          key={pro.id}
                          professional={pro}
                          onToggleSave={toggleSave}
                        />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-gray-700/50">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Showing{" "}
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {(page - 1) * RESULTS_PER_PAGE + 1}
                          </span>{" "}
                          –{" "}
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {Math.min(
                              page * RESULTS_PER_PAGE,
                              filtered.length,
                            )}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {filtered.length}
                          </span>
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Prev
                          </button>
                          {Array.from(
                            {length: Math.min(totalPages, 5)},
                            (_, i) => {
                              let pageNum;
                              if (totalPages <= 5) {
                                pageNum = i + 1;
                              } else if (page <= 3) {
                                pageNum = i + 1;
                              } else if (page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                              } else {
                                pageNum = page - 2 + i;
                              }
                              return (
                                <button
                                  key={pageNum}
                                  type="button"
                                  onClick={() => setPage(pageNum)}
                                  className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                                    page === pageNum
                                      ? "bg-[#456564] text-white"
                                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            },
                          )}
                          <button
                            type="button"
                            disabled={page === totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
                      <Search className="w-6 h-6 text-gray-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                      No professionals found
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
                      Try adjusting your filters or searching in a different
                      location
                    </p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="text-xs font-medium text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] transition-colors"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default CategoryDirectoryPageSample;
