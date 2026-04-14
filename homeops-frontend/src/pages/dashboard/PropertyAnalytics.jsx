import React, {useState, useEffect, useCallback, useMemo} from "react";
import {useTranslation} from "react-i18next";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import PaginationClassic from "../../components/PaginationClassic";
import FilterDropdown from "../../components/FilterDropdown";
import useSuppressBrowserAddressAutofill from "../../hooks/useSuppressBrowserAddressAutofill";
import {PAGE_LAYOUT} from "../../constants/layout";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Eye,
  Users,
  RefreshCw,
  Loader2,
  FileText,
  Sparkles,
  Calendar,
  UserPlus,
  Search,
  Clock,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 10;

/** Odoo-style filter types for dashboard property analytics */
const DASHBOARD_PROPERTY_FILTER_CATEGORIES = [
  {type: "owner_user", labelKey: "owner"},
  {type: "team_user", labelKey: "users"},
  {type: "city", labelKey: "city"},
  {type: "state", labelKey: "state"},
];

const selectClass =
  "form-select w-full sm:w-auto min-w-[10rem] py-2 pl-3 pr-9 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 rounded-lg shadow-sm text-sm text-gray-800 dark:text-gray-200";

function filtersByTypeFromActive(activeFilters) {
  const by = {};
  for (const f of activeFilters) {
    if (!by[f.type]) by[f.type] = [];
    by[f.type].push(f.value);
  }
  return by;
}

function propertyMatchesDropdownFilters(prop, filtersByType) {
  if (filtersByType.owner_user?.length) {
    const allowed = new Set(filtersByType.owner_user);
    const owners = (prop.members || []).filter(
      (m) => m.propertyRole === "owner",
    );
    const ok = owners.some(
      (m) => m.userId != null && allowed.has(String(m.userId)),
    );
    if (!ok) return false;
  }
  if (filtersByType.team_user?.length) {
    const allowed = new Set(filtersByType.team_user);
    const ok = (prop.members || []).some(
      (m) => m.userId != null && allowed.has(String(m.userId)),
    );
    if (!ok) return false;
  }
  if (filtersByType.city?.length) {
    const city = (prop.city || "").trim();
    if (!filtersByType.city.includes(city)) return false;
  }
  if (filtersByType.state?.length) {
    const st = (prop.state || "").trim();
    if (!filtersByType.state.includes(st)) return false;
  }
  return true;
}

function propertyMatchesSearch(prop, qLower) {
  if (!qLower) return true;
  const members = Array.isArray(prop.members) ? prop.members : [];
  const parts = [
    prop.propertyName,
    prop.propertyUid,
    prop.address,
    prop.city,
    prop.state,
    prop.accountName,
    prop.ownerDisplay,
    prop.propertyId != null ? String(prop.propertyId) : "",
    ...members.flatMap((m) => [m.userName, m.userEmail].filter(Boolean)),
  ];
  return parts.some((p) => p && String(p).toLowerCase().includes(qLower));
}

function propertyActivityTotals(prop) {
  const members = Array.isArray(prop.members) ? prop.members : [];
  return {
    documents: Number(prop.documentsCount) || 0,
    visits: members.reduce((s, m) => s + (Number(m.pageViews) || 0), 0),
    maintenance: members.reduce(
      (s, m) => s + (Number(m.maintenanceEvents) || 0),
      0,
    ),
  };
}

function formatAnalyticsDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** Human-readable duration from a number of seconds (e.g. invite acceptance latency). */
function formatDurationSeconds(totalSeconds) {
  if (totalSeconds == null || Number.isNaN(Number(totalSeconds))) return null;
  let s = Math.round(Math.max(0, Number(totalSeconds)));
  if (s < 60) return `${s}s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(s / 3600);
  const remM = Math.floor((s % 3600) / 60);
  if (hours < 48) {
    return remM > 0 ? `${hours}h ${remM}m` : `${hours}h`;
  }
  const days = Math.floor(s / 86400);
  const remH = Math.floor((s % 86400) / 3600);
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

function inviteAcceptanceLine(prop) {
  const n = Number(prop.invitesAccepted) || 0;
  const avg = prop.avgInviteAcceptSeconds;
  if (!n || avg == null) {
    return "No accepted property invitations yet.";
  }
  const dur = formatDurationSeconds(avg);
  return `Avg. time to accept: ${dur} (${n} accepted)`;
}

function comparePropertyAnalyticsDefault(a, b) {
  const acct = String(a.accountName || "").localeCompare(
    String(b.accountName || ""),
    undefined,
    {sensitivity: "base"},
  );
  if (acct !== 0) return acct;
  const na = String(a.propertyName || a.address || a.propertyId || "");
  const nb = String(b.propertyName || b.address || b.propertyId || "");
  return na.localeCompare(nb, undefined, {sensitivity: "base"});
}

function PropertyAnalytics() {
  const {t} = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [searchTerm, setSearchTerm] = useState("");
  const bindPropertySearchInput = useSuppressBrowserAddressAutofill(
    "property-analytics-search",
  );
  const [accountFilter, setAccountFilter] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortOption, setSortOption] = useState("default");

  const accountOptions = useMemo(() => {
    const byId = new Map();
    for (const p of properties) {
      if (p.accountId == null) continue;
      if (!byId.has(p.accountId)) {
        byId.set(p.accountId, {
          id: p.accountId,
          name: p.accountName || `Account #${p.accountId}`,
        });
      }
    }
    return [...byId.values()].sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, {
        sensitivity: "base",
      }),
    );
  }, [properties]);

  const filterOptions = useMemo(() => {
    const ownerById = new Map();
    const teamById = new Map();
    const cities = new Set();
    const states = new Set();
    for (const p of properties) {
      const members = Array.isArray(p.members) ? p.members : [];
      for (const m of members) {
        if (m.userId == null) continue;
        const id = String(m.userId);
        const label = m.userName || m.userEmail || `User #${m.userId}`;
        teamById.set(id, label);
        if (m.propertyRole === "owner") ownerById.set(id, label);
      }
      const c = (p.city || "").trim();
      if (c) cities.add(c);
      const s = (p.state || "").trim();
      if (s) states.add(s);
    }
    const mapToSortedOpts = (map) =>
      [...map.entries()]
        .map(([value, label]) => ({value, label}))
        .sort((a, b) =>
          a.label.localeCompare(b.label, undefined, {sensitivity: "base"}),
        );
    return {
      owner_user: mapToSortedOpts(ownerById),
      team_user: mapToSortedOpts(teamById),
      city: [...cities]
        .sort((a, b) => a.localeCompare(b, undefined, {sensitivity: "base"}))
        .map((value) => ({value, label: value})),
      state: [...states]
        .sort((a, b) => a.localeCompare(b, undefined, {sensitivity: "base"}))
        .map((value) => ({value, label: value})),
    };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtersByType = filtersByTypeFromActive(activeFilters);
    return properties.filter((p) => {
      if (accountFilter && String(p.accountId) !== accountFilter) return false;
      if (!propertyMatchesDropdownFilters(p, filtersByType)) return false;
      return propertyMatchesSearch(p, q);
    });
  }, [properties, searchTerm, accountFilter, activeFilters]);

  const sortedFilteredProperties = useMemo(() => {
    const list = [...filteredProperties];
    const tie = comparePropertyAnalyticsDefault;
    switch (sortOption) {
      case "documents_desc":
        list.sort(
          (a, b) =>
            propertyActivityTotals(b).documents -
              propertyActivityTotals(a).documents || tie(a, b),
        );
        break;
      case "documents_asc":
        list.sort(
          (a, b) =>
            propertyActivityTotals(a).documents -
              propertyActivityTotals(b).documents || tie(a, b),
        );
        break;
      case "visits_desc":
        list.sort(
          (a, b) =>
            propertyActivityTotals(b).visits -
              propertyActivityTotals(a).visits || tie(a, b),
        );
        break;
      case "visits_asc":
        list.sort(
          (a, b) =>
            propertyActivityTotals(a).visits -
              propertyActivityTotals(b).visits || tie(a, b),
        );
        break;
      case "maintenance_desc":
        list.sort(
          (a, b) =>
            propertyActivityTotals(b).maintenance -
              propertyActivityTotals(a).maintenance || tie(a, b),
        );
        break;
      case "maintenance_asc":
        list.sort(
          (a, b) =>
            propertyActivityTotals(a).maintenance -
              propertyActivityTotals(b).maintenance || tie(a, b),
        );
        break;
      default:
        list.sort(tie);
    }
    return list;
  }, [filteredProperties, sortOption]);

  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedFilteredProperties.slice(start, start + itemsPerPage);
  }, [sortedFilteredProperties, currentPage, itemsPerPage]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    Boolean(accountFilter) ||
    activeFilters.length > 0;

  const addFilter = useCallback((f) => {
    setActiveFilters((prev) => {
      if (prev.some((x) => x.type === f.type && x.value === f.value))
        return prev;
      return [...prev, f];
    });
  }, []);

  const removeFilter = useCallback((f) => {
    setActiveFilters((prev) =>
      prev.filter((x) => !(x.type === f.type && x.value === f.value)),
    );
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, accountFilter, activeFilters, sortOption]);

  useEffect(() => {
    const totalPages = Math.ceil(
      sortedFilteredProperties.length / itemsPerPage,
    );
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [sortedFilteredProperties.length, itemsPerPage, currentPage]);

  useEffect(() => {
    if (
      accountFilter &&
      !properties.some((p) => String(p.accountId) === accountFilter)
    ) {
      setAccountFilter("");
    }
  }, [properties, accountFilter]);

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AppApi.getPropertyAnalytics();
      setProperties(list || []);
    } catch (err) {
      setError(
        err?.messages?.[0] ||
          err?.message ||
          "Failed to load property analytics",
      );
      setProperties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  const toggleRow = (propertyId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const clearSearchAndFilters = () => {
    setSearchTerm("");
    setAccountFilter("");
    setActiveFilters([]);
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex flex-col flex-1 min-h-0 overflow-auto">
          <div className={`${PAGE_LAYOUT.listPaddingX} py-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  Property Analytics
                </h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  All properties with team members, owners, and activity per
                  member (visits on property pages, AI report analyses,
                  scheduled maintenance, invitations for this property).
                </p>
              </div>
              <button
                type="button"
                onClick={fetchProperties}
                disabled={loading}
                className="flex items-center gap-2 btn bg-[#456564] text-white hover:bg-[#3a5554] disabled:opacity-50 text-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {!loading && properties.length > 0 && (
              <div className="mb-5 space-y-3">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end">
                  <div className="relative flex-1 min-w-0">
                    <label
                      htmlFor="dashboard-properties-search"
                      className="sr-only"
                    >
                      Search properties
                    </label>
                    <input
                      id="dashboard-properties-search"
                      type="search"
                      placeholder="Search by name, address, account, owner, team…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm text-sm"
                      {...bindPropertySearchInput()}
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
                      <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 ml-0.5" />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 shrink-0 sm:items-end">
                    {accountOptions.length > 1 && (
                      <div className="min-w-0 sm:min-w-[11rem] flex flex-col">
                        <label
                          htmlFor="dashboard-properties-account"
                          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                        >
                          Account
                        </label>
                        <select
                          id="dashboard-properties-account"
                          value={accountFilter}
                          onChange={(e) => setAccountFilter(e.target.value)}
                          className={selectClass}
                          aria-label="Filter by account"
                        >
                          <option value="">All accounts</option>
                          {accountOptions.map((a) => (
                            <option key={a.id} value={String(a.id)}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="min-w-0 sm:min-w-[13rem] flex flex-col">
                      <label
                        htmlFor="dashboard-properties-sort"
                        className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                      >
                        {t("sortBy", {defaultValue: "Sort by"})}
                      </label>
                      <select
                        id="dashboard-properties-sort"
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                        className={selectClass}
                        aria-label={t("sortBy", {defaultValue: "Sort by"})}
                      >
                        <option value="default">
                          {t("analyticsSortAccountName", {
                            defaultValue: "Account & name",
                          })}
                        </option>
                        <option value="documents_desc">
                          {t("analyticsSortDocumentsMost", {
                            defaultValue: "Documents (most first)",
                          })}
                        </option>
                        <option value="documents_asc">
                          {t("analyticsSortDocumentsLeast", {
                            defaultValue: "Documents (least first)",
                          })}
                        </option>
                        <option value="visits_desc">
                          {t("analyticsSortVisitsMost", {
                            defaultValue: "Visits (most first)",
                          })}
                        </option>
                        <option value="visits_asc">
                          {t("analyticsSortVisitsLeast", {
                            defaultValue: "Visits (least first)",
                          })}
                        </option>
                        <option value="maintenance_desc">
                          {t("analyticsSortMaintenanceMost", {
                            defaultValue: "Maintenance (most first)",
                          })}
                        </option>
                        <option value="maintenance_asc">
                          {t("analyticsSortMaintenanceLeast", {
                            defaultValue: "Maintenance (least first)",
                          })}
                        </option>
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <span
                        className="block text-xs font-medium mb-1 invisible select-none pointer-events-none"
                        aria-hidden
                      >
                        Account
                      </span>
                      <FilterDropdown
                        filterCategories={DASHBOARD_PROPERTY_FILTER_CATEGORIES}
                        filterOptions={filterOptions}
                        activeFilters={activeFilters}
                        onAdd={addFilter}
                        onRemove={removeFilter}
                        t={t}
                      />
                    </div>
                    {hasActiveFilters && (
                      <div className="flex flex-col">
                        <span
                          className="block text-xs font-medium mb-1 invisible select-none pointer-events-none"
                          aria-hidden
                        >
                          Account
                        </span>
                        <button
                          type="button"
                          onClick={clearSearchAndFilters}
                          className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors whitespace-nowrap h-[38px] flex items-center"
                        >
                          {t("clearAll", {defaultValue: "Clear all"})}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {activeFilters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFilters.map((f) => (
                      <span
                        key={`${f.type}-${f.value}`}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-500/20"
                      >
                        <span className="text-violet-400 dark:text-violet-500 font-normal">
                          {t(
                            DASHBOARD_PROPERTY_FILTER_CATEGORIES.find(
                              (c) => c.type === f.type,
                            )?.labelKey ?? f.type,
                          )}
                          :
                        </span>
                        {f.label ?? f.value}
                        <button
                          type="button"
                          onClick={() => removeFilter(f)}
                          className="ml-0.5 p-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-500/20 transition-colors"
                          aria-label={t("removeFilter", {
                            defaultValue: "Remove filter",
                          })}
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
                      {t("clearAll", {defaultValue: "Clear all"})}
                    </button>
                  </div>
                )}
              </div>
            )}

            {loading && properties.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
              </div>
            ) : properties.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No properties found.
                </p>
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No properties match your search or filters.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearSearchAndFilters}
                    className="mt-3 text-sm font-medium text-[#456564] hover:underline"
                  >
                    Clear search and filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Team &amp; activity
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 max-w-3xl">
                    Expand a property to see each member&apos;s visits (page
                    views under that property&apos;s URL), AI report analyses,
                    scheduled maintenance events, and invitations sent for that
                    property. Document counts are for the whole property
                    (uploads are not stored per user).
                  </p>
                </div>
                <div className="space-y-4">
                  {paginatedProperties.map((prop) => {
                    const isExpanded = expandedIds.has(prop.propertyId);
                    const members = Array.isArray(prop.members)
                      ? prop.members
                      : [];
                    const addr = [prop.address, prop.city, prop.state]
                      .filter(Boolean)
                      .join(", ");

                    return (
                      <div
                        key={prop.propertyId}
                        className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleRow(prop.propertyId)}
                          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {prop.propertyName ||
                                `Property #${prop.propertyId}`}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {addr || "—"}
                              {prop.accountName ? (
                                <span className="text-gray-400 dark:text-gray-500">
                                  {" "}
                                  · {prop.accountName}
                                </span>
                              ) : null}
                            </p>
                            {prop.ownerDisplay ? (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                Owner: {prop.ownerDisplay}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <Calendar className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
                                <span>
                                  Created{" "}
                                  {formatAnalyticsDateTime(prop.createdAt) ||
                                    "—"}
                                  {prop.createdByDisplay ? (
                                    <> · by {prop.createdByDisplay}</>
                                  ) : (
                                    ""
                                  )}
                                </span>
                              </p>
                              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <Clock className="w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
                                <span>{inviteAcceptanceLine(prop)}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <Users className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {prop.teamCount ?? members.length} team
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <FileText className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {prop.documentsCount ?? 0} docs
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 font-mono">
                                {prop.propertyUid || "—"}
                              </span>
                            </div>
                          </div>
                        </button>

                        {isExpanded && members.length > 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-5 py-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                    <th className="pb-2 pr-4">Member</th>
                                    <th className="pb-2 pr-4">On property</th>
                                    <th className="pb-2 pr-4">App role</th>
                                    <th className="pb-2 pr-3 text-right">
                                      <span className="inline-flex items-center justify-end gap-1 w-full">
                                        <Eye className="w-3.5 h-3.5" />
                                        Visits
                                      </span>
                                    </th>
                                    <th className="pb-2 pr-3 text-right">
                                      <span className="inline-flex items-center justify-end gap-1 w-full">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        AI
                                      </span>
                                    </th>
                                    <th className="pb-2 pr-3 text-right">
                                      <span className="inline-flex items-center justify-end gap-1 w-full">
                                        <Calendar className="w-3.5 h-3.5" />
                                        Maint.
                                      </span>
                                    </th>
                                    <th className="pb-2 text-right">
                                      <span className="inline-flex items-center justify-end gap-1 w-full">
                                        <UserPlus className="w-3.5 h-3.5" />
                                        Invites
                                      </span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {members.map((m) => (
                                    <tr
                                      key={m.userId}
                                      className="border-b border-gray-100 dark:border-gray-700/60 last:border-0"
                                    >
                                      <td className="py-2 pr-4">
                                        <div className="font-medium text-gray-800 dark:text-gray-200">
                                          {m.userName ||
                                            m.userEmail ||
                                            `User #${m.userId}`}
                                        </div>
                                        {m.userEmail ? (
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {m.userEmail}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300 capitalize">
                                        {m.propertyRole || "—"}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                        {m.userRole || "—"}
                                      </td>
                                      <td className="py-2 pr-3 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                        {m.pageViews ?? 0}
                                      </td>
                                      <td className="py-2 pr-3 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                        {m.aiAnalyses ?? 0}
                                      </td>
                                      <td className="py-2 pr-3 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                        {m.maintenanceEvents ?? 0}
                                      </td>
                                      <td className="py-2 text-right tabular-nums text-gray-800 dark:text-gray-200">
                                        {m.invitationsSent ?? 0}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {isExpanded && members.length === 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No team members linked to this property yet.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {filteredProperties.length > 0 && (
                  <div className="mt-6">
                    <PaginationClassic
                      currentPage={currentPage}
                      totalItems={filteredProperties.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={handleItemsPerPageChange}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default PropertyAnalytics;
