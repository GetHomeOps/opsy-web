import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Loader2, RefreshCw, UserRound} from "lucide-react";
import AppApi from "../../api/api";
import PaginationClassic from "../../components/PaginationClassic";
import FilterDropdown from "../../components/FilterDropdown";
import SearchInput from "../../components/SearchInput";
import AgentsTable from "./AgentsTable";

const SEARCH_DEBOUNCE_MS = 300;

const FILTER_CATEGORIES = [
  {type: "agency", labelKey: "agency"},
  {type: "office", labelKey: "office"},
  {type: "team", labelKey: "team"},
];

function filtersToQueryParams(activeFilters) {
  const byType = {};
  activeFilters.forEach((f) => {
    if (!byType[f.type]) byType[f.type] = [];
    byType[f.type].push(f.value);
  });
  const params = {};
  if (byType.agency?.length) params.agency = byType.agency.join(",");
  if (byType.office?.length) params.office = byType.office.join(",");
  if (byType.team?.length) params.team = byType.team.join(",");
  return params;
}

function agentToTableRow(agent) {
  const affiliation = agent.affiliation;
  const isAffiliated = Boolean(affiliation?.agency?.name);
  return {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    agency: affiliation?.agency?.name || null,
    office: affiliation?.office?.name || null,
    team: affiliation?.team?.name || null,
    status: isAffiliated ? "affiliated" : "unaffiliated",
  };
}

function AgentsList({embedded = false}) {
  const {t} = useTranslation();
  const [agents, setAgents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({key: "name", direction: "asc"});
  const [activeFilters, setActiveFilters] = useState([]);
  const [facetOptions, setFacetOptions] = useState({
    agency: [],
    office: [],
    team: [],
  });
  const hasLoadedRef = React.useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filterParams = useMemo(
    () => filtersToQueryParams(activeFilters),
    [activeFilters],
  );

  const listParams = useMemo(() => {
    const q = debouncedSearch.trim();
    return {
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
      sortBy: sortConfig.key,
      sortDir: sortConfig.direction,
      ...(q ? {q} : {}),
      ...filterParams,
    };
  }, [
    currentPage,
    debouncedSearch,
    filterParams,
    itemsPerPage,
    sortConfig.direction,
    sortConfig.key,
  ]);

  const facetParams = useMemo(() => {
    const q = debouncedSearch.trim();
    return {
      ...(q ? {q} : {}),
      ...filterParams,
    };
  }, [debouncedSearch, filterParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, sortConfig.key, sortConfig.direction, activeFilters]);

  useEffect(() => {
    let cancelled = false;

    const loadFacets = async () => {
      try {
        const facets = await AppApi.getAdminAgentFacets(facetParams);
        if (cancelled) return;
        setFacetOptions({
          agency: facets.agencies ?? [],
          office: facets.offices ?? [],
          team: facets.teams ?? [],
        });
      } catch {
        /* facets are non-blocking */
      }
    };

    loadFacets();
    return () => {
      cancelled = true;
    };
  }, [facetParams]);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {agents: list, total: count} = await AppApi.listAdminAgents(listParams);
      setAgents(list || []);
      setTotal(count || 0);
      hasLoadedRef.current = true;
    } catch (err) {
      setError(err.message || "Failed to load agents");
      setAgents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listParams]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const agentsForTable = useMemo(
    () => agents.map(agentToTableRow),
    [agents],
  );

  const handleSort = (columnKey) => {
    setCurrentPage(1);
    setSortConfig((prev) =>
      prev.key === columnKey
        ? {
            key: columnKey,
            direction: prev.direction === "asc" ? "desc" : "asc",
          }
        : {key: columnKey, direction: "asc"},
    );
  };

  const handleAddFilter = (filter) => {
    setActiveFilters((prev) => {
      const exists = prev.some(
        (f) => f.type === filter.type && f.value === filter.value,
      );
      if (exists) return prev;
      return [...prev, filter];
    });
  };

  const handleRemoveFilter = (filter) => {
    setActiveFilters((prev) =>
      prev.filter(
        (f) => !(f.type === filter.type && f.value === filter.value),
      ),
    );
  };

  const showInitialSpinner = loading && !hasLoadedRef.current;

  const tableContent = (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Agents
          </h2>
        </div>
      </div>

      <div className={`space-y-3 ${embedded ? "mb-4" : "mb-8"}`}>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <SearchInput
            placeholder="Search agents, agencies, offices, or teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            inputClassName="form-input w-full pl-10 pr-9 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
          />

          <div className="flex items-center gap-2 shrink-0">
            <FilterDropdown
              filterCategories={FILTER_CATEGORIES}
              filterOptions={facetOptions}
              activeFilters={activeFilters}
              onAdd={handleAddFilter}
              onRemove={handleRemoveFilter}
              t={t}
            />
            <button
              type="button"
              onClick={fetchAgents}
              disabled={loading}
              className="btn border-gray-200 dark:border-gray-700 inline-flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeFilters.map((f) => (
              <span
                key={`${f.type}-${f.value}`}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
              >
                <span className="text-emerald-400 dark:text-emerald-500 font-normal">
                  {FILTER_CATEGORIES.find((c) => c.type === f.type)
                    ? t(
                        FILTER_CATEGORIES.find((c) => c.type === f.type)
                          .labelKey,
                      )
                    : f.type}
                  :
                </span>
                {f.label}
                <button
                  type="button"
                  onClick={() => handleRemoveFilter(f)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-colors"
                  aria-label={t("removeFilter") || "Remove filter"}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setActiveFilters([])}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {showInitialSpinner ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
        </div>
      ) : (
        <div
          className={`transition-opacity duration-150 ${
            loading ? "opacity-60" : "opacity-100"
          }`}
        >
          <AgentsTable
            agents={agentsForTable}
            loading={loading}
            totalAgents={total}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
        </div>
      )}

      {total > 0 && (
        <div className="mt-6">
          <PaginationClassic
            currentPage={currentPage}
            totalItems={total}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      )}
    </div>
  );

  if (embedded) {
    return tableContent;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <UserRound className="w-6 h-6 text-[#456564]" />
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
          Agents
        </h1>
      </div>
      {tableContent}
    </div>
  );
}

export default AgentsList;
