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
    if (lower.includes(aliasNorm) || aliasNorm.includes(lower)) {
      return Array.isArray(canonical) ? canonical[0] : canonical;
    }
  }
  const canonical = CANONICAL_SYSTEMS.find((s) => lower.includes(s) || s.includes(lower));
  if (canonical) return canonical;
  return raw.trim() || null;
}

module.exports = {
  CANONICAL_SYSTEMS,
  EXCLUDED_SYSTEMS,
  SYSTEM_ALIASES,
  isExcludedSystem,
  normalizeSystemType,
};
