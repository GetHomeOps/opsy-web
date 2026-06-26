import React from "react";
import {FileSearch} from "lucide-react";
import ActionItemTableRow from "./ActionItemTableRow";

const TH_CLASS =
  "font-medium px-3 py-2 text-left text-[10px] uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500";

export default function InspectionReportItemsTable({
  items = [],
  completedChecklistItemIds,
  recordsByChecklistItemId = {},
  eventsByChecklistItemId = {},
  handlers = {},
}) {
  if (items.length === 0) return null;

  const {
    onStatusChange,
    onToggleRequest,
    onDelete,
    onUpdateItem,
    onScheduleItem,
    onAIPromptItem,
    onViewEvent,
    onViewItem,
    onAddRecord,
    syncingItemId,
    showSchedule = true,
  } = handlers;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <FileSearch className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
          From Inspection Report
        </h4>
        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          {items.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
              <th className={`${TH_CLASS} w-10`} aria-label="Complete" />
              <th className={`${TH_CLASS} w-24`}>Priority</th>
              <th className={TH_CLASS}>Action Item</th>
              <th className={`${TH_CLASS} hidden md:table-cell`}>
                Description
              </th>
              <th className={`${TH_CLASS} hidden md:table-cell`}>
                Last Performed
              </th>
              <th className={TH_CLASS}>Scheduled</th>
              <th className={`${TH_CLASS} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ActionItemTableRow
                key={item.id}
                item={item}
                variant="inspection"
                completedChecklistItemIds={completedChecklistItemIds}
                recordsByChecklistItemId={recordsByChecklistItemId}
                linkedEvent={eventsByChecklistItemId[Number(item.id)] || null}
                isSyncing={syncingItemId === item.id}
                onStatusChange={onStatusChange}
                onToggleRequest={onToggleRequest}
                onDelete={onDelete}
                onUpdateItem={onUpdateItem}
                onScheduleItem={onScheduleItem}
                onAIPromptItem={onAIPromptItem}
                onViewEvent={onViewEvent}
                onViewItem={onViewItem}
                onAddRecord={onAddRecord}
                showSchedule={showSchedule}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
