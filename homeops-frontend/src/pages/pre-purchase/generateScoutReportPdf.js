import {jsPDF} from "jspdf";
import autoTable from "jspdf-autotable";
import {buildScoutTakeaways} from "./scoutTakeaways";

const BRAND = [69, 101, 100]; // #456564
const MUTED = [100, 100, 100];
const DARK = [23, 23, 23];
const MARGIN = 48;
const PAGE_WIDTH = 612; // letter
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function addFooter(doc, pageNumber, pageCount) {
  const y = doc.internal.pageSize.getHeight() - 28;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Opsy Scout Report", MARGIN, y);
  doc.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - MARGIN, y, {
    align: "right",
  });
}

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
 * Generate and download a professional Opsy Scout PDF report.
 * @param {object} analysis
 */
export function generateScoutReportPdf(analysis) {
  const takeaways = buildScoutTakeaways(analysis);
  if (!takeaways) {
    throw new Error("No analysis data available for the report.");
  }

  const doc = new jsPDF({unit: "pt", format: "letter"});
  let y = MARGIN;

  // Cover header
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_WIDTH, 110, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("OPSY SCOUT", MARGIN, 40);
  doc.setFontSize(22);
  doc.text("Property Analysis Report", MARGIN, 68);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Prepared ${takeaways.analysisDate}`, MARGIN, 90);

  y = 140;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...DARK);
  const nameLines = doc.splitTextToSize(takeaways.name, CONTENT_WIDTH);
  doc.text(nameLines, MARGIN, y);
  y += nameLines.length * 22 + 6;

  if (takeaways.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    const addrLines = doc.splitTextToSize(takeaways.address, CONTENT_WIDTH);
    doc.text(addrLines, MARGIN, y);
    y += addrLines.length * 14 + 12;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND);
  doc.text(`Overall condition: ${takeaways.ratingLabel}`, MARGIN, y);
  y += 28;

  // Executive summary
  y = sectionHeading(doc, "Executive Summary", y);
  y = bodyText(doc, takeaways.executiveSummary, y, {fontSize: 11, lineHeight: 16});
  y += 20;

  // Snapshot
  y = sectionHeading(doc, "Condition Snapshot", y);
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
      0: {fontStyle: "bold", cellWidth: 180},
      1: {cellWidth: CONTENT_WIDTH - 180},
    },
    body: [
      [
        "Condition score",
        takeaways.score != null
          ? `${takeaways.score} (${takeaways.ratingLabel})`
          : takeaways.ratingLabel,
      ],
      ["Major issues", String(takeaways.issueCounts.major)],
      ["Moderate issues", String(takeaways.issueCounts.moderate)],
      ["Minor issues", String(takeaways.issueCounts.minor)],
      ["Estimated repair range", takeaways.repairRange],
      ...(takeaways.repairConfidence
        ? [["Repair confidence", takeaways.repairConfidence]]
        : []),
    ],
  });
  y = doc.lastAutoTable.finalY + 12;
  y = bodyText(doc, takeaways.scoreBlurb, y, {
    fontSize: 9,
    color: MUTED,
    lineHeight: 13,
  });
  y += 20;

  // Top concerns
  y = sectionHeading(doc, "Top Concerns", y);
  if (takeaways.concerns.length === 0) {
    y = bodyText(doc, "No top concerns listed.", y, {color: MUTED});
  } else {
    autoTable(doc, {
      startY: y,
      margin: {left: MARGIN, right: MARGIN},
      head: [["Concern", "Severity"]],
      body: takeaways.concerns.map((c) => [
        c.title,
        c.severity
          ? c.severity.charAt(0).toUpperCase() + c.severity.slice(1)
          : "—",
      ]),
      theme: "striped",
      headStyles: {
        fillColor: BRAND,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
      },
      styles: {
        font: "helvetica",
        fontSize: 10,
        cellPadding: 8,
        textColor: DARK,
      },
      columnStyles: {
        0: {cellWidth: CONTENT_WIDTH - 90},
        1: {cellWidth: 90},
      },
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  // Positives
  y = ensureSpace(doc, y, 40);
  y = sectionHeading(doc, "Positive Findings", y);
  if (takeaways.positives.length === 0) {
    y = bodyText(doc, "No positive findings listed.", y, {color: MUTED});
  } else {
    for (const p of takeaways.positives) {
      y = ensureSpace(doc, y, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      const bullet = `•  ${p}`;
      const lines = doc.splitTextToSize(bullet, CONTENT_WIDTH);
      doc.text(lines, MARGIN, y);
      y += lines.length * 14 + 4;
    }
  }
  y += 16;

  // Recommendations
  y = ensureSpace(doc, y, 40);
  y = sectionHeading(doc, "Key Recommendations", y);
  if (takeaways.recommendations.length === 0) {
    y = bodyText(doc, "No recommendations yet.", y, {color: MUTED});
  } else {
    takeaways.recommendations.forEach((r, i) => {
      y = ensureSpace(doc, y, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      const lines = doc.splitTextToSize(`${i + 1}.  ${r}`, CONTENT_WIDTH);
      doc.text(lines, MARGIN, y);
      y += lines.length * 14 + 6;
    });
  }
  y += 20;

  // Disclaimer
  y = ensureSpace(doc, y, 80);
  y = sectionHeading(doc, "Disclaimer", y);
  y = bodyText(doc, takeaways.disclaimer, y, {
    fontSize: 8,
    color: MUTED,
    lineHeight: 12,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(doc, i, pageCount);
  }

  doc.save(`opsy-scout-${takeaways.fileSlug}.pdf`);
}
