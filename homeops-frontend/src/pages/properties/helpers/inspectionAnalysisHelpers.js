/**
 * Helpers for matching system types to inspection analysis items.
 * Aligns with backend SYSTEM_ALIASES and CANONICAL_SYSTEMS.
 */

import {
  normalizeAiSystemToken,
  mapAiSystemTypeToIds,
} from "./aiSystemNormalization";

function getSystemKeyTokens(systemKey) {
  const raw = String(systemKey || "").trim();
  if (!raw) return [];
  const normalized = normalizeAiSystemToken(raw);
  const tokens = new Set([normalized]);

  const mapped = mapAiSystemTypeToIds(raw);
  mapped.forEach((id) => tokens.add(normalizeAiSystemToken(id)));

  if (normalized.startsWith("custom")) {
    tokens.add(normalized.replace(/^custom/, ""));
  }
  return [...tokens].filter(Boolean);
}

function getAnalysisTypeTokens(rawType) {
  const raw = String(rawType || "").trim();
  if (!raw) return [];
  const normalized = normalizeAiSystemToken(raw);
  const mapped = mapAiSystemTypeToIds(raw);
  if (mapped.length > 0) {
    return mapped.map((id) => normalizeAiSystemToken(id)).filter(Boolean);
  }
  return [normalized].filter(Boolean);
}


/**
 * Check if a UI system key matches an inspection analysis system type.
 * @param {string} systemKey - e.g. "roof", "heating", "custom-Solar-0"
 * @param {string} rawType - From analysis, e.g. "Roof", "HVAC"
 * @returns {boolean}
 */
export function matchesSystemForAnalysis(systemKey, rawType) {
  if (!systemKey || !rawType) return false;
  const keyTokens = getSystemKeyTokens(systemKey);
  const analysisTokens = getAnalysisTypeTokens(rawType);
  if (keyTokens.length === 0 || analysisTokens.length === 0) return false;
  return analysisTokens.some((analysisToken) =>
    keyTokens.some(
      (keyToken) =>
        keyToken === analysisToken ||
        keyToken.includes(analysisToken) ||
        analysisToken.includes(keyToken),
    ),
  );
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
      const st = n.systemType ?? n.system_type;
      return st && matchesSystemForAnalysis(systemType, st);
    }
  );
  const maintenanceSuggestions = (
    analysis.maintenanceSuggestions ?? analysis.maintenance_suggestions ?? []
  ).filter((m) => {
    const st = m.systemType ?? m.system_type;
    return st && matchesSystemForAnalysis(systemType, st);
  });
  return { needsAttention, maintenanceSuggestions };
}
