"use strict";

/**
 * Canonical system types and normalization utilities.
 *
 * Extracted into its own module so that any service can import these
 * without creating circular dependencies.
 */

const CANONICAL_SYSTEMS = [
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
];

const EXCLUDED_SYSTEMS = new Set([
  "appliances",
  "appliance",
  "dishwasher",
  "refrigerator",
  "oven",
  "stove",
  "washer",
  "dryer",
  "microwave",
  "garbage disposal",
  "inspections",
  "inspection",
  "general",
]);

function isExcludedSystem(systemType) {
  if (!systemType || typeof systemType !== "string") return false;
  const key = systemType.toLowerCase().trim().replace(/\s+/g, "");
  return EXCLUDED_SYSTEMS.has(key) || key.includes("appliance");
}

/** Map common AI-generated variants back to canonical types. */
const SYSTEM_ALIASES = {
  hvac: ["heating", "ac"],
  "windows/doors": "windows",
  "water heater": "waterHeating",
  "gutters/drainage": "gutters",
  "fire safety": "safety",
  "air conditioning": "ac",
  "water heating": "waterHeating",
  structure: "foundation",
  structural: "foundation",
  framing: "foundation",
  "foundation/structure": "foundation",
  "foundation & structure": "foundation",
  "fuel storage": "heating",
  "fuel tank": "heating",
  "oil tank": "heating",
  garage: "exterior",
  "garage door": "exterior",
  attic: "exterior",
  insulation: "exterior",
  "crawl space": "foundation",
  basement: "foundation",
  fireplace: "heating",
  chimney: "heating",
  "smoke detectors": "safety",
  "co detectors": "safety",
  ventilation: "ac",
};

function normalizeSystemType(raw) {
  if (!raw || typeof raw !== "string") return null;
  const lower = raw.toLowerCase().trim().replace(/\s+/g, "");
  for (const [alias, canonical] of Object.entries(SYSTEM_ALIASES)) {
    const aliasNorm = alias.toLowerCase().replace(/\s+/g, "");
    // Require the input to contain the full alias (not the reverse — "heating" must not match "waterheating").
    if (lower === aliasNorm || (aliasNorm.length <= lower.length && lower.includes(aliasNorm))) {
      return Array.isArray(canonical) ? canonical[0] : canonical;
    }
  }
  const exact = CANONICAL_SYSTEMS.find((s) => lower === s.toLowerCase());
  if (exact) return exact;
  // Prefer longer ids when the input contains a full canonical token (e.g. "waterheater" → waterHeating).
  const canonical = [...CANONICAL_SYSTEMS]
    .sort((a, b) => b.length - a.length)
    .find((s) => {
      const sLower = s.toLowerCase();
      return lower.includes(sLower);
    });
  if (canonical) return canonical;
  return raw.trim() || null;
}

/** Space-heating vs domestic hot water — common AI mix-up. */
const SPACE_HEATING_KEYWORDS =
  /\b(furnace|boiler|chimney|fireplace|flue|ductwork|heat pump|space heat|forced air)\b/i;
const WATER_HEATING_KEYWORDS =
  /\b(water heater|hot water|tankless water|tpr valve|anode rod|expansion tank)\b/i;

/**
 * Resolve the canonical system for a finding using text + declared systemType.
 * Corrects cases like furnace/chimney tasks tagged as waterHeating.
 */
function resolveFindingSystemType({
  systemType,
  title = "",
  task = "",
  suggestedAction = "",
  rationale = "",
  description = "",
} = {}) {
  const text = [title, task, suggestedAction, rationale, description]
    .filter(Boolean)
    .join(" ");
  const hasSpaceHeating = SPACE_HEATING_KEYWORDS.test(text);
  const hasWaterHeating = WATER_HEATING_KEYWORDS.test(text);

  const declared = normalizeSystemType(systemType) || systemType || null;

  // Correct common AI mis-tags (e.g. furnace tasks labeled waterHeating).
  if (hasSpaceHeating && !hasWaterHeating && declared === "waterHeating") {
    return "heating";
  }
  if (hasWaterHeating && !hasSpaceHeating && declared === "heating") {
    return "waterHeating";
  }

  return declared;
}

/** True when two system identifiers map to the same canonical system id. */
function canonicalSystemsMatch(systemKey, rawType) {
  if (!systemKey || !rawType) return false;
  const left = normalizeSystemType(systemKey);
  const right = normalizeSystemType(rawType);
  if (!left || !right) {
    const a = String(systemKey).trim().toLowerCase();
    const b = String(rawType).trim().toLowerCase();
    return a.length > 0 && a === b;
  }
  return left.toLowerCase() === right.toLowerCase();
}

module.exports = {
  CANONICAL_SYSTEMS,
  EXCLUDED_SYSTEMS,
  SYSTEM_ALIASES,
  isExcludedSystem,
  normalizeSystemType,
  resolveFindingSystemType,
  canonicalSystemsMatch,
};
