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
  Clock,
  MinusCircle,
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
  User,
} from "lucide-react";
import AppApi from "../../../api/api";
import {PROPERTY_SYSTEMS} from "../constants/propertySystems";

const STATUS_CONFIG = {
  pending: {
    icon: Circle,
    label: "Pending",
    color: "text-gray-400 dark:text-gray-500",
    bg: "bg-gray-100 dark:bg-gray-700",
  },
  in_progress: {
    icon: Clock,
    label: "In Progress",
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
  },
  completed: {
    icon: CheckCircle2,
    label: "Done",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
  },
  deferred: {
    icon: Clock,
    label: "Deferred",
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30",
  },
  not_applicable: {
    icon: MinusCircle,
    label: "N/A",
    color: "text-gray-400 dark:text-gray-500",
    bg: "bg-gray-50 dark:bg-gray-800",
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

function getSystemLabel(systemKey) {
  if (!systemKey) return "General";
  const sys = PROPERTY_SYSTEMS.find((s) => s.id === systemKey);
  return sys?.name || systemKey.charAt(0).toUpperCase() + systemKey.slice(1);
}

function ProgressBar({completed, total, className = ""}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
          style={{width: `${pct}%`}}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}

function ChecklistItem({
  item,
  onStatusChange,
  onSchedule,
  onDelete,
  isAddressedByMaintenance = false,
}) {
  const [updating, setUpdating] = useState(false);
  const isUserCreated = item.source === "user_created";
  const isCrossedOut = item.status === "completed" || isAddressedByMaintenance;
  const statusConf = isAddressedByMaintenance
    ? STATUS_CONFIG.completed
    : STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConf.icon;
  const SevIcon = SEVERITY_ICONS[item.severity] || SEVERITY_ICONS.medium;
  const priorityColor =
    PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;

  const handleToggle = async () => {
    if (updating) return;
    const nextStatus = item.status === "completed" ? "pending" : "completed";
    setUpdating(true);
    try {
      await onStatusChange(item.id, nextStatus);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusSelect = async (newStatus) => {
    if (updating || newStatus === item.status) return;
    setUpdating(true);
    try {
      await onStatusChange(item.id, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      className={`flex items-start gap-3 py-2.5 px-3 rounded-lg border transition-colors ${
        isCrossedOut
          ? "border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/10"
          : isUserCreated
            ? "border-violet-200/50 dark:border-violet-800/30 bg-violet-50/20 dark:bg-violet-900/10 hover:bg-violet-50/40 dark:hover:bg-violet-900/20"
            : "border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={updating}
        className={`mt-0.5 flex-shrink-0 transition-colors ${statusConf.color} hover:opacity-70`}
        title={isCrossedOut ? "Mark as pending" : "Mark as done"}
      >
        {updating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <StatusIcon
            className="w-5 h-5"
            strokeWidth={isCrossedOut ? 2.5 : 1.5}
          />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isUserCreated ? (
            <User
              className="w-3.5 h-3.5 flex-shrink-0 text-violet-500 dark:text-violet-400"
              strokeWidth={2}
            />
          ) : item.severity ? (
            <SevIcon
              className={`w-3.5 h-3.5 flex-shrink-0 ${priorityColor}`}
              strokeWidth={2}
            />
          ) : null}
          <span
            className={`text-sm font-medium ${
              isCrossedOut
                ? "text-gray-400 dark:text-gray-500 line-through"
                : "text-gray-800 dark:text-gray-200"
            }`}
          >
            {item.title}
          </span>
          {isUserCreated && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
              My ToDo
            </span>
          )}
          {item.priority && item.priority !== "medium" && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${priorityColor}`}
            >
              {item.priority}
            </span>
          )}
        </div>
        {item.description && !isCrossedOut && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
        {item.suggested_when && !isCrossedOut && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">
            {item.suggested_when}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!isCrossedOut && onSchedule && (
          <button
            type="button"
            onClick={() =>
              onSchedule({
                systemType: item.system_key,
                systemLabel: getSystemLabel(item.system_key),
                task: item.title,
                suggestedWhen: item.suggested_when,
                checklistItemId: item.id,
              })
            }
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium bg-[#456564]/10 hover:bg-[#456564]/20 text-[#456564] dark:text-[#7aa3a2] transition-colors"
            title="Schedule maintenance"
          >
            <Calendar className="w-3 h-3" />
          </button>
        )}
        {isUserCreated && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete ToDo"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        <select
          value={item.status}
          onChange={(e) => handleStatusSelect(e.target.value)}
          disabled={updating}
          className="text-[10px] bg-transparent border-0 text-gray-400 dark:text-gray-500 cursor-pointer focus:ring-0 p-0 pr-4 appearance-auto"
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Done</option>
          <option value="deferred">Deferred</option>
          <option value="not_applicable">N/A</option>
        </select>
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
        className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-md transition-colors w-full"
      >
        <Plus className="w-3.5 h-3.5" />
        Add ToDo
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-violet-200 dark:border-violet-800/50 bg-violet-50/30 dark:bg-violet-900/10 p-3 space-y-2">
      <input
        ref={inputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        maxLength={500}
        className="w-full text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400 dark:focus:ring-violet-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Notes (optional)"
        rows={2}
        className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400 dark:focus:ring-violet-500 resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-gray-600 dark:text-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
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
            className="text-xs font-medium px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  onScheduleMaintenance,
  maintenanceRecords = [],
  compact = false,
}) {
  const [items, setItems] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSystems, setExpandedSystems] = useState(new Set());

  const loadData = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const [itemsRes, progressRes] = await Promise.all([
        AppApi.getInspectionChecklist(propertyId, {systemKey}),
        AppApi.getInspectionChecklistProgress(propertyId),
      ]);
      setItems(itemsRes);
      setProgress(progressRes);
      if (!systemKey) {
        const systems = new Set(itemsRes.map((i) => i.system_key));
        setExpandedSystems(systems);
      }
    } catch (err) {
      console.error("[InspectionChecklistPanel] Load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [propertyId, systemKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = useCallback(
    async (itemId, newStatus) => {
      try {
        if (newStatus === "completed") {
          await AppApi.completeChecklistItem(itemId);
        } else {
          await AppApi.updateChecklistItem(itemId, {status: newStatus});
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: newStatus,
                  completed_at:
                    newStatus === "completed" ? new Date().toISOString() : null,
                }
              : item,
          ),
        );
        setProgress((prev) => {
          if (!prev) return prev;
          const item = items.find((i) => i.id === itemId);
          if (!item) return prev;
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
      } catch (err) {
        console.error("[InspectionChecklistPanel] Status update failed:", err);
        loadData();
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
        total: 0, completed: 0, pending: 0, in_progress: 0, deferred: 0, not_applicable: 0,
      };
      const newSysProgress = {...sysProgress, total: sysProgress.total + 1, pending: sysProgress.pending + 1};
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
  }, []);

  const handleDeleteItem = useCallback(async (itemId) => {
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
        const newSysProgress = {...sysProgress, total: Math.max(0, sysProgress.total - 1)};
        const st = item.status;
        if (st && newSysProgress[st] > 0) newSysProgress[st]--;
        const newBySystem = {...prev.bySystem, [sys]: newSysProgress};
        let totalAll = 0, totalCompleted = 0, totalPending = 0;
        for (const s of Object.values(newBySystem)) {
          totalAll += s.total || 0;
          totalCompleted += s.completed || 0;
          totalPending += s.pending || 0;
        }
        return {...prev, total: totalAll, completed: totalCompleted, pending: totalPending, bySystem: newBySystem};
      });
    } catch (err) {
      console.error("[InspectionChecklistPanel] Delete failed:", err);
    }
  }, [items]);

  const groupedItems = useMemo(() => {
    const groups = {};
    for (const item of items) {
      const key = item.system_key || "general";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [items]);

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
    const sysItems = groupedItems[systemKey]
      || Object.entries(groupedItems).find(([k]) => k.toLowerCase() === sysKeyLower)?.[1]
      || [];
    const sysProgress = progress?.bySystem?.[systemKey]
      ?? Object.entries(progress?.bySystem || {}).find(([k]) => k.toLowerCase() === sysKeyLower)?.[1];
    const inspectionItems = sysItems.filter((i) => i.source !== "user_created");
    const userItems = sysItems.filter((i) => i.source === "user_created");
    const hasAnyItems = sysItems.length > 0;
    return (
      <div className="space-y-1.5">
        {sysProgress && hasAnyItems && (
          <ProgressBar
            completed={sysProgress.completed}
            total={sysProgress.total}
            className="mb-2"
          />
        )}
        {inspectionItems.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onStatusChange={handleStatusChange}
            onSchedule={onScheduleMaintenance}
            onDelete={handleDeleteItem}
            isAddressedByMaintenance={completedChecklistItemIds.has(
              Number(item.id),
            )}
          />
        ))}
        {userItems.length > 0 && inspectionItems.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700/50 my-2" />
        )}
        {userItems.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onStatusChange={handleStatusChange}
            onSchedule={onScheduleMaintenance}
            onDelete={handleDeleteItem}
            isAddressedByMaintenance={completedChecklistItemIds.has(
              Number(item.id),
            )}
          />
        ))}
        <AddTodoForm
          systemKey={systemKey}
          propertyId={propertyId}
          onItemCreated={handleItemCreated}
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
        const inspectionItems = sysItems.filter((i) => i.source !== "user_created");
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
              <div className="px-3 pb-2.5 space-y-1.5">
                {inspectionItems.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onSchedule={onScheduleMaintenance}
                    onDelete={handleDeleteItem}
                    isAddressedByMaintenance={completedChecklistItemIds.has(
                      Number(item.id),
                    )}
                  />
                ))}
                {userItems.length > 0 && inspectionItems.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-700/50 my-2" />
                )}
                {userItems.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onSchedule={onScheduleMaintenance}
                    onDelete={handleDeleteItem}
                    isAddressedByMaintenance={completedChecklistItemIds.has(
                      Number(item.id),
                    )}
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
    </div>
  );
}
