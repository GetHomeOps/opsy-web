import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {useNavigate} from "react-router-dom";
import {Loader2} from "lucide-react";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAgencyListCache} from "../../context/AgencyContext";
import useDropdownAlignment from "../../hooks/useDropdownAlignment";
import ListDropdown from "../../partials/buttons/ListDropdown";
import PaginationClassic from "../../components/PaginationClassic";
import Banner from "../../partials/containers/Banner";
import AgenciesTable from "./AgenciesTable";
import SearchInput from "../../components/SearchInput";

const PAGE_STORAGE_KEY = "agencies_list_page";
const SEARCH_DEBOUNCE_MS = 300;

const FILTER_CATEGORIES = [
  {type: "status", label: "Status"},
  {type: "state", label: "State"},
  {type: "city", label: "City"},
];

const STATUS_FILTER_OPTIONS = [
  {value: "approved", label: "Approved", dot: "#22c55e"},
  {value: "pending", label: "Pending", dot: "#f59e0b"},
  {value: "rejected", label: "Rejected", dot: "#9ca3af"},
];

const initialState = {
  currentPage: 1,
  itemsPerPage: 10,
  searchTerm: "",
  activeFilters: [],
  agencies: [],
  total: 0,
  facetStates: [],
  facetCities: [],
  loading: true,
  refreshing: false,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_CURRENT_PAGE":
      return {...state, currentPage: action.payload};
    case "SET_ITEMS_PER_PAGE":
      return {...state, itemsPerPage: action.payload, currentPage: 1};
    case "SET_SEARCH_TERM":
      return {...state, searchTerm: action.payload, currentPage: 1};
    case "ADD_FILTER": {
      const exists = state.activeFilters.some(
        (f) =>
          f.type === action.payload.type && f.value === action.payload.value,
      );
      if (exists) return state;
      return {
        ...state,
        activeFilters: [...state.activeFilters, action.payload],
        currentPage: 1,
      };
    }
    case "REMOVE_FILTER":
      return {
        ...state,
        activeFilters: state.activeFilters.filter(
          (f) =>
            !(
              f.type === action.payload.type && f.value === action.payload.value
            ),
        ),
        currentPage: 1,
      };
    case "CLEAR_FILTERS":
      return {...state, activeFilters: [], currentPage: 1};
    case "SET_LIST_RESULT":
      return {
        ...state,
        agencies: action.payload.agencies,
        total: action.payload.total,
        loading: false,
        refreshing: false,
      };
    case "SET_FACETS":
      return {
        ...state,
        facetStates: action.payload.states,
        facetCities: action.payload.cities,
      };
    case "SET_LOADING":
      return {...state, loading: action.payload};
    case "SET_REFRESHING":
      return {...state, refreshing: action.payload};
    case "SET_BANNER":
      return {
        ...state,
        bannerOpen: action.payload.open,
        bannerType: action.payload.type,
        bannerMessage: action.payload.message,
      };
    default:
      return state;
  }
}

function filtersToQueryParams(activeFilters) {
  const byType = {};
  activeFilters.forEach((f) => {
    if (!byType[f.type]) byType[f.type] = [];
    byType[f.type].push(f.value);
  });
  const params = {};
  if (byType.status?.length) params.status = byType.status.join(",");
  if (byType.state?.length) params.state = byType.state.join(",");
  if (byType.city?.length) params.city = byType.city.join(",");
  return params;
}

function FilterDropdown({filterOptions, activeFilters, onAdd, onRemove}) {
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
        Filter
        {activeFilters.length > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
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
              {FILTER_CATEGORIES.map((cat) => {
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
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
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
                {
                  FILTER_CATEGORIES.find((c) => c.type === activeCategory)
                    ?.label
                }
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
                    No options available
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

function AgenciesManage() {
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const {
    getListCache,
    setListCache,
    getFacetsCache,
    setFacetsCache,
  } = useAgencyListCache();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const [selectedItems, setSelectedItems] = useState([]);
  const [sortConfig, setSortConfig] = useState({key: "name", direction: "asc"});
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [presignedLogos, setPresignedLogos] = useState({});
  const fetchedLogoKeysRef = useRef(new Set());
  const hasLoadedRef = useRef(false);

  const [state, dispatch] = useReducer(reducer, initialState, (base) => ({
    ...base,
    currentPage:
      Number(localStorage.getItem(PAGE_STORAGE_KEY)) || base.currentPage,
  }));

  useEffect(() => {
    const delay = state.searchTerm.trim() ? SEARCH_DEBOUNCE_MS : 0;
    const t = setTimeout(
      () => setDebouncedSearch(state.searchTerm),
      delay,
    );
    return () => clearTimeout(t);
  }, [state.searchTerm]);

  const filterParams = useMemo(
    () => filtersToQueryParams(state.activeFilters),
    [state.activeFilters],
  );

  const listParams = useMemo(() => {
    const q = debouncedSearch.trim();
    return {
      limit: state.itemsPerPage,
      offset: (state.currentPage - 1) * state.itemsPerPage,
      sortBy: sortConfig.key,
      sortDir: sortConfig.direction,
      ...(q ? {q} : {}),
      ...filterParams,
    };
  }, [
    debouncedSearch,
    state.itemsPerPage,
    state.currentPage,
    sortConfig.key,
    sortConfig.direction,
    filterParams,
  ]);

  const facetParams = useMemo(() => {
    const q = debouncedSearch.trim();
    return {
      ...(q ? {q} : {}),
      ...filterParams,
    };
  }, [debouncedSearch, filterParams]);

  useLayoutEffect(() => {
    const cached = getListCache(listParams);
    if (!cached?.hasLoadedOnce) return;
    hasLoadedRef.current = true;
    dispatch({
      type: "SET_LIST_RESULT",
      payload: {
        agencies: cached.agencies,
        total: cached.total,
      },
    });
  }, [getListCache, listParams]);

  useEffect(() => {
    let cancelled = false;

    const loadFacets = async () => {
      const cachedFacets = getFacetsCache(facetParams);
      if (cachedFacets) {
        dispatch({
          type: "SET_FACETS",
          payload: cachedFacets,
        });
      }

      try {
        const facetsRes = await AppApi.getAdminAgencyFacets(facetParams);
        if (cancelled) return;
        setFacetsCache(facetParams, {
          states: facetsRes.states,
          cities: facetsRes.cities,
        });
        dispatch({
          type: "SET_FACETS",
          payload: {
            states: facetsRes.states,
            cities: facetsRes.cities,
          },
        });
      } catch {
        /* Facets are non-blocking; list errors surface separately */
      }
    };

    loadFacets();
    return () => {
      cancelled = true;
    };
  }, [facetParams, getFacetsCache, setFacetsCache]);

  useEffect(() => {
    let cancelled = false;

    const loadList = async () => {
      const cached = getListCache(listParams);
      const isInitial = !hasLoadedRef.current;

      if (cached) {
        hasLoadedRef.current = true;
        dispatch({
          type: "SET_LIST_RESULT",
          payload: {
            agencies: cached.agencies,
            total: cached.total,
          },
        });
        dispatch({type: "SET_REFRESHING", payload: true});
      } else if (isInitial) {
        dispatch({type: "SET_LOADING", payload: true});
      } else {
        dispatch({type: "SET_REFRESHING", payload: true});
      }

      try {
        const listRes = await AppApi.listAdminAgencies(listParams);
        if (cancelled) return;
        hasLoadedRef.current = true;
        setListCache(listParams, {
          agencies: listRes.agencies,
          total: listRes.total,
        });
        dispatch({
          type: "SET_LIST_RESULT",
          payload: {
            agencies: listRes.agencies,
            total: listRes.total,
          },
        });
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: err?.message || "Failed to load agencies",
          },
        });
        dispatch({type: "SET_LOADING", payload: false});
        dispatch({type: "SET_REFRESHING", payload: false});
      }
    };

    loadList();
    return () => {
      cancelled = true;
    };
  }, [listParams, getListCache, setListCache]);

  useEffect(() => {
    if (state.total === 0) return;
    const lastValidPage = Math.max(
      1,
      Math.ceil(state.total / state.itemsPerPage),
    );
    if (state.currentPage > lastValidPage) {
      dispatch({type: "SET_CURRENT_PAGE", payload: lastValidPage});
    }
  }, [state.total, state.itemsPerPage, state.currentPage]);

  useEffect(() => {
    if (!state.agencies?.length) return;
    state.agencies.forEach((agency) => {
      const key = agency.logoUrl;
      if (
        !key ||
        key.startsWith("http://") ||
        key.startsWith("https://") ||
        fetchedLogoKeysRef.current.has(key)
      ) {
        return;
      }
      fetchedLogoKeysRef.current.add(key);
      AppApi.getInlineImageUrl(key)
        .then((url) => {
          setPresignedLogos((prev) => ({...prev, [key]: url}));
        })
        .catch(() => {
          fetchedLogoKeysRef.current.delete(key);
        });
    });
  }, [state.agencies]);

  const getLogoDisplayUrl = useCallback(
    (agency) => {
      const key = agency?.logoUrl;
      if (!key) return null;
      if (key.startsWith("http://") || key.startsWith("https://")) return key;
      return presignedLogos[key] ?? null;
    },
    [presignedLogos],
  );

  const agenciesForTable = useMemo(
    () =>
      state.agencies.map((agency) => ({
        ...agency,
        logoDisplayUrl: getLogoDisplayUrl(agency),
      })),
    [state.agencies, getLogoDisplayUrl],
  );

  useEffect(() => {
    if (!state.bannerOpen) return;
    const timer = setTimeout(() => {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: false,
          type: state.bannerType,
          message: state.bannerMessage,
        },
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [state.bannerOpen, state.bannerType, state.bannerMessage]);

  const filterOptions = useMemo(
    () => ({
      status: STATUS_FILTER_OPTIONS,
      state: state.facetStates.map((s) => ({value: s, label: s})),
      city: state.facetCities.map((c) => ({value: c, label: c})),
    }),
    [state.facetStates, state.facetCities],
  );

  const handleSearchChange = (e) => {
    dispatch({type: "SET_SEARCH_TERM", payload: e.target.value});
  };

  const handleItemsPerPageChange = (value) => {
    dispatch({type: "SET_ITEMS_PER_PAGE", payload: Number(value)});
  };

  const handlePageChange = (page) => {
    dispatch({type: "SET_CURRENT_PAGE", payload: page});
    localStorage.setItem(PAGE_STORAGE_KEY, page);
  };

  const handleNewAgency = () => {
    navigate(
      accountUrl
        ? `/${accountUrl}/agencies/manage/new`
        : "/agencies/manage/new",
    );
  };

  const handleAgencyClick = useCallback(
    (agency) => {
      const idx = agenciesForTable.findIndex((a) => a.id === agency.id);
      const globalIndex =
        (state.currentPage - 1) * state.itemsPerPage + idx + 1;
      const {limit: _limit, offset: _offset, ...agencyListParams} = listParams;
      const {logoDisplayUrl: _logo, ...agencyForState} = agency;
      navigate(
        accountUrl
          ? `/${accountUrl}/agencies/manage/${agency.id}`
          : `/agencies/manage/${agency.id}`,
        {
          state: {
            currentIndex: globalIndex,
            totalItems: state.total,
            agencyListParams,
            visibleAgencyIds: state.agencies.map((row) => row.id),
            agency: agencyForState,
          },
        },
      );
    },
    [
      navigate,
      accountUrl,
      agenciesForTable,
      state.total,
      state.currentPage,
      state.itemsPerPage,
      state.agencies,
      listParams,
    ],
  );

  const handleSort = (columnKey) => {
    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
    setSortConfig((prev) =>
      prev.key === columnKey
        ? {
            key: columnKey,
            direction: prev.direction === "asc" ? "desc" : "asc",
          }
        : {key: columnKey, direction: "asc"},
    );
  };

  const handleToggleSelect = (ids, shouldSelect = null) => {
    if (Array.isArray(ids)) {
      if (shouldSelect) {
        const merged = new Set(selectedItems);
        ids.forEach((id) => merged.add(id));
        setSelectedItems(Array.from(merged));
      } else {
        setSelectedItems((prev) => prev.filter((id) => !ids.includes(id)));
      }
      return;
    }
    setSelectedItems((prev) =>
      prev.includes(ids) ? prev.filter((id) => id !== ids) : [...prev, ids],
    );
  };

  const importPath = accountUrl
    ? `/${accountUrl}/agencies/import`
    : "/agencies/import";

  const showInitialSpinner =
    state.loading && !hasLoadedRef.current && !getListCache(listParams)?.hasLoadedOnce;

  return (
    <div className="space-y-5">
      <div className="fixed right-0 w-auto sm:w-full z-50 pointer-events-none">
        <div className="pointer-events-auto">
          <Banner
            type={state.bannerType}
            open={state.bannerOpen}
            setOpen={(open) =>
              dispatch({
                type: "SET_BANNER",
                payload: {
                  open,
                  type: state.bannerType,
                  message: state.bannerMessage,
                },
              })
            }
            className={`transition-opacity duration-600 ${
              state.bannerOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            {state.bannerMessage}
          </Banner>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Manage agencies
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <ListDropdown
            align="right"
            hasSelection={selectedItems.length > 0}
            onImport={() => navigate(importPath)}
          />
          <button
            type="button"
            className="btn btn-primary shadow-sm"
            onClick={handleNewAgency}
          >
            <svg
              className="fill-current shrink-0 xs:hidden"
              width="16"
              height="16"
              viewBox="0 0 16 16"
            >
              <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
            </svg>
            <span className="max-xs:sr-only">Add Agency</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <SearchInput
            placeholder="Search agencies..."
            value={state.searchTerm}
            onChange={handleSearchChange}
            inputClassName="form-input w-full pl-10 pr-9 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-[#456564] dark:focus:border-[#456564] rounded-lg shadow-sm text-sm"
            rightSlot={
              state.refreshing ? (
                <Loader2 className="w-4 h-4 text-[#456564] animate-spin" />
              ) : null
            }
          />

          <div className="flex items-center gap-2 shrink-0">
            <FilterDropdown
              filterOptions={filterOptions}
              activeFilters={state.activeFilters}
              onAdd={(f) => dispatch({type: "ADD_FILTER", payload: f})}
              onRemove={(f) => dispatch({type: "REMOVE_FILTER", payload: f})}
            />
          </div>
        </div>

        {state.activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {state.activeFilters.map((f) => (
              <span
                key={`${f.type}-${f.value}`}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
              >
                <span className="text-emerald-400 dark:text-emerald-500 font-normal">
                  {FILTER_CATEGORIES.find((c) => c.type === f.type)?.label ??
                    f.type}
                  :
                </span>
                {f.label}
                <button
                  type="button"
                  onClick={() => dispatch({type: "REMOVE_FILTER", payload: f})}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-colors"
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
              onClick={() => dispatch({type: "CLEAR_FILTERS"})}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {showInitialSpinner ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
        </div>
      ) : (
        <div
          className={`transition-opacity duration-150 ${
            state.refreshing ? "opacity-60" : "opacity-100"
          }`}
        >
          <AgenciesTable
            agencies={agenciesForTable}
            onToggleSelect={handleToggleSelect}
            selectedItems={selectedItems}
            totalAgencies={state.total}
            currentPage={state.currentPage}
            itemsPerPage={state.itemsPerPage}
            onAgencyClick={handleAgencyClick}
            sortConfig={sortConfig}
            onSort={handleSort}
          />
          {state.total > 0 && (
            <div className="mt-8">
              <PaginationClassic
                currentPage={state.currentPage}
                totalItems={state.total}
                itemsPerPage={state.itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AgenciesManage;
