import React from "react";
import { Info, RefreshCw, Sparkles, Wrench } from "lucide-react";
import ActionItemTableRow from "./ActionItemTableRow";

const TH_CLASS =
  "font-medium px-3 py-2 text-left text-[10px] uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500";

function ItemsTable({
  items,
  variant,
  sectionIcon: SectionIcon,
  sectionIconClassName = "text-emerald-600 dark:text-emerald-400",
  sectionTitle,
  sectionBadgeClass,
  showFrequency = true,
  footerNote,
  systemKey,
  propertyId,
  onItemCreated,
  completedChecklistItemIds,
  recordsByChecklistItemId,
  eventsByChecklistItemId,
  handlers,
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      {items.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <SectionIcon
            className={`w-4 h-4 shrink-0 ${sectionIconClassName}`}
          />
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
            {sectionTitle}
          </h4>
          {items.length > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold ${sectionBadgeClass}`}
            >
              {items.length}
            </span>
          )}
        </div>
      )}

      {items.length > 0 && (
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
                  {showFrequency && (
                    <th className={TH_CLASS}>Frequency</th>
                  )}
                  <th className={TH_CLASS}>Next Due</th>
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
                    variant={variant}
                    completedChecklistItemIds={completedChecklistItemIds}
                    recordsByChecklistItemId={recordsByChecklistItemId}
                    linkedEvent={
                      eventsByChecklistItemId[Number(item.id)] || null
                    }
                    isSyncing={handlers.syncingItemId === item.id}
                    onStatusChange={handlers.onStatusChange}
                    onToggleRequest={handlers.onToggleRequest}
                    onDelete={handlers.onDelete}
                    onUpdateItem={handlers.onUpdateItem}
                    onScheduleItem={handlers.onScheduleItem}
                    onAIPromptItem={handlers.onAIPromptItem}
                    onViewEvent={handlers.onViewEvent}
                    onViewItem={handlers.onViewItem}
                    onAddRecord={handlers.onAddRecord}
                    onReviewBids={handlers.onReviewBids}
                    showSchedule={handlers.showSchedule}
                  />
                ))}
          </tbody>
        </table>
        </div>
      )}

      {footerNote && items.length > 0 && (
        <div className="flex items-start gap-2 px-1 text-xs text-neutral-500 dark:text-neutral-400">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{footerNote}</span>
        </div>
      )}

    </section>
  );
}

export function RecurrentMaintenanceTable({
  items = [],
  completedChecklistItemIds,
  recordsByChecklistItemId = {},
  eventsByChecklistItemId = {},
  handlers = {},
}) {
  return (
    <ItemsTable
      items={items}
      variant="recurrent"
      sectionIcon={RefreshCw}
      sectionIconClassName="text-violet-600 dark:text-violet-400"
      sectionTitle="Recurrent Maintenance"
      sectionBadgeClass="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
      showFrequency
      completedChecklistItemIds={completedChecklistItemIds}
      recordsByChecklistItemId={recordsByChecklistItemId}
      eventsByChecklistItemId={eventsByChecklistItemId}
      handlers={handlers}
    />
  );
}

export function RecommendedItemsTable({
  items = [],
  systemLabel,
  systemKey,
  propertyId,
  onItemCreated,
  completedChecklistItemIds,
  recordsByChecklistItemId = {},
  eventsByChecklistItemId = {},
  handlers = {},
}) {
  return (
    <ItemsTable
      items={items}
      variant="recommended"
      sectionIcon={Sparkles}
      sectionTitle="Recommended Maintenance"
      sectionBadgeClass="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      showFrequency
      footerNote={
        systemLabel
          ? `Recommended maintenance is based on industry best practices for ${systemLabel} systems.`
          : "Recommended maintenance is based on industry best practices."
      }
      systemKey={systemKey}
      propertyId={propertyId}
      onItemCreated={onItemCreated}
      completedChecklistItemIds={completedChecklistItemIds}
      recordsByChecklistItemId={recordsByChecklistItemId}
      eventsByChecklistItemId={eventsByChecklistItemId}
      handlers={handlers}
    />
  );
}

export function UserTodosTable({
  items = [],
  completedChecklistItemIds,
  recordsByChecklistItemId = {},
  eventsByChecklistItemId = {},
  handlers = {},
}) {
  return (
    <ItemsTable
      items={items}
      variant="user"
      sectionIcon={Wrench}
      sectionTitle="My ToDos"
      sectionBadgeClass="bg-[#456564]/10 text-[#456564] dark:bg-[#7aa3a2]/15 dark:text-[#7aa3a2]"
      showFrequency={false}
      completedChecklistItemIds={completedChecklistItemIds}
      recordsByChecklistItemId={recordsByChecklistItemId}
      eventsByChecklistItemId={eventsByChecklistItemId}
      handlers={handlers}
    />
  );
}

export default RecommendedItemsTable;
