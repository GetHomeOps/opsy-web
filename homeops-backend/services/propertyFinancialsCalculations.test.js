"use strict";

/**
 * Property financials calculations.
 * Run: node services/propertyFinancialsCalculations.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateEquity,
  calculateEquityPercent,
  calculateLTV,
  calculateMonthlyPI,
  estimateRemainingBalance,
  hoaToMonthly,
  calculateKnownMonthlyHousingCost,
  resolveOutstandingDebt,
  profileCompleteness,
  nextDueDateFromDay,
  saleLooksImplausible,
  SOURCES,
} = require("./propertyFinancialsCalculations");

describe("equity vs LTV", () => {
  it("treats null as unknown, not zero", () => {
    assert.equal(calculateEquity(1180000, null), null);
    assert.equal(calculateEquity(null, 537500), null);
    assert.equal(calculateLTV(null, 1180000), null);
  });

  it("distinguishes equity percent from LTV", () => {
    assert.equal(calculateEquity(1180000, 537500), 642500);
    assert.equal(calculateEquityPercent(1180000, 537500), 54.4);
    assert.equal(calculateLTV(537500, 1180000), 45.6);
  });
});

describe("monthly P&I", () => {
  it("returns null when rate or term is missing", () => {
    assert.equal(calculateMonthlyPI(600000, null, 30), null);
    assert.equal(calculateMonthlyPI(600000, 5.25, null), null);
  });

  it("computes a standard 30-year payment", () => {
    const pmt = calculateMonthlyPI(600000, 5.25, 30);
    assert.ok(pmt > 3300 && pmt < 3400);
  });
});

describe("remaining balance", () => {
  it("returns original amount at origination", () => {
    const bal = estimateRemainingBalance({
      originalAmount: 600000,
      annualInterestRate: 5.25,
      termMonths: 360,
      originationDate: "2020-01-01",
      asOfDate: "2020-01-01",
    });
    assert.equal(bal, 600000);
  });

  it("declines after several years", () => {
    const bal = estimateRemainingBalance({
      originalAmount: 600000,
      annualInterestRate: 5.25,
      termMonths: 360,
      originationDate: "2018-05-01",
      asOfDate: "2026-05-01",
    });
    assert.ok(bal != null);
    assert.ok(bal < 600000);
    assert.ok(bal > 400000);
  });

  it("does not invent a balance without origination date", () => {
    assert.equal(
      estimateRemainingBalance({
        originalAmount: 600000,
        annualInterestRate: 5.25,
        termMonths: 360,
      }),
      null
    );
  });
});

describe("housing costs", () => {
  it("converts HOA frequencies", () => {
    assert.equal(hoaToMonthly(220, "monthly"), 220);
    assert.equal(hoaToMonthly(660, "quarterly"), 220);
    assert.equal(hoaToMonthly(2640, "annually"), 220);
    assert.equal(hoaToMonthly(220, null), null);
  });

  it("marks totals partial when insurance or HOA is missing", () => {
    const result = calculateKnownMonthlyHousingCost({
      mortgagePayment: 2842,
      annualTax: 9468,
      insuranceAnnual: null,
      hoaMonthly: null,
      hoaNotApplicable: false,
    });
    assert.equal(result.isPartial, true);
    assert.deepEqual(result.missing, ["insurance", "hoa"]);
    assert.ok(result.total > 0);
  });

  it("does not require HOA when marked not applicable", () => {
    const result = calculateKnownMonthlyHousingCost({
      mortgagePayment: 2842,
      annualTax: 9468,
      insuranceAnnual: 1654,
      hoaNotApplicable: true,
    });
    assert.equal(result.isPartial, false);
    assert.deepEqual(result.missing, []);
  });
});

describe("debt priority", () => {
  it("prefers verified over estimated over modeled", () => {
    const debt = resolveOutstandingDebt({
      verifiedBalance: 500000,
      modeledBalance: 520000,
      estimatedBalance: 530000,
    });
    assert.equal(debt.primary, 500000);
    assert.equal(debt.source, SOURCES.VERIFIED);
  });

  it("uses amortization estimate when unverified", () => {
    const debt = resolveOutstandingDebt({
      estimatedBalance: 537500,
    });
    assert.equal(debt.primary, 537500);
    assert.equal(debt.source, SOURCES.ESTIMATED);
  });
});

describe("profile completeness", () => {
  it("computes a percentage from optional fields", () => {
    const p = profileCompleteness({
      hasMortgageDetails: true,
      hasTaxes: true,
      hasInsurance: false,
      hasHoaOrNotApplicable: false,
      hasPaymentSchedule: false,
    });
    assert.equal(p.percent, 40);
  });
});

describe("next due date", () => {
  it("returns the next occurrence of a due day", () => {
    const next = nextDueDateFromDay(1, new Date("2026-05-15T00:00:00Z"));
    assert.equal(next, "2026-06-01");
  });

  it("returns null for unknown day", () => {
    assert.equal(nextDueDateFromDay(null), null);
  });
});

describe("saleLooksImplausible", () => {
  it("flags a small recorded sale vs a same-day original mortgage", () => {
    assert.equal(
      saleLooksImplausible({
        salePrice: 64100,
        saleDate: "2005-06-17",
        originalMortgage: 256000,
        originationDate: "2005-06-17",
      }),
      true
    );
  });

  it("does not flag a plausible sale vs original loan", () => {
    assert.equal(
      saleLooksImplausible({
        salePrice: 720000,
        saleDate: "2018-05-01",
        originalMortgage: 600000,
        originationDate: "2018-05-01",
      }),
      false
    );
  });
});
