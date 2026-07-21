import {jsPDF} from "jspdf";
import autoTable from "jspdf-autotable";
import {formatAddress, formatCurrency, formatDisplayName} from "./prePurchaseUtils";
import {computeTrueCostMetrics} from "./trueCostCalculations";

const BRAND = [69, 101, 100];
const MUTED = [100, 100, 100];
const DARK = [23, 23, 23];
const MARGIN = 48;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const DISCLAIMER =
  "All values are estimates based on listing and inspection data. Not a guarantee of costs. Not a lender quote, appraisal, inspection, engineering opinion, or contractor quote. Consult your lender and agent.";

function ensureSpace(doc, y, needed) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 48) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function sectionHeading(doc, title, y) {
  y = ensureSpace(doc, y, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BRAND);
  doc.text(title.toUpperCase(), MARGIN, y);
  y += 6;
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(1);
  doc.line(MARGIN, y, MARGIN + 40, y);
  return y + 18;
}

function bodyText(doc, text, y, options = {}) {
  const {fontSize = 10, color = DARK, lineHeight = 14} = options;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(String(text || ""), CONTENT_WIDTH);
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight);
    doc.text(line, MARGIN, y);
    y += lineHeight;
  }
  return y;
}

/**
 * Generate and download a True Cost buyer summary PDF.
 * @param {object} analysis
 * @param {object} state True Cost form state
 */
export function generateTrueCostBuyerSummaryPdf(analysis, state) {
  const metrics = computeTrueCostMetrics(state);
  const doc = new jsPDF({unit: "pt", format: "letter"});
  let y = MARGIN;

  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_WIDTH, 110, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("OPSY SCOUT", MARGIN, 40);
  doc.setFontSize(22);
  doc.text("True Cost Buyer Summary", MARGIN, 68);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Prepared ${new Date().toLocaleDateString()}`, MARGIN, 90);

  y = 140;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  const name = formatDisplayName(analysis);
  doc.text(doc.splitTextToSize(name, CONTENT_WIDTH), MARGIN, y);
  y += 24;
  const address = formatAddress(analysis);
  if (address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text(doc.splitTextToSize(address, CONTENT_WIDTH), MARGIN, y);
    y += 28;
  }

  y = sectionHeading(doc, "Summary", y);
  autoTable(doc, {
    startY: y,
    margin: {left: MARGIN, right: MARGIN},
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: {top: 6, bottom: 6, left: 0, right: 8},
      textColor: DARK,
    },
    columnStyles: {
      0: {fontStyle: "bold", cellWidth: 220},
      1: {cellWidth: CONTENT_WIDTH - 220},
    },
    body: [
      ["Offer price", formatCurrency(state.offerPrice)],
      ["Listing price", formatCurrency(state.listingPrice)],
      ["True cost to acquire", formatCurrency(metrics.trueCostToAcquire)],
      ["True monthly cost", formatCurrency(metrics.trueMonthlyCost)],
      ["Cash to close", formatCurrency(metrics.cashToClose)],
      ["Condition-adjusted offer", formatCurrency(metrics.conditionAdjustedOffer)],
      ["5-year estimated cash outlay", formatCurrency(metrics.fiveYearCashOutlay)],
    ],
  });
  y = doc.lastAutoTable.finalY + 16;

  y = sectionHeading(doc, "Financing Inputs", y);
  autoTable(doc, {
    startY: y,
    margin: {left: MARGIN, right: MARGIN},
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: {top: 5, bottom: 5, left: 0, right: 8},
      textColor: DARK,
    },
    columnStyles: {
      0: {fontStyle: "bold", cellWidth: 220},
      1: {cellWidth: CONTENT_WIDTH - 220},
    },
    body: [
      ["Down payment", `${formatCurrency(metrics.downPaymentAmount)} (${state.downPaymentPercent}%)`],
      ["Loan amount", formatCurrency(metrics.loanAmount)],
      ["Interest rate", `${state.interestRate}%`],
      ["Loan term", `${state.loanTermYears} years`],
      ["Property tax", `${state.propertyTaxPercent}% /yr`],
      ["Insurance", `${formatCurrency(state.insuranceMonthly)} /mo`],
      ["Closing costs", formatCurrency(state.closingCosts)],
      [
        "Maintenance reserve",
        state.maintenanceReserveEnabled
          ? `${state.maintenanceReservePercent}% /yr`
          : "Off",
      ],
    ],
  });
  y = doc.lastAutoTable.finalY + 16;

  y = sectionHeading(doc, "Repairs", y);
  autoTable(doc, {
    startY: y,
    margin: {left: MARGIN, right: MARGIN},
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: {top: 5, bottom: 5, left: 0, right: 8},
      textColor: DARK,
    },
    columnStyles: {
      0: {fontStyle: "bold", cellWidth: 220},
      1: {cellWidth: CONTENT_WIDTH - 220},
    },
    body: [
      ["Immediate (must-fix)", formatCurrency(metrics.immediateRepairTotal)],
      ["Deferred (3–5 yr)", formatCurrency(metrics.deferredRepairTotal)],
      ["Included total", formatCurrency(metrics.includedRepairTotal)],
    ],
  });
  y = doc.lastAutoTable.finalY + 16;

  y = sectionHeading(doc, "Monthly Ownership", y);
  autoTable(doc, {
    startY: y,
    margin: {left: MARGIN, right: MARGIN},
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: {top: 5, bottom: 5, left: 0, right: 8},
      textColor: DARK,
    },
    columnStyles: {
      0: {fontStyle: "bold", cellWidth: 220},
      1: {cellWidth: CONTENT_WIDTH - 220},
    },
    body: [
      ["Principal & interest", formatCurrency(metrics.monthlyPrincipalAndInterest)],
      ["Property taxes", formatCurrency(metrics.monthlyPropertyTax)],
      ["Homeowners insurance", formatCurrency(metrics.monthlyInsurance)],
      ["Maintenance reserve", formatCurrency(metrics.monthlyMaintenanceReserve)],
      ["Total monthly ownership", formatCurrency(metrics.trueMonthlyCost)],
    ],
  });
  y = doc.lastAutoTable.finalY + 16;

  y = sectionHeading(doc, "Agent Takeaways", y);
  y = bodyText(doc, metrics.takeaways.affordabilityImpact, y);
  y += 6;
  y = bodyText(doc, metrics.takeaways.inspectionLeverage, y);
  y += 6;
  y = bodyText(doc, metrics.takeaways.suggestedNextStep, y);
  y += 16;

  y = sectionHeading(doc, "Disclaimer", y);
  y = bodyText(doc, DISCLAIMER, y, {fontSize: 9, color: MUTED, lineHeight: 13});
  y += 10;
  y = bodyText(
    doc,
    "Five-year cash outlay is an estimate and does not account for appreciation, sale proceeds, tax effects, or remaining equity.",
    y,
    {fontSize: 9, color: MUTED, lineHeight: 13},
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 28;
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Opsy Scout True Cost Summary", MARGIN, footerY);
    doc.text(`Page ${i} of ${pageCount}`, PAGE_WIDTH - MARGIN, footerY, {
      align: "right",
    });
  }

  const safeName = String(name || "property")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  doc.save(`opsy-scout-true-cost-${safeName || "summary"}.pdf`);
}
