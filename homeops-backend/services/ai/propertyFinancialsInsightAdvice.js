"use strict";

/**
 * Pure helpers for gated homeowner financial advice.
 * No DB or OpenAI access.
 */

const { toFiniteNumber } = require("../propertyFinancialsCalculations");

const MAX_ADVICE = 3;

function slugId(value, fallback) {
  const raw = String(value || fallback || "advice")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return raw || fallback || "advice";
}

function publicRecordAmount(value) {
  const n = toFiniteNumber(value);
  if (n == null || n <= 0) return null;
  return n;
}

function compactSnapshot(dto) {
  return {
    homeValue: dto.homeValue?.value ?? null,
    remainingBalance: dto.remainingMortgage?.value ?? null,
    equityAmount: dto.equity?.amount ?? null,
    equityPercent: dto.equity?.percent ?? null,
    ltv: dto.ltv?.percent ?? null,
    interestRate: dto.mortgage?.interestRate?.value ?? null,
    monthlyPayment: dto.mortgage?.monthlyPayment?.value ?? null,
    nextPaymentDue: dto.mortgage?.nextPaymentDue ?? null,
    paymentDueDay: dto.mortgage?.paymentDueDay ?? null,
    lastSalePrice: publicRecordAmount(dto.ownership?.purchasePrice?.value),
    lastSaleDate: dto.ownership?.purchaseDate ?? null,
    lastSaleImplausible: Boolean(dto.ownership?.lastSaleImplausible),
    occupancy: dto.ownership?.occupancy ?? null,
    ownerOccupied: dto.ownership?.ownerOccupied ?? null,
    originalMortgage: publicRecordAmount(dto.mortgage?.originalAmount?.value),
    originationDate: dto.mortgage?.originationDate ?? null,
    termMonths: dto.mortgage?.termMonths ?? null,
    assessedValue: dto.assessedValue?.value ?? null,
    assessorMarketValue: dto.assessorMarketValue?.value ?? null,
    annualTax: dto.tax?.annualAmount?.value ?? null,
    taxYear: dto.tax?.year ?? null,
    insurancePremium: dto.insurance?.annualPremium?.value ?? null,
    insuranceRenewalDate: dto.insurance?.renewalDate ?? null,
    hoaMonthly: dto.hoa?.monthlyAmount ?? null,
    hoaNextDue: dto.hoa?.nextDueDate ?? null,
    monthlyCostTotal: dto.monthlyCosts?.total ?? null,
    monthlyCostsPartial: Boolean(dto.monthlyCosts?.isPartial),
  };
}

function hasEnoughInsightData(snapshot) {
  const homeValue = toFiniteNumber(snapshot?.homeValue);
  const remaining = toFiniteNumber(snapshot?.remainingBalance);
  const rate = toFiniteNumber(snapshot?.interestRate);
  const payment = toFiniteNumber(snapshot?.monthlyPayment);
  return (
    homeValue != null &&
    homeValue > 0 &&
    remaining != null &&
    remaining > 0 &&
    (rate != null || payment != null)
  );
}

function normalizeAdviceAiResponse(parsed) {
  const raw = Array.isArray(parsed?.insights)
    ? parsed.insights
    : (Array.isArray(parsed?.flags) ? parsed.flags : []);
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const message = String(item.message || item.text || "").trim();
    if (!message) continue;
    const id = slugId(item.id, `advice-${out.length + 1}`);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      field: null,
      severity: "info",
      message: message.slice(0, 400),
      source: "ai",
      kind: "advice",
    });
    if (out.length >= MAX_ADVICE) break;
  }
  return out;
}

function buildAdvicePrompt(snapshot) {
  return `You write short, actionable financial advice for a homeowner from the snapshot below.

Rules:
- Suggest refinance position, payment schedule, insurance renewal, or HOA timing only when the snapshot supports it.
- Never invent, estimate, or suggest replacement numbers (no rates, balances, due dates, or sale amounts).
- Null fields and a missing or $0 public-record sale price or original mortgage are incomplete records, not problems. Do not mention them as issues or "unusual".
- Do not flag tax, occupancy, or data-quality concerns.
- At most 3 short homeowner-facing sentences.

Input snapshot (JSON):
${JSON.stringify(snapshot)}

Return JSON only:
{
  "insights": [
    { "id": "kebab-case-id", "message": "short homeowner-facing sentence" }
  ]
}

If you have nothing useful to add, return {"insights": []}.`;
}

module.exports = {
  compactSnapshot,
  hasEnoughInsightData,
  normalizeAdviceAiResponse,
  buildAdvicePrompt,
};
