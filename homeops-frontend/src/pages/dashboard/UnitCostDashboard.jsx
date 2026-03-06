import React, { useState, useEffect, useCallback } from "react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import { PAGE_LAYOUT } from "../../constants/layout";
import {
  DollarSign,
  RefreshCw,
  FileText,
  Users,
  Sparkles,
  Cpu,
} from "lucide-react";

function formatUsd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(value);
}

function getDefaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function UnitCostDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState(getDefaultDateRange);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, summaryData] = await Promise.all([
        AppApi.getCostPerUser(dateRange),
        AppApi.getCostSummary(dateRange),
      ]);
      setUsers(usersData ?? []);
      setSummary(summaryData ?? null);
    } catch (err) {
      setError(
        err?.messages?.[0] || err?.message || "Failed to load unit cost data"
      );
      setUsers([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalApiCalls = users.reduce((acc, u) => acc + (u.apiCallCount ?? 0), 0);
  const totalDocuments = users.reduce(
    (acc, u) => acc + (u.documentCount ?? 0),
    0
  );
  const totalTokens = users.reduce((acc, u) => acc + (u.tokenCount ?? 0), 0);

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
                  Unit Cost Dashboard
                </h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Cost per user: OpenAI API calls, documents stored on S3, and
                  other usage.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="startDate"
                    className="text-sm text-gray-600 dark:text-gray-400"
                  >
                    From
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="endDate"
                    className="text-sm text-gray-600 dark:text-gray-400"
                  >
                    To
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) =>
                      setDateRange((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-2 btn bg-[#456564] text-white hover:bg-[#3a5554] disabled:opacity-50 text-sm"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                  {loading ? "Loading..." : "Refresh"}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {!error && summary && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Cost</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {formatUsd(summary.totalCost ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Avg per User</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {formatUsd(summary.avgCostPerUser ?? 0)}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">OpenAI API Calls</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {totalApiCalls.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">S3 Documents</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {totalDocuments.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Cpu className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Tokens</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {totalTokens.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {loading && users.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-gray-500 dark:text-gray-400">
                  Loading unit cost data...
                </p>
              </div>
            ) : users.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No usage data for the selected period.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-600">
                        <th className="px-5 py-3 font-medium">User</th>
                        <th className="px-5 py-3 font-medium">Role</th>
                        <th className="px-5 py-3 font-medium">Account(s)</th>
                        <th className="px-5 py-3 font-medium text-right">
                          Total Cost
                        </th>
                        <th className="px-5 py-3 font-medium text-right">
                          AI (OpenAI)
                        </th>
                        <th className="px-5 py-3 font-medium text-right">
                          Storage (S3)
                        </th>
                        <th className="px-5 py-3 font-medium text-right">
                          Email
                        </th>
                        <th className="px-5 py-3 font-medium text-right">
                          API Calls
                        </th>
                        <th className="px-5 py-3 font-medium text-right">
                          Documents
                        </th>
                        <th className="px-5 py-3 font-medium text-right">
                          Tokens
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.userId}
                          className="border-b border-gray-100 dark:border-gray-700/60 last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                        >
                          <td className="px-5 py-3">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {u.userName || u.userEmail || `User #${u.userId}`}
                              </p>
                              {u.userName && u.userEmail && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {u.userEmail}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                u.userRole === "super_admin"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                                  : u.userRole === "admin"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  : u.userRole === "agent"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  : u.userRole === "homeowner"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                              }`}
                            >
                              {u.userRole || "—"}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-400 max-w-[180px] truncate">
                            {u.accountNames || "—"}
                          </td>
                          <td className="px-5 py-3 text-right font-medium">
                            {formatUsd(u.totalCost)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {u.aiCost > 0 ? formatUsd(u.aiCost) : "—"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {u.storageCost > 0
                              ? formatUsd(u.storageCost)
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {u.emailCost > 0 ? formatUsd(u.emailCost) : "—"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {(u.apiCallCount ?? 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {(u.documentCount ?? 0).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {(u.tokenCount ?? 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default UnitCostDashboard;
