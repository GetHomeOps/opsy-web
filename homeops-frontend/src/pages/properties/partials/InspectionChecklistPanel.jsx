/**
 * InspectionChecklistPanel
 * Displays per-system checklist items derived from inspection analysis.
 * Allows users to mark items as completed, deferred, or N/A.
 * Shows progress bar for overall and per-system completion.
 */

import React, {useState, useEffect, useCallback, useMemo, useRef} from "react";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  ClipboardList,
  Plus,
  Trash2,
  X,
  MapPin,
  User,
  Clock,
} from "lucide-react";
import AppApi from "../../../api/api";
import ModalBlank from "../../../components/ModalBlank";
import {parseDateInput} from "../../../lib/dateOffset";
import {getSystemLabelFromAiType} from "../helpers/aiSystemNormalization";

const INSPECTION_CHECKLIST_UPDATED_EVENT = "inspection-checklist:updated";

function emitInspectionChecklistUpdated(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(INSPECTION_CHECKLIST_UPDATED_EVENT, {detail}),
  );
}

/** Checked vs unchecked - only two states for UI. */
const STATUS_CONFIG = {
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  not_completed: {
    icon: Circle,
    color: "text-gray-400 dark:text-gray-500",
  },
};

const SEVERITY_ICONS = {
  critical: AlertOctagon,
  high: AlertTriangle,
  medium: AlertCircle,
  low: AlertCircle,
};

const PRIORITY_COLORS = {
  urgent: "text-red-600 dark:text-red-400",
  high: "text-red-500 dark:text-red-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-gray-500 dark:text-gray-400",
};

const PRIORITY_PILL_STYLES = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  high: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
};

const LEFT_BORDER_BY_PRIORITY = {
  urgent: "border-l-red-500 dark:border-l-red-400",
  high: "border-l-red-400 dark:border-l-red-500",
  medium: "border-l-amber-400 dark:border-l-amber-500",
  low: "border-l-gray-300 dark:border-l-gray-600",
};

function getSystemLabel(systemKey) {
  if (!systemKey) return "General";
  return getSystemLabelFromAiType(systemKey);
}

function ProgressBar({completed, total, className = ""}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out animate-pulse"
          style={{width: `${pct}%`, backgroundColor: "#32bd7c"}}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}

function EventDetailInlineModal({event, isOpen, onClose}) {
  if (!event) return null;
  const eventDate = parseDateInput(event.scheduled_date ?? event.scheduledDate);
  const formattedDate = eventDate
    ? eventDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const formattedTime = event.scheduled_time
    ? (() => {
        const [h, m] = event.scheduled_time.split(":");
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        return `${hour12}:${m} ${ampm}`;
      })()
    : null;
  const statusLabel =
    event.status === "scheduled"
      ? "Scheduled"
      : event.status === "completed"
        ? "Completed"
        : event.status || "Scheduled";

  return (
    <ModalBlank
      id="checklist-event-detail"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName="max-w-sm"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                {statusLabel}
              </span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {event.system_name || "Maintenance"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {formattedDate}
              {formattedTime && ` at ${formattedTime}`}
            </span>
          </div>
          {event.contractor_name && (
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {event.contractor_name}
              </span>
            </div>
          )}
          {event.message_body && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
              {event.message_body}
            </div>
          )}
        </div>
      </div>
    </ModalBlank>
  );
}

function SystemEventsModal({events, systemLabel, isOpen, onClose}) {
  if (!events?.length) return null;
  return (
    <ModalBlank
      id="system-events-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName="max-w-md"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              Scheduled Events
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {systemLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {events.map((ev) => {
            const d = parseDateInput(ev.scheduled_date ?? ev.scheduledDate);
            return (
              <div
                key={ev.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {d
                      ? d.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No date"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {ev.contractor_name || "No professional assigned"}
                  </p>
                </div>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex-shrink-0">
                  {ev.status || "scheduled"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </ModalBlank>
  );
}

function ChecklistItem({
  item,
  onStatusChange,
  onDelete,
  linkedEvent = null,
  onViewEvent,
  isAddressedByMaintenance = false,
  isSyncing = false,
}) {
  const isUserCreated = item.source === "user_created";
  // User's explicit status takes precedence: if they unchecked (pending/in_progress), show as unchecked
  const explicitlyIncomplete = ["pending", "in_progress"].includes(
    String(item.status ?? "").toLowerCase(),
  );
  const isChecked =
    item.status === "completed" ||
    (isAddressedByMaintenance && !explicitlyIncomplete);
  const statusConf = isChecked
    ? STATUS_CONFIG.completed
    : STATUS_CONFIG.not_completed;
  const StatusIcon = statusConf.icon;
  const SevIcon = SEVERITY_ICONS[item.severity] || SEVERITY_ICONS.medium;
  const priorityColor =
    PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;

  const handleToggle = () => {
    if (isSyncing) return;
    const nextStatus = item.status === "completed" ? "pending" : "completed";
    onStatusChange(item.id, nextStatus);
  };

  const effectivePriority =
    item.priority ||
    (item.severity === "critical"
      ? "urgent"
      : item.severity === "high"
        ? "high"
        : "medium");
  const leftBorder =
    LEFT_BORDER_BY_PRIORITY[effectivePriority] ||
    LEFT_BORDER_BY_PRIORITY.medium;
  const pillStyle =
    PRIORITY_PILL_STYLES[effectivePriority] || PRIORITY_PILL_STYLES.medium;

  return (
    <div
      className={`group flex items-start gap-3 py-2.5 px-3 rounded-lg border border-l-[3px] transition-all duration-200 ${
        isChecked
          ? `border-emerald-200/60 dark:border-emerald-800/30 border-l-emerald-400 dark:border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10`
          : `border-gray-100 dark:border-gray-700/50 ${leftBorder} bg-white dark:bg-gray-800/30 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 hover:shadow-sm`
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={isSyncing}
        className={`mt-0.5 flex-shrink-0 transition-all duration-200 ${statusConf.color} hover:scale-110 ${isSyncing ? "opacity-70" : ""}`}
        title={isChecked ? "Mark as pending" : "Mark as done"}
      >
        <StatusIcon className="w-5 h-5" strokeWidth={isChecked ? 2.5 : 1.5} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-sm font-medium transition-colors duration-200 ${
              isChecked
                ? "text-gray-400 dark:text-gray-500 line-through"
                : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {item.title}
          </span>
          {isUserCreated && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#456564]/10 text-[#456564] dark:bg-[#7aa3a2]/15 dark:text-[#7aa3a2]">
              My ToDo
            </span>
          )}
          {effectivePriority && effectivePriority !== "medium" && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full transition-opacity duration-150 ${pillStyle} ${
                  isChecked ? "opacity-45" : ""
                }`}
              >
                <SevIcon className="w-2.5 h-2.5" strokeWidth={2.5} />
                {effectivePriority}
              </span>
            )}
        </div>
        {item.description && (
          <p
            className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
              isChecked
                ? "text-gray-400/80 dark:text-gray-500/80"
                : "text-gray-500 dark:text-gray-400"
            }`}
          >
            {item.description}
          </p>
        )}
        {item.suggested_when && (
          <p
            className={`text-[11px] mt-1 italic ${
              isChecked
                ? "text-gray-400/80 dark:text-gray-500/80"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {item.suggested_when}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {linkedEvent && onViewEvent && (
          <button
            type="button"
            onClick={() => onViewEvent(linkedEvent)}
            className="inline-flex items-center px-1.5 py-1 rounded text-emerald-500 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-150"
            title={`Scheduled: ${linkedEvent.scheduled_date || "view event"}`}
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
        )}
        {isUserCreated && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="opacity-0 group-hover:opacity-100 inline-flex items-center px-1.5 py-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150"
            title="Delete ToDo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function AddTodoForm({systemKey, propertyId, onItemCreated}) {
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
      console.error("[AddTodoForm] Create failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#456564] dark:text-[#7aa3a2] hover:bg-[#456564]/5 dark:hover:bg-[#7aa3a2]/10 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 hover:border-[#456564]/30 dark:hover:border-[#7aa3a2]/30 transition-all duration-200 w-full"
      >
        <Plus className="w-3.5 h-3.5" />
        Add ToDo
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-3 space-y-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        maxLength={500}
        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#456564] dark:focus:ring-[#7aa3a2]"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#456564] dark:focus:ring-[#7aa3a2] resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#456564]"
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
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="text-xs font-medium px-3 py-1 rounded-md bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function InspectionChecklistPanel({
  propertyId,
  systemKey = null,
  maintenanceRecords = [],
  compact = false,
}) {
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingItemId, setSyncingItemId] = useState(null);
  const skipNextLoadRef = useRef(false);
  const [expandedSystems, setExpandedSystems] = useState(new Set());
  const [maintenanceEvents, setMaintenanceEvents] = useState([]);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState(null);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [systemEventsModalOpen, setSystemEventsModalOpen] = useState(false);
  const [systemEventsModalEvents, setSystemEventsModalEvents] = useState([]);
  const [systemEventsModalLabel, setSystemEventsModalLabel] = useState("");

  const loadData = useCallback(async ({showLoader = true} = {}) => {
    if (!propertyId) return;
    if (showLoader) setLoading(true);
    try {
      const [itemsRes, progressRes, eventsRes] = await Promise.all([
        AppApi.getInspectionChecklist(propertyId, {systemKey}),
        AppApi.getInspectionChecklistProgress(propertyId),
        AppApi.getMaintenanceEventsByProperty(propertyId).catch(() => []),
      ]);
      setItems(itemsRes);
      setProgress(progressRes);
      setMaintenanceEvents(eventsRes || []);
      if (!systemKey) {
        const systems = new Set(itemsRes.map((i) => i.system_key));
        setExpandedSystems(systems);
      }
    } catch (err) {
      console.error("[InspectionChecklistPanel] Load failed:", err);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [propertyId, systemKey]);

  useEffect(() => {
    loadData({showLoader: true});
  }, [loadData]);

  useEffect(() => {
    const handleChecklistUpdated = (event) => {
      if (event?.detail?.skipChecklistReload) return;
      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }
      // Avoid replacing checklist content with a loading skeleton; this can
      // shift surrounding layout and make the page scroll jump during toggles.
      loadData({showLoader: false});
    };
    window.addEventListener(
      INSPECTION_CHECKLIST_UPDATED_EVENT,
      handleChecklistUpdated,
    );
    return () =>
      window.removeEventListener(
        INSPECTION_CHECKLIST_UPDATED_EVENT,
        handleChecklistUpdated,
      );
  }, [loadData]);

  const handleStatusChange = useCallback(
    async (itemId, newStatus) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      setSyncingItemId(itemId);
      // Optimistic update: apply immediately for instant feedback
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: newStatus,
                completed_at:
                  newStatus === "completed" ? new Date().toISOString() : null,
              }
            : i,
        ),
      );
      setProgress((prev) => {
        if (!prev) return prev;
        const sys = item.system_key;
        const sysProgress = prev.bySystem[sys] || {
          total: 0,
          completed: 0,
          pending: 0,
          in_progress: 0,
          deferred: 0,
          not_applicable: 0,
        };
        const oldStatus = item.status;
        const newSysProgress = {...sysProgress};
        if (oldStatus && newSysProgress[oldStatus] > 0)
          newSysProgress[oldStatus]--;
        newSysProgress[newStatus] = (newSysProgress[newStatus] || 0) + 1;
        const newBySystem = {...prev.bySystem, [sys]: newSysProgress};
        let totalCompleted = 0;
        let totalPending = 0;
        for (const s of Object.values(newBySystem)) {
          totalCompleted += s.completed || 0;
          totalPending += s.pending || 0;
        }
        return {
          ...prev,
          completed: totalCompleted,
          pending: totalPending,
          bySystem: newBySystem,
        };
      });
      try {
        if (newStatus === "completed") {
          await AppApi.completeChecklistItem(itemId);
        } else {
          await AppApi.updateChecklistItem(itemId, {status: newStatus});
        }
        skipNextLoadRef.current = true;
        emitInspectionChecklistUpdated({skipChecklistReload: true});
      } catch (err) {
        console.error("[InspectionChecklistPanel] Status update failed:", err);
        loadData({showLoader: false});
      } finally {
        setSyncingItemId(null);
      }
    },
    [items, loadData],
  );

  const handleItemCreated = useCallback((newItem) => {
    setItems((prev) => [...prev, newItem]);
    setProgress((prev) => {
      if (!prev) return prev;
      const sys = newItem.system_key;
      const sysProgress = prev.bySystem[sys] || {
        total: 0,
        completed: 0,
        pending: 0,
        in_progress: 0,
        deferred: 0,
        not_applicable: 0,
      };
      const newSysProgress = {
        ...sysProgress,
        total: sysProgress.total + 1,
        pending: sysProgress.pending + 1,
      };
      return {
        ...prev,
        total: prev.total + 1,
        pending: prev.pending + 1,
        bySystem: {...prev.bySystem, [sys]: newSysProgress},
      };
    });
    setExpandedSystems((prev) => {
      const next = new Set(prev);
      next.add(newItem.system_key);
      return next;
    });
    skipNextLoadRef.current = true;
    emitInspectionChecklistUpdated();
  }, []);

  const handleDeleteItem = useCallback(
    async (itemId) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      try {
        await AppApi.deleteChecklistItem(itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        setProgress((prev) => {
          if (!prev) return prev;
          const sys = item.system_key;
          const sysProgress = prev.bySystem[sys];
          if (!sysProgress) return prev;
          const newSysProgress = {
            ...sysProgress,
            total: Math.max(0, sysProgress.total - 1),
          };
          const st = item.status;
          if (st && newSysProgress[st] > 0) newSysProgress[st]--;
          const newBySystem = {...prev.bySystem, [sys]: newSysProgress};
          let totalAll = 0,
            totalCompleted = 0,
            totalPending = 0;
          for (const s of Object.values(newBySystem)) {
            totalAll += s.total || 0;
            totalCompleted += s.completed || 0;
            totalPending += s.pending || 0;
          }
          return {
            ...prev,
            total: totalAll,
            completed: totalCompleted,
            pending: totalPending,
            bySystem: newBySystem,
          };
        });
        skipNextLoadRef.current = true;
        emitInspectionChecklistUpdated();
      } catch (err) {
        console.error("[InspectionChecklistPanel] Delete failed:", err);
      }
    },
    [items],
  );

  const groupedItems = useMemo(() => {
    const groups = {};
    for (const item of items) {
      const key = item.system_key || "general";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [items]);

  const eventsByChecklistItemId = useMemo(() => {
    const map = {};
    for (const ev of maintenanceEvents || []) {
      const cid = ev.checklist_item_id ?? ev.checklistItemId;
      if (cid != null) {
        map[Number(cid)] = ev;
      }
    }
    return map;
  }, [maintenanceEvents]);

  const handleViewEvent = useCallback((event) => {
    setSelectedEventForDetail(event);
    setEventDetailOpen(true);
  }, []);

  const handleViewSystemEvents = useCallback(
    (sysKey, label) => {
      const sysEvents = (maintenanceEvents || []).filter(
        (ev) => (ev.system_key ?? ev.systemKey) === sysKey,
      );
      setSystemEventsModalEvents(sysEvents);
      setSystemEventsModalLabel(label || getSystemLabel(sysKey));
      setSystemEventsModalOpen(true);
    },
    [maintenanceEvents],
  );

  const completedChecklistItemIds = useMemo(() => {
    const ids = new Set();
    for (const rec of maintenanceRecords || []) {
      const cid = rec.checklist_item_id ?? rec.checklistItemId;
      const status = (rec.status ?? "").toString();
      if (cid != null && status.toLowerCase() === "completed") {
        ids.add(Number(cid));
      }
    }
    return ids;
  }, [maintenanceRecords]);

  const toggleSystem = (sysKey) => {
    setExpandedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(sysKey)) next.delete(sysKey);
      else next.add(sysKey);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading checklist...
        </span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <ClipboardList className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No inspection checklist items yet.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Upload and analyze an inspection report to generate a checklist.
        </p>
      </div>
    );
  }

  if (systemKey) {
    const sysKeyLower = systemKey.toLowerCase();
    const sysItems =
      groupedItems[systemKey] ||
      Object.entries(groupedItems).find(
        ([k]) => k.toLowerCase() === sysKeyLower,
      )?.[1] ||
      [];
    const sysProgress =
      progress?.bySystem?.[systemKey] ??
      Object.entries(progress?.bySystem || {}).find(
        ([k]) => k.toLowerCase() === sysKeyLower,
      )?.[1];
    const inspectionItems = sysItems.filter((i) => i.source !== "user_created");
    const userItems = sysItems.filter((i) => i.source === "user_created");
    const hasAnyItems = sysItems.length > 0;
    return (
      <div className="space-y-2">
        {sysProgress && hasAnyItems && (
          <ProgressBar
            completed={sysProgress.completed}
            total={sysProgress.total}
            className="mb-3"
          />
        )}
        {inspectionItems.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onStatusChange={handleStatusChange}
            onDelete={handleDeleteItem}
            linkedEvent={eventsByChecklistItemId[Number(item.id)] || null}
            onViewEvent={handleViewEvent}
            isAddressedByMaintenance={completedChecklistItemIds.has(
              Number(item.id),
            )}
            isSyncing={syncingItemId === item.id}
          />
        ))}
        {userItems.length > 0 && inspectionItems.length > 0 && (
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700/50" />
            <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              My ToDos
            </span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700/50" />
          </div>
        )}
        {userItems.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onStatusChange={handleStatusChange}
            onDelete={handleDeleteItem}
            linkedEvent={eventsByChecklistItemId[Number(item.id)] || null}
            onViewEvent={handleViewEvent}
            isAddressedByMaintenance={completedChecklistItemIds.has(
              Number(item.id),
            )}
            isSyncing={syncingItemId === item.id}
          />
        ))}
        <AddTodoForm
          systemKey={systemKey}
          propertyId={propertyId}
          onItemCreated={handleItemCreated}
        />
        <EventDetailInlineModal
          event={selectedEventForDetail}
          isOpen={eventDetailOpen}
          onClose={setEventDetailOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {progress && (
        <div className="flex items-center gap-3 mb-1">
          <ProgressBar
            completed={progress.completed}
            total={progress.total}
            className="flex-1"
          />
        </div>
      )}

      {Object.entries(groupedItems).map(([sysKey, sysItems]) => {
        const isExpanded = expandedSystems.has(sysKey);
        const sysProgress = progress?.bySystem?.[sysKey];
        const inspectionItems = sysItems.filter(
          (i) => i.source !== "user_created",
        );
        const userItems = sysItems.filter((i) => i.source === "user_created");
        return (
          <div
            key={sysKey}
            className="border border-gray-100 dark:border-gray-700/50 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleSystem(sysKey)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {getSystemLabel(sysKey)}
              </span>
              {sysProgress && (
                <ProgressBar
                  completed={sysProgress.completed}
                  total={sysProgress.total}
                  className="flex-1 max-w-[160px]"
                />
              )}
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                {inspectionItems.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteItem}
                    linkedEvent={
                      eventsByChecklistItemId[Number(item.id)] || null
                    }
                    onViewEvent={handleViewEvent}
                    isAddressedByMaintenance={completedChecklistItemIds.has(
                      Number(item.id),
                    )}
                    isSyncing={syncingItemId === item.id}
                  />
                ))}
                {userItems.length > 0 && inspectionItems.length > 0 && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700/50" />
                    <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      My ToDos
                    </span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700/50" />
                  </div>
                )}
                {userItems.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteItem}
                    linkedEvent={
                      eventsByChecklistItemId[Number(item.id)] || null
                    }
                    onViewEvent={handleViewEvent}
                    isAddressedByMaintenance={completedChecklistItemIds.has(
                      Number(item.id),
                    )}
                    isSyncing={syncingItemId === item.id}
                  />
                ))}
                <AddTodoForm
                  systemKey={sysKey}
                  propertyId={propertyId}
                  onItemCreated={handleItemCreated}
                />
              </div>
            )}
          </div>
        );
      })}
      <EventDetailInlineModal
        event={selectedEventForDetail}
        isOpen={eventDetailOpen}
        onClose={setEventDetailOpen}
      />
      <SystemEventsModal
        events={systemEventsModalEvents}
        systemLabel={systemEventsModalLabel}
        isOpen={systemEventsModalOpen}
        onClose={setSystemEventsModalOpen}
      />
    </div>
  );
}
