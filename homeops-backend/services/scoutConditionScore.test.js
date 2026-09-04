"use strict";

/**
 * Scout condition scoring.
 * Run: node services/scoutConditionScore.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  RELATIVE_ANCHORS,
  ABSOLUTE_ANCHORS,
  interpolateAnchors,
  midRepairCost,
  scoreToRating,
  clampTotalModifier,
  computeOverallConditionScore,
} = require("./scoutConditionScore");

function score(input) {
  return computeOverallConditionScore(input);
}

describe("interpolation", () => {
  it("returns exact anchor values", () => {
    assert.equal(interpolateAnchors(0, RELATIVE_ANCHORS), 100);
    assert.equal(interpolateAnchors(0.005, RELATIVE_ANCHORS), 95);
    assert.equal(interpolateAnchors(0.04, RELATIVE_ANCHORS), 78);
    assert.equal(interpolateAnchors(0, ABSOLUTE_ANCHORS), 100);
    assert.equal(interpolateAnchors(20000, ABSOLUTE_ANCHORS), 78);
  });

  it("is continuous across bucket boundaries", () => {
    const a = interpolateAnchors(0.0399, RELATIVE_ANCHORS);
    const b = interpolateAnchors(0.0401, RELATIVE_ANCHORS);
    assert.ok(Math.abs(a - b) < 0.2, `expected tiny gap, got ${a} vs ${b}`);
    assert.ok(a > b);
  });

  it("is strictly non-increasing as repair burden rises", () => {
    let prev = 100;
    for (let pct = 0; pct <= 0.55; pct += 0.002) {
      const y = interpolateAnchors(pct, RELATIVE_ANCHORS);
      assert.ok(y <= prev + 1e-9, `rose from ${prev} to ${y} at ${pct}`);
      prev = y;
    }
    prev = 100;
    for (let usd = 0; usd <= 400000; usd += 2500) {
      const y = interpolateAnchors(usd, ABSOLUTE_ANCHORS);
      assert.ok(y <= prev + 1e-9, `rose from ${prev} to ${y} at $${usd}`);
      prev = y;
    }
  });

  it("is deterministic for identical inputs", () => {
    const first = interpolateAnchors(0.045, RELATIVE_ANCHORS);
    const second = interpolateAnchors(0.045, RELATIVE_ANCHORS);
    assert.equal(first, second);
  });
});

describe("scoreToRating", () => {
  it("maps all seven bands", () => {
    assert.equal(scoreToRating(100), "excellent");
    assert.equal(scoreToRating(90), "excellent");
    assert.equal(scoreToRating(89), "very_good");
    assert.equal(scoreToRating(80), "very_good");
    assert.equal(scoreToRating(79), "good");
    assert.equal(scoreToRating(70), "good");
    assert.equal(scoreToRating(69), "fair");
    assert.equal(scoreToRating(60), "fair");
    assert.equal(scoreToRating(59), "needs_attention");
    assert.equal(scoreToRating(50), "needs_attention");
    assert.equal(scoreToRating(49), "poor");
    assert.equal(scoreToRating(35), "poor");
    assert.equal(scoreToRating(34), "critical");
    assert.equal(scoreToRating(0), "critical");
    assert.equal(scoreToRating(null), "unknown");
  });
});

describe("midRepairCost", () => {
  it("averages low and high", () => {
    assert.equal(midRepairCost(15000, 30000), 22500);
  });

  it("uses a one-sided bound when the other is missing", () => {
    assert.equal(midRepairCost(15000, null), 15000);
    assert.equal(midRepairCost(null, 30000), 30000);
    assert.equal(midRepairCost(null, null), null);
  });
});

describe("scenario A — excellent", () => {
  it("scores approximately 90+ for a small repair package on a $600k home", () => {
    const result = score({
      repairCostLow: 2000,
      repairCostHigh: 4000,
      estimatedPropertyValue: 600000,
    });
    assert.ok(result.finalScore >= 90, `expected 90+, got ${result.finalScore}`);
    assert.equal(result.rating, "excellent");
    assert.equal(result.audit.scoringMethod, "relative_repair_burden");
  });
});

describe("scenario B — typical deferred maintenance", () => {
  it("lands roughly 68–80 for $15k–$30k on a $500k home", () => {
    const result = score({
      repairCostLow: 15000,
      repairCostHigh: 30000,
      estimatedPropertyValue: 500000,
    });
    assert.ok(
      result.finalScore >= 68 && result.finalScore <= 80,
      `expected 68–80, got ${result.finalScore}`
    );
    assert.equal(result.rating, "good");
  });
});

describe("scenario C — same repair cost, serious structural concern", () => {
  it("scores materially lower than scenario B", () => {
    const typical = score({
      repairCostLow: 15000,
      repairCostHigh: 30000,
      estimatedPropertyValue: 500000,
    });
    const structural = score({
      repairCostLow: 15000,
      repairCostHigh: 30000,
      estimatedPropertyValue: 500000,
      modifiers: {
        structuralModifier: -15,
        exceptionalCircumstances: true,
        exceptionalReason: "Significant foundation movement noted in the report.",
        significantStructuralFailure: true,
        reasoning: ["Active foundation cracking beyond repair-cost impact."],
      },
    });
    assert.ok(
      structural.finalScore <= typical.finalScore - 8,
      `expected a material drop from ${typical.finalScore}, got ${structural.finalScore}`
    );
    assert.ok(structural.audit.exceptionalHonored);
  });
});

describe("scenario D — expensive but valuable home", () => {
  it("does not treat ~$40k of repairs on a $1.5M home as Poor", () => {
    const result = score({
      repairCostLow: 35000,
      repairCostHigh: 45000,
      estimatedPropertyValue: 1500000,
      modifiers: { majorSystemsModifier: 3, positiveConditionModifier: 2 },
    });
    assert.ok(result.finalScore >= 70, `expected 70+, got ${result.finalScore}`);
    assert.ok(
      result.rating === "good" ||
        result.rating === "very_good" ||
        result.rating === "excellent",
      `unexpected rating ${result.rating}`
    );
  });
});

describe("scenario E — low-value property", () => {
  it("scores substantially lower than the same $40k on a $1.5M home", () => {
    const expensiveHome = score({
      repairCostLow: 35000,
      repairCostHigh: 45000,
      estimatedPropertyValue: 1500000,
    });
    const lowValue = score({
      repairCostLow: 35000,
      repairCostHigh: 45000,
      estimatedPropertyValue: 200000,
    });
    assert.ok(
      lowValue.finalScore <= expensiveHome.finalScore - 20,
      `expected a large gap: high-value ${expensiveHome.finalScore} vs low-value ${lowValue.finalScore}`
    );
    assert.ok(lowValue.audit.repairBurdenPct >= 0.18);
  });
});

describe("scenario F — no property value", () => {
  it("uses absolute-dollar interpolation", () => {
    const result = score({
      repairCostLow: 15000,
      repairCostHigh: 30000,
    });
    assert.equal(result.audit.scoringMethod, "absolute_repair_cost");
    assert.equal(result.audit.estimatedPropertyValue, null);
    assert.ok(
      result.finalScore >= 70 && result.finalScore <= 80,
      `expected 70s for $22.5k midpoint, got ${result.finalScore}`
    );
  });

  it("uses the unknown baseline when no repair range is present", () => {
    const result = score({});
    assert.equal(result.finalScore, 80);
    assert.equal(result.audit.scoringMethod, "absolute_repair_cost");
    assert.equal(result.audit.repairMidpoint, null);
  });
});

describe("scenario G — many findings but inexpensive", () => {
  it("ignores finding count; a $5k midpoint stays high", () => {
    const result = score({
      repairCostLow: 4000,
      repairCostHigh: 6000,
      estimatedPropertyValue: 500000,
    });
    assert.ok(result.finalScore >= 85, `expected high score, got ${result.finalScore}`);
    assert.equal(result.audit.modifierBreakdown.structuralModifier, 0);
  });
});

describe("modifier limits", () => {
  it("clamps the total to ±10 without exceptional evidence", () => {
    assert.equal(clampTotalModifier(-18, false), -10);
    assert.equal(clampTotalModifier(14, false), 10);
  });

  it("does not honor exceptionalCircumstances based on finding volume", () => {
    const result = score({
      repairCostLow: 15000,
      repairCostHigh: 30000,
      estimatedPropertyValue: 500000,
      modifiers: {
        exceptionalCircumstances: true,
        exceptionalReason: "25+ inspection findings",
        majorSystemsModifier: -4,
        structuralModifier: -2,
      },
    });
    assert.equal(result.audit.exceptionalHonored, false);
    assert.ok(result.totalModifier >= -10);
    assert.ok(result.finalScore >= 65);
  });

  it("allows a larger downward adjustment when exceptional evidence is present", () => {
    const result = score({
      repairCostLow: 15000,
      repairCostHigh: 30000,
      estimatedPropertyValue: 500000,
      modifiers: {
        structuralModifier: -18,
        exceptionalCircumstances: true,
        significantStructuralFailure: true,
      },
    });
    assert.equal(result.audit.exceptionalHonored, true);
    assert.ok(result.totalModifier < -10);
  });
});

describe("safety caps", () => {
  it("does not cap on a vague unsafeOccupancy flag", () => {
    const result = score({
      repairCostLow: 2000,
      repairCostHigh: 4000,
      estimatedPropertyValue: 600000,
      modifiers: {
        unsafeOccupancy: true,
        habitabilityModifier: -2,
      },
    });
    assert.ok(result.finalScore > 35);
    assert.deepEqual(result.audit.capsApplied, []);
  });

  it("caps at 35 when occupancy is unsafe with a strong habitability modifier", () => {
    const result = score({
      repairCostLow: 2000,
      repairCostHigh: 4000,
      estimatedPropertyValue: 600000,
      modifiers: {
        unsafeOccupancy: true,
        habitabilityModifier: -12,
        exceptionalCircumstances: true,
      },
    });
    assert.ok(result.finalScore <= 35);
    assert.ok(result.audit.capsApplied.includes("unsafe_occupancy"));
  });

  it("caps at 40 for significant structural failure with a strong modifier", () => {
    const result = score({
      repairCostLow: 2000,
      repairCostHigh: 4000,
      estimatedPropertyValue: 600000,
      modifiers: {
        significantStructuralFailure: true,
        structuralModifier: -16,
        exceptionalCircumstances: true,
      },
    });
    assert.ok(result.finalScore <= 40);
    assert.ok(result.audit.capsApplied.includes("significant_structural_failure"));
  });
});

describe("final clamp and determinism", () => {
  it("clamps the published score to 0–100", () => {
    const result = score({
      repairCostLow: 500000,
      repairCostHigh: 800000,
      estimatedPropertyValue: 200000,
      modifiers: {
        structuralModifier: -20,
        safetyModifier: -10,
        exceptionalCircumstances: true,
        significantStructuralFailure: true,
        unsafeOccupancy: true,
        habitabilityModifier: -16,
      },
    });
    assert.ok(result.finalScore >= 0 && result.finalScore <= 100);
  });

  it("returns the same result for identical inputs", () => {
    const input = {
      repairCostLow: 15000,
      repairCostHigh: 30000,
      estimatedPropertyValue: 500000,
      modifiers: { majorSystemsModifier: -3 },
    };
    assert.deepEqual(score(input), score(input));
  });
});
