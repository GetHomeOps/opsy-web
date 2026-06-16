import React from "react";
import {FileText, Wrench, ClipboardCheck, MapPin, ChevronRight} from "lucide-react";
import SectionCard from "../../../properties/partials/passport/SectionCard";
import EmptyStateCard from "../../../properties/partials/passport/EmptyStateCard";
import {StatusBadge} from "../../../properties/partials/passport/StatusBadge";
import CardListPagination, {
  usePaginatedList,
} from "../../../properties/partials/passport/CardListPagination";

function formatRecordDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Maintenance and inspection records where this contact is the assigned
 * contractor. Shows an empty state until any records exist.
 */
function ContactDocumentsCard({records = [], onViewRecord}) {
  const {
    pageItems,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    pageCount,
    rangeStart,
    rangeEnd,
  } = usePaginatedList(records);

  return (
    <SectionCard flat title="Documents" icon={FileText}>
      {records.length > 0 ? (
        <>
          <ul className="space-y-2">
            {pageItems.map((record) => {
            const isInspection =
              String(record.recordType || "").toLowerCase() === "inspection";
            const Icon = isInspection ? ClipboardCheck : Wrench;
            const title = record.title || "Maintenance record";
            const date = formatRecordDate(record.date);
            const meta = [record.propertyName, date].filter(Boolean).join(" · ");
            return (
              <li key={record.id}>
                <button
                  type="button"
                  onClick={() => onViewRecord?.(record)}
                  className="w-full flex items-center gap-3 text-left rounded-xl border border-neutral-200/70 dark:border-neutral-700/50 bg-neutral-50/60 dark:bg-neutral-800/40 px-3 py-2.5 group hover:border-[#456564]/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#456564]/10 dark:bg-[#5a7a78]/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#456564] dark:text-[#7fa3a1]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">
                      {title}
                    </p>
                    {meta && (
                      <p className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {meta}
                      </p>
                    )}
                  </div>
                  <StatusBadge tone="neutral" className="shrink-0">
                    {isInspection ? "Inspection" : "Maintenance"}
                  </StatusBadge>
                  <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-[#456564] dark:group-hover:text-[#7fa3a1] shrink-0 transition-colors" />
                </button>
              </li>
            );
            })}
          </ul>
          <CardListPagination
            totalItems={totalItems}
            page={page}
            pageSize={pageSize}
            pageCount={pageCount}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="record"
          />
        </>
      ) : (
        <EmptyStateCard
          icon={FileText}
          title="No records yet"
          description="Maintenance and inspection records where this contact is the contractor will appear here."
        />
      )}
    </SectionCard>
  );
}

export default ContactDocumentsCard;
