import React from "react";
import {getMaintenanceRecordTitle} from "../../helpers/maintenanceRecordMapping";
import {ChevronRight, ArrowLeft} from "lucide-react";
import {StatusBadge} from "../passport/StatusBadge";

function formatMetaDate(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMetaCost(value) {
  if (value == null || value === "") return "—";
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function getStatusTone(status) {
  switch (String(status ?? "").trim()) {
    case "Completed":
      return "emerald";
    case "Scheduled":
      return "brand";
    case "In Progress":
    case "Pending Contractor":
      return "amber";
    case "Cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

/**
 * Dedicated record view shell — breadcrumb, metadata strip, and form panel.
 */
function MaintenanceRecordDetailView({
  record,
  systemName,
  isNewRecord,
  onBack,
  children,
}) {
  const title = isNewRecord
    ? "New Maintenance Record"
    : getMaintenanceRecordTitle(record, systemName);

  return (
    <div className="flex flex-col min-h-[640px] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
      {/* Breadcrumb + back */}
      <div className="flex-shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-sm mb-2"
            >
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 -ml-2 font-semibold text-[#456564] dark:text-[#7fa3a1] hover:bg-[#456564]/10 hover:text-[#3a5453] dark:hover:bg-[#5a7a78]/15 dark:hover:text-[#9bc0be] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#456564]/50"
              >
                <ArrowLeft className="w-4 h-4" />
                Maintenance
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="text-gray-600 dark:text-gray-300 truncate">
                {title}
              </span>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {title}
              </h2>
              {record?.status && (
                <StatusBadge tone={getStatusTone(record.status)}>
                  {record.status}
                </StatusBadge>
              )}
              {isNewRecord && (
                <StatusBadge tone="brand">Draft</StatusBadge>
              )}
            </div>
          </div>
        </div>

        {/* Metadata row */}
        {(record || isNewRecord) && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Service Date</span>
              <p className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                {formatMetaDate(record?.date)}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">System</span>
              <p className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                {systemName || "—"}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Contractor</span>
              <p className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                {record?.contractor || "—"}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Cost</span>
              <p className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                {formatMetaCost(record?.cost)}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Next Service</span>
              <p className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                {formatMetaDate(record?.nextServiceDate)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Form panel */}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export default MaintenanceRecordDetailView;
