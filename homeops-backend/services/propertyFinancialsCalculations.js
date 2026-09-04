"use strict";

/**
 * Canonical property-financials math. Null in, null out — never treat unknown as zero.
 */

const SOURCES = {
  PUBLIC_RECORD: "public_record",
  ESTIMATED: "estimated",
  CALCULATED: "calculated",
  VERIFIED: "verified",
};

const HOA_FREQUENCIES = new Set(["monthly", "quarterly", "annually"]);

function toFiniteNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundMoney(value) {
  const n = toFiniteNumber(value);
  if (n == null) return null;
  return Math.round(n * 100) / 100;
}

function roundPercent(fraction) {
  const n = toFiniteNumber(fraction);
  if (n == null) return null;
  return Math.round(n * 1000) / 10;
}

/** equity = value - debt. Null if either input is unknown. */
function calculateEquity(propertyValue, debt) {
  const value = toFiniteNumber(propertyValue);
  const d = toFiniteNumber(debt);
  if (value == null || d == null) return null;
  return roundMoney(value - d);
}

/** equity / property value as 0–100 percent. */
function calculateEquityPercent(propertyValue, debt) {
  const value = toFiniteNumber(propertyValue);
  const equity = calculateEquity(propertyValue, debt);
  if (value == null || value <= 0 || equity == null) return null;
  return roundPercent(equity / value);
}

/** debt / property value as 0–100 percent. Distinct from equity %. */
function calculateLTV(debt, propertyValue) {
  const value = toFiniteNumber(propertyValue);
  const d = toFiniteNumber(debt);
  if (value == null || value <= 0 || d == null) return null;
  return roundPercent(d / value);
}

/**
 * Standard fixed-rate principal & interest. Rate is annual percent (e.g. 5.25).
 * Returns null when any required input is unknown.
 */
function calculateMonthlyPI(loanAmt, annualInterestRate, loanTermYears) {
  const principal = toFiniteNumber(loanAmt);
  const years = toFiniteNumber(loanTermYears);
  const annual = toFiniteNumber(annualInterestRate);
  if (principal == null || principal <= 0) return null;
  if (years == null || years <= 0) return null;
  if (annual == null) return null;

  const n = Math.round(years * 12);
  if (n <= 0) return null;
  if (annual === 0) return roundMoney(principal / n);

  const r = annual / 100 / 12;
  const factor = Math.pow(1 + r, n);
  if (!Number.isFinite(factor) || factor === 1) return roundMoney(principal / n);
  return roundMoney((principal * (r * factor)) / (factor - 1));
}

function monthsBetween(fromDate, toDate) {
  if (!(fromDate instanceof Date) || !(toDate instanceof Date)) return null;
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
  const years = toDate.getUTCFullYear() - fromDate.getUTCFullYear();
  const months = toDate.getUTCMonth() - fromDate.getUTCMonth();
  let elapsed = years * 12 + months;
  if (toDate.getUTCDate() < fromDate.getUTCDate()) elapsed -= 1;
  return Math.max(0, elapsed);
}

function parseIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Remaining principal after elapsed months of amortization.
 * Requires original amount, annual rate (%), term in months, and origination date.
 */
function estimateRemainingBalance({
  originalAmount,
  annualInterestRate,
  termMonths,
  originationDate,
  asOfDate = new Date(),
} = {}) {
  const principal = toFiniteNumber(originalAmount);
  const annual = toFiniteNumber(annualInterestRate);
  const n = toFiniteNumber(termMonths);
  const start = parseIsoDate(originationDate);
  const asOf = parseIsoDate(asOfDate) || (asOfDate instanceof Date ? asOfDate : null);
  if (principal == null || principal <= 0) return null;
  if (annual == null) return null;
  if (n == null || n <= 0) return null;
  if (!start || !asOf) return null;

  const elapsed = monthsBetween(start, asOf);
  if (elapsed == null) return null;
  if (elapsed >= n) return 0;
  if (elapsed <= 0) return roundMoney(principal);

  const r = annual / 100 / 12;
  if (r === 0) {
    const remaining = principal * (1 - elapsed / n);
    return roundMoney(Math.max(0, remaining));
  }
  const factorN = Math.pow(1 + r, n);
  const factorK = Math.pow(1 + r, elapsed);
  if (!Number.isFinite(factorN) || !Number.isFinite(factorK) || factorN === 1) {
    return null;
  }
  const remaining = principal * ((factorN - factorK) / (factorN - 1));
  if (!Number.isFinite(remaining)) return null;
  return roundMoney(Math.max(0, remaining));
}

function hoaToMonthly(amount, frequency) {
  const n = toFiniteNumber(amount);
  if (n == null) return null;
  const freq = String(frequency || "").toLowerCase();
  if (freq === "monthly") return roundMoney(n);
  if (freq === "quarterly") return roundMoney(n / 3);
  if (freq === "annually") return roundMoney(n / 12);
  return null;
}

/**
 * Sum only known monthly categories. Missing insurance/HOA makes the total partial
 * unless HOA is explicitly marked not applicable.
 */
function calculateKnownMonthlyHousingCost({
  mortgagePayment = null,
  annualTax = null,
  insuranceAnnual = null,
  hoaMonthly = null,
  hoaNotApplicable = false,
} = {}) {
  const mortgage = roundMoney(mortgagePayment);
  const tax = annualTax == null ? null : roundMoney(toFiniteNumber(annualTax) / 12);
  const insurance =
    insuranceAnnual == null ? null : roundMoney(toFiniteNumber(insuranceAnnual) / 12);
  const hoa = hoaNotApplicable ? 0 : hoaMonthly;

  const categories = [
    { id: "mortgage", label: "Mortgage (P&I)", amount: mortgage },
    { id: "tax", label: "Property tax", amount: tax },
    { id: "insurance", label: "Home insurance", amount: insurance },
    {
      id: "hoa",
      label: "HOA",
      amount: hoaNotApplicable ? null : hoa,
      notApplicable: Boolean(hoaNotApplicable),
    },
  ];

  const known = categories
    .map((c) => c.amount)
    .filter((v) => v != null);
  const total = known.length ? roundMoney(known.reduce((sum, v) => sum + v, 0)) : null;

  const missing = [];
  if (insurance == null) missing.push("insurance");
  if (!hoaNotApplicable && hoaMonthly == null) missing.push("hoa");

  return {
    total,
    isPartial: missing.length > 0,
    missing,
    categories,
  };
}

function resolveOutstandingDebt({
  verifiedBalance = null,
  modeledBalance = null,
  estimatedBalance = null,
  secondLienOriginalAmount = null,
} = {}) {
  let primary = null;
  let source = null;
  if (toFiniteNumber(verifiedBalance) != null) {
    primary = roundMoney(verifiedBalance);
    source = SOURCES.VERIFIED;
  } else if (toFiniteNumber(modeledBalance) != null) {
    primary = roundMoney(modeledBalance);
    source = SOURCES.ESTIMATED;
  } else if (toFiniteNumber(estimatedBalance) != null) {
    primary = roundMoney(estimatedBalance);
    source = SOURCES.ESTIMATED;
  }

  const second = toFiniteNumber(secondLienOriginalAmount);
  const otherLiens = second != null && second > 0 ? roundMoney(second) : null;
  const total =
    primary == null && otherLiens == null
      ? null
      : roundMoney((primary || 0) + (otherLiens || 0));

  return { primary, source, otherLiens, total };
}

const PROFILE_ITEMS = [
  { id: "mortgage", label: "Mortgage details" },
  { id: "taxes", label: "Property taxes" },
  { id: "insurance", label: "Homeowners insurance" },
  { id: "hoa", label: "HOA dues" },
  { id: "schedule", label: "Payment schedule" },
];

function profileCompleteness({
  hasMortgageDetails = false,
  hasTaxes = false,
  hasInsurance = false,
  hasHoaOrNotApplicable = false,
  hasPaymentSchedule = false,
} = {}) {
  const items = [
    { ...PROFILE_ITEMS[0], complete: Boolean(hasMortgageDetails) },
    { ...PROFILE_ITEMS[1], complete: Boolean(hasTaxes) },
    { ...PROFILE_ITEMS[2], complete: Boolean(hasInsurance) },
    { ...PROFILE_ITEMS[3], complete: Boolean(hasHoaOrNotApplicable) },
    { ...PROFILE_ITEMS[4], complete: Boolean(hasPaymentSchedule) },
  ];
  const done = items.filter((i) => i.complete).length;
  return {
    percent: Math.round((done / items.length) * 100),
    items,
  };
}

const SALE_VS_MORTGAGE_RATIO = 0.5;
const SALE_MORTGAGE_DAY_WINDOW = 30;

/**
 * Recorded sale consideration that is far below a near-concurrent original
 * mortgage is unlikely to be an arm's-length purchase price.
 */
function saleLooksImplausible({
  salePrice = null,
  saleDate = null,
  originalMortgage = null,
  originationDate = null,
} = {}) {
  const sale = toFiniteNumber(salePrice);
  const mortgage = toFiniteNumber(originalMortgage);
  if (sale == null || sale <= 0 || mortgage == null || mortgage <= 0) return false;
  if (sale >= mortgage * SALE_VS_MORTGAGE_RATIO) return false;
  const saleAt = parseIsoDate(saleDate);
  const origAt = parseIsoDate(originationDate);
  if (!saleAt || !origAt) return false;
  const days = Math.abs(saleAt.getTime() - origAt.getTime()) / 86400000;
  return days <= SALE_MORTGAGE_DAY_WINDOW;
}

function nextDueDateFromDay(dueDay, fromDate = new Date()) {
  const day = toFiniteNumber(dueDay);
  if (day == null || day < 1 || day > 31) return null;
  const from = fromDate instanceof Date ? fromDate : parseIsoDate(fromDate);
  if (!from || Number.isNaN(from.getTime())) return null;
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const candidate = new Date(Date.UTC(year, month, Math.min(day, 28)));
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  candidate.setUTCDate(Math.min(Math.round(day), lastDay));
  if (candidate <= from) {
    const nextMonth = month + 1;
    const next = new Date(Date.UTC(year, nextMonth, 1));
    const nextLast = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(Math.round(day), nextLast));
    return next.toISOString().slice(0, 10);
  }
  return candidate.toISOString().slice(0, 10);
}

module.exports = {
  SOURCES,
  HOA_FREQUENCIES,
  toFiniteNumber,
  roundMoney,
  roundPercent,
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
  parseIsoDate,
  monthsBetween,
  saleLooksImplausible,
  SALE_VS_MORTGAGE_RATIO,
  SALE_MORTGAGE_DAY_WINDOW,
};
