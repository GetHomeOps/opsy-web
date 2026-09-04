"use strict";

/**
 * Pure Financials dashboard DTO composition. No DB access.
 */

const {
  SOURCES,
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
  toFiniteNumber,
  roundMoney,
  saleLooksImplausible,
} = require("./propertyFinancialsCalculations");

const FINANCIAL_DOC_TYPES = new Set(["mortgage", "insurance", "hoa", "tax"]);

function valued(value, source, asOf = null) {
  if (value == null) return null;
  return { value, source, asOf: asOf || null };
}

function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function vestingLabel(row) {
  if (!row) return null;
  if (row.trust_indicator) return "Trust";
  if (row.corporate_indicator) return "Corporate";
  const type = row.owner_type ? String(row.owner_type).trim() : "";
  if (type) return type;
  return null;
}

function occupancyLabel(row) {
  if (!row) return null;
  if (row.absentee_indicator) return row.absentee_indicator;
  if (row.owner_occupied === true) return "Owner Occupied";
  if (row.owner_occupied === false) return "Absentee Owner";
  return null;
}

function hasRecordedMortgage(row) {
  if (!row) return false;
  return (
    toFiniteNumber(row.mortgage_original_amount) != null ||
    Boolean(row.mortgage_lender) ||
    Boolean(row.mortgage_origination_date)
  );
}

function storedFlagsList(stored) {
  const list = Array.isArray(stored)
    ? stored
    : (stored && Array.isArray(stored.flags) ? stored.flags : []);
  return list.filter((item) => item && item.kind !== "advice");
}

function storedAdviceList(stored) {
  const list = Array.isArray(stored)
    ? stored
    : (stored && Array.isArray(stored.advice) ? stored.advice : []);
  return list.filter((item) => item && item.kind === "advice");
}

function mergePlausibilityFlags(deterministic, stored) {
  const list = [];
  const seen = new Set();
  for (const flag of [...(deterministic || []), ...storedFlagsList(stored)]) {
    if (!flag || !flag.id || seen.has(flag.id)) continue;
    if (flag.kind === "advice") continue;
    seen.add(flag.id);
    list.push({
      id: String(flag.id),
      field: flag.field || null,
      severity: flag.severity || "warning",
      message: String(flag.message || "").trim(),
      source: flag.source || "ai",
    });
  }
  return list.filter((f) => f.message);
}

function mergeAdviceInsights(insights, stored) {
  const out = [...insights];
  const seen = new Set(out.map((item) => item.id));
  for (const item of storedAdviceList(stored)) {
    const message = String(item.message || item.text || "").trim();
    if (!message) continue;
    const rawId = String(item.id || `advice-${out.length + 1}`);
    const id = rawId.startsWith("advice-") ? rawId : `advice-${rawId}`;
    if (seen.has(id) || seen.has(rawId)) continue;
    seen.add(id);
    out.push({ id, text: message, kind: "advice" });
  }
  return out;
}

function formatInsightMoney(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return null;
  return `$${Math.round(Number(amount)).toLocaleString("en-US")}`;
}

function formatInsightDate(iso) {
  if (!iso) return null;
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function deterministicSaleFlag(row) {
  const implausible = saleLooksImplausible({
    salePrice: row?.last_sale_price,
    saleDate: row?.last_sale_date,
    originalMortgage: row?.mortgage_original_amount,
    originationDate: row?.mortgage_origination_date,
  });
  if (!implausible) return [];
  return [{
    id: "sale-vs-mortgage",
    field: "last_sale_price",
    severity: "warning",
    source: "deterministic",
    message: "This recorded amount may not be a market purchase.",
  }];
}

function hasVerifiedMortgage(row) {
  if (!row) return false;
  return (
    toFiniteNumber(row.verified_current_balance) != null ||
    toFiniteNumber(row.verified_monthly_payment) != null ||
    toFiniteNumber(row.verified_interest_rate) != null ||
    toFiniteNumber(row.verified_payment_due_day) != null
  );
}

function buildInsights({
  homeValue,
  equityAmount,
  equityPercent,
  ltv,
  remainingBalance,
  interestRate,
  monthlyPayment,
  nextPaymentDue,
  paymentDueDay,
  purchasePrice,
  insurance,
  hoa,
  hoaNotApplicable,
  saleImplausible = false,
}) {
  const insights = [];
  const hasBalance = remainingBalance != null && remainingBalance > 0;

  if (hasBalance && ltv != null) {
    if (ltv <= 80) {
      insights.push({
        id: "refinance-position",
        text: `Your loan-to-value is about ${ltv}%, which may put you in a position to refinance or drop PMI.`,
      });
    } else {
      const pointsTo20 = Math.round((ltv - 80) * 10) / 10;
      insights.push({
        id: "refinance-position",
        text: `You are about ${pointsTo20} percentage points of LTV away from 20% equity, a common threshold for dropping PMI or refinancing.`,
      });
    }
  }

  if (nextPaymentDue) {
    const dateLabel = formatInsightDate(nextPaymentDue);
    const amountLabel = monthlyPayment != null
      ? ` of about ${formatInsightMoney(monthlyPayment)}`
      : "";
    insights.push({
      id: "payment-schedule",
      text: `Your next mortgage payment${amountLabel} is due ${dateLabel}.`,
    });
  } else if (hasBalance && paymentDueDay == null) {
    const extra = monthlyPayment == null ? " and monthly principal and interest" : "";
    insights.push({
      id: "add-payment-schedule",
      text: `Add your payment due date${extra} to unlock a payment schedule.`,
    });
  }

  if (hasBalance && interestRate == null) {
    insights.push({
      id: "add-rate",
      text: "Add your interest rate to estimate monthly principal and interest and see refinance context.",
    });
  }

  if (equityAmount != null && equityPercent != null) {
    const k = equityAmount >= 1000
      ? `$${Math.round(equityAmount / 1000)}K`
      : `$${Math.round(equityAmount)}`;
    insights.push({
      id: "equity",
      text: `You have approximately ${k} in estimated equity (${equityPercent}% of value).`,
    });
  }

  if (
    !saleImplausible &&
    homeValue != null &&
    purchasePrice != null &&
    purchasePrice > 0
  ) {
    const change = ((homeValue - purchasePrice) / purchasePrice) * 100;
    if (Number.isFinite(change)) {
      const rounded = Math.round(change * 10) / 10;
      const direction = rounded >= 0 ? "increased" : "decreased";
      insights.push({
        id: "value-since-purchase",
        text: `Your property value is estimated to have ${direction} ${Math.abs(rounded)}% since last recorded sale.`,
      });
    }
  }

  if (insurance?.renewalDate) {
    const renewal = new Date(`${insurance.renewalDate}T00:00:00Z`);
    const now = new Date();
    const days = Math.round((renewal.getTime() - now.getTime()) / 86400000);
    if (Number.isFinite(days) && days >= 0 && days <= 90) {
      insights.push({
        id: "insurance-renewal",
        text: `Your homeowners insurance renews in ${days} day${days === 1 ? "" : "s"}.`,
      });
    }
  }

  if (!insurance) {
    insights.push({
      id: "add-insurance",
      text: "Add insurance and HOA information to improve your monthly ownership-cost estimate.",
    });
  } else if (!hoaNotApplicable && !hoa) {
    insights.push({
      id: "add-hoa",
      text: "Add HOA information to improve your monthly ownership-cost estimate, or mark that this property has no HOA.",
    });
  }

  return insights.slice(0, 8);
}

/**
 * Ensure the latest trend point matches live composed value / debt / equity.
 * Historical points are left unchanged. Same-day as-of fills the last point;
 * a different day appends a current point.
 */
function overlayCurrentTrendPoint(trend, { label, value, balance, equity } = {}) {
  if (!trend || !label) return trend;
  const lastIdx = trend.labels.length - 1;
  const lastLabel = lastIdx >= 0 ? trend.labels[lastIdx] : null;

  if (lastLabel === label) {
    if (value != null) trend.value[lastIdx] = value;
    if (balance != null) trend.balance[lastIdx] = balance;
    if (equity != null) trend.equity[lastIdx] = equity;
    return trend;
  }

  if (value != null || equity != null) {
    trend.labels.push(label);
    trend.value.push(value ?? null);
    trend.balance.push(balance ?? null);
    trend.equity.push(equity ?? null);
  }
  return trend;
}

function composeFromRow(row, { documents = [], snapshots = [], attomStatus = "ready" } = {}) {
  const asOf = isoDate(row?.attom_fetched_at) || isoDate(row?.updated_at);

  const verifiedHome = toFiniteNumber(row?.verified_home_value);
  const avmHome = toFiniteNumber(row?.avm_value);
  const homeValue = verifiedHome != null
    ? valued(roundMoney(verifiedHome), SOURCES.VERIFIED, isoDate(row.home_value_verified_at) || asOf)
    : avmHome != null
      ? valued(roundMoney(avmHome), SOURCES.ESTIMATED, isoDate(row.avm_date) || asOf)
      : null;

  const recordedMortgageEarly = hasRecordedMortgage(row);
  const verifiedMortgageEarly = hasVerifiedMortgage(row);
  const estimatedBalance =
    recordedMortgageEarly || verifiedMortgageEarly
      ? estimateRemainingBalance({
          originalAmount: row?.mortgage_original_amount,
          annualInterestRate: row?.verified_interest_rate ?? row?.mortgage_interest_rate,
          termMonths: row?.mortgage_term_months,
          originationDate: row?.mortgage_origination_date,
        })
      : null;

  let debt = resolveOutstandingDebt({
    verifiedBalance: row?.verified_current_balance,
    modeledBalance: row?.modeled_balance,
    estimatedBalance,
    secondLienOriginalAmount: row?.second_lien_original_amount,
  });

  // After a successful ATTOM snapshot with no mortgage record, debt is known to be
  // only other liens (usually none) — do not leave equity blank.
  if (row?.attom_fetched_at && !recordedMortgageEarly && !verifiedMortgageEarly) {
    debt = {
      primary: null,
      source: null,
      otherLiens: debt.otherLiens,
      total: debt.otherLiens != null ? debt.otherLiens : 0,
    };
  }

  const remainingMortgage = debt.primary != null
    ? valued(debt.primary, debt.source, asOf)
    : null;

  const equityAmount = homeValue
    ? calculateEquity(homeValue.value, debt.total)
    : null;
  const equityPercent = homeValue
    ? calculateEquityPercent(homeValue.value, debt.total)
    : null;
  const ltv = homeValue ? calculateLTV(debt.total, homeValue.value) : null;

  const equity = equityAmount != null
    ? {
        amount: equityAmount,
        percent: equityPercent,
        source: SOURCES.CALCULATED,
      }
    : null;

  const rate = toFiniteNumber(row?.verified_interest_rate) != null
    ? valued(Number(row.verified_interest_rate), SOURCES.VERIFIED, isoDate(row?.mortgage_verified_at))
    : toFiniteNumber(row?.mortgage_interest_rate) != null
      ? valued(Number(row.mortgage_interest_rate), SOURCES.PUBLIC_RECORD, asOf)
      : null;

  const originalAmount = toFiniteNumber(row?.mortgage_original_amount) != null
    ? valued(roundMoney(row.mortgage_original_amount), SOURCES.PUBLIC_RECORD, asOf)
    : null;

  const verifiedPayment = toFiniteNumber(row?.verified_monthly_payment);
  const calculatedPayment = calculateMonthlyPI(
    originalAmount?.value,
    rate?.value,
    row?.mortgage_term_months != null ? Number(row.mortgage_term_months) / 12 : null
  );
  const monthlyPayment = verifiedPayment != null
    ? valued(roundMoney(verifiedPayment), SOURCES.VERIFIED, isoDate(row?.mortgage_verified_at))
    : calculatedPayment != null
      ? valued(calculatedPayment, SOURCES.ESTIMATED, asOf)
      : null;

  const nextPaymentDate = nextDueDateFromDay(row?.verified_payment_due_day);

  const taxAnnual = toFiniteNumber(row?.annual_tax_amount);
  const tax = taxAnnual != null
    ? {
        annualAmount: valued(roundMoney(taxAnnual), SOURCES.PUBLIC_RECORD, asOf),
        year: row.tax_year != null ? Number(row.tax_year) : null,
        monthlyAllocation: roundMoney(taxAnnual / 12),
      }
    : null;

  const hasInsurance = Boolean(row?.insurance_verified_at) ||
    toFiniteNumber(row?.insurance_annual_premium) != null ||
    Boolean(row?.insurance_provider);
  const insurance = hasInsurance
    ? {
        provider: row.insurance_provider || null,
        annualPremium: toFiniteNumber(row.insurance_annual_premium) != null
          ? valued(roundMoney(row.insurance_annual_premium), SOURCES.VERIFIED, isoDate(row.insurance_verified_at))
          : null,
        renewalDate: isoDate(row.insurance_renewal_date),
        policyNumber: row.insurance_policy_number || null,
        deductible: toFiniteNumber(row.insurance_deductible),
        escrowIncluded: row.insurance_escrow_included,
        source: SOURCES.VERIFIED,
        verifiedAt: isoDate(row.insurance_verified_at),
        sourceDocumentId: row.insurance_source_document_id || null,
      }
    : null;

  const hoaNotApplicable = Boolean(row?.hoa_not_applicable);
  const hasHoa = !hoaNotApplicable && (
    Boolean(row?.hoa_verified_at) ||
    toFiniteNumber(row?.hoa_amount) != null ||
    Boolean(row?.hoa_association_name)
  );
  const hoaMonthly = hasHoa ? hoaToMonthly(row.hoa_amount, row.hoa_frequency) : null;
  const hoa = hoaNotApplicable
    ? { notApplicable: true, source: SOURCES.VERIFIED, verifiedAt: isoDate(row.hoa_verified_at) }
    : hasHoa
      ? {
          notApplicable: false,
          associationName: row.hoa_association_name || null,
          amount: toFiniteNumber(row.hoa_amount) != null
            ? valued(roundMoney(row.hoa_amount), SOURCES.VERIFIED, isoDate(row.hoa_verified_at))
            : null,
          frequency: row.hoa_frequency || null,
          monthlyAmount: hoaMonthly,
          nextDueDate: isoDate(row.hoa_next_due_date),
          specialAssessment: toFiniteNumber(row.hoa_special_assessment),
          source: SOURCES.VERIFIED,
          verifiedAt: isoDate(row.hoa_verified_at),
          sourceDocumentId: row.hoa_source_document_id || null,
        }
      : null;

  const monthlyCosts = calculateKnownMonthlyHousingCost({
    mortgagePayment: monthlyPayment?.value ?? null,
    annualTax: taxAnnual,
    insuranceAnnual: insurance?.annualPremium?.value ?? null,
    hoaMonthly,
    hoaNotApplicable,
  });

  const obligations = [];
  if (monthlyPayment && nextPaymentDate) {
    obligations.push({
      id: "mortgage",
      label: "Mortgage payment",
      date: nextPaymentDate,
      amount: monthlyPayment.value,
      source: monthlyPayment.source,
      cadence: "monthly",
    });
  }
  if (tax) {
    obligations.push({
      id: "tax",
      label: "Property tax",
      date: null,
      amount: tax.annualAmount.value,
      source: SOURCES.PUBLIC_RECORD,
      cadence: "annual",
      year: tax.year,
    });
  }
  if (insurance?.renewalDate && insurance.annualPremium) {
    obligations.push({
      id: "insurance",
      label: "Homeowners insurance",
      date: insurance.renewalDate,
      amount: insurance.annualPremium.value,
      source: SOURCES.VERIFIED,
      cadence: "annual",
    });
  } else if (!insurance) {
    obligations.push({
      id: "insurance",
      label: "Homeowners insurance",
      date: null,
      amount: null,
      missing: true,
    });
  }
  if (hoaNotApplicable) {
    // omit
  } else if (hoa?.nextDueDate && hoa.amount) {
    obligations.push({
      id: "hoa",
      label: hoa.associationName ? `${hoa.associationName} dues` : "HOA dues",
      date: hoa.nextDueDate,
      amount: hoa.amount.value,
      source: SOURCES.VERIFIED,
      cadence: hoa.frequency || null,
    });
  } else if (!hoa) {
    obligations.push({
      id: "hoa",
      label: "HOA dues",
      date: null,
      amount: null,
      missing: true,
    });
  }

  const purchasePrice = toFiniteNumber(row?.last_sale_price);
  const saleImplausible = saleLooksImplausible({
    salePrice: purchasePrice,
    saleDate: row?.last_sale_date,
    originalMortgage: row?.mortgage_original_amount,
    originationDate: row?.mortgage_origination_date,
  });
  const storedFlags = row?.plausibility_flags;
  const parsedStored = typeof storedFlags === "string"
    ? (() => { try { return JSON.parse(storedFlags); } catch { return []; } })()
    : storedFlags;
  const plausibilityFlags = mergePlausibilityFlags(
    deterministicSaleFlag(row),
    parsedStored
  );
  const insights = mergeAdviceInsights(buildInsights({
    homeValue: homeValue?.value ?? null,
    equityAmount,
    equityPercent,
    ltv,
    remainingBalance: remainingMortgage?.value ?? null,
    interestRate: rate?.value ?? null,
    monthlyPayment: monthlyPayment?.value ?? null,
    nextPaymentDue: nextPaymentDate,
    paymentDueDay: row?.verified_payment_due_day != null
      ? Number(row.verified_payment_due_day)
      : null,
    purchasePrice,
    insurance,
    hoa: hasHoa ? hoa : null,
    hoaNotApplicable,
    saleImplausible,
  }), parsedStored);

  const recordedMortgage = hasRecordedMortgage(row);
  const verifiedMortgage = hasVerifiedMortgage(row);
  const profile = profileCompleteness({
    hasMortgageDetails: recordedMortgage || verifiedMortgage,
    hasTaxes: tax != null,
    hasInsurance: Boolean(insurance),
    hasHoaOrNotApplicable: hoaNotApplicable || Boolean(hoa),
    hasPaymentSchedule: Boolean(row?.verified_payment_due_day),
  });

  const financialDocs = (documents || []).filter((d) =>
    FINANCIAL_DOC_TYPES.has(String(d.document_type || d.documentType || "").toLowerCase())
  );

  const trendPoints = (snapshots || []).filter(
    (s) => s.avm_value != null || s.estimated_balance != null
  );
  const seedLabel = asOf || homeValue?.asOf || null;
  const snapshotTrend = trendPoints.length >= 1
    ? {
        labels: trendPoints.map((s) => isoDate(s.captured_at)),
        value: trendPoints.map((s) =>
          s.avm_value == null ? null : Number(s.avm_value)
        ),
        balance: trendPoints.map((s) =>
          s.estimated_balance == null ? null : Number(s.estimated_balance)
        ),
        equity: trendPoints.map((s) => {
          if (s.avm_value == null || s.estimated_balance == null) return null;
          return calculateEquity(Number(s.avm_value), Number(s.estimated_balance));
        }),
      }
    : homeValue && seedLabel
      ? {
          labels: [seedLabel],
          value: [homeValue.value],
          balance: [debt.total != null ? Number(debt.total) : null],
          equity: [equityAmount],
        }
      : null;
  const trend = overlayCurrentTrendPoint(snapshotTrend, {
    label: seedLabel,
    value: homeValue?.value ?? null,
    balance: debt.total != null ? Number(debt.total) : null,
    equity: equityAmount,
  });

  return {
    attomStatus,
    lastUpdated: row?.attom_fetched_at
      ? new Date(row.attom_fetched_at).toISOString()
      : row?.updated_at
        ? new Date(row.updated_at).toISOString()
        : null,
    homeValue,
    homeValueRange: homeValue?.source === SOURCES.ESTIMATED && row && (row.avm_low != null || row.avm_high != null)
      ? {
          low: row.avm_low != null ? Number(row.avm_low) : null,
          high: row.avm_high != null ? Number(row.avm_high) : null,
        }
      : null,
    remainingMortgage,
    otherLiens: debt.otherLiens != null
      ? valued(debt.otherLiens, SOURCES.PUBLIC_RECORD, asOf)
      : null,
    equity,
    ltv: ltv != null ? { percent: ltv, source: SOURCES.CALCULATED } : null,
    assessedValue: toFiniteNumber(row?.assessed_value) != null
      ? valued(roundMoney(row.assessed_value), SOURCES.PUBLIC_RECORD, asOf)
      : null,
    assessorMarketValue: toFiniteNumber(row?.market_value) != null
      ? valued(roundMoney(row.market_value), SOURCES.PUBLIC_RECORD, asOf)
      : null,
    ownership: {
      ownerOccupied: row?.owner_occupied ?? null,
      occupancy: occupancyLabel(row),
      vesting: vestingLabel(row),
      purchasePrice: purchasePrice != null
        ? valued(roundMoney(purchasePrice), SOURCES.PUBLIC_RECORD, asOf)
        : null,
      purchaseDate: isoDate(row?.last_sale_date),
      lastSaleImplausible: saleImplausible,
      ltv: ltv != null ? { percent: ltv, source: SOURCES.CALCULATED } : null,
      source: SOURCES.PUBLIC_RECORD,
    },
    mortgage: {
      hasRecordedMortgage: recordedMortgage,
      lender: row?.mortgage_lender || null,
      loanType: row?.mortgage_loan_type || null,
      interestRate: rate,
      originalAmount,
      remainingBalance: remainingMortgage,
      monthlyPayment,
      originationDate: isoDate(row?.mortgage_origination_date),
      maturityDate: isoDate(row?.mortgage_maturity_date),
      deedType: row?.mortgage_deed_type || null,
      termMonths: row?.mortgage_term_months != null ? Number(row.mortgage_term_months) : null,
      recordedInterestRate: toFiniteNumber(row?.mortgage_interest_rate) != null
        ? valued(Number(row.mortgage_interest_rate), SOURCES.PUBLIC_RECORD, asOf)
        : null,
      escrowIncluded: row?.verified_escrow_included ?? null,
      paymentDueDay: row?.verified_payment_due_day != null
        ? Number(row.verified_payment_due_day)
        : null,
      nextPaymentDue: nextPaymentDate,
      source: verifiedMortgage ? SOURCES.VERIFIED : recordedMortgage ? SOURCES.PUBLIC_RECORD : null,
      verifiedAt: isoDate(row?.mortgage_verified_at),
      sourceDocumentId: row?.mortgage_source_document_id || null,
    },
    tax,
    insurance,
    hoa,
    monthlyCosts,
    obligations,
    insights,
    plausibilityFlags,
    profile,
    trend,
    documents: financialDocs.map((d) => ({
      id: d.id,
      name: d.document_name,
      date: isoDate(d.document_date),
      type: d.document_type,
      key: d.document_key,
    })),
    refinance: {
      available: false,
      reason: "Current market rate data is not connected yet.",
    },
  };
}

module.exports = {
  composeFromRow,
  overlayCurrentTrendPoint,
  buildInsights,
  saleLooksImplausible,
  mergePlausibilityFlags,
  FINANCIAL_DOC_TYPES,
};
