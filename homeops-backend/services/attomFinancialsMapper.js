"use strict";

/**
 * Pure mapper: ATTOM expandedprofile / AVM payloads → property_financials snapshot.
 * Does not persist. Null when a field is absent — never substitutes assessed value for AVM.
 */

function pickFirst(obj, ...keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const val = obj[k];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  const lower = Object.fromEntries(
    Object.entries(obj).map(([key, v]) => [key.toLowerCase(), v])
  );
  for (const k of keys) {
    const val = lower[k?.toLowerCase?.() ?? k];
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return null;
}

function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInt(value) {
  const n = toNumber(value);
  return n == null ? null : Math.round(n);
}

function toBool(value) {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["y", "yes", "true", "1", "t"].includes(s)) return true;
  if (["n", "no", "false", "0", "f"].includes(s)) return false;
  return null;
}

function normalizeAttomDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function normalizeRate(value) {
  const n = toNumber(value);
  if (n == null) return null;
  // ATTOM occasionally returns a decimal fraction (0.0525) instead of 5.25.
  if (n > 0 && n < 1) return Math.round(n * 10000) / 100;
  return n;
}

const LOAN_TYPE_LABELS = {
  CONV: "Conventional",
  CON: "Conventional",
  FHA: "FHA",
  VA: "VA",
  USDA: "USDA",
  ARM: "ARM",
  FRM: "Fixed",
  FIXED: "Fixed",
};

function loanTypeLabel(code) {
  if (code == null || code === "") return null;
  const raw = String(code).trim();
  const upper = raw.toUpperCase();
  return LOAN_TYPE_LABELS[upper] || raw;
}

function lenderName(mortgage) {
  if (!mortgage || typeof mortgage !== "object") return null;
  const company =
    pickFirst(mortgage, "companyName", "CompanyName", "lenderName") ?? null;
  if (company) return String(company).trim() || null;
  const first = pickFirst(mortgage, "LenderFirstName", "lenderFirstName");
  const last = pickFirst(mortgage, "LenderLastName", "lenderLastName");
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

function termMonths(mortgage) {
  const months = toInt(pickFirst(mortgage, "term", "termMonths", "loanTerm"));
  if (months != null && months > 0) {
    // Values like 30 usually mean years.
    if (months <= 50) return months * 12;
    return months;
  }
  const years = toInt(pickFirst(mortgage, "termYears", "loanTermYears"));
  return years != null && years > 0 ? years * 12 : null;
}

function occupancyFromAbsentee(indicator, statusCode) {
  const text = indicator != null ? String(indicator).trim() : "";
  const code = statusCode != null ? String(statusCode).trim().toUpperCase() : "";
  const lower = text.toLowerCase();
  if (code === "O" || lower.includes("owner occupied") || lower === "occupied") {
    return { absenteeIndicator: text || "Owner Occupied", ownerOccupied: true };
  }
  if (code === "A" || lower.includes("absentee")) {
    return { absenteeIndicator: text || "Absentee Owner", ownerOccupied: false };
  }
  if (text) return { absenteeIndicator: text, ownerOccupied: null };
  return { absenteeIndicator: null, ownerOccupied: null };
}

/**
 * @param {Object} prop ATTOM property object from data.property[0]
 * @returns {Object} snake_case snapshot fields (no verified overrides)
 */
function mapAttomFinancials(prop) {
  if (!prop || typeof prop !== "object") return {};

  const sale = prop.sale ?? {};
  const saleAmount = sale.amount && typeof sale.amount === "object" ? sale.amount : sale;
  const assessment = prop.assessment ?? {};
  const assessed = assessment.assessed ?? {};
  const market = assessment.market ?? {};
  const tax = assessment.tax ?? prop.tax ?? {};
  const owner = assessment.owner ?? prop.owner ?? {};
  const summary = prop.summary ?? {};
  const mortgageBlock = assessment.mortgage ?? prop.mortgage ?? {};
  const first =
    mortgageBlock.FirstConcurrent ??
    mortgageBlock.firstConcurrent ??
    mortgageBlock.first ??
    {};
  const second =
    mortgageBlock.SecondConcurrent ??
    mortgageBlock.secondConcurrent ??
    mortgageBlock.second ??
    {};

  const occupancy = occupancyFromAbsentee(
    pickFirst(summary, "absenteeInd", "absenteeOwner"),
    pickFirst(owner, "absenteeOwnerStatus", "absenteeownerstatus")
  );

  const lastSaleDate = normalizeAttomDate(
    pickFirst(sale, "saleTransDate", "saletransdate", "saleSearchDate", "salesearchdate") ??
      pickFirst(saleAmount, "saleRecDate", "salerecdate")
  );

  return {
    assessed_value: toNumber(
      pickFirst(assessed, "assdTtlValue", "assdttlvalue", "assessedValue")
    ),
    market_value: toNumber(
      pickFirst(market, "mktTtlValue", "mktttlvalue", "marketValue")
    ),
    assessment_year: toInt(
      pickFirst(tax, "taxYear", "taxyear") ??
        pickFirst(assessment, "year", "assessmentYear")
    ),
    last_sale_price: toNumber(
      pickFirst(saleAmount, "saleAmt", "saleamt", "saleAmount", "amount")
    ),
    last_sale_date: lastSaleDate,
    absentee_indicator: occupancy.absenteeIndicator,
    owner_occupied: occupancy.ownerOccupied,
    owner_type: pickFirst(owner, "type", "ownerType", "description")
      ? String(pickFirst(owner, "type", "ownerType", "description")).trim()
      : null,
    trust_indicator: toBool(pickFirst(owner?.owner1 ?? owner, "trustIndicator", "trustindicator")),
    corporate_indicator: toBool(
      pickFirst(owner, "corporateIndicator", "corporateindicator")
    ),
    annual_tax_amount: toNumber(pickFirst(tax, "taxAmt", "taxamt", "taxAmount")),
    tax_year: toInt(pickFirst(tax, "taxYear", "taxyear")),
    mortgage_lender: lenderName(first),
    mortgage_loan_type: loanTypeLabel(
      pickFirst(first, "loanTypeCode", "loantypecode", "loanType")
    ),
    mortgage_interest_rate: normalizeRate(
      pickFirst(first, "interestRate", "interestrate")
    ),
    mortgage_original_amount: toNumber(pickFirst(first, "amount", "loanAmount")),
    mortgage_term_months: termMonths(first),
    mortgage_origination_date: normalizeAttomDate(
      pickFirst(first, "date", "originationDate", "recordingDate")
    ),
    mortgage_maturity_date: normalizeAttomDate(
      pickFirst(first, "dueDate", "duedate", "maturityDate")
    ),
    mortgage_deed_type: pickFirst(first, "deedType", "deedtype")
      ? String(pickFirst(first, "deedType", "deedtype")).trim()
      : null,
    second_lien_original_amount: toNumber(pickFirst(second, "amount", "loanAmount")),
  };
}

/**
 * Map ATTOM AVM detail payload. Never falls back to assessed/market value.
 * @param {Object} prop ATTOM property object from avm/detail
 */
function mapAttomAvm(prop) {
  if (!prop || typeof prop !== "object") return {};
  const avm = prop.avm ?? {};
  const amount = avm.amount && typeof avm.amount === "object" ? avm.amount : avm;
  const value = toNumber(pickFirst(amount, "value", "avmValue", "estimate"));
  if (value == null) return {};
  return {
    avm_value: value,
    avm_low: toNumber(pickFirst(amount, "low", "lowValue")),
    avm_high: toNumber(pickFirst(amount, "high", "highValue")),
    avm_date: normalizeAttomDate(
      pickFirst(avm, "eventDate", "date", "asOf", "calculatedDate") ??
        pickFirst(amount, "scrDate", "date")
    ),
    avm_source: "attom_avm",
  };
}

module.exports = {
  mapAttomFinancials,
  mapAttomAvm,
  pickFirst,
  normalizeAttomDate,
  normalizeRate,
  occupancyFromAbsentee,
  loanTypeLabel,
};
