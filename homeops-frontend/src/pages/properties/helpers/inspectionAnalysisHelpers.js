/**
 * Helpers for matching system types to inspection analysis items.
 * Aligns with backend SYSTEM_ALIASES and CANONICAL_SYSTEMS.
 */

import {
  canonicalSystemsMatch,
  resolveFindingSystemType,
} from "./aiSystemNormalization";
import {isCompletedMaintenanceRecord} from "./maintenanceRecordMapping";

/** Resolve the display system bucket for a persisted checklist row. */
export function resolveChecklistItemSystemKey(item) {
  return (
    resolveFindingSystemType({
      systemType: item.system_key ?? item.systemKey,
      title: item.title,
      description: item.description,
    }) ||
    item.system_key ||
    item.systemKey ||
    "general"
  );
}

/** True when a checklist row should render as completed (matches ChecklistItem). */
export function isChecklistItemCompleted(item, completedChecklistItemIds = new Set()) {
  const explicitlyIncomplete = ["pending", "in_progress"].includes(
    String(item.status ?? "").toLowerCase(),
  );
  return (
    item.status === "completed" ||
    (completedChecklistItemIds.has(Number(item.id)) && !explicitlyIncomplete)
  );
}

/** Filter checklist rows to those belonging to a UI system. */
export function filterChecklistItemsForSystem(items, systemKey) {
  return (items || []).filter((item) =>
    matchesSystemForAnalysis(systemKey, resolveChecklistItemSystemKey(item)),
  );
}

/** Property documents filed under a system folder in the Documents tab. */
export function filterPropertyDocumentsForSystem(documents, systemKey) {
  if (!systemKey) return [];
  return (documents || []).filter((doc) => {
    const rawKey = doc.system_key ?? doc.systemKey;
    const docKey =
      rawKey === "general" ? "inspectionReport" : rawKey || "inspectionReport";
    return matchesSystemForAnalysis(systemKey, docKey);
  });
}

/** Derive progress stats from the same rows the checklist UI displays. */
export function computeChecklistProgressFromItems(
  items,
  completedChecklistItemIds = new Set(),
) {
  const list = items || [];
  const completed = list.filter((item) =>
    isChecklistItemCompleted(item, completedChecklistItemIds),
  ).length;
  return {
    completed,
    total: list.length,
    open: list.length - completed,
  };
}

function resolveItemSystemType(item) {
  return (
    resolveFindingSystemType({
      systemType: item.systemType ?? item.system_type ?? item.system_key,
      title: item.title,
      task: item.task,
      suggestedAction: item.suggestedAction,
      rationale: item.rationale,
      description: item.description,
    }) ||
    item.systemType ||
    item.system_type ||
    item.system_key
  );
}

/**
 * Check if a UI system key matches an inspection analysis system type.
 * @param {string} systemKey - e.g. "roof", "heating", "custom-Solar-0"
 * @param {string} rawType - From analysis, e.g. "Roof", "HVAC"
 * @returns {boolean}
 */
export function matchesSystemForAnalysis(systemKey, rawType) {
  return canonicalSystemsMatch(systemKey, rawType);
}

/**
 * Get needsAttention and maintenanceSuggestions for a specific system from analysis.
 * @param {string} systemType - UI system id (roof, heating, custom-Solar-0, etc.)
 * @param {Object} analysis - Inspection analysis (needsAttention, maintenanceSuggestions)
 * @returns {{ needsAttention: Array, maintenanceSuggestions: Array }}
 */
export function getSystemFindingsFromAnalysis(systemType, analysis) {
  if (!analysis) return { needsAttention: [], maintenanceSuggestions: [] };
  const needsAttention = (analysis.needsAttention ?? analysis.needs_attention ?? []).filter(
    (n) => {
      const st = resolveItemSystemType(n);
      return st && matchesSystemForAnalysis(systemType, st);
    }
  );
  const maintenanceSuggestions = (
    analysis.maintenanceSuggestions ?? analysis.maintenance_suggestions ?? []
  ).filter((m) => {
    const st = resolveItemSystemType(m);
    return st && matchesSystemForAnalysis(systemType, st);
  });
  return { needsAttention, maintenanceSuggestions };
}

function normalizeFindingLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findingLabel(finding, sourceType) {
  if (sourceType === "maintenance_suggestion") {
    return normalizeFindingLabel(
      finding.task || finding.rationale || finding.title,
    );
  }
  return normalizeFindingLabel(
    finding.title || finding.suggestedAction || finding.task,
  );
}

/** Checklist rows addressed by a completed maintenance record. */
export function getCompletedChecklistItemIds(maintenanceRecords = []) {
  const ids = new Set();
  for (const rec of maintenanceRecords) {
    const cid = rec.checklist_item_id ?? rec.checklistItemId;
    if (cid == null || cid === "") continue;
    if (isCompletedMaintenanceRecord(rec)) ids.add(Number(cid));
  }
  return ids;
}

function isChecklistItemOpen(item, completedFromRecords) {
  const status = String(item?.status ?? "").toLowerCase();
  if (status === "pending" || status === "in_progress") return true;
  if (status === "completed") return false;
  return !completedFromRecords.has(Number(item?.id));
}

function findChecklistItemForFinding(
  finding,
  sourceType,
  systemItems,
  analysis,
) {
  const allSourceItems =
    sourceType === "needs_attention"
      ? (analysis?.needsAttention ?? analysis?.needs_attention ?? [])
      : (analysis?.maintenanceSuggestions ??
        analysis?.maintenance_suggestions ??
        []);
  const label = findingLabel(finding, sourceType);
  let sourceIndex = allSourceItems.findIndex(
    (entry) => findingLabel(entry, sourceType) === label,
  );
  if (sourceIndex >= 0) {
    const matched = systemItems.find(
      (item) =>
        item.source === sourceType &&
        Number(item.source_index) === sourceIndex,
    );
    if (matched) return matched;
  }
  return (
    systemItems.find(
      (item) => normalizeFindingLabel(item.title) === label,
    ) ?? null
  );
}

function isFindingAddressed(
  finding,
  sourceType,
  systemItems,
  analysis,
  completedFromRecords,
) {
  const item = findChecklistItemForFinding(
    finding,
    sourceType,
    systemItems,
    analysis,
  );
  if (item) return !isChecklistItemOpen(item, completedFromRecords);
  return false;
}

/**
 * AI findings with checklist/maintenance progress applied — hides items that
 * have been completed or addressed by a finished maintenance record.
 */
export function getResolvedSystemFindings(
  systemType,
  analysis,
  {checklistItems = [], maintenanceRecords = []} = {},
) {
  const raw = getSystemFindingsFromAnalysis(systemType, analysis);
  const systemItems = filterChecklistItemsForSystem(checklistItems, systemType);
  const completedFromRecords = getCompletedChecklistItemIds(maintenanceRecords);

  const needsAttention = (raw.needsAttention ?? []).filter(
    (finding) =>
      !isFindingAddressed(
        finding,
        "needs_attention",
        systemItems,
        analysis,
        completedFromRecords,
      ),
  );
  const maintenanceSuggestions = (raw.maintenanceSuggestions ?? []).filter(
    (finding) =>
      !isFindingAddressed(
        finding,
        "maintenance_suggestion",
        systemItems,
        analysis,
        completedFromRecords,
      ),
  );

  return {needsAttention, maintenanceSuggestions};
}

/** True when every checklist row for the system is done or addressed. */
export function areAllSystemActionItemsComplete(
  systemKey,
  checklistItems = [],
  maintenanceRecords = [],
) {
  const items = filterChecklistItemsForSystem(checklistItems, systemKey);
  if (items.length === 0) return false;
  const completedFromRecords = getCompletedChecklistItemIds(maintenanceRecords);
  return items.every((item) => !isChecklistItemOpen(item, completedFromRecords));
}

/**
 * When all action items are fulfilled, bump Fair/Poor to Good for display.
 */
export function resolveEffectiveSystemCondition(
  storedCondition,
  allActionItemsComplete,
) {
  const stored = String(storedCondition ?? "").trim();
  if (!stored) return null;
  const lower = stored.toLowerCase();
  if (allActionItemsComplete) {
    if (lower === "fair" || lower === "poor") return "Good";
    return stored;
  }
  if (lower === "good") return "Fair";
  return stored;
}

export function countOpenSystemActionItems(
  systemKey,
  checklistItems = [],
  maintenanceRecords = [],
) {
  const items = filterChecklistItemsForSystem(checklistItems, systemKey);
  const completedFromRecords = getCompletedChecklistItemIds(maintenanceRecords);
  return items.filter((item) =>
    isChecklistItemOpen(item, completedFromRecords),
  ).length;
}
