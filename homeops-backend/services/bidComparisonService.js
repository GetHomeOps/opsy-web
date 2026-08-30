"use strict";

/**
 * Bid comparison + clarifying questions.
 * Builds a deterministic matrix first, then optionally asks the model for
 * a narrative, highlights, extra rows, and contractor questions.
 */

const OpenAI = require("openai");
const { parseMoney, formatMoney, priceStats } = require("./bidStatus");

const MODEL = process.env.AI_BID_COMPARISON_MODEL || "gpt-4o-mini";

const CERTAINTY = {
  STATED: "stated",
  INFERRED: "inferred",
  NOT_FOUND: "not_found",
};

const COMPARE_FIELDS = [
  { key: "totalPrice", label: "Total", aliases: ["totalPrice", "cost", "price", "amount", "total"] },
  { key: "labor", label: "Labor", aliases: ["labor", "laborCost", "laborPrice"] },
  { key: "materials", label: "Materials", aliases: ["materials", "materialCost", "materialsCost"] },
  { key: "scopeIncluded", label: "Scope included", aliases: ["scopeIncluded", "scope", "inclusions", "included"] },
  { key: "exclusions", label: "Exclusions", aliases: ["exclusions", "excluded", "notIncluded"] },
  { key: "warranty", label: "Warranty", aliases: ["warranty", "warrantyDetails", "warrantyTerm", "workmanshipWarranty"] },
  { key: "deposit", label: "Deposit / payment terms", aliases: ["deposit", "paymentTerms", "termsAndConditions"] },
  { key: "estimatedDuration", label: "Estimated duration", aliases: ["estimatedDuration", "duration", "timeline"] },
  { key: "proposedStartDate", label: "Proposed start date", aliases: ["proposedStartDate", "startDate"] },
  { key: "validUntil", label: "Quote expiration", aliases: ["validUntil", "expiration", "expires"] },
  { key: "permitResponsibility", label: "Permit responsibility", aliases: ["permitResponsibility", "permits", "permit"] },
  { key: "cleanup", label: "Cleanup / disposal", aliases: ["cleanup", "disposal", "cleanupDisposal"] },
  { key: "allowances", label: "Allowances", aliases: ["allowances", "allowance"] },
  { key: "changeOrderTerms", label: "Change-order terms", aliases: ["changeOrderTerms", "changeOrders"] },
];

const SCOPE_SYNONYMS = [
  { key: "floor_prep", label: "Floor preparation", patterns: [/floor\s*prep/i, /subfloor/i, /level(ing)?/i, /prep\s*work/i] },
  { key: "furniture", label: "Furniture removal", patterns: [/furniture/i, /move\s*(and\s*)?protect/i] },
  { key: "removal", label: "Removal / disposal", patterns: [/remov/i, /tear\s*out/i, /haul/i, /dispos/i, /demo/i] },
  { key: "cleanup", label: "Cleanup", patterns: [/cleanup/i, /clean\s*up/i] },
  { key: "permits", label: "Permits", patterns: [/permit/i] },
  { key: "warranty", label: "Warranty", patterns: [/warrant/i] },
];

function inferCertainty(finding) {
  const raw = String(finding?.certainty || "").toLowerCase().replace(/[\s-]+/g, "_");
  if (["stated", "clearly_stated", "clear"].includes(raw)) return CERTAINTY.STATED;
  if (["inferred", "ambiguous", "unclear", "potentially_ambiguous"].includes(raw)) {
    return CERTAINTY.INFERRED;
  }
  if (["not_found", "missing", "unknown"].includes(raw)) return CERTAINTY.NOT_FOUND;

  const value = finding?.value;
  if (value == null || value === "") return CERTAINTY.NOT_FOUND;
  const conf = Number(finding?.confidence);
  const hasEvidence = Boolean(finding?.evidence && String(finding.evidence).trim());
  if (hasEvidence && (!Number.isFinite(conf) || conf >= 0.75)) return CERTAINTY.STATED;
  if (Number.isFinite(conf) && conf < 0.5) return CERTAINTY.INFERRED;
  if (hasEvidence) return CERTAINTY.STATED;
  return CERTAINTY.INFERRED;
}

function findingsByKey(findings = []) {
  const map = new Map();
  for (const field of findings || []) {
    const key = String(field.fieldKey || field.key || "").trim();
    if (key) map.set(key, field);
  }
  return map;
}

function findField(byKey, aliases) {
  for (const alias of aliases) {
    if (byKey.has(alias)) return byKey.get(alias);
  }
  const lower = new Map(
    [...byKey.entries()].map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const alias of aliases) {
    const hit = lower.get(String(alias).toLowerCase());
    if (hit) return hit;
  }
  return null;
}

function displayValue(value) {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item == null) return "";
        if (typeof item === "string") return item;
        if (typeof item === "object") {
          return item.description || item.name || item.label || item.item || JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof value === "object") {
    return value.description || value.name || value.label || JSON.stringify(value);
  }
  return String(value);
}

function cellFromField(field, { money = false } = {}) {
  if (!field || field.value == null || field.value === "") {
    return {
      value: null,
      display: "Not listed",
      certainty: CERTAINTY.NOT_FOUND,
      evidence: null,
    };
  }
  const certainty = inferCertainty(field);
  const raw = displayValue(field.value);
  const amount = money ? parseMoney(field.value) : null;
  return {
    value: money ? amount : field.value,
    display:
      money && amount != null
        ? formatMoney(amount)
        : raw || "Not listed",
    certainty,
    evidence: field.evidence || null,
  };
}

function collectLineItemLabels(findings) {
  const byKey = findingsByKey(findings);
  const field = findField(byKey, ["lineItems", "line_items", "scopeIncluded", "scope"]);
  const value = field?.value;
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return item.description || item.name || item.label || item.item || "";
        }
        return String(item || "");
      })
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return String(value)
    .split(/[;\n•]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeScopeRows(bids) {
  const used = new Set();
  const rows = [];
  for (const syn of SCOPE_SYNONYMS) {
    const cells = {};
    let any = false;
    for (const bid of bids) {
      const labels = collectLineItemLabels(bid.findings);
      const match = labels.find((label) => syn.patterns.some((re) => re.test(label)));
      if (match) {
        any = true;
        used.add(match.toLowerCase());
        cells[bid.documentId] = {
          value: match,
          display: "Included",
          certainty: CERTAINTY.STATED,
          evidence: match,
        };
      } else {
        cells[bid.documentId] = {
          value: null,
          display: "Not listed",
          certainty: CERTAINTY.NOT_FOUND,
          evidence: null,
        };
      }
    }
    if (any) {
      rows.push({ key: syn.key, label: syn.label, cells });
    }
  }
  return { rows, used };
}

function buildBidSnapshot(bid) {
  const byKey = findingsByKey(bid.findings || bid.appliedFields || []);
  const totalField = findField(byKey, ["totalPrice", "cost", "price", "amount", "total"]);
  const installerField = findField(byKey, ["installer", "vendor", "contractor", "company"]);
  const fields = {};
  for (const spec of COMPARE_FIELDS) {
    fields[spec.key] = cellFromField(findField(byKey, spec.aliases), {
      money: spec.key === "totalPrice" || spec.key === "labor" || spec.key === "materials" || spec.key === "deposit",
    });
  }
  return {
    documentId: bid.documentId || bid.propertyDocumentId,
    analysisResultId: bid.id || bid.analysisResultId || null,
    documentName: bid.documentName || bid.document_name || "Quote",
    documentKey: bid.documentKey || bid.document_key || null,
    contractorName: displayValue(installerField?.value) || bid.documentName || "Contractor",
    installerEmail: displayValue(findField(byKey, ["installerEmail", "email"])?.value),
    total: parseMoney(totalField?.value),
    totalDisplay: fields.totalPrice.display,
    fields,
    findings: bid.findings || [],
  };
}

function buildMatrix(snapshots) {
  const rows = COMPARE_FIELDS.map((spec) => ({
    key: spec.key,
    label: spec.label,
    cells: Object.fromEntries(
      snapshots.map((snap) => [snap.documentId, snap.fields[spec.key]]),
    ),
  }));
  const { rows: scopeRows } = normalizeScopeRows(snapshots);
  const existingKeys = new Set(rows.map((r) => r.key));
  for (const extra of scopeRows) {
    if (!existingKeys.has(extra.key)) rows.push(extra);
  }
  return rows.filter((row) =>
    snapshots.some((snap) => {
      const cell = row.cells[snap.documentId];
      return cell && cell.certainty !== CERTAINTY.NOT_FOUND;
    }),
  );
}

function buildHighlights(snapshots, stats) {
  const highlights = [];
  if (stats.min != null) {
    const lowest = snapshots.filter((s) => s.total === stats.min);
    if (lowest.length === 1) {
      highlights.push({
        type: "lowest_price",
        label: "Lowest price",
        documentId: lowest[0].documentId,
        detail: `${lowest[0].contractorName} is the lowest at ${formatMoney(stats.min)}.`,
      });
    }
  }

  const completeness = snapshots.map((snap) => {
    const stated = Object.values(snap.fields).filter(
      (c) => c.certainty === CERTAINTY.STATED,
    ).length;
    return { snap, stated };
  });
  completeness.sort((a, b) => b.stated - a.stated);
  if (completeness.length > 1 && completeness[0].stated > completeness[1].stated) {
    highlights.push({
      type: "most_complete_scope",
      label: "Most complete scope",
      documentId: completeness[0].snap.documentId,
      detail: `${completeness[0].snap.contractorName} states the most scope and terms clearly.`,
    });
  }

  const warrantyYears = snapshots.map((snap) => {
    const text = String(snap.fields.warranty?.display || "");
    const match = text.match(/(\d+)\s*(year|yr)/i);
    return { snap, years: match ? Number(match[1]) : null, text };
  });
  const withYears = warrantyYears.filter((w) => w.years != null);
  if (withYears.length) {
    const best = withYears.reduce((a, b) => (b.years > a.years ? b : a));
    highlights.push({
      type: "strongest_warranty",
      label: "Strongest warranty",
      documentId: best.snap.documentId,
      detail: `${best.snap.contractorName} lists a ${best.years}-year warranty.`,
    });
  }

  const durations = snapshots.map((snap) => {
    const text = String(snap.fields.estimatedDuration?.display || "");
    const match = text.match(/(\d+)\s*(day|week|month)/i);
    const n = match ? Number(match[1]) : null;
    const unit = match ? match[2].toLowerCase() : null;
    let days = null;
    if (n != null) {
      days = unit.startsWith("week") ? n * 7 : unit.startsWith("month") ? n * 30 : n;
    }
    return { snap, days, text };
  });
  const withDuration = durations.filter((d) => d.days != null);
  if (withDuration.length) {
    const fastest = withDuration.reduce((a, b) => (b.days < a.days ? b : a));
    highlights.push({
      type: "fastest_timeline",
      label: "Fastest timeline",
      documentId: fastest.snap.documentId,
      detail: `${fastest.snap.contractorName} estimates ${fastest.text}.`,
    });
  }

  for (const snap of snapshots) {
    const missing = Object.entries(snap.fields)
      .filter(([, cell]) => cell.certainty === CERTAINTY.NOT_FOUND)
      .map(([key]) => COMPARE_FIELDS.find((f) => f.key === key)?.label || key);
    const unclear = Object.entries(snap.fields)
      .filter(([, cell]) => cell.certainty === CERTAINTY.INFERRED)
      .map(([key]) => COMPARE_FIELDS.find((f) => f.key === key)?.label || key);
    if (missing.length) {
      highlights.push({
        type: "missing_information",
        label: "Missing information",
        documentId: snap.documentId,
        detail: `${snap.contractorName} does not list: ${missing.slice(0, 4).join(", ")}.`,
      });
    }
    if (unclear.length) {
      highlights.push({
        type: "cost_uncertainty",
        label: "Potential cost uncertainty",
        documentId: snap.documentId,
        detail: `${snap.contractorName} is unclear on: ${unclear.slice(0, 3).join(", ")}.`,
      });
    }
  }

  return highlights;
}

function fieldLooksAnswered(field) {
  if (!field) return false;
  return inferCertainty(field) === CERTAINTY.STATED && field.value != null && field.value !== "";
}

function questionAlreadyAnswered(text, snapshot) {
  const q = String(text || "").toLowerCase();
  const byKey = findingsByKey(snapshot.findings);
  const checks = [
    { re: /level|subfloor|prep/i, keys: ["scopeIncluded", "lineItems"] },
    { re: /furniture/i, keys: ["scopeIncluded", "lineItems"] },
    { re: /dispos|remov|haul/i, keys: ["cleanup", "scopeIncluded", "lineItems"] },
    { re: /warrant/i, keys: ["warranty", "warrantyDetails", "warrantyTerm"] },
    { re: /brand|grade|material/i, keys: ["materials", "lineItems"] },
    { re: /deposit|payment/i, keys: ["deposit", "paymentTerms"] },
    { re: /permit/i, keys: ["permitResponsibility", "permits"] },
    { re: /increase|final price|change.?order/i, keys: ["changeOrderTerms", "allowances"] },
  ];
  for (const check of checks) {
    if (!check.re.test(q)) continue;
    if (check.keys.some((key) => fieldLooksAnswered(findField(byKey, [key, ...COMPARE_FIELDS.find((f) => f.key === key)?.aliases || []])))) {
      return true;
    }
    const labels = collectLineItemLabels(snapshot.findings).join(" ").toLowerCase();
    if (check.re.test(labels)) return true;
  }
  return false;
}

function defaultQuestionsForSnapshot(snapshot, { competing = [] } = {}) {
  const groups = { Scope: [], Materials: [], Warranty: [], Price: [], Terms: [] };
  const add = (category, text) => {
    if (questionAlreadyAnswered(text, snapshot)) return;
    groups[category].push({
      id: `q_${snapshot.documentId}_${category}_${groups[category].length}`,
      text,
      selected: true,
      source: "ai",
    });
  };

  if (snapshot.fields.scopeIncluded.certainty !== CERTAINTY.STATED) {
    add("Scope", "Does the quoted price include all prep work if needed?");
  }
  const labels = collectLineItemLabels(snapshot.findings).join(" ").toLowerCase();
  if (!/furniture/.test(labels)) {
    add("Scope", "Does your price include moving and protecting furniture?");
  }
  if (snapshot.fields.cleanup.certainty !== CERTAINTY.STATED && !/dispos|remov/.test(labels)) {
    add("Scope", "Is removal and disposal of existing materials included?");
  }
  if (snapshot.fields.materials.certainty !== CERTAINTY.STATED) {
    add("Materials", "What brand and grade are included in the quoted price?");
  }
  if (snapshot.fields.warranty.certainty !== CERTAINTY.STATED) {
    add("Warranty", "What workmanship warranty do you provide?");
  }
  if (snapshot.fields.changeOrderTerms.certainty !== CERTAINTY.STATED) {
    add("Price", "Are there circumstances that could increase the final price beyond this quote?");
  }
  if (snapshot.fields.deposit.certainty !== CERTAINTY.STATED) {
    add("Terms", "What deposit and payment schedule do you require?");
  }
  if (snapshot.fields.permitResponsibility.certainty !== CERTAINTY.STATED) {
    add("Terms", "Who is responsible for permits, if any are required?");
  }

  for (const other of competing) {
    if (other.documentId === snapshot.documentId) continue;
    if (
      other.fields.warranty.certainty === CERTAINTY.STATED &&
      snapshot.fields.warranty.certainty !== CERTAINTY.STATED
    ) {
      add(
        "Warranty",
        `A competing bid lists ${other.fields.warranty.display}. Can you confirm your warranty in writing?`,
      );
    }
    if (
      other.fields.cleanup.certainty === CERTAINTY.STATED &&
      snapshot.fields.cleanup.certainty !== CERTAINTY.STATED
    ) {
      add("Scope", "A competing bid includes cleanup and disposal. Is that in your price?");
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length)
    .map(([category, items]) => ({ category, items }));
}

function buildDeterministicNarrative(snapshots, stats, highlights) {
  if (!snapshots.length) return "No bids are linked to this action item yet.";
  if (snapshots.length === 1) {
    const only = snapshots[0];
    return `${only.contractorName} is the only bid so far${
      only.totalDisplay && only.totalDisplay !== "Not listed"
        ? ` at ${only.totalDisplay}`
        : ""
    }. Add another bid to compare price, scope, and terms side by side.`;
  }
  const lowest = highlights.find((h) => h.type === "lowest_price");
  const complete = highlights.find((h) => h.type === "most_complete_scope");
  const missing = highlights.filter((h) => h.type === "missing_information");
  const parts = [];
  if (lowest) parts.push(lowest.detail.replace(/\.$/, ""));
  if (complete) parts.push(complete.detail.replace(/\.$/, ""));
  if (stats.spread != null && stats.spread > 0) {
    parts.push(`the price spread is ${formatMoney(stats.spread)}`);
  }
  if (missing.length) {
    parts.push(
      `${missing.length} bid${missing.length === 1 ? "" : "s"} still ${
        missing.length === 1 ? "has" : "have"
      } important items that are not clearly listed`,
    );
  }
  if (!parts.length) {
    return "The bids are close enough that scope, warranty, and missing terms matter more than price alone.";
  }
  const sentence = parts.join(", while ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

function buildComparisonPayload(bids, { actionItemTitle } = {}) {
  const snapshots = (bids || []).map(buildBidSnapshot);
  const stats = priceStats(snapshots.map((s) => s.total));
  const matrix = buildMatrix(snapshots);
  const highlights = buildHighlights(snapshots, stats);
  const summary = buildDeterministicNarrative(snapshots, stats, highlights);
  const questions = snapshots.map((snap) => ({
    documentId: snap.documentId,
    contractorName: snap.contractorName,
    groups: defaultQuestionsForSnapshot(snap, { competing: snapshots }),
  }));

  return {
    actionItemTitle: actionItemTitle || null,
    snapshots,
    stats: {
      ...stats,
      minDisplay: formatMoney(stats.min),
      maxDisplay: formatMoney(stats.max),
      avgDisplay: formatMoney(stats.avg),
      spreadDisplay: formatMoney(stats.spread),
    },
    matrix,
    highlights,
    summary,
    questions,
    bidCount: snapshots.length,
  };
}

function filterAnsweredQuestions(questions, snapshots) {
  const byId = new Map(snapshots.map((s) => [Number(s.documentId), s]));
  return (questions || []).map((block) => ({
    ...block,
    groups: (block.groups || [])
      .map((group) => ({
        ...group,
        items: (group.items || []).filter((item) => {
          if (item.source === "user") return true;
          const snap = byId.get(Number(block.documentId));
          if (!snap) return true;
          return !questionAlreadyAnswered(item.text, snap);
        }),
      }))
      .filter((group) => group.items.length),
  }));
}

function mergeCustomQuestions(previous, next) {
  const prevByDoc = new Map(
    (previous || []).map((block) => [Number(block.documentId), block]),
  );
  return (next || []).map((block) => {
    const prior = prevByDoc.get(Number(block.documentId));
    const custom = (prior?.groups || [])
      .flatMap((g) => (g.items || []).filter((i) => i.source === "user"))
      .map((item) => ({ ...item, selected: item.selected !== false }));
    if (!custom.length) return block;
    const groups = [...(block.groups || [])];
    const other = groups.find((g) => g.category === "Other");
    if (other) other.items = [...other.items, ...custom];
    else groups.push({ category: "Other", items: custom });
    return { ...block, groups };
  });
}

async function enrichComparisonWithAi(payload, { actionItemTitle } = {}) {
  if (!process.env.OPENAI_API_KEY || payload.snapshots.length === 0) {
    return payload;
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const compact = payload.snapshots.map((s) => ({
    documentId: s.documentId,
    contractorName: s.contractorName,
    total: s.totalDisplay,
    fields: Object.fromEntries(
      Object.entries(s.fields).map(([k, cell]) => [
        k,
        { display: cell.display, certainty: cell.certainty },
      ]),
    ),
  }));
  const prompt = `You compare home-repair contractor bids. Do NOT invent a numeric score.
Action item: ${actionItemTitle || "this project"}
Bids JSON:
${JSON.stringify(compact)}

Return ONLY JSON:
{
  "summary": "2-3 sentences explaining WHY one bid may be stronger. Mention missing or unclear items. No scores.",
  "highlights": [{"type":"lowest_price|most_complete_scope|strongest_warranty|fastest_timeline|missing_information|cost_uncertainty","label":"...","documentId":123,"detail":"why"}],
  "questions": [{"documentId":123,"contractorName":"...","groups":[{"category":"Scope|Materials|Warranty|Price|Terms","items":[{"text":"..."}]}]}]
}
Skip any question already clearly answered in that bid. Prefer missing info, ambiguous language, hidden-cost risk, and differences versus competing bids.`;

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a careful homeowner procurement assistant." },
        { role: "user", content: prompt },
      ],
    });
    const raw = completion.choices?.[0]?.message?.content;
    const parsed = raw ? JSON.parse(raw) : {};
    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : payload.summary;
    const highlights = Array.isArray(parsed.highlights) && parsed.highlights.length
      ? parsed.highlights
      : payload.highlights;
    let questions = payload.questions;
    if (Array.isArray(parsed.questions) && parsed.questions.length) {
      questions = parsed.questions.map((block) => ({
        documentId: block.documentId,
        contractorName: block.contractorName,
        groups: (block.groups || []).map((group, gi) => ({
          category: group.category || "Other",
          items: (group.items || []).map((item, ii) => ({
            id: item.id || `q_${block.documentId}_${gi}_${ii}`,
            text: item.text || item,
            selected: item.selected !== false,
            source: "ai",
          })),
        })),
      }));
      questions = filterAnsweredQuestions(questions, payload.snapshots);
    }
    return { ...payload, summary, highlights, questions };
  } catch (err) {
    console.warn("[bidComparisonService] AI enrich failed:", err.message);
    return payload;
  }
}

module.exports = {
  CERTAINTY,
  COMPARE_FIELDS,
  inferCertainty,
  buildBidSnapshot,
  buildComparisonPayload,
  filterAnsweredQuestions,
  mergeCustomQuestions,
  questionAlreadyAnswered,
  enrichComparisonWithAi,
  defaultQuestionsForSnapshot,
};
