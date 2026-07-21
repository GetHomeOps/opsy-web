import {findingMidCost} from "./prePurchaseUtils";

/** Coerce to a finite non-negative number; invalid → fallback. */
export function safeNumber(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function roundMoney(value) {
  return Math.round(safeNumber(value) * 100) / 100;
}

export function repairMidpoint(low, high) {
  return findingMidCost({estimatedCostLow: low, estimatedCostHigh: high});
}

export function downPaymentAmount(offerPrice, downPaymentPercent) {
  return roundMoney(
    (safeNumber(offerPrice) * safeNumber(downPaymentPercent)) / 100,
  );
}

export function downPaymentPercentFromAmount(offerPrice, amount) {
  const offer = safeNumber(offerPrice);
  if (offer <= 0) return 0;
  return roundMoney((safeNumber(amount) / offer) * 100);
}

export function loanAmount(offerPrice, downPaymentAmt) {
  return roundMoney(Math.max(0, safeNumber(offerPrice) - safeNumber(downPaymentAmt)));
}

/**
 * Standard fixed-rate mortgage principal & interest.
 * Zero interest → straight-line principal / months.
 */
export function monthlyPrincipalAndInterest(
  loanAmt,
  annualInterestRate,
  loanTermYears,
) {
  const principal = safeNumber(loanAmt);
  const years = safeNumber(loanTermYears);
  const n = years * 12;
  if (principal <= 0 || n <= 0) return 0;

  const annual = safeNumber(annualInterestRate);
  if (annual === 0) return roundMoney(principal / n);

  const r = annual / 100 / 12;
  const factor = Math.pow(1 + r, n);
  if (!Number.isFinite(factor) || factor === 1) return roundMoney(principal / n);
  return roundMoney((principal * (r * factor)) / (factor - 1));
}

export function monthlyPropertyTax(offerPrice, propertyTaxPercent) {
  return roundMoney(
    (safeNumber(offerPrice) * safeNumber(propertyTaxPercent)) / 100 / 12,
  );
}

export function monthlyMaintenanceReserve(
  offerPrice,
  maintenanceReservePercent,
  enabled = true,
) {
  if (!enabled) return 0;
  return roundMoney(
    (safeNumber(offerPrice) * safeNumber(maintenanceReservePercent)) /
      100 /
      12,
  );
}

export function trueMonthlyCost({
  monthlyPrincipalAndInterest: pi,
  monthlyPropertyTax: tax,
  monthlyInsurance,
  monthlyMaintenanceReserve: reserve,
}) {
  return roundMoney(
    safeNumber(pi) +
      safeNumber(tax) +
      safeNumber(monthlyInsurance) +
      safeNumber(reserve),
  );
}

/** PITI without maintenance reserve (list affordability baseline). */
export function monthlyPiti({
  monthlyPrincipalAndInterest: pi,
  monthlyPropertyTax: tax,
  monthlyInsurance,
}) {
  return roundMoney(
    safeNumber(pi) + safeNumber(tax) + safeNumber(monthlyInsurance),
  );
}

export function trueCostToAcquire({
  offerPrice,
  closingCosts,
  selectedImmediateRepairTotal,
  acquisitionBuffer,
}) {
  return roundMoney(
    safeNumber(offerPrice) +
      safeNumber(closingCosts) +
      safeNumber(selectedImmediateRepairTotal) +
      safeNumber(acquisitionBuffer),
  );
}

export function cashToClose({
  downPaymentAmount: dp,
  closingCosts,
  selectedImmediateRepairTotal,
  acquisitionBuffer,
}) {
  return roundMoney(
    safeNumber(dp) +
      safeNumber(closingCosts) +
      safeNumber(selectedImmediateRepairTotal) +
      safeNumber(acquisitionBuffer),
  );
}

export function fiveYearCashOutlay({
  downPaymentAmount: dp,
  closingCosts,
  selectedImmediateRepairTotal,
  acquisitionBuffer,
  trueMonthlyCost: monthly,
  deferredRepairTotal,
}) {
  return roundMoney(
    safeNumber(dp) +
      safeNumber(closingCosts) +
      safeNumber(selectedImmediateRepairTotal) +
      safeNumber(acquisitionBuffer) +
      safeNumber(monthly) * 60 +
      safeNumber(deferredRepairTotal),
  );
}

export function conditionAdjustedOffer(offerPrice, selectedImmediateRepairTotal) {
  return roundMoney(
    Math.max(0, safeNumber(offerPrice) - safeNumber(selectedImmediateRepairTotal)),
  );
}

export function priceVsAsk(offerPrice, listingPrice) {
  const offer = safeNumber(offerPrice);
  const list = safeNumber(listingPrice);
  if (list <= 0 && offer <= 0) {
    return {delta: 0, belowAsk: 0, aboveAsk: 0};
  }
  const delta = roundMoney(offer - list);
  return {
    delta,
    belowAsk: delta < 0 ? Math.abs(delta) : 0,
    aboveAsk: delta > 0 ? delta : 0,
  };
}

/** Sum costs for included items with a given timing. */
export function sumRepairsByTiming(items = [], timing) {
  return roundMoney(
    items
      .filter((i) => i.included && i.timing === timing)
      .reduce((sum, i) => sum + safeNumber(i.estimatedCost), 0),
  );
}

export function sumIncludedRepairs(items = []) {
  return roundMoney(
    items
      .filter((i) => i.included && i.timing !== "excluded")
      .reduce((sum, i) => sum + safeNumber(i.estimatedCost), 0),
  );
}

export function buildAgentTakeaways({
  trueMonthly,
  pitiOnly,
  selectedImmediateRepairTotal,
}) {
  const affordabilityDelta = roundMoney(
    safeNumber(trueMonthly) - safeNumber(pitiOnly),
  );
  const leverage = roundMoney(selectedImmediateRepairTotal);
  return {
    affordabilityImpact:
      affordabilityDelta > 0
        ? `True Monthly Cost is ${formatUsd(affordabilityDelta)}/mo more than the list PITI alone.`
        : affordabilityDelta < 0
          ? `True Monthly Cost is ${formatUsd(Math.abs(affordabilityDelta))}/mo less than the list PITI alone.`
          : "True Monthly Cost matches the list PITI alone.",
    inspectionLeverage:
      leverage > 0
        ? `${formatUsd(leverage)} in must-fix repairs before close.`
        : "No must-fix repairs selected before close.",
    suggestedNextStep:
      leverage > 0
        ? `Consider a ${formatUsd(leverage)} credit or price adjustment.`
        : "No repair-based credit suggested at this time.",
    affordabilityDelta,
    leverage,
  };
}

function formatUsd(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(safeNumber(n));
}

const TIMINGS = new Set(["immediate", "deferred", "excluded"]);

export function defaultTimingFromUrgency(urgency) {
  if (urgency === "immediate") return "immediate";
  if (urgency === "near_term" || urgency === "long_term") return "deferred";
  return "excluded";
}

export function defaultIncludedFromTiming(timing) {
  return timing === "immediate" || timing === "deferred";
}

/** Build default repair items from analysis findings. */
export function buildDefaultRepairItems(findings = []) {
  return findings.map((f) => {
    const timing = defaultTimingFromUrgency(f.urgency);
    return {
      kind: "finding",
      findingId: f.id,
      included: defaultIncludedFromTiming(timing),
      timing,
      estimatedCost: roundMoney(findingMidCost(f)),
      note: null,
    };
  });
}

/**
 * Merge saved repair overrides with current findings.
 * Keeps user edits; adds new findings; drops deleted findings.
 */
export function reconcileRepairItems(savedItems = [], findings = []) {
  const findingById = new Map(findings.map((f) => [Number(f.id), f]));
  const savedFinding = new Map();
  const customs = [];

  for (const item of savedItems) {
    if (item?.kind === "custom") {
      customs.push({...item});
      continue;
    }
    if (item?.kind === "finding" && item.findingId != null) {
      savedFinding.set(Number(item.findingId), item);
    }
  }

  const reconciled = [];
  for (const f of findings) {
    const id = Number(f.id);
    const existing = savedFinding.get(id);
    if (existing) {
      reconciled.push({
        kind: "finding",
        findingId: id,
        included: Boolean(existing.included),
        timing: TIMINGS.has(existing.timing)
          ? existing.timing
          : defaultTimingFromUrgency(f.urgency),
        estimatedCost: roundMoney(safeNumber(existing.estimatedCost, findingMidCost(f))),
        note: existing.note ?? null,
      });
    } else {
      const timing = defaultTimingFromUrgency(f.urgency);
      reconciled.push({
        kind: "finding",
        findingId: id,
        included: defaultIncludedFromTiming(timing),
        timing,
        estimatedCost: roundMoney(findingMidCost(f)),
        note: null,
      });
    }
  }

  return [...reconciled, ...customs];
}

export function seedListingPrice(analysis) {
  const raw =
    analysis?.identityData?.estimatedValue ??
    analysis?.identity_data?.estimatedValue ??
    null;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? roundMoney(n) : null;
}

/** Round to nearest $10,000 for offer slider bounds / labels. */
export function roundToNearest10k(value) {
  return Math.round(safeNumber(value) / 10000) * 10000;
}

/**
 * Offer-price slider range from listing (~85%–105%), expanded to include
 * the current offer when it falls outside.
 */
export function offerSliderBounds(listingPrice, offerPrice) {
  const anchor = safeNumber(listingPrice) || safeNumber(offerPrice) || 500000;
  let min = roundToNearest10k(anchor * 0.85);
  let max = roundToNearest10k(anchor * 1.05);
  const offer = safeNumber(offerPrice);
  if (offer > 0) {
    min = Math.min(min, Math.floor(offer / 10000) * 10000);
    max = Math.max(max, Math.ceil(offer / 10000) * 10000);
  }
  if (min < 0) min = 0;
  if (min >= max) max = min + 100000;
  return {min, max};
}

/** Compact dollar label for slider ends, e.g. 600000 → "$600k". */
export function formatCompactThousands(value) {
  const k = Math.round(safeNumber(value) / 1000);
  return `$${k.toLocaleString("en-US")}k`;
}

export function buildDefaultTrueCostState(analysis) {
  const listingPrice = seedListingPrice(analysis);
  const offerPrice = listingPrice;
  const closingCosts =
    offerPrice != null ? roundMoney(safeNumber(offerPrice) * 0.03) : 0;

  return {
    listingPrice,
    offerPrice,
    downPaymentPercent: 20,
    interestRate: 6.5,
    loanTermYears: 30,
    propertyTaxPercent: 1,
    insuranceMonthly: 0,
    closingCosts,
    maintenanceReservePercent: 1,
    maintenanceReserveEnabled: true,
    acquisitionBuffer: 0,
    repairs: {items: buildDefaultRepairItems(analysis?.findings || [])},
  };
}

/** Compute all derived True Cost figures from inputs + repair items. */
export function computeTrueCostMetrics(inputs) {
  const offerPrice = safeNumber(inputs.offerPrice);
  const listingPrice = safeNumber(inputs.listingPrice);
  const downPct = safeNumber(inputs.downPaymentPercent);
  const dp = downPaymentAmount(offerPrice, downPct);
  const loan = loanAmount(offerPrice, dp);
  const pi = monthlyPrincipalAndInterest(
    loan,
    inputs.interestRate,
    inputs.loanTermYears,
  );
  const tax = monthlyPropertyTax(offerPrice, inputs.propertyTaxPercent);
  const insurance = safeNumber(inputs.insuranceMonthly);
  const reserve = monthlyMaintenanceReserve(
    offerPrice,
    inputs.maintenanceReservePercent,
    inputs.maintenanceReserveEnabled !== false,
  );
  const items = inputs.repairs?.items || inputs.repairItems || [];
  const immediate = sumRepairsByTiming(items, "immediate");
  const deferred = sumRepairsByTiming(items, "deferred");
  const includedTotal = sumIncludedRepairs(items);
  const monthly = trueMonthlyCost({
    monthlyPrincipalAndInterest: pi,
    monthlyPropertyTax: tax,
    monthlyInsurance: insurance,
    monthlyMaintenanceReserve: reserve,
  });
  const piti = monthlyPiti({
    monthlyPrincipalAndInterest: pi,
    monthlyPropertyTax: tax,
    monthlyInsurance: insurance,
  });
  const acquire = trueCostToAcquire({
    offerPrice,
    closingCosts: inputs.closingCosts,
    selectedImmediateRepairTotal: immediate,
    acquisitionBuffer: inputs.acquisitionBuffer,
  });
  const cash = cashToClose({
    downPaymentAmount: dp,
    closingCosts: inputs.closingCosts,
    selectedImmediateRepairTotal: immediate,
    acquisitionBuffer: inputs.acquisitionBuffer,
  });
  const fiveYear = fiveYearCashOutlay({
    downPaymentAmount: dp,
    closingCosts: inputs.closingCosts,
    selectedImmediateRepairTotal: immediate,
    acquisitionBuffer: inputs.acquisitionBuffer,
    trueMonthlyCost: monthly,
    deferredRepairTotal: deferred,
  });
  const adjusted = conditionAdjustedOffer(offerPrice, immediate);
  const vsAsk = priceVsAsk(offerPrice, listingPrice);
  const takeaways = buildAgentTakeaways({
    trueMonthly: monthly,
    pitiOnly: piti,
    selectedImmediateRepairTotal: immediate,
  });

  return {
    downPaymentAmount: dp,
    loanAmount: loan,
    monthlyPrincipalAndInterest: pi,
    monthlyPropertyTax: tax,
    monthlyInsurance: insurance,
    monthlyMaintenanceReserve: reserve,
    trueMonthlyCost: monthly,
    monthlyPiti: piti,
    immediateRepairTotal: immediate,
    deferredRepairTotal: deferred,
    includedRepairTotal: includedTotal,
    trueCostToAcquire: acquire,
    cashToClose: cash,
    fiveYearCashOutlay: fiveYear,
    conditionAdjustedOffer: adjusted,
    priceVsAsk: vsAsk,
    takeaways,
  };
}

/** Payload shape for PUT /true-cost */
export function toTrueCostPayload(state) {
  return {
    listingPrice: state.listingPrice == null ? null : safeNumber(state.listingPrice),
    offerPrice: state.offerPrice == null ? null : safeNumber(state.offerPrice),
    downPaymentPercent: safeNumber(state.downPaymentPercent, 20),
    interestRate: safeNumber(state.interestRate, 6.5),
    loanTermYears: Math.round(safeNumber(state.loanTermYears, 30)) || 30,
    propertyTaxPercent: safeNumber(state.propertyTaxPercent, 1),
    insuranceMonthly: safeNumber(state.insuranceMonthly, 0),
    closingCosts: safeNumber(state.closingCosts, 0),
    maintenanceReservePercent: safeNumber(state.maintenanceReservePercent, 1),
    maintenanceReserveEnabled: state.maintenanceReserveEnabled !== false,
    // Buffer field removed from UI; always persist 0 so stale values do not affect totals.
    acquisitionBuffer: 0,
    repairs: {
      items: (state.repairs?.items || []).map((item) => {
        if (item.kind === "custom") {
          return {
            kind: "custom",
            id: String(item.id),
            description: String(item.description || "").trim(),
            included: Boolean(item.included),
            timing: item.timing,
            estimatedCost: safeNumber(item.estimatedCost),
            note: item.note ?? null,
          };
        }
        return {
          kind: "finding",
          findingId: Number(item.findingId),
          included: Boolean(item.included),
          timing: item.timing,
          estimatedCost: safeNumber(item.estimatedCost),
          note: item.note ?? null,
        };
      }),
    },
  };
}

export function hydrateTrueCostState(saved, analysis) {
  const defaults = buildDefaultTrueCostState(analysis);
  if (!saved) return defaults;

  const items = reconcileRepairItems(
    saved.repairs?.items || [],
    analysis?.findings || [],
  );

  return {
    listingPrice:
      saved.listingPrice != null ? safeNumber(saved.listingPrice) : defaults.listingPrice,
    offerPrice:
      saved.offerPrice != null ? safeNumber(saved.offerPrice) : defaults.offerPrice,
    downPaymentPercent: safeNumber(saved.downPaymentPercent, defaults.downPaymentPercent),
    interestRate: safeNumber(saved.interestRate, defaults.interestRate),
    loanTermYears: Math.round(safeNumber(saved.loanTermYears, defaults.loanTermYears)),
    propertyTaxPercent: safeNumber(
      saved.propertyTaxPercent,
      defaults.propertyTaxPercent,
    ),
    insuranceMonthly: safeNumber(saved.insuranceMonthly, defaults.insuranceMonthly),
    closingCosts: safeNumber(saved.closingCosts, defaults.closingCosts),
    maintenanceReservePercent: safeNumber(
      saved.maintenanceReservePercent,
      defaults.maintenanceReservePercent,
    ),
    maintenanceReserveEnabled:
      saved.maintenanceReserveEnabled != null
        ? Boolean(saved.maintenanceReserveEnabled)
        : defaults.maintenanceReserveEnabled,
    acquisitionBuffer: 0,
    repairs: {items},
  };
}
