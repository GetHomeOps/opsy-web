"use strict";

/**
 * ATTOM financial field mapper.
 * Run: node services/attomFinancialsMapper.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  mapAttomFinancials,
  mapAttomAvm,
  occupancyFromAbsentee,
  normalizeRate,
  loanTypeLabel,
} = require("./attomFinancialsMapper");

describe("occupancy", () => {
  it("maps owner-occupied indicators", () => {
    assert.deepEqual(occupancyFromAbsentee("Owner Occupied", "O"), {
      absenteeIndicator: "Owner Occupied",
      ownerOccupied: true,
    });
    assert.equal(occupancyFromAbsentee("Absentee Owner", "A").ownerOccupied, false);
  });
});

describe("rate normalization", () => {
  it("keeps percent values and expands fractions", () => {
    assert.equal(normalizeRate(5.25), 5.25);
    assert.equal(normalizeRate(0.0525), 5.25);
    assert.equal(normalizeRate(null), null);
  });
});

describe("mapAttomFinancials", () => {
  const sample = {
    summary: { absenteeInd: "Owner Occupied" },
    sale: {
      saleTransDate: "2018-05-12",
      amount: { saleAmt: 720000 },
    },
    assessment: {
      assessed: { assdTtlValue: 980000 },
      market: { mktTtlValue: 1100000 },
      tax: { taxAmt: 7896, taxYear: 2025 },
      owner: {
        type: "Sole Ownership",
        absenteeOwnerStatus: "O",
        corporateIndicator: "N",
        owner1: { trustIndicator: "N" },
      },
      mortgage: {
        FirstConcurrent: {
          amount: 600000,
          LenderFirstName: "Chase Home Lending",
          interestRate: 5.25,
          loanTypeCode: "CONV",
          term: 360,
          date: "2018-05-01",
          dueDate: "2048-05-01",
        },
        SecondConcurrent: { amount: 0 },
      },
    },
  };

  it("extracts sale, tax, occupancy, and original mortgage", () => {
    const mapped = mapAttomFinancials(sample);
    assert.equal(mapped.last_sale_price, 720000);
    assert.equal(mapped.last_sale_date, "2018-05-12");
    assert.equal(mapped.annual_tax_amount, 7896);
    assert.equal(mapped.tax_year, 2025);
    assert.equal(mapped.owner_occupied, true);
    assert.equal(mapped.mortgage_original_amount, 600000);
    assert.equal(mapped.mortgage_lender, "Chase Home Lending");
    assert.equal(mapped.mortgage_interest_rate, 5.25);
    assert.equal(mapped.mortgage_term_months, 360);
    assert.equal(mapped.mortgage_loan_type, "Conventional");
    assert.equal(mapped.assessed_value, 980000);
    assert.equal(mapped.market_value, 1100000);
  });

  it("does not invent an AVM from assessed or market value", () => {
    const mapped = mapAttomFinancials(sample);
    assert.equal(mapped.avm_value, undefined);
  });

  it("returns empty object for missing property", () => {
    assert.deepEqual(mapAttomFinancials(null), {});
  });
});

describe("mapAttomAvm", () => {
  it("reads value/low/high and never uses assessed value", () => {
    const mapped = mapAttomAvm({
      avm: { amount: { value: 1180000, low: 1100000, high: 1250000 }, eventDate: "2026-04-01" },
      assessment: { assessed: { assdTtlValue: 9 } },
    });
    assert.equal(mapped.avm_value, 1180000);
    assert.equal(mapped.avm_low, 1100000);
    assert.equal(mapped.avm_high, 1250000);
    assert.equal(mapped.avm_source, "attom_avm");
    assert.equal(mapped.avm_date, "2026-04-01");
  });

  it("returns empty when AVM is absent", () => {
    assert.deepEqual(mapAttomAvm({ assessment: { assessed: { assdTtlValue: 1 } } }), {});
  });
});

describe("loan type labels", () => {
  it("maps common codes", () => {
    assert.equal(loanTypeLabel("CONV"), "Conventional");
    assert.equal(loanTypeLabel("FHA"), "FHA");
  });
});
