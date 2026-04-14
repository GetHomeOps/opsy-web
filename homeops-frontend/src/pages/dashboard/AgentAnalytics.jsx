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
  UserPlus,
  MessageSquare,
  Eye,
  Users,
  RefreshCw,
  Loader2,
  Search,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 10;

const AGENT_ANALYTICS_FILTER_CATEGORIES = [
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

/**
 * Agent matches if at least one of their properties satisfies each active filter category
 * (OR within type, AND across types — same rules as Dashboard Properties).
 */
function agentMatchesDropdownFilters(agent, filtersByType) {
  const properties = Array.isArray(agent.properties) ? agent.properties : [];
  if (filtersByType.owner_user?.length) {
    const allowed = new Set(filtersByType.owner_user);
    const ok = properties.some((prop) => {
      const owners = (prop.members || []).filter(
        (m) => m.propertyRole === "owner",
      );
      return owners.some(
        (m) => m.userId != null && allowed.has(String(m.userId)),
      );
    });
    if (!ok) return false;
  }
  if (filtersByType.team_user?.length) {
    const allowed = new Set(filtersByType.team_user);
    const ok = properties.some((prop) =>
      (prop.members || []).some(
        (m) => m.userId != null && allowed.has(String(m.userId)),
      ),
    );
    if (!ok) return false;
  }
  if (filtersByType.city?.length) {
    const cities = properties.map((p) => (p.city || "").trim()).filter(Boolean);
    const ok = filtersByType.city.some((c) => cities.includes(c));
    if (!ok) return false;
  }
  if (filtersByType.state?.length) {
    const states = properties
      .map((p) => (p.state || "").trim())
      .filter(Boolean);
    const ok = filtersByType.state.some((s) => states.includes(s));
    if (!ok) return false;
  }
  return true;
}

function agentMatchesSearch(agent, qLower) {
  if (!qLower) return true;
  const accounts = Array.isArray(agent.accounts) ? agent.accounts : [];
  const properties = Array.isArray(agent.properties) ? agent.properties : [];
  const parts = [
    agent.agentName,
    agent.agentEmail,
    agent.agentId != null ? String(agent.agentId) : "",
    ...accounts.map((a) => a.name).filter(Boolean),
    ...properties.flatMap((p) => {
      const members = Array.isArray(p.members) ? p.members : [];
      return [
        p.propertyName,
        p.propertyId != null ? String(p.propertyId) : "",
        p.address,
        p.city,
        p.state,
        ...members.flatMap((m) => [m.userName, m.userEmail].filter(Boolean)),
      ];
    }),
  ];
  return parts.some((p) => p && String(p).toLowerCase().includes(qLower));
}

function AgentAnalytics() {
  const {t} = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAgents, setExpandedAgents] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [searchTerm, setSearchTerm] = useState("");
  const bindAgentSearchInput = useSuppressBrowserAddressAutofill(
    "agent-analytics-search",
  );
  const [accountFilter, setAccountFilter] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);

  const accountOptions = useMemo(() => {
    const byId = new Map();
    for (const agent of agents) {
      for (const a of agent.accounts || []) {
        if (a.id == null) continue;
        if (!byId.has(a.id)) {
          byId.set(a.id, {
            id: a.id,
            name: a.name || `Account #${a.id}`,
          });
        }
      }
    }
    return [...byId.values()].sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, {
        sensitivity: "base",
      }),
    );
  }, [agents]);

  const filterOptions = useMemo(() => {
    const ownerById = new Map();
    const teamById = new Map();
    const cities = new Set();
    const states = new Set();
    for (const agent of agents) {
      for (const p of agent.properties || []) {
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
  }, [agents]);

  const filteredAgents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtersByType = filtersByTypeFromActive(activeFilters);
    return agents.filter((agent) => {
      if (accountFilter) {
        const linked = agent.accounts || [];
        if (!linked.some((a) => String(a.id) === accountFilter)) return false;
      }
      if (!agentMatchesDropdownFilters(agent, filtersByType)) return false;
      return agentMatchesSearch(agent, q);
    });
  }, [agents, searchTerm, accountFilter, activeFilters]);

  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAgents.slice(start, start + itemsPerPage);
  }, [filteredAgents, currentPage, itemsPerPage]);

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
  }, [searchTerm, accountFilter, activeFilters]);

  useEffect(() => {
    const totalPages = Math.ceil(filteredAgents.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredAgents.length, itemsPerPage, currentPage]);

  useEffect(() => {
    if (
      accountFilter &&
      !agents.some((ag) =>
        (ag.accounts || []).some((a) => String(a.id) === accountFilter),
      )
    ) {
      setAccountFilter("");
    }
  }, [agents, accountFilter]);

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AppApi.getAgentAnalytics();
      setAgents(list || []);
    } catch (err) {
      setError(
        err?.messages?.[0] || err?.message || "Failed to load agent analytics",
      );
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const toggleAgent = (agentId) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
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
                  Agent Analytics
                </h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Agent users, their properties, homeowner counts, invitations,
                  communications, and engagement.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAgents}
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

            {!loading && agents.length > 0 && (
              <div className="mb-5 space-y-3">
                <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end">
                  <div className="relative flex-1 min-w-0">
                    <label
                      htmlFor="dashboard-agent-analytics-search"
                      className="sr-only"
                    >
                      Search agents
                    </label>
                    <input
                      id="dashboard-agent-analytics-search"
                      type="search"
                      placeholder="Search by agent, account, property, address…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm text-sm"
                      {...bindAgentSearchInput()}
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
                      <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 ml-0.5" />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 shrink-0 sm:items-end">
                    {accountOptions.length > 1 && (
                      <div className="min-w-0 sm:min-w-[11rem] flex flex-col">
                        <label
                          htmlFor="dashboard-agent-analytics-account"
                          className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                        >
                          Account
                        </label>
                        <select
                          id="dashboard-agent-analytics-account"
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
                    <div className="flex flex-col">
                      {accountOptions.length > 1 && (
                        <span
                          className="block text-xs font-medium mb-1 invisible select-none pointer-events-none"
                          aria-hidden
                        >
                          Account
                        </span>
                      )}
                      <FilterDropdown
                        filterCategories={AGENT_ANALYTICS_FILTER_CATEGORIES}
                        filterOptions={filterOptions}
                        activeFilters={activeFilters}
                        onAdd={addFilter}
                        onRemove={removeFilter}
                        t={t}
                      />
                    </div>
                    {hasActiveFilters && (
                      <div className="flex flex-col">
                        {accountOptions.length > 1 && (
                          <span
                            className="block text-xs font-medium mb-1 invisible select-none pointer-events-none"
                            aria-hidden
                          >
                            Account
                          </span>
                        )}
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
                            AGENT_ANALYTICS_FILTER_CATEGORIES.find(
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

            {loading && agents.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
              </div>
            ) : agents.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No agent users found.
                </p>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No agents match your search or filters.
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
                <div className="space-y-4">
                  {paginatedAgents.map((agent) => {
                    const isExpanded = expandedAgents.has(agent.agentId);
                    const accounts = Array.isArray(agent.accounts)
                      ? agent.accounts
                      : [];
                    const properties = agent.properties || [];

                    return (
                      <div
                        key={agent.agentId}
                        className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleAgent(agent.agentId)}
                          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {agent.agentName ||
                                agent.agentEmail ||
                                `Agent #${agent.agentId}`}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {agent.agentEmail}
                            </p>
                            {accounts.length > 0 && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                {accounts.map((a) => a.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {agent.propertiesCount ?? 0} properties
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <UserPlus className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {agent.invitationsSent ?? 0} invited
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {agent.communicationsSent ?? 0} comms
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                              <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {agent.pageViews ?? 0} visits
                              </span>
                            </div>
                          </div>
                        </button>

                        {isExpanded && properties.length > 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-5 py-4">
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                              Properties & Homeowners
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                    <th className="pb-2 pr-4">Property</th>
                                    <th className="pb-2 pr-4">Address</th>
                                    <th className="pb-2 text-right">
                                      Homeowners
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {properties.map((prop) => (
                                    <tr
                                      key={prop.propertyId}
                                      className="border-b border-gray-100 dark:border-gray-700/60 last:border-0"
                                    >
                                      <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">
                                        {prop.propertyName ||
                                          `Property #${prop.propertyId}`}
                                      </td>
                                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                        {[prop.address, prop.city, prop.state]
                                          .filter(Boolean)
                                          .join(", ") || "—"}
                                      </td>
                                      <td className="py-2 text-right">
                                        <span className="inline-flex items-center gap-1">
                                          <Users className="w-3.5 h-3.5" />
                                          {prop.homeownersCount ?? 0}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {isExpanded && properties.length === 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No properties for this agent.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {filteredAgents.length > 0 && (
                  <div className="mt-6">
                    <PaginationClassic
                      currentPage={currentPage}
                      totalItems={filteredAgents.length}
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

export default AgentAnalytics;
