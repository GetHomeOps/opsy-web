import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Link, useNavigate, useParams} from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileSearch,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import AppApi, {getApiErrorMessage} from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import ModalBlank from "../../components/ModalBlank";
import FilterDropdown from "../../components/FilterDropdown";
import SectionCard from "../properties/partials/passport/SectionCard";
import {StatusBadge} from "../properties/partials/passport/StatusBadge";
import EmptyStateCard from "../properties/partials/passport/EmptyStateCard";
import PaginationClassic from "../../components/PaginationClassic";
import ListDropdown from "../../partials/buttons/ListDropdown";
import {useSortIndicator} from "../../hooks/useSortIndicator";
import PrePurchaseShell from "./PrePurchaseShell";
import {
  CONDITION_BADGE,
  STATUS_LABELS,
  formatCostRange,
  formatDateTime,
  formatDisplayName,
  isInProgress,
} from "./prePurchaseUtils";

const DEFAULT_PAGE_SIZE = 10;
const FETCH_LIMIT = 200;

const FILTER_CATEGORIES = [
  {type: "status", labelKey: "status"},
  {type: "condition", labelKey: "condition"},
  {type: "city", labelKey: "city"},
  {type: "state", labelKey: "state"},
];

const FILTER_LABELS = {
  filter: "Filter",
  status: "Status",
  condition: "Condition",
  city: "City",
  state: "State",
};

const STATUS_FILTER_OPTIONS = [
  {value: "draft", label: "Draft"},
  {value: "in_progress", label: "In Progress"},
  {value: "completed", label: "Completed"},
  {value: "failed", label: "Failed"},
];

const CONDITION_FILTER_OPTIONS = [
  {value: "excellent", label: "Excellent"},
  {value: "good", label: "Good"},
  {value: "fair", label: "Fair"},
  {value: "poor", label: "Poor"},
  {value: "unknown", label: "Unknown"},
];

function filterT(key) {
  return FILTER_LABELS[key] || key;
}

function getSortValue(analysis, key) {
  switch (key) {
    case "property":
      return formatDisplayName(analysis).toLowerCase();
    case "street":
      return (analysis.street || "").toLowerCase();
    case "city":
      return (analysis.city || "").toLowerCase();
    case "state":
      return (analysis.state || "").toLowerCase();
    case "analysisDate":
      return new Date(analysis.completedAt || analysis.createdAt || 0).getTime();
    case "condition":
      return (analysis.overallConditionRating || "").toLowerCase();
    case "majorIssues":
      return Number(analysis.majorIssuesCount ?? -1);
    case "repairRange":
      return Number(analysis.repairCostLow ?? analysis.repairCostHigh ?? -1);
    case "status":
      return (STATUS_LABELS[analysis.status] || analysis.status || "").toLowerCase();
    default:
      return "";
  }
}

function compareAnalyses(a, b, {key, direction}) {
  const multiplier = direction === "asc" ? 1 : -1;
  const av = getSortValue(a, key);
  const bv = getSortValue(b, key);
  if (typeof av === "number" && typeof bv === "number") {
    if (av === bv) return (a.id - b.id) * multiplier;
    return (av - bv) * multiplier;
  }
  const cmp = String(av).localeCompare(String(bv), undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (cmp === 0) return (a.id - b.id) * multiplier;
  return cmp * multiplier;
}

function matchesStatusFilter(analysis, values) {
  return values.some((value) => {
    if (value === "in_progress") return isInProgress(analysis.status);
    return analysis.status === value;
  });
}

function StatCard({label, value, tone = "neutral", hint}) {
  const tones = {
    neutral: "border-neutral-200/80 dark:border-neutral-700/50",
    brand: "border-[#456564]/30",
    emerald: "border-emerald-300/50",
    amber: "border-amber-300/50",
    red: "border-red-300/50",
  };
  return (
    <div
      className={`rounded-2xl border bg-white dark:bg-neutral-900 px-4 py-3 ${tones[tone] || tones.neutral}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400 font-semibold">
        {label}
      </p>
      <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1 tabular-nums">
        {value ?? "—"}
      </p>
      {hint && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{hint}</p>
      )}
    </div>
  );
}

function SortableTh({label, columnKey, sortConfig, onSort, className = ""}) {
  const renderSortIndicator = useSortIndicator();
  return (
    <th
      className={`px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap text-left font-semibold ${className}`}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="font-semibold uppercase text-left"
          onClick={() => onSort(columnKey)}
        >
          {label}
        </button>
        <button
          type="button"
          className="shrink-0 w-4 h-4 flex items-center justify-center [&_span]:ml-0"
          onClick={() => onSort(columnKey)}
          tabIndex={-1}
          aria-hidden="true"
        >
          {renderSortIndicator(sortConfig, columnKey)}
        </button>
      </div>
    </th>
  );
}

export default function PrePurchaseDashboard() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: "analysisDate",
    direction: "desc",
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [dangerModalOpen, setDangerModalOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const load = useCallback(async () => {
    if (!currentAccount?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await AppApi.getPrePurchaseAnalyses({
        accountId: currentAccount.id,
        limit: FETCH_LIMIT,
        offset: 0,
      });
      setAnalyses(res.analyses || []);
      setStats(res.stats || null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load analyses."));
      setAnalyses([]);
    } finally {
      setLoading(false);
    }
  }, [currentAccount?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, activeFilters, sortConfig.key, sortConfig.direction, itemsPerPage]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, itemsPerPage, search, activeFilters, currentAccount?.id]);

  const filterOptions = useMemo(() => {
    const cities = [
      ...new Set(analyses.map((a) => a.city).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    const states = [
      ...new Set(analyses.map((a) => a.state).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    return {
      status: STATUS_FILTER_OPTIONS,
      condition: CONDITION_FILTER_OPTIONS,
      city: cities.map((c) => ({value: c, label: c})),
      state: states.map((s) => ({value: s, label: s})),
    };
  }, [analyses]);

  const filteredAnalyses = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtersByType = {};
    activeFilters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = [];
      filtersByType[f.type].push(f.value);
    });

    return analyses.filter((a) => {
      if (term) {
        const haystack = [
          a.displayName,
          a.street,
          a.city,
          a.state,
          a.zip,
          formatDisplayName(a),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      if (filtersByType.status?.length && !matchesStatusFilter(a, filtersByType.status)) {
        return false;
      }
      if (filtersByType.condition?.length) {
        const rating = a.overallConditionRating || "unknown";
        if (!filtersByType.condition.includes(rating)) return false;
      }
      if (filtersByType.city?.length && !filtersByType.city.includes(a.city)) {
        return false;
      }
      if (filtersByType.state?.length && !filtersByType.state.includes(a.state)) {
        return false;
      }
      return true;
    });
  }, [analyses, search, activeFilters]);

  const sortedAnalyses = useMemo(() => {
    const next = [...filteredAnalyses];
    next.sort((a, b) => compareAnalyses(a, b, sortConfig));
    return next;
  }, [filteredAnalyses, sortConfig]);

  const total = sortedAnalyses.length;

  useEffect(() => {
    if (total === 0) return;
    const lastValidPage = Math.max(1, Math.ceil(total / itemsPerPage));
    if (page > lastValidPage) setPage(1);
  }, [total, itemsPerPage, page]);

  const paginatedAnalyses = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedAnalyses.slice(start, start + itemsPerPage);
  }, [sortedAnalyses, page, itemsPerPage]);

  function handleItemsPerPageChange(value) {
    setItemsPerPage(Number(value) || DEFAULT_PAGE_SIZE);
  }

  const pageIds = paginatedAnalyses.map((a) => a.id);
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const someSelected =
    pageIds.some((id) => selectedIds.includes(id)) && !allSelected;

  function handleSort(columnKey) {
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {key: columnKey, direction: "asc"};
    });
  }

  function addFilter(filter) {
    setActiveFilters((prev) => {
      if (prev.some((f) => f.type === filter.type && f.value === filter.value)) {
        return prev;
      }
      return [...prev, filter];
    });
  }

  function removeFilter(filter) {
    setActiveFilters((prev) =>
      prev.filter((f) => !(f.type === filter.type && f.value === filter.value))
    );
  }

  function clearFilters() {
    setActiveFilters([]);
  }

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  }

  function openDeleteConfirm(ids) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) return;
    const blocked = analyses.filter(
      (a) => unique.includes(a.id) && isInProgress(a.status)
    );
    if (blocked.length === unique.length) {
      setDeleteError("Cannot delete analyses that are in progress.");
      return;
    }
    const deletable = unique.filter(
      (id) => !analyses.some((a) => a.id === id && isInProgress(a.status))
    );
    setDeleteError(null);
    setPendingDeleteIds(deletable);
    setDangerModalOpen(true);
  }

  function handleBulkDeleteClick() {
    openDeleteConfirm(selectedIds);
  }

  async function handleConfirmDelete() {
    if (pendingDeleteIds.length === 0) return;
    setIsDeleting(true);
    setDeleteError(null);
    const idsToDelete = [...pendingDeleteIds];
    const failed = [];
    try {
      for (const id of idsToDelete) {
        try {
          await AppApi.deletePrePurchaseAnalysis(id);
        } catch (err) {
          failed.push({
            id,
            message: getApiErrorMessage(err, "Failed to delete."),
          });
        }
      }
      const failedIds = new Set(failed.map((f) => f.id));
      const deletedIds = idsToDelete.filter((id) => !failedIds.has(id));
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
      setDangerModalOpen(false);
      setPendingDeleteIds([]);
      await load();
      if (failed.length > 0) {
        setDeleteError(
          failed.length === idsToDelete.length
            ? failed[0].message
            : `${failed.length} of ${idsToDelete.length} analyses could not be deleted.`
        );
      }
    } finally {
      setIsDeleting(false);
    }
  }

  const hasActiveQuery = search.trim() || activeFilters.length > 0;
  const showEmptyAll = !loading && !error && analyses.length === 0;
  const showEmptyFiltered =
    !loading && !error && analyses.length > 0 && paginatedAnalyses.length === 0;

  return (
    <PrePurchaseShell>
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
                Pre-Purchase Analysis
              </h1>
            </div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
              Upload inspection reports and property documents to get an assessment
              before you buy.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
            <ListDropdown
              align="right"
              hasSelection={selectedIds.length > 0}
              onDelete={handleBulkDeleteClick}
            />
            <Link
              to={`/${accountUrl}/pre-purchase/new`}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" aria-hidden />
              New Analysis
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <StatCard label="Total Analyses" value={stats?.total ?? 0} tone="brand" />
          <StatCard label="In Progress" value={stats?.inProgress ?? 0} tone="amber" />
          <StatCard label="Completed" value={stats?.completed ?? 0} tone="emerald" />
          <StatCard
            label="Critical Issues Found"
            value={stats?.criticalIssues ?? 0}
            tone="red"
            hint="Major findings across analyses"
          />
        </div>

        {deleteError && (
          <div className="mb-4 flex items-start gap-2 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p>{deleteError}</p>
              <button
                type="button"
                className="text-xs underline mt-1"
                onClick={() => setDeleteError(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <SectionCard title="Recent Analyses" icon={FileSearch}>
          <div className="mb-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or address..."
                  className="form-input pl-8 py-2 text-sm w-full"
                  aria-label="Search analyses by name or address"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <FilterDropdown
                  filterCategories={FILTER_CATEGORIES}
                  filterOptions={filterOptions}
                  activeFilters={activeFilters}
                  onAdd={addFilter}
                  onRemove={removeFilter}
                  t={filterT}
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
                      {filterT(
                        FILTER_CATEGORIES.find((c) => c.type === f.type)?.labelKey ??
                          f.type
                      )}
                      :
                    </span>
                    {f.label || f.value}
                    <button
                      type="button"
                      onClick={() => removeFilter(f)}
                      className="hover:opacity-75 p-0.5"
                      aria-label={`Remove ${f.label || f.value} filter`}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm text-[#456564] dark:text-[#7aa3a2] hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-neutral-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              Loading analyses…
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 py-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-medium">Could not load analyses</p>
                <p className="text-sm mt-1">{error}</p>
                <button type="button" className="btn-sm mt-3 border" onClick={load}>
                  Retry
                </button>
              </div>
            </div>
          ) : showEmptyAll ? (
            <EmptyStateCard
              icon={Building2}
              title="No analyses yet"
              description="Start a new Pre-Purchase analysis by entering an address and uploading documents."
              actionLabel="New Analysis"
              onAction={() => navigate(`/${accountUrl}/pre-purchase/new`)}
            />
          ) : showEmptyFiltered ? (
            <EmptyStateCard
              icon={FileSearch}
              title="No matching analyses"
              description={
                hasActiveQuery
                  ? "Try adjusting your search or filters."
                  : "No analyses to show."
              }
              actionLabel={activeFilters.length > 0 ? "Clear filters" : undefined}
              onAction={activeFilters.length > 0 ? clearFilters : undefined}
            />
          ) : (
            <>
              <div className="overflow-x-auto -mx-1">
                <table className="table-auto w-full text-sm">
                  <thead className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400 bg-neutral-100/80 dark:bg-neutral-900/40">
                    <tr>
                      <th className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap w-px">
                        <div className="flex items-center">
                          <label className="inline-flex">
                            <span className="sr-only">Select all</span>
                            <input
                              type="checkbox"
                              className="form-checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected;
                              }}
                              onChange={toggleSelectAll}
                            />
                          </label>
                        </div>
                      </th>
                      <SortableTh
                        label="Property"
                        columnKey="property"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTh
                        label="Address"
                        columnKey="street"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="hidden sm:table-cell"
                      />
                      <SortableTh
                        label="City"
                        columnKey="city"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="hidden md:table-cell"
                      />
                      <SortableTh
                        label="State"
                        columnKey="state"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="hidden md:table-cell"
                      />
                      <SortableTh
                        label="Analysis Date"
                        columnKey="analysisDate"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="hidden lg:table-cell"
                      />
                      <SortableTh
                        label="Condition"
                        columnKey="condition"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                      <SortableTh
                        label="Major Issues"
                        columnKey="majorIssues"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="hidden sm:table-cell"
                      />
                      <SortableTh
                        label="Est. Repair Range"
                        columnKey="repairRange"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        className="hidden lg:table-cell"
                      />
                      <SortableTh
                        label="Status"
                        columnKey="status"
                        sortConfig={sortConfig}
                        onSort={handleSort}
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {paginatedAnalyses.map((a) => (
                      <tr
                        key={a.id}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer"
                        onClick={() => navigate(`/${accountUrl}/pre-purchase/${a.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/${accountUrl}/pre-purchase/${a.id}`);
                          }
                        }}
                        tabIndex={0}
                        role="link"
                      >
                        <td
                          className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap w-px"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center">
                            <label className="inline-flex">
                              <span className="sr-only">Select analysis</span>
                              <input
                                type="checkbox"
                                className="form-checkbox"
                                checked={selectedIds.includes(a.id)}
                                onChange={() => toggleSelect(a.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </label>
                          </div>
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap">
                          <div className="font-medium text-neutral-900 dark:text-white text-left">
                            {formatDisplayName(a)}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5 sm:hidden text-left">
                            {[a.street, a.city, a.state].filter(Boolean).join(", ") || "—"}
                          </div>
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap text-neutral-600 dark:text-neutral-300 hidden sm:table-cell max-w-[14rem]">
                          <span className="block truncate text-left">{a.street || "—"}</span>
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap text-neutral-600 dark:text-neutral-300 hidden md:table-cell text-left">
                          {a.city || "—"}
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap text-neutral-600 dark:text-neutral-300 hidden md:table-cell text-left">
                          {a.state || "—"}
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap text-neutral-600 dark:text-neutral-300 hidden lg:table-cell text-left">
                          {formatDateTime(a.completedAt || a.createdAt)}
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap">
                          {a.overallConditionRating ? (
                            <StatusBadge
                              tone={CONDITION_BADGE[a.overallConditionRating] || "neutral"}
                            >
                              {a.overallConditionRating}
                            </StatusBadge>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap tabular-nums hidden sm:table-cell text-left">
                          {a.majorIssuesCount ?? "—"}
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap hidden lg:table-cell text-left">
                          {formatCostRange(a.repairCostLow, a.repairCostHigh)}
                        </td>
                        <td className="px-2 first:pl-5 last:pr-5 py-3 whitespace-nowrap">
                          <StatusBadge
                            tone={
                              a.status === "completed"
                                ? "emerald"
                                : a.status === "failed"
                                  ? "red"
                                  : isInProgress(a.status)
                                    ? "brand"
                                    : "neutral"
                            }
                          >
                            {a.status === "completed" && (
                              <CheckCircle2 className="w-3 h-3" aria-hidden />
                            )}
                            {isInProgress(a.status) && (
                              <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                            )}
                            {STATUS_LABELS[a.status] || a.status}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {total > 0 && (
                <div className="mt-4">
                  <PaginationClassic
                    currentPage={page}
                    totalItems={total}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setPage}
                    onItemsPerPageChange={handleItemsPerPageChange}
                  />
                </div>
              )}
            </>
          )}
        </SectionCard>
      </div>

      <ModalBlank
        id="pre-purchase-delete-modal"
        modalOpen={dangerModalOpen}
        setModalOpen={(open) => {
          if (!isDeleting) {
            setDangerModalOpen(open);
            if (!open) setPendingDeleteIds([]);
          }
        }}
        contentClassName="max-w-lg"
      >
        <div className="p-5 flex space-x-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-neutral-100 dark:bg-neutral-700">
            <svg
              className="shrink-0 fill-current text-red-500"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              aria-hidden
            >
              <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-2">
              <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Delete {pendingDeleteIds.length} analys
                {pendingDeleteIds.length === 1 ? "is" : "es"}?
              </div>
            </div>
            <div className="text-sm mb-10 text-neutral-600 dark:text-neutral-300">
              <p>
                This will permanently remove the selected analysis
                {pendingDeleteIds.length !== 1 ? "es" : ""} and uploaded documents.
                This action can’t be undone.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-sm border-neutral-200 dark:border-neutral-700/60 hover:border-neutral-300 dark:hover:border-neutral-600 text-gray-800 dark:text-gray-300"
                disabled={isDeleting}
                onClick={() => {
                  setDangerModalOpen(false);
                  setPendingDeleteIds([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </ModalBlank>
    </PrePurchaseShell>
  );
}
