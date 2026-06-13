import React, {useEffect, useMemo, useState} from "react";
import {format, parse, isValid} from "date-fns";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Trash2,
  ArrowUpDown,
  FileText,
  Plus,
} from "lucide-react";
import {StatusBadge} from "../passport/StatusBadge";
import {RECORD_STATUS} from "../../helpers/maintenanceRecordMapping";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const FILTER_SELECT_CLASS =
  "form-select w-full text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg pl-2.5 pr-8 py-2 min-w-[8.5rem]";

function FilterField({label, children, className = ""}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function formatRecordDate(value) {
  if (value == null) return "—";
  const s =
    typeof value === "string"
      ? value.trim()
      : value instanceof Date
        ? format(value, "yyyy-MM-dd")
        : String(value).trim();
  if (!s) return "—";
  const datePart = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const parsed = parse(datePart, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) return format(parsed, "MMM d, yyyy");
  }
  const fallback = new Date(s);
  return isValid(fallback) ? format(fallback, "MMM d, yyyy") : "—";
}

function formatCost(value) {
  if (value == null || value === "") return "—";
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num) || num === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function getDisplayStatus(record) {
  const today = new Date().toISOString().slice(0, 10);
  const nextDue = record.nextServiceDate
    ? String(record.nextServiceDate).slice(0, 10)
    : null;
  if (nextDue && nextDue < today) {
    return {label: "Overdue", tone: "red"};
  }
  const recordStatus = String(record.record_status ?? "").toLowerCase();
  if (recordStatus === RECORD_STATUS.CONTRACTOR_PENDING) {
    return {label: "Needs Review", tone: "amber"};
  }
  const status = String(record.status ?? "").trim();
  switch (status) {
    case "Completed":
      return {label: "Completed", tone: "emerald"};
    case "Scheduled":
      return {label: "Scheduled", tone: "brand"};
    case "In Progress":
      return {label: "In Progress", tone: "amber"};
    case "Pending Contractor":
      return {label: "Pending", tone: "amber"};
    case "Cancelled":
      return {label: "Cancelled", tone: "neutral"};
    default:
      return {label: status || "—", tone: "neutral"};
  }
}

function getRecordSource(record) {
  const recordStatus = String(record.record_status ?? "").toLowerCase();
  if (
    recordStatus === RECORD_STATUS.CONTRACTOR_COMPLETED ||
    recordStatus === RECORD_STATUS.CONTRACTOR_PENDING ||
    record.requestStatus
  ) {
    return "Contractor";
  }
  return "Opsy";
}

function getRecordTypeLabel(record, getSystemName) {
  const recordType = String(record.recordType ?? "").trim();
  if (recordType) return recordType;
  const description = String(record.description ?? "").trim();
  if (description) return description;
  return `${getSystemName(record.systemId)} Service`;
}

function RecordActionsMenu({record, onOpenInNewTab, onDelete}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Actions"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-20 min-w-[10rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {onOpenInNewTab && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
              onClick={() => {
                onOpenInNewTab(record);
                setOpen(false);
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => {
                onDelete(record.id);
                setOpen(false);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MaintenanceRecordRow({
  record,
  systemMeta,
  getSystemName,
  onSelect,
  onOpenInNewTab,
  onDelete,
}) {
  const SystemIcon = systemMeta?.icon;
  const status = getDisplayStatus(record);
  const docCount = Array.isArray(record.files) ? record.files.length : 0;

  return (
    <tr
      onClick={() => onSelect?.(record)}
      className="group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
    >
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {formatRecordDate(record.date)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          {SystemIcon && (
            <span className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center shrink-0">
              <SystemIcon className="w-3.5 h-3.5 text-[#456564] dark:text-[#7a9a88]" />
            </span>
          )}
          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
            {getSystemName(record.systemId)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate block max-w-[12rem]">
          {getRecordTypeLabel(record, getSystemName)}
        </span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-sm text-gray-600 dark:text-gray-400 truncate block max-w-[10rem]">
          {record.contractor || "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
        <span className="text-sm text-gray-700 dark:text-gray-300 tabular-nums">
          {formatCost(record.cost)}
        </span>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell whitespace-nowrap">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatRecordDate(record.nextServiceDate)}
        </span>
      </td>
      <td className="px-4 py-3 hidden xl:table-cell">
        {docCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
            <FileText className="w-3.5 h-3.5" />
            {docCount}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {getRecordSource(record)}
        </span>
      </td>
      <td className="px-2 py-3">
        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <RecordActionsMenu
            record={record}
            onOpenInNewTab={onOpenInNewTab}
            onDelete={onDelete}
          />
        </div>
      </td>
    </tr>
  );
}

/**
 * Paginated maintenance records table with filters — matches the mockup list view.
 */
function MaintenanceRecordsTableView({
  records = [],
  systems = [],
  getSystemName,
  onSelectRecord,
  onOpenInNewTab,
  onDelete,
  onNewRecord,
  contractorRequestsOnly = false,
  quickFilter = null,
  onQuickFilterApplied,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSystem, setFilterSystem] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [filterContractor, setFilterContractor] = useState("all");
  const [filterHasDocuments, setFilterHasDocuments] = useState("all");
  const [filterPreset, setFilterPreset] = useState(null);
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const systemById = useMemo(() => {
    const map = {};
    systems.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [systems]);

  const contractorOptions = useMemo(() => {
    const set = new Set();
    records.forEach((r) => {
      const c = String(r.contractor ?? "").trim();
      if (c) set.add(c);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return records.filter((record) => {
      if (contractorRequestsOnly && !record.requestStatus) {
        return false;
      }

      if (filterPreset === "upcoming") {
        const nextDue = record.nextServiceDate
          ? String(record.nextServiceDate).slice(0, 10)
          : null;
        if (!nextDue || nextDue < today) return false;
      }

      if (filterSystem !== "all" && record.systemId !== filterSystem) {
        return false;
      }

      if (filterStatus !== "all") {
        const display = getDisplayStatus(record);
        if (filterStatus === "Overdue" && display.label !== "Overdue") {
          return false;
        }
        if (filterStatus !== "Overdue" && record.status !== filterStatus) {
          return false;
        }
      }

      if (filterContractor !== "all") {
        if (String(record.contractor ?? "").trim() !== filterContractor) {
          return false;
        }
      }

      if (filterHasDocuments === "yes") {
        if (!Array.isArray(record.files) || record.files.length === 0) {
          return false;
        }
      } else if (filterHasDocuments === "no") {
        if (Array.isArray(record.files) && record.files.length > 0) {
          return false;
        }
      }

      if (filterDateRange !== "all" && record.date) {
        const dateStr = String(record.date).slice(0, 10);
        const recordDate = new Date(`${dateStr}T00:00:00`);
        if (Number.isNaN(recordDate.getTime())) return false;
        const diffDays = Math.floor(
          (Date.now() - recordDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (filterDateRange === "30d" && diffDays > 30) return false;
        if (filterDateRange === "90d" && diffDays > 90) return false;
        if (filterDateRange === "year" && dateStr.slice(0, 4) !== String(new Date().getFullYear())) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          record.description,
          record.contractor,
          record.notes,
          record.workOrderNumber,
          getSystemName(record.systemId),
          record.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      return true;
    });
  }, [
    records,
    contractorRequestsOnly,
    filterPreset,
    filterSystem,
    filterStatus,
    filterContractor,
    filterHasDocuments,
    filterDateRange,
    searchQuery,
    getSystemName,
  ]);

  const sortedRecords = useMemo(() => {
    const list = [...filteredRecords];
    const dateOf = (r) => {
      const d = r.date ? new Date(String(r.date).slice(0, 10)) : null;
      return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
    };
    if (sortOrder === "newest") list.sort((a, b) => dateOf(b) - dateOf(a));
    else if (sortOrder === "oldest") list.sort((a, b) => dateOf(a) - dateOf(b));
    return list;
  }, [filteredRecords, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(sortedRecords.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [
    records.length,
    contractorRequestsOnly,
    searchQuery,
    filterSystem,
    filterStatus,
    filterDateRange,
    filterContractor,
    filterHasDocuments,
    filterPreset,
    sortOrder,
    pageSize,
  ]);

  useEffect(() => {
    if (!quickFilter) return;
    setFilterPreset(null);
    if (quickFilter === "upcoming") {
      setFilterPreset("upcoming");
      setFilterStatus("all");
    } else if (quickFilter === "overdue") {
      setFilterStatus("Overdue");
    } else if (quickFilter === "completed") {
      setFilterStatus("Completed");
    }
    onQuickFilterApplied?.();
  }, [quickFilter, onQuickFilterApplied]);

  const safePage = Math.min(page, pageCount);
  const pageRecords = sortedRecords.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const rangeStart =
    sortedRecords.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, sortedRecords.length);

  const statusOptions = [
    {value: "all", label: "All Statuses"},
    {value: "Completed", label: "Completed"},
    {value: "Scheduled", label: "Scheduled"},
    {value: "In Progress", label: "In Progress"},
    {value: "Pending Contractor", label: "Pending"},
    {value: "Overdue", label: "Overdue"},
  ];

  return (
    <div className="flex flex-col min-h-[480px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 mr-auto">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {contractorRequestsOnly
                ? "Contractor Requests"
                : "Maintenance Records"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {sortedRecords.length} record{sortedRecords.length === 1 ? "" : "s"}
            </p>
          </div>

          {onNewRecord && (
            <button
              type="button"
              onClick={() => onNewRecord()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#3a5548] text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Record
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative flex-1 min-w-[12rem] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search records…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#456654] focus:border-transparent"
            />
          </div>

          <FilterField label="System">
            <select
              value={filterSystem}
              onChange={(e) => setFilterSystem(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Systems</option>
              {systems.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Status">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setFilterPreset(null);
              }}
              className={FILTER_SELECT_CLASS}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Date Range" className="hidden sm:block">
            <select
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="year">This Year</option>
            </select>
          </FilterField>

          <FilterField label="Contractor" className="hidden lg:block">
            <select
              value={filterContractor}
              onChange={(e) => setFilterContractor(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All Contractors</option>
              {contractorOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Has Documents" className="hidden xl:block">
            <select
              value={filterHasDocuments}
              onChange={(e) => setFilterHasDocuments(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="all">All</option>
              <option value="yes">Has Documents</option>
              <option value="no">No Documents</option>
            </select>
          </FilterField>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {pageRecords.length > 0 ? (
          <table className="w-full table-auto">
            <thead className="sticky top-0 bg-gray-50/95 dark:bg-gray-900/80 backdrop-blur-sm text-[10px] uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">
                  <button
                    type="button"
                    onClick={() =>
                      setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))
                    }
                    className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Date
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">System</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden md:table-cell">
                  Record Type
                </th>
                <th className="px-4 py-2.5 text-left font-semibold hidden lg:table-cell">
                  Contractor
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-left font-semibold hidden sm:table-cell">
                  Cost
                </th>
                <th className="px-4 py-2.5 text-left font-semibold hidden xl:table-cell">
                  Next Due
                </th>
                <th className="px-4 py-2.5 text-left font-semibold hidden xl:table-cell">
                  Documents
                </th>
                <th className="px-4 py-2.5 text-left font-semibold hidden lg:table-cell">
                  Source
                </th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {pageRecords.map((record) => (
                <MaintenanceRecordRow
                  key={record.id ?? `${record.systemId}-${record.date}`}
                  record={record}
                  systemMeta={systemById[record.systemId]}
                  getSystemName={getSystemName}
                  onSelect={onSelectRecord}
                  onOpenInNewTab={onOpenInNewTab}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {contractorRequestsOnly
                ? "No contractor requests found"
                : "No maintenance records found"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
              {contractorRequestsOnly
                ? "Maintenance records sent to contractors will appear here."
                : searchQuery ||
                    filterSystem !== "all" ||
                    filterStatus !== "all" ||
                    filterDateRange !== "all" ||
                    filterPreset
                  ? "Try adjusting your search or filters."
                  : "Create your first maintenance record to track service history and upcoming work."}
            </p>
            {onNewRecord &&
              !searchQuery &&
              !contractorRequestsOnly && (
              <button
                type="button"
                onClick={() => onNewRecord()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#3a5548] text-white transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Record
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {sortedRecords.length > 0 && (
        <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {rangeStart} to {rangeEnd} of {sortedRecords.length} record
            {sortedRecords.length === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="form-select text-xs bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 rounded-lg pl-2 pr-6 py-1"
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
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="min-w-[2rem] text-center text-xs font-medium text-gray-700 dark:text-gray-300 px-1">
                  {safePage}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={safePage >= pageCount}
                  className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:pointer-events-none"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MaintenanceRecordsTableView;
