import React, { useRef, useState } from "react";
import { Info, Plus, RefreshCw, Sparkles, Wrench } from "lucide-react";
import ActionItemTableRow from "./ActionItemTableRow";
import AppApi from "../../../../../api/api";

const TH_CLASS =
  "font-medium px-3 py-2 text-left text-[10px] uppercase tracking-[0.08em] text-neutral-400 dark:text-neutral-500";

function AddCustomActionItemForm({ systemKey, propertyId, onItemCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const handleOpen = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setTitle("");
    setDescription("");
    setPriority("medium");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const item = await AppApi.createChecklistItem(propertyId, {
        systemKey,
        title: title.trim(),
        description: description.trim() || null,
        priority,
      });
      onItemCreated(item);
      handleCancel();
    } catch (err) {
      console.error("[AddCustomActionItemForm] Create failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#456564] dark:text-[#7aa3a2] border border-[#456564]/30 dark:border-[#7aa3a2]/30 rounded-lg hover:bg-[#456564]/5 dark:hover:bg-[#7aa3a2]/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Custom Action Item
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/30 p-3 space-y-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        maxLength={500}
        className="w-full text-sm bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#456564] dark:focus:ring-[#7aa3a2]"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md px-2.5 py-1.5 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#456564] dark:focus:ring-[#7aa3a2] resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 rounded-md px-2 py-1.5 text-neutral-700 dark:text-neutral-300"
        >
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
          <option value="urgent">Urgent</option>
        </select>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="text-xs font-medium px-3 py-1.5 rounded-lg btn-primary disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </form>
  );
}

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
  if (items.length === 0 && variant !== "recommended") return null;

  return (
    <section className="space-y-2">
      {(items.length > 0 || variant === "recommended") && (
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

      {variant === "recommended" && propertyId && systemKey && (
        <AddCustomActionItemForm
          systemKey={systemKey}
          propertyId={propertyId}
          onItemCreated={onItemCreated}
        />
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
