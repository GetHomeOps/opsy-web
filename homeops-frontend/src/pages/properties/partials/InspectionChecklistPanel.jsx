/**
 * InspectionChecklistPanel
 * Displays per-system checklist items derived from inspection analysis.
 * Allows users to mark items as completed, deferred, or N/A.
 * Shows progress bar for overall and per-system completion.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "lucide-react";
import AppApi from "../../../api/api";
import { PROPERTY_SYSTEMS } from "../constants/propertySystems";

const STATUS_CONFIG = {
  pending: { icon: Circle, label: "Pending", color: "text-gray-400 dark:text-gray-500", bg: "bg-gray-100 dark:bg-gray-700" },
  in_progress: { icon: Clock, label: "In Progress", color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
  completed: { icon: CheckCircle2, label: "Done", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
  deferred: { icon: Clock, label: "Deferred", color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" },
  not_applicable: { icon: MinusCircle, label: "N/A", color: "text-gray-400 dark:text-gray-500", bg: "bg-gray-50 dark:bg-gray-800" },
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

function ProgressBar({ completed, total, className = "" }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}

function ChecklistItem({ item, onStatusChange, onSchedule, isAddressedByMaintenance = false }) {
  const [updating, setUpdating] = useState(false);
  const isCrossedOut = item.status === "completed" || isAddressedByMaintenance;
  const statusConf = isAddressedByMaintenance ? STATUS_CONFIG.completed : (STATUS_CONFIG[item.status] || STATUS_CONFIG.pending);
  const StatusIcon = statusConf.icon;
  const SevIcon = SEVERITY_ICONS[item.severity] || SEVERITY_ICONS.medium;
  const priorityColor = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;

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
    <div className={`flex items-start gap-3 py-2.5 px-3 rounded-lg border transition-colors ${
      isCrossedOut
        ? "border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-900/10"
        : "border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/50"
    }`}>
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
          <StatusIcon className="w-5 h-5" strokeWidth={isCrossedOut ? 2.5 : 1.5} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {item.severity && (
            <SevIcon className={`w-3.5 h-3.5 flex-shrink-0 ${priorityColor}`} strokeWidth={2} />
          )}
          <span className={`text-sm font-medium ${
            isCrossedOut
              ? "text-gray-400 dark:text-gray-500 line-through"
              : "text-gray-800 dark:text-gray-200"
          }`}>
            {item.title}
          </span>
          {item.priority && item.priority !== "medium" && (
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${priorityColor}`}>
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
            onClick={() => onSchedule({
              systemType: item.system_key,
              systemLabel: getSystemLabel(item.system_key),
              task: item.title,
              suggestedWhen: item.suggested_when,
              checklistItemId: item.id,
            })}
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium bg-[#456564]/10 hover:bg-[#456564]/20 text-[#456564] dark:text-[#7aa3a2] transition-colors"
            title="Schedule maintenance"
          >
            <Calendar className="w-3 h-3" />
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
        AppApi.getInspectionChecklist(propertyId, { systemKey }),
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

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = useCallback(async (itemId, newStatus) => {
    try {
      if (newStatus === "completed") {
        await AppApi.completeChecklistItem(itemId);
      } else {
        await AppApi.updateChecklistItem(itemId, { status: newStatus });
      }
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null }
            : item
        )
      );
      setProgress((prev) => {
        if (!prev) return prev;
        const item = items.find((i) => i.id === itemId);
        if (!item) return prev;
        const sys = item.system_key;
        const sysProgress = prev.bySystem[sys] || { total: 0, completed: 0, pending: 0, in_progress: 0, deferred: 0, not_applicable: 0 };
        const oldStatus = item.status;
        const newSysProgress = { ...sysProgress };
        if (oldStatus && newSysProgress[oldStatus] > 0) newSysProgress[oldStatus]--;
        newSysProgress[newStatus] = (newSysProgress[newStatus] || 0) + 1;
        const newBySystem = { ...prev.bySystem, [sys]: newSysProgress };
        let totalCompleted = 0;
        let totalPending = 0;
        for (const s of Object.values(newBySystem)) {
          totalCompleted += s.completed || 0;
          totalPending += s.pending || 0;
        }
        return { ...prev, completed: totalCompleted, pending: totalPending, bySystem: newBySystem };
      });
    } catch (err) {
      console.error("[InspectionChecklistPanel] Status update failed:", err);
      loadData();
    }
  }, [items, loadData]);

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
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading checklist...</span>
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
    const sysItems = groupedItems[systemKey] || [];
    const sysProgress = progress?.bySystem?.[systemKey];
    if (sysItems.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {sysProgress && (
          <ProgressBar completed={sysProgress.completed} total={sysProgress.total} className="mb-2" />
        )}
        {sysItems.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            onStatusChange={handleStatusChange}
            onSchedule={onScheduleMaintenance}
            isAddressedByMaintenance={completedChecklistItemIds.has(Number(item.id))}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {progress && (
        <div className="flex items-center gap-3 mb-1">
          <ProgressBar completed={progress.completed} total={progress.total} className="flex-1" />
        </div>
      )}

      {Object.entries(groupedItems).map(([sysKey, sysItems]) => {
        const isExpanded = expandedSystems.has(sysKey);
        const sysProgress = progress?.bySystem?.[sysKey];
        return (
          <div key={sysKey} className="border border-gray-100 dark:border-gray-700/50 rounded-lg overflow-hidden">
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
                {sysItems.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onStatusChange={handleStatusChange}
                    onSchedule={onScheduleMaintenance}
                    isAddressedByMaintenance={completedChecklistItemIds.has(Number(item.id))}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
