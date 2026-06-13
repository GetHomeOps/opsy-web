import React, { useMemo } from "react";
import { History } from "lucide-react";
import SectionCard from "../passport/SectionCard";
import { formatOverviewDate } from "../passport/SystemsOverviewPanel";
import EmptyStateCard from "../passport/EmptyStateCard";

export function SystemHistoryTab({ systemId, maintenanceRecords = [] }) {
  const records = useMemo(
    () =>
      maintenanceRecords
        .filter(
          (r) => String(r.systemId ?? r.system_key ?? "") === String(systemId),
        )
        .sort((a, b) =>
          String(b.serviceDate ?? b.service_date ?? b.date ?? "")
            .localeCompare(String(a.serviceDate ?? a.service_date ?? a.date ?? "")),
        ),
    [maintenanceRecords, systemId],
  );

  if (records.length === 0) {
    return (
      <EmptyStateCard
        title="No maintenance history"
        description="Completed maintenance and service records for this system will appear here."
        icon={History}
      />
    );
  }

  return (
    <SectionCard flat title="Maintenance History" icon={History}>
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {records.map((rec) => {
          const date =
            rec.serviceDate ?? rec.service_date ?? rec.date ?? rec.completedAt;
          const title = rec.title ?? rec.description ?? rec.serviceType ?? "Service";
          return (
            <li key={rec.id ?? `${date}-${title}`} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                {title}
              </p>
              {date && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {formatOverviewDate(date) ?? date}
                </p>
              )}
              {rec.notes && (
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                  {rec.notes}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
