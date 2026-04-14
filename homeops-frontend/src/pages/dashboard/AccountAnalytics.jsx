import React, {useState, useEffect, useCallback, useMemo, useRef} from "react";
import {createPortal} from "react-dom";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import PaginationClassic from "../../components/PaginationClassic";
import useSuppressBrowserAddressAutofill from "../../hooks/useSuppressBrowserAddressAutofill";
import {PAGE_LAYOUT} from "../../constants/layout";
import Transition from "../../utils/Transition";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  Search,
  LogIn,
  Clock,
  FileText,
  Activity,
  User,
  Eye,
} from "lucide-react";

const DEFAULT_ITEMS_PER_PAGE = 10;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HEATMAP_MONTH_NAMES_UPPER = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

/** `ymd` = YYYY-MM-DD from API (browser timezone via request). */
function formatHeatmapTooltipDayLine(ymd) {
  const parts = String(ymd).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "";
  const [y, m, d] = parts;
  const ref = new Date(y, m - 1, d);
  const dow = DAY_LABELS[ref.getDay()]?.toUpperCase() || "";
  const month = HEATMAP_MONTH_NAMES_UPPER[ref.getMonth()];
  const dayNum = ref.getDate();
  const yFull = ref.getFullYear();
  const cy = new Date().getFullYear();
  const yearPart = yFull !== cy ? ` ${yFull}` : "";
  return `${dow} ${month} ${dayNum}${yearPart}`;
}

function heatmapRowShortLabel(ymd, rowIndex) {
  if (rowIndex === 0) return "Today";
  const parts = String(ymd).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "—";
  const [y, m, d] = parts;
  const ref = new Date(y, m - 1, d);
  return DAY_LABELS[ref.getDay()] || "—";
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return "—";
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

/** Compact label for heatmap cells (small footprint). */
function formatHeatmapDuration(ms) {
  if (ms == null || ms < 1000) return "";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h${rm}m` : `${h}h`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const HEATMAP_CELL =
  "w-[18px] h-[18px] sm:w-5 sm:h-5 shrink-0 rounded-[2px] flex items-center justify-center text-[5px] sm:text-[6px] leading-none font-semibold tabular-nums px-px overflow-hidden cursor-help select-none transition-[transform,box-shadow] duration-100 hover:ring-2 hover:ring-[#456564]/40 hover:ring-offset-1 hover:ring-offset-white dark:hover:ring-offset-gray-900 hover:z-10 hover:scale-110";

const HEATMAP_TIP_HIDE_MS = 60;

function HeatmapGrid({patterns, dayKeys}) {
  const hideTimerRef = useRef(null);
  const [tip, setTip] = useState(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  const showCellTip = useCallback(
    (e, {rowYmd, hour, count, durationMs, hasViews}) => {
      clearHideTimer();
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const placeAbove = rect.top > 100;
      const y = placeAbove ? rect.top : rect.bottom;
      setTip({
        x,
        y,
        placeAbove,
        rowYmd,
        hour,
        count,
        durationMs,
        hasViews,
      });
    },
    [clearHideTimer],
  );

  const scheduleHideTip = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setTip(null);
      hideTimerRef.current = null;
    }, HEATMAP_TIP_HIDE_MS);
  }, [clearHideTimer]);

  const {grid, maxCount} = useMemo(() => {
    const keys = Array.isArray(dayKeys) ? dayKeys : [];
    const rowIndexByDate = new Map(keys.map((ymd, i) => [ymd, i]));
    const g = keys.map(() =>
      Array.from({length: 24}, () => ({count: 0, durationMs: 0})),
    );
    let mc = 0;
    for (const p of patterns || []) {
      const ymd = p.localDate;
      if (!ymd) continue;
      const ri = rowIndexByDate.get(ymd);
      if (ri === undefined) continue;
      const cell = g[ri][p.hour];
      cell.count += p.count || 0;
      cell.durationMs += p.durationMs || 0;
      mc = Math.max(mc, cell.count);
    }
    return {grid: g, maxCount: mc};
  }, [patterns, dayKeys]);

  const getOpacity = (count) => {
    if (maxCount === 0 || count === 0) return 0;
    return 0.15 + (count / maxCount) * 0.85;
  };

  const portalRoot = typeof document !== "undefined" ? document.body : null;

  const tipPanel =
    tip &&
    portalRoot &&
    createPortal(
      <div
        className="fixed z-[10000] pointer-events-none"
        style={{
          left: tip.x,
          top: tip.y,
          transform: tip.placeAbove
            ? "translate(-50%, calc(-100% - 10px))"
            : "translate(-50%, 10px)",
        }}
        aria-hidden
      >
        <Transition
          appear
          show={Boolean(tip)}
          tag="div"
          className="rounded-xl border border-gray-200/90 dark:border-gray-600/70 bg-white/98 dark:bg-gray-900/98 backdrop-blur-md shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25)] dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)] px-3.5 py-2.5 min-w-[10.5rem] max-w-[16rem]"
          enter="transition ease-out duration-75"
          enterStart="opacity-0 scale-[0.96]"
          enterEnd="opacity-100 scale-100"
          leave="transition ease-in duration-50"
          leaveStart="opacity-100 scale-100"
          leaveEnd="opacity-0 scale-[0.98]"
        >
          <div className="flex flex-col gap-1.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#456564] dark:text-teal-400/90">
                {formatHeatmapTooltipDayLine(tip.rowYmd)}
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-50 tabular-nums">
                {tip.hour}:00 – {tip.hour}:59
              </p>
            </div>
            <div className="h-px bg-gradient-to-r from-[#456564]/25 via-gray-200 dark:via-gray-600 to-transparent" />
            <dl className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400 shrink-0">
                  Page views
                </dt>
                <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {tip.count}
                </dd>
              </div>
              <div className="flex justify-between gap-4 items-start">
                <dt className="text-gray-500 dark:text-gray-400 shrink-0 pt-0.5">
                  Time spent
                </dt>
                <dd className="text-right font-medium text-gray-800 dark:text-gray-100 leading-snug">
                  {tip.durationMs >= 1000 ? (
                    <span className="text-[#456564] dark:text-teal-400">
                      ~{formatDuration(tip.durationMs)}
                    </span>
                  ) : tip.hasViews ? (
                    <span className="inline-flex flex-col items-end gap-0.5">
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Session ended here
                      </span>
                      <span className="text-[10px] font-normal text-gray-400 dark:text-gray-500 leading-snug">
                        User left or was idle 30+ min
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </dd>
              </div>
            </dl>
            {tip.hasViews && (
              <p className="text-[10px] leading-relaxed text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-700/80 pt-1.5 mt-0.5">
                {tip.durationMs >= 1000
                  ? "Time spent is measured from the first to last page navigation within this hour slot."
                  : "Time can\u2019t be measured when this was the user\u2019s last page before leaving or going idle."}
              </p>
            )}
          </div>
        </Transition>
      </div>,
      portalRoot,
    );

  return (
    <div className="space-y-1">
      {tipPanel}
      <div className="max-w-full overflow-x-auto pb-1">
        <div className="inline-block min-w-0">
          <div className="flex gap-0.5 ml-9 sm:ml-10">
            {Array.from({length: 24}, (_, i) => (
              <div
                key={i}
                className="w-[18px] sm:w-5 shrink-0 text-center text-[8px] text-gray-400 dark:text-gray-500 tabular-nums"
              >
                {i % 3 === 0 ? i : ""}
              </div>
            ))}
          </div>
          {(dayKeys || []).map((ymd, di) => {
            const rowLabel = heatmapRowShortLabel(ymd, di);
            return (
              <div key={ymd} className="flex items-center gap-0.5 mt-0.5">
                <span className="w-8 sm:w-9 text-right text-[9px] text-gray-500 dark:text-gray-400 shrink-0 pr-0.5">
                  {rowLabel}
                </span>
                <div className="flex gap-0.5">
                  {(grid[di] || []).map((cell, hi) => {
                    const {count, durationMs} = cell;
                    const label = formatHeatmapDuration(durationMs);
                    const hasViews = count > 0;
                    const op = getOpacity(count);
                    const filled = hasViews && op > 0;
                    return (
                      <div
                        key={hi}
                        aria-label={`${formatHeatmapTooltipDayLine(ymd)}, ${hi}:00, ${count} views${
                          durationMs >= 1000
                            ? `, ~${formatDuration(durationMs)} spent`
                            : ""
                        }`}
                        className={HEATMAP_CELL}
                        style={{
                          backgroundColor: !hasViews
                            ? "rgba(156,163,175,0.12)"
                            : `rgba(69,101,100,${op})`,
                          color: filled
                            ? op > 0.45
                              ? "rgba(255,255,255,0.95)"
                              : "rgba(17,24,39,0.9)"
                            : "rgba(107,114,128,0.9)",
                        }}
                        onMouseEnter={(e) =>
                          showCellTip(e, {
                            rowYmd: ymd,
                            hour: hi,
                            count,
                            durationMs,
                            hasViews,
                          })
                        }
                        onMouseLeave={scheduleHideTip}
                      >
                        {label ||
                          (hasViews ? (
                            <span className="opacity-60 font-normal">·</span>
                          ) : null)}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
        <p className="text-[9px] text-gray-500 dark:text-gray-400 max-w-md leading-snug">
          Color intensity = page views. Cell label = time spent on pages. Hover
          a cell for details.
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Less
          </span>
          {[0, 0.25, 0.5, 0.75, 1].map((level) => (
            <div
              key={level}
              className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-[2px]"
              style={{
                backgroundColor:
                  level === 0
                    ? "rgba(156,163,175,0.12)"
                    : `rgba(69,101,100,${0.15 + level * 0.85})`,
              }}
            />
          ))}
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            More
          </span>
        </div>
      </div>
    </div>
  );
}

function StatBadge({icon: Icon, label, value, color = "gray"}) {
  const colors = {
    gray: "bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300",
    green:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    blue: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400",
    amber:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
    violet:
      "bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400",
  };
  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${colors[color] || colors.gray}`}
    >
      <Icon className="w-3.5 h-3.5 opacity-70" />
      <span className="text-xs font-medium">
        {value} {label}
      </span>
    </div>
  );
}

function UserActivityRow({user, isLast, heatmapDayKeys = []}) {
  const [showPages, setShowPages] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);

  return (
    <div
      className={`${!isLast ? "border-b border-gray-100 dark:border-gray-700/60" : ""}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {user.userName || user.userEmail || `User #${user.userId}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {user.userEmail}
              {user.userRole ? (
                <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                  ({user.userRole})
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 shrink-0">
          <StatBadge
            icon={LogIn}
            label="(24h)"
            value={user.logins24h}
            color={user.logins24h > 0 ? "green" : "gray"}
          />
          <StatBadge
            icon={LogIn}
            label="(12h)"
            value={user.logins12h}
            color={user.logins12h > 0 ? "green" : "gray"}
          />
          <StatBadge
            icon={Clock}
            label="avg"
            value={formatDuration(user.avgSessionMs)}
            color={user.avgSessionMs > 0 ? "blue" : "gray"}
          />
          <StatBadge
            icon={Eye}
            label="sessions"
            value={user.sessionCount}
            color={user.sessionCount > 0 ? "violet" : "gray"}
          />
          {user.lastLogin && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500 self-center ml-1">
              Last login: {formatTimeAgo(user.lastLogin)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 pb-3">
        {user.topPages?.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPages((p) => !p)}
            className="text-xs text-[#456564] hover:text-[#3a5554] dark:text-teal-400 dark:hover:text-teal-300 font-medium flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            {showPages ? "Hide" : "Show"} pages ({user.topPages.length})
          </button>
        )}
        {user.topPages?.length > 0 && heatmapDayKeys.length > 0 && (
          <span
            className="h-4 w-px shrink-0 bg-gray-200 dark:bg-gray-600"
            aria-hidden
          />
        )}
        {heatmapDayKeys.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPatterns((p) => !p)}
            className="text-xs text-[#456564] hover:text-[#3a5554] dark:text-teal-400 dark:hover:text-teal-300 font-medium flex items-center gap-1"
          >
            <Activity className="w-3 h-3" />
            {showPatterns ? "Hide" : "Show"} activity heatmap
          </button>
        )}
      </div>

      {showPages && user.topPages?.length > 0 && (
        <div className="px-5 pb-4">
          <div className="rounded-lg border border-gray-100 dark:border-gray-700/60 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-800/50 text-left text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">Page Path</th>
                  <th className="px-3 py-2 font-medium text-right">Visits</th>
                  <th className="px-3 py-2 font-medium text-right">
                    Last Visited
                  </th>
                </tr>
              </thead>
              <tbody>
                {user.topPages.map((page) => (
                  <tr
                    key={page.path}
                    className="border-t border-gray-100 dark:border-gray-700/40"
                  >
                    <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 font-mono truncate max-w-[280px]">
                      {page.path}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">
                      {page.visitCount}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(page.lastVisited)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPatterns && heatmapDayKeys.length > 0 && (
        <div className="px-5 pb-4">
          <div className="rounded-lg border border-gray-100 dark:border-gray-700/60 p-3 bg-gray-50/50 dark:bg-gray-900/30">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wide">
              Activity heatmap (today and prior 6 days)
            </p>
            <HeatmapGrid
              patterns={user.visitPatterns || []}
              dayKeys={heatmapDayKeys}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AccountAnalytics() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [activityHeatmapDays, setActivityHeatmapDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [searchTerm, setSearchTerm] = useState("");
  const bindAccountSearchInput = useSuppressBrowserAddressAutofill(
    "account-analytics-search",
  );

  const filteredAccounts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((acct) => {
      const parts = [
        acct.accountName,
        String(acct.accountId),
        ...acct.users.flatMap((u) => [u.userName, u.userEmail, u.userRole]),
      ];
      return parts.some((p) => p && String(p).toLowerCase().includes(q));
    });
  }, [accounts, searchTerm]);

  const paginatedAccounts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAccounts.slice(start, start + itemsPerPage);
  }, [filteredAccounts, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [filteredAccounts.length, itemsPerPage, currentPage]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const {accounts: nextAccounts, activityHeatmapDays: dayKeys} =
        await AppApi.getAccountsActivity({timeZone});
      setAccounts(nextAccounts);
      setActivityHeatmapDays(dayKeys);
    } catch (err) {
      setError(
        err?.messages?.[0] || err?.message || "Failed to load account activity",
      );
      setAccounts([]);
      setActivityHeatmapDays([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleAccount = (accountId) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  const accountSummary = useCallback((acct) => {
    const users = acct.users || [];
    const totalLogins24h = users.reduce((s, u) => s + (u.logins24h || 0), 0);
    const totalLogins12h = users.reduce((s, u) => s + (u.logins12h || 0), 0);
    const activeSessions = users.reduce((s, u) => s + (u.sessionCount || 0), 0);
    const avgSessions =
      users.filter((u) => u.avgSessionMs > 0).length > 0
        ? Math.round(
            users.reduce((s, u) => s + (u.avgSessionMs || 0), 0) /
              users.filter((u) => u.avgSessionMs > 0).length,
          )
        : 0;
    return {totalLogins24h, totalLogins12h, activeSessions, avgSessions};
  }, []);

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
                  Account Analytics
                </h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Per-account user activity: logins, session duration, pages
                  visited, and usage patterns.
                </p>
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
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {!loading && accounts.length > 0 && (
              <div className="mb-5">
                <div className="relative max-w-md">
                  <label htmlFor="acct-analytics-search" className="sr-only">
                    Search accounts
                  </label>
                  <input
                    id="acct-analytics-search"
                    type="search"
                    placeholder="Search by account, user name, email…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-300 dark:focus:border-gray-600 rounded-lg shadow-sm text-sm"
                    {...bindAccountSearchInput()}
                  />
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-3">
                    <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 ml-0.5" />
                  </div>
                </div>
              </div>
            )}

            {loading && accounts.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
              </div>
            ) : accounts.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No account activity data found.
                </p>
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No accounts match your search.
                </p>
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="mt-3 text-sm font-medium text-[#456564] hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedAccounts.map((acct) => {
                    const isExpanded = expandedAccounts.has(acct.accountId);
                    const summary = accountSummary(acct);

                    return (
                      <div
                        key={acct.accountId}
                        className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleAccount(acct.accountId)}
                          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {acct.accountName || `Account #${acct.accountId}`}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {acct.users.length} user
                              {acct.users.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <StatBadge
                              icon={LogIn}
                              label="logins (24h)"
                              value={summary.totalLogins24h}
                              color={
                                summary.totalLogins24h > 0 ? "green" : "gray"
                              }
                            />
                            <StatBadge
                              icon={LogIn}
                              label="logins (12h)"
                              value={summary.totalLogins12h}
                              color={
                                summary.totalLogins12h > 0 ? "green" : "gray"
                              }
                            />
                            <StatBadge
                              icon={Clock}
                              label="avg session"
                              value={formatDuration(summary.avgSessions)}
                              color={summary.avgSessions > 0 ? "blue" : "gray"}
                            />
                            <StatBadge
                              icon={Activity}
                              label="sessions"
                              value={summary.activeSessions}
                              color={
                                summary.activeSessions > 0 ? "violet" : "gray"
                              }
                            />
                          </div>
                        </button>

                        {isExpanded && acct.users.length > 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                            {acct.users.map((user, idx) => (
                              <UserActivityRow
                                key={user.userId}
                                user={user}
                                isLast={idx === acct.users.length - 1}
                                heatmapDayKeys={activityHeatmapDays}
                              />
                            ))}
                          </div>
                        )}

                        {isExpanded && acct.users.length === 0 && (
                          <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No users in this account.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {filteredAccounts.length > 0 && (
                  <div className="mt-6">
                    <PaginationClassic
                      currentPage={currentPage}
                      totalItems={filteredAccounts.length}
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

export default AccountAnalytics;
