"use strict";

/**
 * Deterministic Opsy Scout property-condition scoring.
 *
 * Final score = interpolated repair-burden baseline + clamped inspection
 * modifiers, with optional safety caps. Finding counts are never an input.
 */

const UNKNOWN_BASELINE = 80;

const RELATIVE_ANCHORS = [
  [0.0, 100],
  [0.005, 95],
  [0.01, 90],
  [0.02, 85],
  [0.04, 78],
  [0.07, 70],
  [0.1, 63],
  [0.15, 55],
  [0.2, 47],
  [0.3, 37],
  [0.4, 25],
  [0.55, 0],
];

const ABSOLUTE_ANCHORS = [
  [0, 100],
  [2500, 95],
  [5000, 90],
  [10000, 85],
  [20000, 78],
  [35000, 70],
  [50000, 63],
  [75000, 55],
  [100000, 47],
  [150000, 37],
  [250000, 22],
  [400000, 0],
];

const MODIFIER_KEYS = [
  "structuralModifier",
  "safetyModifier",
  "waterDamageModifier",
  "majorSystemsModifier",
  "habitabilityModifier",
  "positiveConditionModifier",
];

const MODIFIER_RANGES = {
  structuralModifier: [-20, 3],
  safetyModifier: [-10, 3],
  waterDamageModifier: [-10, 3],
  majorSystemsModifier: [-12, 5],
  habitabilityModifier: [-20, 3],
  positiveConditionModifier: [0, 5],
};

const SCORING_METHODS = {
  RELATIVE: "relative_repair_burden",
  ABSOLUTE: "absolute_repair_cost",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toPositiveNumber(value) {
  const n = toFiniteNumber(value);
  return n != null && n > 0 ? n : null;
}

function round2(value) {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Piecewise-linear interpolation through monotonic (x, y) anchors.
 * x at or below the first anchor returns that y; x at or above the last
 * returns that y. Identical x always yields the same y.
 */
function interpolateAnchors(x, anchors) {
  const n = toFiniteNumber(x);
  if (n == null || !Array.isArray(anchors) || anchors.length === 0) return null;
  if (n <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (n >= last[0]) return last[1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (n <= x1) {
      if (x1 === x0) return y1;
      const t = (n - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

function midRepairCost(repairCostLow, repairCostHigh) {
  const low = toFiniteNumber(repairCostLow);
  const high = toFiniteNumber(repairCostHigh);
  const hasLow = low != null;
  const hasHigh = high != null;
  if (hasLow && hasHigh) return (low + high) / 2;
  if (hasHigh) return high;
  if (hasLow) return low;
  return null;
}

function scoreToRating(score) {
  if (score == null || !Number.isFinite(Number(score))) return "unknown";
  const n = Number(score);
  if (n >= 90) return "excellent";
  if (n >= 80) return "very_good";
  if (n >= 70) return "good";
  if (n >= 60) return "fair";
  if (n >= 50) return "needs_attention";
  if (n >= 35) return "poor";
  return "critical";
}

function emptyBreakdown() {
  return {
    structuralModifier: 0,
    safetyModifier: 0,
    waterDamageModifier: 0,
    majorSystemsModifier: 0,
    habitabilityModifier: 0,
    positiveConditionModifier: 0,
  };
}

function clampModifierField(key, value) {
  const n = toFiniteNumber(value);
  const [min, max] = MODIFIER_RANGES[key] || [-20, 10];
  if (n == null) return 0;
  return clamp(n, min, max);
}

function truthyFlag(value) {
  return value === true || value === "true" || value === 1;
}

function normalizeModifiers(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const breakdown = emptyBreakdown();
  for (const key of MODIFIER_KEYS) {
    breakdown[key] = clampModifierField(key, source[key]);
  }
  const rawTotal = MODIFIER_KEYS.reduce((sum, key) => sum + breakdown[key], 0);
  const flags = {
    exceptionalCircumstances: truthyFlag(source.exceptionalCircumstances),
    exceptionalReason:
      source.exceptionalReason == null || source.exceptionalReason === ""
        ? null
        : String(source.exceptionalReason),
    unsafeOccupancy: truthyFlag(source.unsafeOccupancy),
    significantStructuralFailure: truthyFlag(source.significantStructuralFailure),
  };
  const reasoning = Array.isArray(source.reasoning)
    ? source.reasoning.map((r) => String(r)).filter(Boolean)
    : [];
  return { breakdown, rawTotal, flags, reasoning };
}

function hasExceptionalEvidence(breakdown, flags) {
  return (
    breakdown.structuralModifier <= -10 ||
    breakdown.safetyModifier <= -8 ||
    breakdown.waterDamageModifier <= -8 ||
    breakdown.habitabilityModifier <= -8 ||
    flags.unsafeOccupancy === true ||
    flags.significantStructuralFailure === true
  );
}

function clampTotalModifier(rawTotal, exceptional) {
  if (exceptional) return clamp(rawTotal, -30, 10);
  return clamp(rawTotal, -10, 10);
}

function applySafetyCaps(score, breakdown, flags) {
  let capped = score;
  const capsApplied = [];
  if (flags.unsafeOccupancy && breakdown.habitabilityModifier <= -8) {
    capped = Math.min(capped, 35);
    capsApplied.push("unsafe_occupancy");
  }
  if (flags.significantStructuralFailure && breakdown.structuralModifier <= -10) {
    capped = Math.min(capped, 40);
    capsApplied.push("significant_structural_failure");
  }
  return { score: capped, capsApplied };
}

/**
 * Compute the Scout overall condition score.
 *
 * @param {object} [input]
 * @param {number|null} [input.repairCostLow]
 * @param {number|null} [input.repairCostHigh]
 * @param {number|null} [input.estimatedPropertyValue]
 * @param {object|null} [input.modifiers] raw AI modifier payload
 * @returns {{
 *   finalScore: number,
 *   rating: string,
 *   baselineScore: number,
 *   totalModifier: number,
 *   audit: object
 * }}
 */
function computeOverallConditionScore({
  repairCostLow = null,
  repairCostHigh = null,
  estimatedPropertyValue = null,
  modifiers = null,
} = {}) {
  const repairMidpoint = midRepairCost(repairCostLow, repairCostHigh);
  const propertyValue = toPositiveNumber(estimatedPropertyValue);

  let baselineScore;
  let scoringMethod;
  let repairBurdenPct = null;

  if (repairMidpoint == null) {
    baselineScore = UNKNOWN_BASELINE;
    scoringMethod = SCORING_METHODS.ABSOLUTE;
  } else if (propertyValue != null) {
    repairBurdenPct = repairMidpoint / propertyValue;
    baselineScore = interpolateAnchors(repairBurdenPct, RELATIVE_ANCHORS);
    scoringMethod = SCORING_METHODS.RELATIVE;
  } else {
    baselineScore = interpolateAnchors(repairMidpoint, ABSOLUTE_ANCHORS);
    scoringMethod = SCORING_METHODS.ABSOLUTE;
  }

  const parsed = normalizeModifiers(modifiers);
  const exceptionalHonored =
    parsed.flags.exceptionalCircumstances &&
    hasExceptionalEvidence(parsed.breakdown, parsed.flags);
  const totalModifier = clampTotalModifier(parsed.rawTotal, exceptionalHonored);

  const uncapped = baselineScore + totalModifier;
  const { score: capped, capsApplied } = applySafetyCaps(
    uncapped,
    parsed.breakdown,
    parsed.flags
  );
  const finalScore = Math.round(clamp(capped, 0, 100));
  const rating = scoreToRating(finalScore);

  const audit = {
    finalScore,
    baselineScore: round2(baselineScore),
    repairLow: toFiniteNumber(repairCostLow),
    repairHigh: toFiniteNumber(repairCostHigh),
    repairMidpoint: round2(repairMidpoint),
    estimatedPropertyValue: propertyValue,
    repairBurdenPct: round2(repairBurdenPct),
    totalModifier: round2(totalModifier),
    modifierBreakdown: parsed.breakdown,
    scoringMethod,
    capsApplied,
    exceptionalHonored,
    reasoning: parsed.reasoning,
  };

  return {
    finalScore,
    rating,
    baselineScore: audit.baselineScore,
    totalModifier: audit.totalModifier,
    audit,
  };
}

module.exports = {
  RELATIVE_ANCHORS,
  ABSOLUTE_ANCHORS,
  UNKNOWN_BASELINE,
  SCORING_METHODS,
  interpolateAnchors,
  midRepairCost,
  scoreToRating,
  normalizeModifiers,
  hasExceptionalEvidence,
  clampTotalModifier,
  applySafetyCaps,
  computeOverallConditionScore,
};
