/**
 * Helpers for matching system types to inspection analysis items.
 * Aligns with backend SYSTEM_ALIASES and CANONICAL_SYSTEMS.
 */

import {
  canonicalSystemsMatch,
  resolveFindingSystemType,
} from "./aiSystemNormalization";

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
