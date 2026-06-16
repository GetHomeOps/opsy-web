import React, {useEffect, useMemo, useState} from "react";
import {
  ChevronRight,
  ChevronLeft,
  Activity,
  Sparkles,
  Wrench,
  CheckCircle2,
} from "lucide-react";
import SectionCard from "./SectionCard";
import EmptyStateCard from "./EmptyStateCard";
import {StatusBadge} from "./StatusBadge";

function conditionTone(condition) {
  const c = String(condition ?? "").toLowerCase();
  if (c === "excellent" || c === "good") return "emerald";
  if (c === "fair") return "amber";
  if (c === "poor") return "red";
  return "neutral";
}

function healthBarColor(percent) {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 50) return "bg-emerald-400";
  if (percent >= 25) return "bg-amber-400";
  return "bg-neutral-300 dark:bg-neutral-600";
}

const PAGE_SIZE_OPTIONS = [5, 10, 25];
const DEFAULT_PAGE_SIZE = 10;
const SYSTEMS_OVERVIEW_PAGE_SIZE_KEY = "homeops:systems-overview-page-size";

function readStoredPageSize() {
  if (typeof localStorage === "undefined") return DEFAULT_PAGE_SIZE;
  const raw = Number(localStorage.getItem(SYSTEMS_OVERVIEW_PAGE_SIZE_KEY));
  return PAGE_SIZE_OPTIONS.includes(raw) ? raw : DEFAULT_PAGE_SIZE;
}

export function formatOverviewDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Dense read-only overview table of the property's systems. Rows jump to the
 * corresponding editable CollapsibleSection — no new editing surface.
 *
 * Row shape: { id, name, icon, condition, lastService, nextDue, installer,
 * percent, filled, total }
 */
export function SystemsOverviewTable({rows = [], onJumpToSystem}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(readStoredPageSize);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(SYSTEMS_OVERVIEW_PAGE_SIZE_KEY, String(pageSize));
  }, [pageSize]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [rows.length, pageSize]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  );

  const rangeStart =
    rows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, rows.length);

  if (rows.length === 0) return null;
  return (
    <SectionCard
      flat
      title="Systems Overview"
      description="Track the condition, service history, and completion of your home systems"
      icon={Activity}
      bodyClassName="!px-0 !pb-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500 border-b border-neutral-100 dark:border-neutral-800">
              <th className="font-medium px-4 md:px-5 py-2">System</th>
              <th className="font-medium px-3 py-2">Condition</th>
              <th className="font-medium px-3 py-2 hidden md:table-cell">
                Last Service
              </th>
              <th className="font-medium px-3 py-2 hidden md:table-cell">
                Next Due
              </th>
              <th className="font-medium px-3 py-2 hidden lg:table-cell">
                Installer
              </th>
              <th className="font-medium px-3 py-2">Details</th>
              <th className="px-3 py-2" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {pageRows.map((row) => {
              const Icon = row.icon;
              return (
                <tr
                  key={row.id}
                  className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 cursor-pointer transition-colors"
                  onClick={() => onJumpToSystem?.(row.id)}
                >
                  <td className="px-4 md:px-5 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {Icon && (
                        <Icon className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
                      )}
                      <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                        {row.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {row.condition ? (
                      <StatusBadge tone={conditionTone(row.condition)}>
                        {row.condition}
                      </StatusBadge>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-600">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                    {formatOverviewDate(row.lastService) ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell whitespace-nowrap">
                    {row.nextDue ? (
                      <span
                        className={
                          row.nextDueOverdue
                            ? "text-red-600 dark:text-red-400 font-medium"
                            : "text-neutral-600 dark:text-neutral-400"
                        }
                      >
                        {formatOverviewDate(row.nextDue)}
                      </span>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-600">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden lg:table-cell text-neutral-600 dark:text-neutral-400 truncate max-w-[10rem]">
                    {row.installer ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-[6rem]">
                      <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${healthBarColor(row.percent)}`}
                          style={{width: `${Math.round(row.percent)}%`}}
                        />
                      </div>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums shrink-0">
                        {row.filled}/{row.total}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline-block" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-5 py-2.5 border-t border-neutral-100 dark:border-neutral-800">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Showing {rangeStart} to {rangeEnd} of {rows.length} system
          {rows.length === 1 ? "" : "s"}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="form-select text-xs bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 rounded-lg pl-2 pr-6 py-1"
            aria-label="Systems per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="min-w-[2rem] text-center text-xs font-medium text-neutral-700 dark:text-neutral-300 px-1">
                {safePage}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={safePage >= pageCount}
                className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none"
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

/** Right rail summarizing systems health, recommended tasks, and recent activity. */
export function SystemsRightRail({
  rows = [],
  recentActivity = [],
  onJumpToSystem,
  onOpenSystemsSetup,
  systemsEmptyState,
}) {
  const overallPercent =
    rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + r.percent, 0) / rows.length)
      : 0;
  const conditionCounts = rows.reduce(
    (acc, r) => {
      const c = String(r.condition ?? "").toLowerCase();
      if (c === "excellent") acc.excellent += 1;
      else if (c === "good") acc.good += 1;
      else if (c === "fair") acc.fair += 1;
      else if (c === "poor") acc.poor += 1;
      return acc;
    },
    {excellent: 0, good: 0, fair: 0, poor: 0},
  );
  const incompleteRows = rows.filter((r) => r.percent < 100).slice(0, 4);

  return (
    <>
      <SectionCard flat title="Systems Health Overview" icon={Activity}>
        <div className="flex items-center gap-4">
          <div className="shrink-0 text-center">
            <p className="text-2xl font-bold text-neutral-900 dark:text-white tabular-nums">
              {overallPercent}%
            </p>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.08em]">
              Documented
            </p>
          </div>
          <div className="flex-1 space-y-1.5 min-w-0">
            {[
              {label: "Excellent", count: conditionCounts.excellent, dot: "bg-emerald-600"},
              {label: "Good", count: conditionCounts.good, dot: "bg-emerald-400"},
              {label: "Fair", count: conditionCounts.fair, dot: "bg-amber-400"},
              {label: "Poor", count: conditionCounts.poor, dot: "bg-red-400"},
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                <span className="text-neutral-600 dark:text-neutral-400 flex-1">
                  {c.label}
                </span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard flat title="Recommended Next Tasks" icon={Sparkles}>
        {rows.length === 0 ? (
          <EmptyStateCard
            icon={Sparkles}
            title={systemsEmptyState?.title ?? "No systems selected"}
            description={
              systemsEmptyState?.description ??
              "Choose which home systems to track on this property."
            }
            actionLabel={
              onOpenSystemsSetup ? systemsEmptyState?.actionLabel ?? "Select systems" : undefined
            }
            onAction={onOpenSystemsSetup}
            className="!border-0 !bg-transparent !px-0 !py-4"
          />
        ) : incompleteRows.length > 0 ? (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {incompleteRows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onJumpToSystem?.(row.id)}
                  className="w-full flex items-center gap-2.5 py-2 first:pt-0 last:pb-0 text-left group"
                >
                  <Wrench className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">
                      Complete {row.name} details
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {row.filled} of {row.total} fields filled
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-[#456564] dark:group-hover:text-[#7fa3a1] shrink-0 transition-colors" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            All systems fully documented.
          </div>
        )}
      </SectionCard>

      <SectionCard flat title="Recent Maintenance Activity" icon={Wrench}>
        {recentActivity.length > 0 ? (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {recentActivity.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-neutral-800 dark:text-neutral-200 truncate">
                    {item.label}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {item.system}
                    {formatOverviewDate(item.date)
                      ? ` — ${formatOverviewDate(item.date)}`
                      : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyStateCard
            icon={Wrench}
            title="No maintenance activity yet"
            description="Completed maintenance records will appear here."
          />
        )}
      </SectionCard>
    </>
  );
}
