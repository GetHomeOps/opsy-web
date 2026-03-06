/**
 * Helpers for matching system types to inspection analysis items.
 * Aligns with backend SYSTEM_ALIASES and CANONICAL_SYSTEMS.
 */

const SYSTEM_ALIASES = {
  hvac: ["heating", "ac"],
  "windows/doors": "windows",
  "water heater": "waterHeating",
  "gutters/drainage": "gutters",
  "fire safety": "safety",
  "air conditioning": "ac",
  "water heating": "waterHeating",
  exterior: "exterior",
  siding: "exterior",
};

const CANONICAL_IDS = [
  "roof",
  "gutters",
  "foundation",
  "exterior",
  "windows",
  "heating",
  "ac",
  "waterHeating",
  "electrical",
  "plumbing",
  "safety",
  "inspections",
];

function normalizeRawType(raw) {
  if (!raw || typeof raw !== "string") return null;
  const lower = raw.toLowerCase().trim().replace(/\s+/g, "");
  for (const [alias, canonical] of Object.entries(SYSTEM_ALIASES)) {
    const aliasNorm = alias.toLowerCase().replace(/\s+/g, "");
    if (lower.includes(aliasNorm) || aliasNorm.includes(lower)) {
      return Array.isArray(canonical) ? canonical : [canonical];
    }
  }
  const matched = CANONICAL_IDS.find((s) => lower.includes(s) || s.includes(lower));
  return matched ? [matched] : null;
}


/**
 * Check if a UI system key matches an inspection analysis system type.
 * @param {string} systemKey - e.g. "roof", "heating", "custom-Solar-0"
 * @param {string} rawType - From analysis, e.g. "Roof", "HVAC"
 * @returns {boolean}
 */
export function matchesSystemForAnalysis(systemKey, rawType) {
  if (!systemKey || !rawType) return false;
  const key = String(systemKey).toLowerCase().replace(/-/g, "");
  const norm = normalizeRawType(rawType);
  if (!norm) return false;
  const normArr = Array.isArray(norm) ? norm : [norm];
  return normArr.some((n) => {
    const nLower = String(n).toLowerCase();
    return key === nLower || key.includes(nLower) || nLower.includes(key);
  });
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
