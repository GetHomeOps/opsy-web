import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Loader2, SlidersHorizontal} from "lucide-react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import Banner from "../../partials/containers/Banner";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import SearchInput from "../../components/SearchInput";
import FilterDropdown from "../../components/FilterDropdown";
import PaginationClassic from "../../components/PaginationClassic";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";

const ACCOUNT_TYPE_LABELS = {
  agent: "Agent",
  homeowner: "Homeowner",
  admin: "Admin",
  super_admin: "Super Admin",
  unknown: "Unknown",
};

function formatAccountType(type) {
  if (!type) return "Unknown";
  return (
    ACCOUNT_TYPE_LABELS[type] ||
    type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ")
  );
}

function YesNoBadge({value}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        value
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
      }`}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

function CustomizationList() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const {t} = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({key: "name", direction: "asc"});
  const [banner, setBanner] = useState({open: false, type: "success", message: ""});

  const base = accountUrl ? `/${accountUrl}/customization` : "/customization";

  const showBanner = useCallback((type, message) => {
    setBanner({open: true, type, message});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountList, agencyList, teamList] = await Promise.all([
        AppApi.getAllAccounts(),
        AppApi.getAgenciesForCustomization(),
        AppApi.getTeamsForCustomization(),
      ]);
      setAccounts(Array.isArray(accountList) ? accountList : []);
      setAgencies(Array.isArray(agencyList) ? agencyList : []);
      setTeams(Array.isArray(teamList) ? teamList : []);
    } catch (err) {
      setAccounts([]);
      setAgencies([]);
      setTeams([]);
      showBanner(
        "error",
        Array.isArray(err) ? err.join(", ") : err?.message || "Failed to load customization data",
      );
    } finally {
      setLoading(false);
    }
  }, [showBanner]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSearch("");
    setActiveFilters([]);
    setCurrentPage(1);
    setSortConfig({key: "name", direction: "asc"});
  }, [activeTab]);

  const accountFilterCategories = useMemo(
    () => [
      {type: "accountType", labelKey: "accountType"},
      {type: "agency", labelKey: "agency"},
      {type: "customizable", labelKey: "customizable"},
    ],
    [],
  );

  const agencyFilterCategories = useMemo(
    () => [
      {type: "customization", labelKey: "customization"},
      {type: "status", labelKey: "status"},
    ],
    [],
  );

  const teamFilterCategories = useMemo(
    () => [
      {type: "agency", labelKey: "agency"},
      {type: "customizable", labelKey: "customizable"},
      {type: "customization", labelKey: "customization"},
    ],
    [],
  );

  const filterCategories =
    activeTab === "accounts"
      ? accountFilterCategories
      : activeTab === "teams"
        ? teamFilterCategories
        : agencyFilterCategories;

  const accountFilterOptions = useMemo(() => {
    const types = [
      ...new Set(accounts.map((a) => a.accountType).filter(Boolean)),
    ].sort();
    const agencyNames = [
      ...new Set(accounts.map((a) => a.agencyName).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));

    return {
      accountType: types.map((value) => ({
        value,
        label: formatAccountType(value),
      })),
      agency: agencyNames.map((value) => ({value, label: value})),
      customizable: [
        {value: "yes", label: "Yes"},
        {value: "no", label: "No"},
      ],
    };
  }, [accounts]);

  const agencyFilterOptions = useMemo(() => {
    const statuses = [
      ...new Set(agencies.map((a) => a.status).filter(Boolean)),
    ].sort();
    return {
      customization: [
        {value: "yes", label: "Yes"},
        {value: "no", label: "No"},
      ],
      status: statuses.map((value) => ({
        value,
        label: value.charAt(0).toUpperCase() + value.slice(1),
      })),
    };
  }, [agencies]);

  const teamFilterOptions = useMemo(() => {
    const agencyNames = [
      ...new Set(teams.map((t) => t.agencyName).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    return {
      agency: agencyNames.map((value) => ({value, label: value})),
      customizable: [
        {value: "yes", label: "Yes"},
        {value: "no", label: "No"},
      ],
      customization: [
        {value: "yes", label: "Yes"},
        {value: "no", label: "No"},
      ],
    };
  }, [teams]);

  const filterOptions =
    activeTab === "accounts"
      ? accountFilterOptions
      : activeTab === "teams"
        ? teamFilterOptions
        : agencyFilterOptions;

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = accounts;

    if (q) {
      list = list.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.url?.toLowerCase().includes(q) ||
          a.ownerEmail?.toLowerCase().includes(q) ||
          a.agencyName?.toLowerCase().includes(q) ||
          a.accountType?.toLowerCase().includes(q) ||
          String(a.id).includes(q),
      );
    }

    if (activeFilters.length > 0) {
      const filtersByType = {};
      activeFilters.forEach((f) => {
        if (!filtersByType[f.type]) filtersByType[f.type] = [];
        filtersByType[f.type].push(f.value);
      });

      list = list.filter((a) =>
        Object.entries(filtersByType).every(([type, values]) => {
          if (type === "accountType") {
            return values.includes(a.accountType);
          }
          if (type === "agency") {
            return values.includes(a.agencyName);
          }
          if (type === "customizable") {
            const yes = !!a.customizable;
            return values.some((v) => (v === "yes" ? yes : !yes));
          }
          return true;
        }),
      );
    }

    const {key, direction} = sortConfig;
    return [...list].sort((a, b) => {
      let av;
      let bv;
      if (key === "hasCustomization" || key === "customizable") {
        av = a[key] ? 1 : 0;
        bv = b[key] ? 1 : 0;
      } else if (key === "accountType") {
        av = formatAccountType(a.accountType).toLowerCase();
        bv = formatAccountType(b.accountType).toLowerCase();
      } else {
        av = (a[key] ?? "").toString().toLowerCase();
        bv = (b[key] ?? "").toString().toLowerCase();
      }
      if (av < bv) return direction === "asc" ? -1 : 1;
      if (av > bv) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [accounts, search, activeFilters, sortConfig]);

  const filteredAgencies = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = agencies;

    if (q) {
      list = list.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.status?.toLowerCase().includes(q) ||
          String(a.id).includes(q),
      );
    }

    if (activeFilters.length > 0) {
      const filtersByType = {};
      activeFilters.forEach((f) => {
        if (!filtersByType[f.type]) filtersByType[f.type] = [];
        filtersByType[f.type].push(f.value);
      });

      list = list.filter((a) =>
        Object.entries(filtersByType).every(([type, values]) => {
          if (type === "customization") {
            const has = !!a.hasCustomization;
            return values.some((v) => (v === "yes" ? has : !has));
          }
          if (type === "status") {
            return values.includes(a.status);
          }
          return true;
        }),
      );
    }

    const {key, direction} = sortConfig;
    return [...list].sort((a, b) => {
      let av;
      let bv;
      if (key === "hasCustomization") {
        av = a.hasCustomization ? 1 : 0;
        bv = b.hasCustomization ? 1 : 0;
      } else {
        av = (a[key] ?? "").toString().toLowerCase();
        bv = (b[key] ?? "").toString().toLowerCase();
      }
      if (av < bv) return direction === "asc" ? -1 : 1;
      if (av > bv) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [agencies, search, activeFilters, sortConfig]);

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = teams;

    if (q) {
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(q) ||
          t.agencyName?.toLowerCase().includes(q) ||
          t.officeName?.toLowerCase().includes(q) ||
          t.status?.toLowerCase().includes(q) ||
          String(t.id).includes(q),
      );
    }

    if (activeFilters.length > 0) {
      const filtersByType = {};
      activeFilters.forEach((f) => {
        if (!filtersByType[f.type]) filtersByType[f.type] = [];
        filtersByType[f.type].push(f.value);
      });

      list = list.filter((t) =>
        Object.entries(filtersByType).every(([type, values]) => {
          if (type === "agency") {
            return values.includes(t.agencyName);
          }
          if (type === "customizable") {
            const yes = !!t.customizable;
            return values.some((v) => (v === "yes" ? yes : !yes));
          }
          if (type === "customization") {
            const has = !!t.hasCustomization;
            return values.some((v) => (v === "yes" ? has : !has));
          }
          return true;
        }),
      );
    }

    const {key, direction} = sortConfig;
    return [...list].sort((a, b) => {
      let av;
      let bv;
      if (key === "hasCustomization" || key === "customizable") {
        av = a[key] ? 1 : 0;
        bv = b[key] ? 1 : 0;
      } else {
        av = (a[key] ?? "").toString().toLowerCase();
        bv = (b[key] ?? "").toString().toLowerCase();
      }
      if (av < bv) return direction === "asc" ? -1 : 1;
      if (av > bv) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [teams, search, activeFilters, sortConfig]);

  const filteredItems =
    activeTab === "accounts"
      ? filteredAccounts
      : activeTab === "teams"
        ? filteredTeams
        : filteredAgencies;

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setCurrentPage(1);
  };

  const handleAddFilter = (filter) => {
    setActiveFilters((prev) => {
      if (prev.some((f) => f.type === filter.type && f.value === filter.value)) {
        return prev;
      }
      return [...prev, filter];
    });
    setCurrentPage(1);
  };

  const handleRemoveFilter = (filter) => {
    setActiveFilters((prev) =>
      prev.filter((f) => !(f.type === filter.type && f.value === filter.value)),
    );
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setActiveFilters([]);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? {key, direction: prev.direction === "asc" ? "desc" : "asc"}
        : {key, direction: "asc"},
    );
  };

  const handleAccountClick = (account) => {
    if (!account.customizable) {
      showBanner(
        "warning",
        account.inheritsFromLabel ||
          "This account isn’t customizable. Only agent accounts can be customized.",
      );
      return;
    }
    const customizableAccounts = filteredAccounts.filter((a) => a.customizable);
    const currentIndex =
      customizableAccounts.findIndex((a) => a.id === account.id) + 1;
    navigate(`${base}/${account.id}`, {
      state: {
        currentIndex,
        totalItems: customizableAccounts.length,
        visibleAccountIds: customizableAccounts.map((a) => a.id),
        listTab: "accounts",
      },
    });
  };

  const handleAgencyClick = (agency) => {
    const currentIndex =
      filteredAgencies.findIndex((a) => a.id === agency.id) + 1;
    navigate(`${base}/agency/${agency.id}`, {
      state: {
        currentIndex,
        totalItems: filteredAgencies.length,
        visibleAgencyIds: filteredAgencies.map((a) => a.id),
        listTab: "agencies",
      },
    });
  };

  const handleTeamClick = (team) => {
    const currentIndex = filteredTeams.findIndex((t) => t.id === team.id) + 1;
    navigate(`${base}/team/${team.id}`, {
      state: {
        currentIndex,
        totalItems: filteredTeams.length,
        visibleTeamIds: filteredTeams.map((t) => t.id),
        listTab: "teams",
      },
    });
  };

  const accountColumns = useMemo(
    () => [
      {
        key: "name",
        label: "Account",
        sortable: true,
        render: (value) => (
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "url",
        label: "URL",
        sortable: true,
        render: (value) => (
          <span className="text-gray-600 dark:text-gray-400 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "ownerEmail",
        label: "Main email",
        sortable: true,
        render: (value) => (
          <span className="text-gray-600 dark:text-gray-400 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "accountType",
        label: "Account type",
        sortable: true,
        render: (value) => (
          <span className="text-gray-700 dark:text-gray-300">
            {formatAccountType(value)}
          </span>
        ),
      },
      {
        key: "agencyName",
        label: "Agency",
        sortable: true,
        render: (value) => (
          <span className="text-gray-600 dark:text-gray-400 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "customizable",
        label: "Customizable",
        sortable: true,
        render: (value) => <YesNoBadge value={!!value} />,
      },
      {
        key: "hasCustomization",
        label: "Customization",
        sortable: true,
        render: (value) => <YesNoBadge value={!!value} />,
      },
    ],
    [],
  );

  const agencyColumns = useMemo(
    () => [
      {
        key: "name",
        label: "Agency",
        sortable: true,
        render: (value) => (
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        render: (value) => (
          <span className="text-gray-600 dark:text-gray-400 capitalize">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "hasCustomization",
        label: "Customization",
        sortable: true,
        render: (value) => <YesNoBadge value={!!value} />,
      },
    ],
    [],
  );

  const teamColumns = useMemo(
    () => [
      {
        key: "name",
        label: "Team",
        sortable: true,
        render: (value) => (
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "agencyName",
        label: "Agency",
        sortable: true,
        render: (value) => (
          <span className="text-gray-600 dark:text-gray-400 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "officeName",
        label: "Office",
        sortable: true,
        render: (value) => (
          <span className="text-gray-600 dark:text-gray-400 truncate">
            {value || <span className="text-gray-400">&mdash;</span>}
          </span>
        ),
      },
      {
        key: "customizable",
        label: "Customizable",
        sortable: true,
        render: (value) => <YesNoBadge value={!!value} />,
      },
      {
        key: "hasCustomization",
        label: "Customization",
        sortable: true,
        render: (value) => <YesNoBadge value={!!value} />,
      },
    ],
    [],
  );

  const columns =
    activeTab === "accounts"
      ? accountColumns
      : activeTab === "teams"
        ? teamColumns
        : agencyColumns;

  const renderItem = (item, handleSelect, selected, onItemClick) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selected.includes(item.id)}
      onItemClick={onItemClick}
      selectable={false}
    />
  );

  const filterLabelDefaults = {
    filter: "Filter",
    accountType: "Account type",
    agency: "Agency",
    customizable: "Customizable",
    customization: "Customization",
    status: "Status",
    noItemsFound: "No items found",
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={PAGE_LAYOUT.list}>
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold flex items-center gap-2">
              <SlidersHorizontal className="w-7 h-7 text-[var(--opsy-accent,#456564)]" />
              Customization
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Customize shell accent, sidebar icon, and agent card for agencies, teams,
              and agent accounts.
            </p>
            <div
              className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
              role="note"
            >
              <p className="font-medium text-gray-800 dark:text-gray-100 mb-1.5">
                Branding hierarchy
              </p>
              <ul className="list-disc pl-5 space-y-1 leading-snug">
                <li>
                  <span className="font-medium">Agencies</span>,{" "}
                  <span className="font-medium">teams</span>, and{" "}
                  <span className="font-medium">agent accounts</span> can be customized.
                </li>
                <li>
                  Most specific wins: agent branding overrides team and agency. Team
                  branding overrides agency when the agent has no personal branding.
                  Agency branding applies when neither agent nor team is customized.
                </li>
                <li>
                  Homeowners inherit the sponsoring agent&apos;s effective branding when
                  sponsored; otherwise they use Opsy defaults.
                </li>
              </ul>
            </div>
          </div>

          <nav className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
            {[
              {id: "accounts", label: "Accounts"},
              {id: "agencies", label: "Agencies"},
              {id: "teams", label: "Teams"},
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? "border-[var(--opsy-accent,#456564)] text-[var(--opsy-accent,#456564)]"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {banner.message && (
            <div className="mb-4">
              <Banner
                open={banner.open}
                type={banner.type}
                setOpen={(open) => setBanner((b) => ({...b, open}))}
              >
                {banner.message}
              </Banner>
            </div>
          )}

          <div className="mb-5 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <SearchInput
                placeholder={
                  activeTab === "accounts"
                    ? "Search by name, URL, email, type, or agency…"
                    : activeTab === "teams"
                      ? "Search teams by name, agency, or office…"
                      : "Search agencies by name or status…"
                }
                value={search}
                onChange={handleSearchChange}
              />
              <div className="flex items-center gap-2 shrink-0">
                <FilterDropdown
                  filterCategories={filterCategories}
                  filterOptions={filterOptions}
                  activeFilters={activeFilters}
                  onAdd={handleAddFilter}
                  onRemove={handleRemoveFilter}
                  t={(key, opts) =>
                    t(key, {
                      defaultValue: filterLabelDefaults[key] ?? key,
                      ...opts,
                    })
                  }
                />
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
                      {t(
                        filterCategories.find((c) => c.type === f.type)?.labelKey ??
                          f.type,
                        {
                          defaultValue:
                            filterLabelDefaults[
                              filterCategories.find((c) => c.type === f.type)
                                ?.labelKey
                            ] ?? f.type,
                        },
                      )}
                      :
                    </span>
                    {f.label}
                    <button
                      type="button"
                      onClick={() => handleRemoveFilter(f)}
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
                  onClick={handleClearFilters}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  {t("clearAll", {defaultValue: "Clear all"})}
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-12">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading {activeTab}…
            </div>
          ) : (
            <>
              <DataTable
                items={paginatedItems}
                columns={columns}
                onItemClick={
                  activeTab === "accounts"
                    ? handleAccountClick
                    : activeTab === "teams"
                      ? handleTeamClick
                      : handleAgencyClick
                }
                totalItems={filteredItems.length}
                title={
                  activeTab === "accounts"
                    ? "accounts"
                    : activeTab === "teams"
                      ? "teams"
                      : "agencies"
                }
                sortConfig={sortConfig}
                onSort={handleSort}
                renderItem={renderItem}
                selectedItems={[]}
                onSelect={() => {}}
                allSelected={false}
                selectable={false}
              />
              {filteredItems.length > 0 && filteredItems.length > itemsPerPage && (
                <div className="mt-8">
                  <PaginationClassic
                    currentPage={currentPage}
                    totalItems={filteredItems.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    pageSizeOptions={[5, 10, 20, 50]}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default CustomizationList;
