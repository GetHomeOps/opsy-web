import React, {useState, useEffect, useCallback, useMemo} from "react";
import {useTranslation} from "react-i18next";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import PaginationClassic from "../../components/PaginationClassic";
import {PAGE_LAYOUT} from "../../constants/layout";
import {isDemoSite, canAccessDemoSalesDashboard} from "../../utils/demoSite";
import {useAuth} from "../../context/AuthContext";
import {
  Users,
  LogIn,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  TrendingUp,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 15;

const STATUS_OPTIONS = [
  {value: "", labelKey: "demoSales.statusAll"},
  {value: "opened", labelKey: "demoSales.statusOpened"},
  {value: "pending", labelKey: "demoSales.statusPending"},
  {value: "expired", labelKey: "demoSales.statusExpired"},
];

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({status, t}) {
  const styles = {
    opened:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
    pending:
      "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
    expired: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };
  const labels = {
    opened: t("demoSales.statusOpened", {defaultValue: "Opened"}),
    pending: t("demoSales.statusPending", {defaultValue: "Pending"}),
    expired: t("demoSales.statusExpired", {defaultValue: "Expired"}),
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}
    >
      {labels[status] || status}
    </span>
  );
}

function KpiCard({label, value, sub, icon: Icon, accent}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1 tabular-nums">
            {value}
          </p>
          {sub ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={`p-2.5 rounded-lg ${accent || "bg-[#456564]/10 text-[#456564]"}`}
          >
            <Icon className="w-5 h-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DemoSalesDashboard() {
  const {t} = useTranslation();
  const {currentUser} = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);

  const canAccess = canAccessDemoSalesDashboard(currentUser);

  const dateParams = useMemo(() => {
    const params = {};
    if (dateFrom) params.from = new Date(dateFrom).toISOString();
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      params.to = end.toISOString();
    }
    return params;
  }, [dateFrom, dateTo]);

  const loadSummary = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    try {
      const data = await AppApi.getDemoSalesSummary(dateParams);
      setSummary(data);
    } catch (err) {
      setError(err.message || "Failed to load demo sales summary");
    } finally {
      setLoading(false);
    }
  }, [canAccess, dateParams]);

  const loadAccounts = useCallback(async () => {
    if (!canAccess) return;
    setAccountsLoading(true);
    try {
      const offset = (currentPage - 1) * itemsPerPage;
      const data = await AppApi.getDemoSalesAccounts({
        ...dateParams,
        createdBy:
          selectedCreatorId != null ? String(selectedCreatorId) : undefined,
        status: statusFilter || undefined,
        limit: itemsPerPage,
        offset,
      });
      setAccounts(data.accounts ?? []);
      setTotalCount(data.totalCount ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load demo accounts");
    } finally {
      setAccountsLoading(false);
    }
  }, [
    canAccess,
    dateParams,
    selectedCreatorId,
    statusFilter,
    currentPage,
    itemsPerPage,
  ]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCreatorId, statusFilter, dateFrom, dateTo, itemsPerPage]);

  const handleRefresh = () => {
    loadSummary();
    loadAccounts();
  };

  const handleCreatorClick = (creatorId) => {
    setSelectedCreatorId((prev) => (prev === creatorId ? null : creatorId));
  };

  if (!isDemoSite() || !canAccess) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className={`relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden ${PAGE_LAYOUT}`}>
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="grow">
            <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl">
              <p className="text-gray-600 dark:text-gray-400">
                {t("demoSales.unavailable", {
                  defaultValue:
                    "Demo sales analytics are only available to super admins on demo.heyopsy.com.",
                })}
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const totals = summary?.totals ?? {};
  const creators = summary?.creators ?? [];

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className={`relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden ${PAGE_LAYOUT}`}>
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {t("demoSales.title", {defaultValue: "Demo Sales"})}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t("demoSales.subtitle", {
                    defaultValue:
                      "Track ready-to-use demo accounts created by your team and whether prospects opened them.",
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading || accountsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
              >
                {loading || accountsLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {t("refresh", {defaultValue: "Refresh"})}
              </button>
            </div>

            {error ? (
              <div className="mb-6 flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="form-input text-sm py-2 px-3 rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-800"
                aria-label={t("demoSales.dateFrom", {defaultValue: "From date"})}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="form-input text-sm py-2 px-3 rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-800"
                aria-label={t("demoSales.dateTo", {defaultValue: "To date"})}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-select text-sm py-2 px-3 rounded-lg border-gray-200 dark:border-gray-700 dark:bg-gray-800 min-w-[10rem]"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {t(opt.labelKey, {defaultValue: opt.value || "All statuses"})}
                  </option>
                ))}
              </select>
              {selectedCreatorId != null ? (
                <button
                  type="button"
                  onClick={() => setSelectedCreatorId(null)}
                  className="text-sm text-[#456564] dark:text-emerald-400 hover:underline"
                >
                  {t("demoSales.clearCreatorFilter", {
                    defaultValue: "Clear sales rep filter",
                  })}
                </button>
              ) : null}
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#456564]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <KpiCard
                  label={t("demoSales.totalCreated", {defaultValue: "Demos created"})}
                  value={totals.totalCreated ?? 0}
                  icon={Users}
                />
                <KpiCard
                  label={t("demoSales.totalOpened", {defaultValue: "Opened"})}
                  value={totals.totalOpened ?? 0}
                  icon={LogIn}
                  accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                />
                <KpiCard
                  label={t("demoSales.openRate", {defaultValue: "Open rate"})}
                  value={`${totals.openRate ?? 0}%`}
                  icon={TrendingUp}
                />
                <KpiCard
                  label={t("demoSales.pendingOpen", {defaultValue: "Pending open"})}
                  value={totals.pendingOpen ?? 0}
                  icon={Clock}
                  accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                />
                <KpiCard
                  label={t("demoSales.expiredUnopened", {
                    defaultValue: "Expired unopened",
                  })}
                  value={totals.expiredUnopened ?? 0}
                  icon={AlertCircle}
                  accent="bg-gray-500/10 text-gray-600 dark:text-gray-400"
                />
              </div>
            )}

            <section className="mb-10">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t("demoSales.bySalesRep", {defaultValue: "By sales rep"})}
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 shadow-sm">
                <table className="table-auto w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700/60 text-left text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-3 font-medium">
                        {t("demoSales.salesRep", {defaultValue: "Sales rep"})}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t("demoSales.created", {defaultValue: "Created"})}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t("demoSales.opened", {defaultValue: "Opened"})}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t("demoSales.openRate", {defaultValue: "Open rate"})}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t("demoSales.pendingOpen", {defaultValue: "Pending"})}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t("demoSales.expiredUnopened", {defaultValue: "Expired"})}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                        >
                          {t("demoSales.noData", {
                            defaultValue: "No demo accounts yet.",
                          })}
                        </td>
                      </tr>
                    ) : (
                      creators.map((row) => {
                        const isSelected = selectedCreatorId === row.creatorId;
                        return (
                          <tr
                            key={row.creatorId ?? row.creatorEmail}
                            onClick={() => handleCreatorClick(row.creatorId)}
                            className={`border-b border-gray-100 dark:border-gray-700/40 cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-[#456564]/10 dark:bg-[#456564]/20"
                                : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {row.creatorName}
                              </div>
                              {row.creatorEmail ? (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {row.creatorEmail}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {row.totalCreated}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {row.totalOpened}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {row.openRate}%
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {row.pendingOpen}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {row.expiredUnopened}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t("demoSales.demoAccounts", {defaultValue: "Demo accounts"})}
              </h2>
              {accountsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-[#456564]" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800 shadow-sm">
                    <table className="table-auto w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700/60 text-left text-gray-500 dark:text-gray-400">
                          <th className="px-4 py-3 font-medium">
                            {t("demoSales.prospect", {defaultValue: "Prospect"})}
                          </th>
                          <th className="px-4 py-3 font-medium">
                            {t("demoSales.role", {defaultValue: "Role"})}
                          </th>
                          <th className="px-4 py-3 font-medium">
                            {t("demoSales.salesRep", {defaultValue: "Sales rep"})}
                          </th>
                          <th className="px-4 py-3 font-medium">
                            {t("demoSales.status", {defaultValue: "Status"})}
                          </th>
                          <th className="px-4 py-3 font-medium">
                            {t("demoSales.createdAt", {defaultValue: "Created"})}
                          </th>
                          <th className="px-4 py-3 font-medium">
                            {t("demoSales.openedAt", {defaultValue: "First login"})}
                          </th>
                          <th className="px-4 py-3 font-medium">
                            {t("demoSales.expiresAt", {defaultValue: "Expires"})}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                            >
                              {t("demoSales.noAccounts", {
                                defaultValue: "No demo accounts match your filters.",
                              })}
                            </td>
                          </tr>
                        ) : (
                          accounts.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-gray-100 dark:border-gray-700/40"
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {row.name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {row.email}
                                </div>
                                {row.isPairedHomeowner ? (
                                  <span className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5 inline-block">
                                    {t("demoSales.pairedHomeowner", {
                                      defaultValue: "Paired homeowner",
                                    })}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-4 py-3 capitalize">{row.role}</td>
                              <td className="px-4 py-3">
                                {row.provisionedByName || "Unknown"}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={row.status} t={t} />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                {formatDateTime(row.createdAt)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                {formatDateTime(row.demoFirstLoginAt)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                                {formatDateTime(row.demoExpiresAt)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {totalCount > itemsPerPage ? (
                    <div className="mt-4">
                      <PaginationClassic
                        currentPage={currentPage}
                        totalItems={totalCount}
                        itemsPerPage={itemsPerPage}
                        onPageChange={setCurrentPage}
                        onItemsPerPageChange={setItemsPerPage}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default DemoSalesDashboard;
