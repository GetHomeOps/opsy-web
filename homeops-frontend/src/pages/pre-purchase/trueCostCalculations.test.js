import {describe, expect, it} from "vitest";
import {
  buildDefaultRepairItems,
  buildDefaultTrueCostState,
  cashToClose,
  computeTrueCostMetrics,
  conditionAdjustedOffer,
  downPaymentAmount,
  downPaymentPercentFromAmount,
  fiveYearCashOutlay,
  formatCompactThousands,
  hydrateTrueCostState,
  loanAmount,
  monthlyPrincipalAndInterest,
  monthlyPropertyTax,
  offerSliderBounds,
  reconcileRepairItems,
  repairMidpoint,
  safeNumber,
  sumRepairsByTiming,
  toTrueCostPayload,
  trueCostToAcquire,
  trueMonthlyCost,
} from "./trueCostCalculations";

describe("safeNumber", () => {
  it("rejects NaN, Infinity, and negatives", () => {
    expect(safeNumber(NaN, 1)).toBe(1);
    expect(safeNumber(Infinity, 2)).toBe(2);
    expect(safeNumber(-5, 0)).toBe(0);
    expect(safeNumber(12.5)).toBe(12.5);
  });
});

describe("offerSliderBounds", () => {
  it("uses ~85%–105% of listing rounded to $10k", () => {
    expect(offerSliderBounds(699000, 675000)).toEqual({
      min: 590000,
      max: 730000,
    });
  });

  it("expands to include an offer outside the default range", () => {
    expect(offerSliderBounds(500000, 600000)).toEqual({
      min: 430000,
      max: 600000,
    });
  });

  it("falls back to offer or 500k when listing is missing", () => {
    expect(offerSliderBounds(null, 400000)).toEqual({
      min: 340000,
      max: 420000,
    });
    expect(offerSliderBounds(null, null)).toEqual({
      min: 430000,
      max: 530000,
    });
  });
});

describe("formatCompactThousands", () => {
  it("formats as $XXk", () => {
    expect(formatCompactThousands(600000)).toBe("$600k");
    expect(formatCompactThousands(720000)).toBe("$720k");
  });
});

describe("repairMidpoint", () => {
  it("uses midpoint of min/max range", () => {
    expect(repairMidpoint(1000, 3000)).toBe(2000);
  });

  it("falls back to single bound", () => {
    expect(repairMidpoint(1500, null)).toBe(1500);
    expect(repairMidpoint(null, 900)).toBe(900);
    expect(repairMidpoint(null, null)).toBe(0);
  });
});

describe("down payment sync", () => {
  it("computes amount from percent", () => {
    expect(downPaymentAmount(675000, 20)).toBe(135000);
  });

  it("computes percent from amount", () => {
    expect(downPaymentPercentFromAmount(675000, 135000)).toBe(20);
  });

  it("computes loan amount", () => {
    expect(loanAmount(675000, 135000)).toBe(540000);
  });
});

describe("monthlyPrincipalAndInterest", () => {
  it("matches standard fixed-rate mortgage", () => {
    // 540000 @ 6.5% for 30 years ≈ 3412.73
    const pi = monthlyPrincipalAndInterest(540000, 6.5, 30);
    expect(pi).toBeGreaterThan(3400);
    expect(pi).toBeLessThan(3430);
  });

  it("handles zero-interest loan", () => {
    expect(monthlyPrincipalAndInterest(120000, 0, 10)).toBe(1000);
  });

  it("returns 0 for empty loan", () => {
    expect(monthlyPrincipalAndInterest(0, 6.5, 30)).toBe(0);
  });
});

describe("true cost aggregates", () => {
  const items = [
    {
      kind: "finding",
      findingId: 1,
      included: true,
      timing: "immediate",
      estimatedCost: 2000,
    },
    {
      kind: "finding",
      findingId: 2,
      included: true,
      timing: "immediate",
      estimatedCost: 3000,
    },
    {
      kind: "finding",
      findingId: 3,
      included: true,
      timing: "deferred",
      estimatedCost: 8000,
    },
    {
      kind: "finding",
      findingId: 4,
      included: false,
      timing: "immediate",
      estimatedCost: 1000,
    },
  ];

  it("sums immediate and deferred included repairs", () => {
    expect(sumRepairsByTiming(items, "immediate")).toBe(5000);
    expect(sumRepairsByTiming(items, "deferred")).toBe(8000);
  });

  it("computes True Cost to Acquire", () => {
    expect(
      trueCostToAcquire({
        offerPrice: 675000,
        closingCosts: 20250,
        selectedImmediateRepairTotal: 5000,
        acquisitionBuffer: 2000,
      }),
    ).toBe(702250);
  });

  it("computes True Monthly Cost", () => {
    expect(
      trueMonthlyCost({
        monthlyPrincipalAndInterest: 3413,
        monthlyPropertyTax: 563,
        monthlyInsurance: 88,
        monthlyMaintenanceReserve: 563,
      }),
    ).toBe(4627);
  });

  it("computes condition-adjusted offer", () => {
    expect(conditionAdjustedOffer(675000, 7000)).toBe(668000);
  });

  it("computes cash to close and five-year outlay", () => {
    expect(
      cashToClose({
        downPaymentAmount: 135000,
        closingCosts: 20250,
        selectedImmediateRepairTotal: 5000,
        acquisitionBuffer: 0,
      }),
    ).toBe(160250);

    const five = fiveYearCashOutlay({
      downPaymentAmount: 135000,
      closingCosts: 20250,
      selectedImmediateRepairTotal: 5000,
      acquisitionBuffer: 0,
      trueMonthlyCost: 4626,
      deferredRepairTotal: 8000,
    });
    expect(five).toBe(135000 + 20250 + 5000 + 0 + 4626 * 60 + 8000);
  });

  it("computeTrueCostMetrics ties acquire total to composition parts", () => {
    const metrics = computeTrueCostMetrics({
      offerPrice: 675000,
      listingPrice: 699000,
      downPaymentPercent: 20,
      interestRate: 6.5,
      loanTermYears: 30,
      propertyTaxPercent: 1,
      insuranceMonthly: 88,
      closingCosts: 20250,
      maintenanceReservePercent: 1,
      maintenanceReserveEnabled: true,
      acquisitionBuffer: 0,
      repairs: {items},
    });

    expect(metrics.loanAmount).toBe(540000);
    expect(metrics.immediateRepairTotal).toBe(5000);
    expect(metrics.deferredRepairTotal).toBe(8000);
    expect(metrics.trueCostToAcquire).toBe(675000 + 20250 + 5000 + 0);
    expect(metrics.conditionAdjustedOffer).toBe(670000);
    expect(metrics.monthlyPropertyTax).toBe(monthlyPropertyTax(675000, 1));
    expect(metrics.takeaways.leverage).toBe(5000);
  });
});

describe("init and reconcile", () => {
  const findings = [
    {
      id: 10,
      urgency: "immediate",
      severity: "major",
      estimatedCostLow: 1000,
      estimatedCostHigh: 3000,
    },
    {
      id: 11,
      urgency: "near_term",
      severity: "moderate",
      estimatedCostLow: 400,
      estimatedCostHigh: 600,
    },
    {
      id: 12,
      urgency: "monitor",
      severity: "minor",
      estimatedCostLow: 100,
      estimatedCostHigh: 100,
    },
  ];

  it("builds default repair items from urgency", () => {
    const items = buildDefaultRepairItems(findings);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      kind: "finding",
      findingId: 10,
      timing: "immediate",
      included: true,
      severity: "major",
      estimatedCost: 2000,
    });
    expect(items[1].timing).toBe("deferred");
    expect(items[1].included).toBe(true);
    expect(items[1].severity).toBe("moderate");
    expect(items[2].timing).toBe("excluded");
    expect(items[2].included).toBe(false);
    expect(items[2].severity).toBe("minor");
  });

  it("seeds listing/offer from identity estimatedValue", () => {
    const state = buildDefaultTrueCostState({
      identityData: {estimatedValue: 699000},
      findings,
    });
    expect(state.listingPrice).toBe(699000);
    expect(state.offerPrice).toBe(699000);
    expect(state.closingCosts).toBe(round3pct(699000));
    expect(state.repairs.items).toHaveLength(3);
  });

  it("reconciles saved edits with new/removed findings", () => {
    const saved = [
      {
        kind: "finding",
        findingId: 10,
        included: false,
        timing: "deferred",
        severity: "minor",
        estimatedCost: 2500,
        note: "edited",
      },
      {
        kind: "custom",
        id: "c1",
        description: "Custom fence",
        included: true,
        timing: "immediate",
        severity: "moderate",
        estimatedCost: 800,
        note: null,
      },
      {
        kind: "finding",
        findingId: 99,
        included: true,
        timing: "immediate",
        estimatedCost: 1,
      },
    ];
    const nextFindings = [
      findings[0],
      findings[1],
      {
        id: 13,
        urgency: "immediate",
        severity: "major",
        estimatedCostLow: 500,
        estimatedCostHigh: 500,
      },
    ];
    const merged = reconcileRepairItems(saved, nextFindings);
    expect(merged.find((i) => i.findingId === 10)).toMatchObject({
      included: false,
      timing: "deferred",
      severity: "minor",
      estimatedCost: 2500,
      note: "edited",
    });
    expect(merged.find((i) => i.findingId === 99)).toBeUndefined();
    expect(merged.find((i) => i.findingId === 13)).toMatchObject({
      timing: "immediate",
      severity: "major",
      estimatedCost: 500,
      included: true,
    });
    expect(merged.find((i) => i.kind === "custom" && i.id === "c1")).toMatchObject({
      severity: "moderate",
    });
  });

  it("falls back to finding severity when saved item has none", () => {
    const saved = [
      {
        kind: "finding",
        findingId: 10,
        included: true,
        timing: "immediate",
        estimatedCost: 2000,
      },
    ];
    const merged = reconcileRepairItems(saved, [findings[0]]);
    expect(merged[0].severity).toBe("major");
  });

  it("hydrates and round-trips payload for save/restore", () => {
    const analysis = {
      identityData: {estimatedValue: 500000},
      findings,
    };
    const initial = buildDefaultTrueCostState(analysis);
    initial.offerPrice = 480000;
    initial.downPaymentPercent = 15;
    initial.acquisitionBuffer = 2500;
    initial.repairs.items[0].estimatedCost = 2222;

    const payload = toTrueCostPayload(initial);
    expect(payload.acquisitionBuffer).toBe(0);

    const restored = hydrateTrueCostState(
      {...payload, acquisitionBuffer: 2500, id: 1, analysisId: 9},
      analysis,
    );

    expect(restored.offerPrice).toBe(480000);
    expect(restored.downPaymentPercent).toBe(15);
    expect(restored.acquisitionBuffer).toBe(0);
    expect(restored.repairs.items[0].estimatedCost).toBe(2222);
    expect(restored.repairs.items).toHaveLength(3);
  });
});

function round3pct(n) {
  return Math.round(n * 0.03 * 100) / 100;
}
