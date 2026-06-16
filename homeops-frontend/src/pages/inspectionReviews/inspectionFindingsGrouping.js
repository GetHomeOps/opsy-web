import {PROPERTY_SYSTEMS} from "../properties/constants/propertySystems";
import {
  mapAiSystemTypeToIds,
  getSystemLabelFromAiType,
} from "../properties/helpers/aiSystemNormalization";

const SEVERITY_RANK = {critical: 0, high: 1, medium: 2, low: 3};
const PRIORITY_RANK = {urgent: 0, high: 1, medium: 2, low: 3};

export function getSystemGroupMeta(systemKey) {
  const raw = String(systemKey || "").trim();
  const matchedIds = mapAiSystemTypeToIds(raw, PROPERTY_SYSTEMS);
  const foundById =
    matchedIds.length > 0
      ? PROPERTY_SYSTEMS.find((s) => s.id === matchedIds[0])
      : null;
  if (foundById) {
    return {id: foundById.id, label: foundById.name, icon: foundById.icon};
  }
  if (!raw) return {id: "general", label: "General", icon: null};
  return {id: raw, label: getSystemLabelFromAiType(raw), icon: null};
}

export function sortBySeverity(items) {
  return [...items].sort((a, b) => {
    const aSev = SEVERITY_RANK[a.severity] ?? 2;
    const bSev = SEVERITY_RANK[b.severity] ?? 2;
    if (aSev !== bSev) return aSev - bSev;
    const aPri = PRIORITY_RANK[a.priority] ?? 2;
    const bPri = PRIORITY_RANK[b.priority] ?? 2;
    if (aPri !== bPri) return aPri - bPri;
    return (b.impactScore ?? 5) - (a.impactScore ?? 5);
  });
}

export function groupFindingsBySystem(items = []) {
  const indexed = items.map((item, originalIndex) => ({
    ...item,
    _index: originalIndex,
  }));
  const sorted = sortBySeverity(indexed);
  return sorted.reduce((acc, item) => {
    const meta = getSystemGroupMeta(item.systemType ?? item.system_type);
    const group = acc.get(meta.id) || {meta, items: []};
    group.items.push(item);
    acc.set(meta.id, group);
    return acc;
  }, new Map());
}

/** Normalize a finding or maintenance row into the shape customers see on the checklist. */
export function normalizeChecklistPreviewItem(item, source, sourceIndex) {
  if (source === "needs_attention") {
    return {
      source,
      sourceIndex,
      systemType: item.systemType ?? item.system_type,
      title: item.title || item.suggestedAction || "Inspection finding",
      description: item.suggestedAction || null,
      priority: item.priority || item.severity || "medium",
      severity: item.severity || null,
      suggestedWhen: null,
      evidence: item.evidence || null,
    };
  }
  return {
    source: "maintenance_suggestion",
    sourceIndex,
    systemType: item.systemType ?? item.system_type,
    title: item.task || "Maintenance task",
    description: item.rationale || null,
    priority: item.priority || "medium",
    severity: null,
    suggestedWhen: item.suggestedWhen || null,
    evidence: null,
  };
}

/**
 * Group needsAttention + maintenanceSuggestions the same way the customer
 * inspection checklist does (one list per system, both sources combined).
 */
export function groupUnifiedChecklistItems(
  needsAttention = [],
  maintenanceSuggestions = [],
) {
  const items = [
    ...needsAttention.map((item, i) =>
      normalizeChecklistPreviewItem(item, "needs_attention", i),
    ),
    ...maintenanceSuggestions.map((item, i) =>
      normalizeChecklistPreviewItem(item, "maintenance_suggestion", i),
    ),
  ];

  items.sort((a, b) => {
    const aPri = PRIORITY_RANK[a.priority?.toLowerCase?.()] ?? 2;
    const bPri = PRIORITY_RANK[b.priority?.toLowerCase?.()] ?? 2;
    if (aPri !== bPri) return aPri - bPri;
    const aSev = SEVERITY_RANK[a.severity?.toLowerCase?.()] ?? 2;
    const bSev = SEVERITY_RANK[b.severity?.toLowerCase?.()] ?? 2;
    return aSev - bSev;
  });

  return items.reduce((acc, item) => {
    const meta = getSystemGroupMeta(item.systemType);
    const group = acc.get(meta.id) || {meta, items: []};
    group.items.push(item);
    acc.set(meta.id, group);
    return acc;
  }, new Map());
}
