"use strict";

/**
 * Dashboard DTO composition — provenance and empty-state rules.
 * Run: node services/propertyFinancialsService.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { composeFromRow, buildInsights, mergePlausibilityFlags } = require("./propertyFinancialsCompose");
const { SOURCES } = require("./propertyFinancialsCalculations");
const {
  compactSnapshot,
  hasEnoughInsightData,
  normalizeAdviceAiResponse,
} = require("./ai/propertyFinancialsInsightAdvice");

describe("composeFromRow provenance", () => {
  it("labels AVM as estimated and never as public record", () => {
    const dto = composeFromRow({
      avm_value: 1180000,
      avm_date: "2026-04-01",
      mortgage_original_amount: 600000,
      mortgage_interest_rate: 5.25,
      mortgage_term_months: 360,
      mortgage_origination_date: "2018-05-01",
      attom_fetched_at: "2026-05-01T00:00:00Z",
    });
    assert.equal(dto.homeValue.source, SOURCES.ESTIMATED);
    assert.equal(dto.remainingMortgage.source, SOURCES.ESTIMATED);
    assert.equal(dto.equity.source, SOURCES.CALCULATED);
    assert.ok(dto.ltv.percent > 0);
    assert.ok(dto.equity.percent > 0);
    assert.notEqual(dto.ltv.percent, dto.equity.percent);
  });

  it("prefers verified current balance", () => {
    const dto = composeFromRow({
      avm_value: 1180000,
      mortgage_original_amount: 600000,
      verified_current_balance: 500000,
      mortgage_verified_at: "2026-05-01",
    });
    assert.equal(dto.remainingMortgage.value, 500000);
    assert.equal(dto.remainingMortgage.source, SOURCES.VERIFIED);
  });

  it("does not invent a next mortgage payment date from ATTOM maturity", () => {
    const dto = composeFromRow({
      mortgage_maturity_date: "2048-05-01",
      mortgage_original_amount: 600000,
    });
    assert.equal(dto.mortgage.nextPaymentDue, null);
    assert.equal(dto.mortgage.maturityDate, "2048-05-01");
  });

  it("does not fabricate tax due dates", () => {
    const dto = composeFromRow({
      annual_tax_amount: 7896,
      tax_year: 2025,
    });
    const taxOb = dto.obligations.find((o) => o.id === "tax");
    assert.equal(taxOb.date, null);
    assert.equal(taxOb.cadence, "annual");
  });

  it("does not treat missing AVM as assessed value", () => {
    const dto = composeFromRow({
      assessed_value: 980000,
      market_value: 1100000,
    });
    assert.equal(dto.homeValue, null);
    assert.equal(dto.assessedValue.value, 980000);
    assert.equal(dto.assessedValue.source, SOURCES.PUBLIC_RECORD);
  });

  it("prefers verified home value over ATTOM AVM", () => {
    const dto = composeFromRow({
      avm_value: 534111,
      avm_low: 500000,
      avm_high: 560000,
      verified_home_value: 610000,
      home_value_verified_at: "2026-08-01T00:00:00Z",
    });
    assert.equal(dto.homeValue.value, 610000);
    assert.equal(dto.homeValue.source, SOURCES.VERIFIED);
    assert.equal(dto.homeValueRange, null);
  });

  it("uses verified home value when ATTOM has no AVM", () => {
    const dto = composeFromRow({
      verified_home_value: 425000,
      home_value_verified_at: "2026-08-15T00:00:00Z",
      attom_fetched_at: "2026-08-15T00:00:00Z",
    });
    assert.equal(dto.homeValue.value, 425000);
    assert.equal(dto.homeValue.source, SOURCES.VERIFIED);
    assert.equal(dto.equity.amount, 425000);
  });

  it("shows empty mortgage when nothing is recorded", () => {
    const dto = composeFromRow({});
    assert.equal(dto.mortgage.hasRecordedMortgage, false);
    assert.equal(dto.remainingMortgage, null);
  });

  it("computes equity without labeling remaining mortgage as zero", () => {
    const dto = composeFromRow({
      avm_value: 500000,
      attom_fetched_at: "2026-05-01T00:00:00Z",
    });
    assert.equal(dto.remainingMortgage, null);
    assert.equal(dto.equity.amount, 500000);
    assert.equal(dto.equity.percent, 100);
    assert.equal(dto.ltv.percent, 0);
  });

  it("keeps AVM while leaving equity unknown when a mortgage cannot be amortized", () => {
    const dto = composeFromRow({
      avm_value: 534111,
      mortgage_original_amount: 256000,
      mortgage_lender: "TERRITORIAL SAVINGS BANK",
      mortgage_origination_date: "2005-06-17",
      attom_fetched_at: "2026-08-31T00:00:00Z",
    });
    assert.equal(dto.homeValue.value, 534111);
    assert.equal(dto.homeValue.source, SOURCES.ESTIMATED);
    assert.equal(dto.mortgage.hasRecordedMortgage, true);
    assert.equal(dto.remainingMortgage, null);
    assert.equal(dto.equity, null);
    assert.equal(dto.ltv, null);
  });
});

describe("insights", () => {
  it("only emits insights supported by data", () => {
    const none = buildInsights({});
    assert.ok(none.some((i) => i.id === "add-insurance"));
    assert.ok(!none.some((i) => i.id === "equity"));
    assert.ok(!none.some((i) => i.id === "refinance-position"));

    const withEquity = buildInsights({
      homeValue: 1180000,
      equityAmount: 642500,
      equityPercent: 54.4,
      ltv: 45.6,
    });
    assert.ok(withEquity.some((i) => i.id === "equity"));
    assert.ok(!withEquity.some((i) => i.id === "ltv"));
    assert.ok(!withEquity.some((i) => i.id === "refinance-position"));
  });

  it("suggests refinance or PMI when LTV is at or under 80% and a balance remains", () => {
    const insights = buildInsights({
      remainingBalance: 300000,
      ltv: 57.1,
    });
    const item = insights.find((i) => i.id === "refinance-position");
    assert.ok(item);
    assert.match(item.text, /57\.1%/);
    assert.match(item.text, /refinance|PMI/i);
  });

  it("mentions the 20% equity mark when LTV is above 80%", () => {
    const insights = buildInsights({
      remainingBalance: 400000,
      ltv: 88,
      equityPercent: 12,
    });
    const item = insights.find((i) => i.id === "refinance-position");
    assert.ok(item);
    assert.match(item.text, /20% equity/);
  });

  it("asks for rate and payment schedule when a balance exists without those details", () => {
    const insights = buildInsights({
      remainingBalance: 300000,
      ltv: 57.1,
    });
    assert.ok(insights.some((i) => i.id === "add-rate"));
    assert.ok(insights.some((i) => i.id === "add-payment-schedule"));
    assert.ok(!insights.some((i) => i.id === "payment-schedule"));
  });

  it("emits a next-payment insight when a due date is known", () => {
    const insights = buildInsights({
      remainingBalance: 300000,
      monthlyPayment: 1850,
      nextPaymentDue: "2026-09-15",
      paymentDueDay: 15,
      interestRate: 6.25,
    });
    const item = insights.find((i) => i.id === "payment-schedule");
    assert.ok(item);
    assert.match(item.text, /1,850/);
    assert.match(item.text, /Sep 15, 2026/);
    assert.ok(!insights.some((i) => i.id === "add-rate"));
    assert.ok(!insights.some((i) => i.id === "add-payment-schedule"));
  });

  it("skips value-since-purchase when the recorded sale is implausible vs the mortgage", () => {
    const dto = composeFromRow({
      avm_value: 534111,
      last_sale_price: 64100,
      last_sale_date: "2005-06-17",
      mortgage_original_amount: 256000,
      mortgage_origination_date: "2005-06-17",
      attom_fetched_at: "2026-08-31T00:00:00Z",
    });
    assert.equal(dto.ownership.lastSaleImplausible, true);
    assert.ok(!dto.insights.some((i) => i.id === "value-since-purchase"));
    assert.ok(dto.plausibilityFlags.some((f) => f.id === "sale-vs-mortgage"));
  });

  it("emits value-since-purchase for a plausible sale vs original loan", () => {
    const dto = composeFromRow({
      avm_value: 800000,
      last_sale_price: 720000,
      last_sale_date: "2018-05-01",
      mortgage_original_amount: 600000,
      mortgage_origination_date: "2018-05-01",
      attom_fetched_at: "2026-05-01T00:00:00Z",
    });
    assert.equal(dto.ownership.lastSaleImplausible, false);
    assert.ok(dto.insights.some((i) => i.id === "value-since-purchase"));
  });

  it("does not surface stored AI flags as insights", () => {
    const dto = composeFromRow({
      last_sale_price: 720000,
      last_sale_date: "2018-05-01",
      mortgage_original_amount: 600000,
      mortgage_origination_date: "2018-05-01",
      plausibility_flags: [
        { id: "tax-vs-value", field: "annual_tax_amount", message: "Tax looks high relative to value." },
      ],
    });
    assert.ok(dto.plausibilityFlags.some((f) => f.id === "tax-vs-value"));
    assert.ok(!dto.insights.some((i) => i.id === "flag-tax-vs-value"));
    assert.ok(!dto.insights.some((i) => i.text && i.text.includes("Tax looks high")));
  });

  it("merges stored AI advice into insights", () => {
    const dto = composeFromRow({
      avm_value: 525000,
      verified_current_balance: 300000,
      verified_interest_rate: 6.25,
      verified_monthly_payment: 1850,
      plausibility_flags: [
        { id: "compare-rate", kind: "advice", message: "With your rate and equity, it may be worth comparing refinance quotes." },
      ],
    });
    assert.ok(!dto.plausibilityFlags.some((f) => f.id === "compare-rate"));
    assert.ok(dto.insights.some((i) => i.id === "advice-compare-rate"));
  });
});

describe("insight advice gate", () => {
  it("rejects a sparse ATTOM snapshot with missing sale and zero original mortgage", () => {
    const dto = composeFromRow({
      avm_value: 525000,
      modeled_balance: 300000,
      mortgage_original_amount: 0,
      annual_tax_amount: 3543,
      tax_year: 2025,
      attom_fetched_at: "2026-08-31T00:00:00Z",
    });
    const snapshot = compactSnapshot(dto);
    assert.equal(snapshot.lastSalePrice, null);
    assert.equal(snapshot.originalMortgage, null);
    assert.equal(hasEnoughInsightData(snapshot), false);
  });

  it("allows advice when value, remaining balance, and rate or payment exist", () => {
    const dto = composeFromRow({
      avm_value: 525000,
      verified_current_balance: 300000,
      verified_interest_rate: 6.25,
      attom_fetched_at: "2026-08-31T00:00:00Z",
    });
    assert.equal(hasEnoughInsightData(compactSnapshot(dto)), true);
  });

  it("normalizes model output as advice and caps at 3 items", () => {
    const out = normalizeAdviceAiResponse({
      insights: [
        { id: "refi", message: "You may be in a position to refinance." },
        { id: "schedule", text: "Add a due date to track payments." },
        { id: "insure", message: "Insurance renews soon." },
        { id: "extra", message: "Should be dropped." },
      ],
    });
    assert.equal(out.length, 3);
    assert.equal(out[0].kind, "advice");
    assert.equal(out[0].id, "refi");
    assert.ok(!out.some((item) => item.id === "extra"));
  });
});

describe("plausibility flags", () => {
  it("dedupes deterministic and stored AI flags by id", () => {
    const merged = mergePlausibilityFlags(
      [{ id: "sale-vs-mortgage", message: "Deterministic", source: "deterministic" }],
      {
        flags: [
          { id: "sale-vs-mortgage", message: "AI duplicate" },
          { id: "tax-vs-value", message: "Tax looks high relative to value." },
        ],
      }
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0].source, "deterministic");
    assert.equal(merged[1].id, "tax-vs-value");
  });
});

describe("trend snapshots", () => {
  it("does not treat a missing historical balance as zero equity", () => {
    const dto = composeFromRow(
      { avm_value: 500000, attom_fetched_at: "2026-05-01T00:00:00Z" },
      {
        snapshots: [
          { captured_at: "2026-01-01", avm_value: 480000, estimated_balance: null },
          { captured_at: "2026-05-01", avm_value: 500000, estimated_balance: null },
        ],
      }
    );
    assert.ok(dto.trend);
    assert.equal(dto.trend.equity[0], null);
    assert.equal(dto.trend.equity[1], 500000);
    assert.equal(dto.trend.balance[1], 0);
    assert.equal(dto.trend.value[1], 500000);
  });

  it("returns trend from a single snapshot", () => {
    const dto = composeFromRow(
      {
        avm_value: 534111,
        verified_current_balance: 250000,
        attom_fetched_at: "2026-08-31T00:00:00Z",
      },
      {
        snapshots: [
          { captured_at: "2026-08-31", avm_value: 534111, estimated_balance: 250000 },
        ],
      }
    );
    assert.ok(dto.trend);
    assert.deepEqual(dto.trend.labels, ["2026-08-31"]);
    assert.deepEqual(dto.trend.value, [534111]);
    assert.deepEqual(dto.trend.balance, [250000]);
    assert.deepEqual(dto.trend.equity, [284111]);
  });

  it("overlays verified balance onto a same-day snapshot missing estimated_balance", () => {
    const dto = composeFromRow(
      {
        avm_value: 534111,
        verified_current_balance: 250000,
        attom_fetched_at: "2026-08-26T00:00:00Z",
      },
      {
        snapshots: [
          { captured_at: "2026-08-26", avm_value: 534111, estimated_balance: null },
        ],
      }
    );
    assert.ok(dto.trend);
    assert.deepEqual(dto.trend.labels, ["2026-08-26"]);
    assert.deepEqual(dto.trend.value, [534111]);
    assert.deepEqual(dto.trend.balance, [250000]);
    assert.deepEqual(dto.trend.equity, [284111]);
  });

  it("appends a current point when live as-of is a different day than the latest snapshot", () => {
    const dto = composeFromRow(
      {
        avm_value: 534111,
        verified_current_balance: 250000,
        attom_fetched_at: "2026-08-31T00:00:00Z",
      },
      {
        snapshots: [
          { captured_at: "2026-08-26", avm_value: 534111, estimated_balance: null },
        ],
      }
    );
    assert.ok(dto.trend);
    assert.deepEqual(dto.trend.labels, ["2026-08-26", "2026-08-31"]);
    assert.deepEqual(dto.trend.value, [534111, 534111]);
    assert.deepEqual(dto.trend.balance, [null, 250000]);
    assert.deepEqual(dto.trend.equity, [null, 284111]);
  });

  it("seeds trend from current value and equity when snapshots are empty", () => {
    const dto = composeFromRow({
      avm_value: 500000,
      verified_current_balance: 200000,
      attom_fetched_at: "2026-08-31T00:00:00Z",
    });
    assert.ok(dto.trend);
    assert.deepEqual(dto.trend.labels, ["2026-08-31"]);
    assert.deepEqual(dto.trend.value, [500000]);
    assert.deepEqual(dto.trend.balance, [200000]);
    assert.equal(dto.trend.equity[0], 300000);
  });

  it("leaves trend empty when there is no value or history", () => {
    const dto = composeFromRow({});
    assert.equal(dto.trend, null);
  });
});
