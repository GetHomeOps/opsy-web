"use strict";

/**
 * Pre-Purchase Analysis Service
 *
 * Downloads uploaded documents from S3, extracts text (PDF) or uses vision
 * (images), runs the shared Properties inspection analysis pipeline, maps
 * results into Pre-Purchase tables, enriches with cost estimates, and
 * matches professionals from the directory.
 */

const { PDFParse } = require("pdf-parse");
const OpenAI = require("openai");
const db = require("../db");
const { getFile } = require("./s3Service");
const PrePurchaseAnalysis = require("../models/prePurchaseAnalysis");
const PrePurchaseTrueCost = require("../models/prePurchaseTrueCost");
const Professional = require("../models/professional");
const PropertyFinancials = require("../models/propertyFinancials");
const { logAiUsage } = require("./usageService");
const { analyzeInspectionText } = require("./inspectionAnalysisService");
const { composeFromRow } = require("./propertyFinancialsCompose");
const { fetchAttomAvm } = require("./attomLookupService");
const { mapAttomAvm } = require("./attomFinancialsMapper");
const {
  computeOverallConditionScore,
  scoreToRating,
} = require("./scoutConditionScore");

const MODEL = process.env.AI_PRE_PURCHASE_MODEL || process.env.AI_DOCUMENT_ANALYSIS_MODEL || "gpt-4o-mini";
const VISION_MODEL =
  process.env.AI_PRE_PURCHASE_VISION_MODEL ||
  process.env.AI_DOCUMENT_ANALYSIS_VISION_MODEL ||
  "gpt-4o-mini";

const SYSTEM_DEFS = [
  { key: "roof", label: "Roof" },
  { key: "foundation", label: "Foundation" },
  { key: "exterior", label: "Exterior" },
  { key: "hvac", label: "HVAC" },
  { key: "plumbing", label: "Plumbing" },
  { key: "electrical", label: "Electrical" },
  { key: "windows_doors", label: "Windows & Doors" },
  { key: "interior", label: "Interior" },
  { key: "appliances", label: "Appliances" },
  { key: "other", label: "Other" },
];

const SYSTEM_CATEGORY_KEYWORDS = {
  roof: ["roof"],
  foundation: ["foundation", "structural", "general contractor"],
  exterior: ["siding", "painter", "landscap", "fence", "exterior"],
  hvac: ["hvac", "heating", "cooling", "air conditioning"],
  plumbing: ["plumb", "water", "septic", "well"],
  electrical: ["electric", "solar", "generator", "low voltage"],
  windows_doors: ["window", "door"],
  interior: ["interior", "floor", "paint", "remodel", "tile", "cabinet"],
  appliances: ["appliance"],
  other: ["general contractor", "home inspection", "pest"],
};

const MAX_RATE_LIMIT_WAIT_MS = 35000;

const COST_ENRICHMENT_PROMPT = `You are estimating repair/negotiation cost ranges for a pre-purchase home analysis.
Given the structured findings and systems below, return ONLY valid JSON:
{
  "repairCostLow": number or null,
  "repairCostHigh": number or null,
  "repairConfidence": "low|medium|high",
  "findingCosts": [
    { "index": 0, "estimatedCostLow": number or null, "estimatedCostHigh": number or null }
  ],
  "systemCosts": [
    { "systemKey": "roof", "repairCostLow": number or null, "repairCostHigh": number or null }
  ]
}

Rules:
- Costs are rough USD estimates for a US residential buyer/agent — not quotes.
- Prefer null over inventing costs when there is no basis.
- findingCosts.index must match the findings array index provided.
- Sum of finding midpoints should roughly align with overall repairCostLow/High when both are present.
- Do not invent new findings or systems.

Structured analysis:
`;

const CONDITION_MODIFIERS_PROMPT = `You are evaluating qualitative inspection modifiers for a pre-purchase home analysis.

PROPERTY CONDITION SCORING

Do not derive property condition primarily from the number of inspection findings.
Home inspection reports routinely document many minor or moderate defects.
Estimated repair burden is the primary quantitative indicator of overall condition.

Your role is to identify qualitative factors that justify a limited adjustment to the repair-based baseline.

Focus particularly on:
- Structural integrity
- Safety
- Active water intrusion
- Habitability
- Failure of essential systems
- Remaining useful life of major systems
- Unusual deterioration not adequately captured by estimated repair cost

Avoid double-counting defects already reflected in the repair estimate.
Ordinary deferred maintenance should not turn an otherwise functional property into a 30–50 score.
A property requiring approximately $15,000–$30,000 in repairs will commonly fall around 70–80 unless there are unusually serious structural, safety, or habitability concerns.
The count of major/moderate/minor findings should not independently determine the condition score.

Modifier guidance (use 0 when the category does not apply):
- Mostly cosmetic/minor findings: positiveConditionModifier 0 to +3
- Major systems generally in good condition: majorSystemsModifier +2 to +5
- One aging but functional major system: majorSystemsModifier -2 to -4
- One major system needing replacement soon: majorSystemsModifier -4 to -7
- Multiple major systems needing replacement: majorSystemsModifier -6 to -12
- Active roof leak / meaningful water intrusion: waterDamageModifier -4 to -10
- Serious electrical/fire-safety hazard: safetyModifier -5 to -10
- Significant foundation/structural issue: structuralModifier -10 to -20
- Serious habitability issue: habitabilityModifier significant negative

Do not apply a large negative modifier simply because a defect is already priced into the repair range.
Qualitative modifiers should reflect risk beyond what repair cost alone captures.
Avoid double-counting the same defect across several categories.

Set exceptionalCircumstances true ONLY for genuinely exceptional circumstances such as:
- Severe structural instability
- Major foundation failure
- Extensive active water damage
- Serious fire/electrical hazard
- Unsafe occupancy
- Failed essential utilities
- Major environmental/habitability concern supported by the inspection

A high number of findings alone must NEVER qualify as exceptionalCircumstances.

Set unsafeOccupancy true only with strong evidence that the property is unsafe for normal occupancy.
Set significantStructuralFailure true only with strong evidence of significant unresolved structural failure.

Return ONLY valid JSON:
{
  "structuralModifier": number,
  "safetyModifier": number,
  "waterDamageModifier": number,
  "majorSystemsModifier": number,
  "habitabilityModifier": number,
  "positiveConditionModifier": number,
  "exceptionalCircumstances": false,
  "exceptionalReason": null,
  "unsafeOccupancy": false,
  "significantStructuralFailure": false,
  "reasoning": ["brief reason"]
}

Structured analysis:
`;

async function chatCompletionWithRetry(openai, params, { label = "openai", maxRetries = 4 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status;
      const retryable = status === 429 || (status >= 500 && status < 600);
      if (!retryable || attempt === maxRetries) throw err;
      const suggested = /try again in ([\d.]+)\s*s/i.exec(err?.message || "");
      let waitMs = suggested
        ? Math.ceil(parseFloat(suggested[1]) * 1000) + 750
        : Math.min(2000 * Math.pow(2, attempt), MAX_RATE_LIMIT_WAIT_MS);
      waitMs = Math.min(waitMs, MAX_RATE_LIMIT_WAIT_MS);
      console.warn(
        `[prePurchaseAnalysis] ${label}: ${status} — retrying in ${Math.round(waitMs / 1000)}s`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

function parseJsonContent(content) {
  if (!content) return null;
  let text = content.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function extractTextFromPdf(buffer) {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return { text: result.text || "", pageCount: result.total || result.numpages || null };
  } catch (err) {
    console.error("[prePurchaseAnalysis] PDF parse error:", err.message);
    return { text: "", pageCount: null };
  }
}

function isImageMime(mime) {
  return typeof mime === "string" && mime.startsWith("image/");
}

async function extractViaVision(openai, buffer, mimeType, usageCtx) {
  const b64 = buffer.toString("base64");
  const completion = await chatCompletionWithRetry(
    openai,
    {
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all readable text from this property document image. Include any condition notes, deficiencies, cost figures, and page labels. Return plain text only.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${b64}` },
            },
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0,
    },
    { label: "vision-extract" }
  );
  if (usageCtx && completion.usage) {
    logAiUsage({
      accountId: usageCtx.accountId,
      userId: usageCtx.userId,
      model: `openai/${VISION_MODEL}`,
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      endpoint: "pre-purchase/vision-extract",
    }).catch(() => {});
  }
  return completion.choices[0]?.message?.content || "";
}

function applyOverallConditionScore(structured, { estimatedPropertyValue = null } = {}) {
  if (!structured) return structured;
  const result = computeOverallConditionScore({
    repairCostLow: structured.repairCostLow,
    repairCostHigh: structured.repairCostHigh,
    estimatedPropertyValue,
    modifiers: structured.conditionModifiers,
  });
  structured.overallConditionScore = result.finalScore;
  structured.overallConditionRating = result.rating;
  structured.scoringAudit = result.audit;
  return structured;
}

function toPositiveNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resolve estimated property value for relative repair-burden scoring.
 * Never substitutes assessed/market value for AVM.
 */
async function resolveEstimatedPropertyValue(analysis) {
  if (!analysis) return null;

  const propertyId = analysis.property_id ?? analysis.propertyId ?? null;
  if (propertyId) {
    try {
      const row = await PropertyFinancials.get(propertyId);
      if (row) {
        const dto = composeFromRow(row, { attomStatus: "ready" });
        const homeValue = toPositiveNumber(dto?.homeValue?.value);
        if (homeValue != null) return homeValue;
      }
    } catch (err) {
      console.warn("[prePurchaseAnalysis] financials value lookup failed:", err.message);
    }
  }

  const street = analysis.street || analysis.addressLine1 || null;
  const city = analysis.city || null;
  const state = analysis.state || null;
  const zip = analysis.zip || null;
  if (street && (city || zip)) {
    try {
      const avmLookup = await fetchAttomAvm({
        addressLine1: street,
        city,
        state,
        zip,
      });
      if (avmLookup.status === "success") {
        const mapped = mapAttomAvm(avmLookup.rawProperty);
        const avmValue = toPositiveNumber(mapped?.avm_value);
        if (avmValue != null) return avmValue;
      }
    } catch (err) {
      console.warn("[prePurchaseAnalysis] AVM lookup failed:", err.message);
    }
  }

  const identity = analysis.identity_data || analysis.identityData || {};
  const identityValue = toPositiveNumber(identity.estimatedValue ?? identity.estimated_value);
  if (identityValue != null) return identityValue;

  const analysisId = analysis.id ?? null;
  if (analysisId) {
    try {
      const trueCost = await PrePurchaseTrueCost.getByAnalysisId(analysisId);
      const listing = toPositiveNumber(trueCost?.listing_price);
      if (listing != null) return listing;
    } catch (err) {
      console.warn("[prePurchaseAnalysis] true-cost listing lookup failed:", err.message);
    }
  }

  return null;
}

function normalizeSystemKey(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, "_");
  const aliases = {
    heating: "hvac",
    cooling: "hvac",
    ac: "hvac",
    air_conditioning: "hvac",
    water_heating: "plumbing",
    waterheating: "plumbing",
    gutters: "roof",
    windows: "windows_doors",
    doors: "windows_doors",
    window: "windows_doors",
    structure: "foundation",
    framing: "foundation",
    siding: "exterior",
    attic: "exterior",
    safety: "other",
  };
  const key = aliases[s] || s;
  if (SYSTEM_DEFS.some((d) => d.key === key)) return key;
  return "other";
}

function labelForSystem(key) {
  return SYSTEM_DEFS.find((d) => d.key === key)?.label || "Other";
}

/** Life-safety / code-critical language — used to boost true majors. */
const SAFETY_RE =
  /\b(fire\s*(barrier|stop|separation|wall|door)|smoke\s*(detector|alarm)|carbon\s*monoxide|\bco\s*detector|gas\s*leak|structural\s*(damage|failure|crack)|collapse|life[\s-]?safety|electrocution|ungrounded|open\s*ground|scald|asbestos|radon|active\s*leak|double[\s-]?tapped|overheated)\b/i;

function evidenceExcerpt(evidence) {
  if (!evidence) return null;
  if (typeof evidence === "string") return evidence;
  if (typeof evidence === "object") {
    return evidence.excerpt || evidence.quote || evidence.text || JSON.stringify(evidence);
  }
  return String(evidence);
}

function findingText(n) {
  return [n.title, n.suggestedAction, evidenceExcerpt(n.evidence)].filter(Boolean).join(" ");
}

function compositeFindingScore(n) {
  const sevRank =
    { critical: 4, high: 3, medium: 2, low: 1 }[String(n.severity || "").toLowerCase()] || 2;
  const priRank =
    { urgent: 2, high: 2, medium: 1, low: 0 }[String(n.priority || "").toLowerCase()] || 1;
  const impact = Number(n.impactScore);
  const impactN = Number.isFinite(impact) ? impact : 5;
  let score = impactN * 1.2 + sevRank * 1.5 + priRank;
  if (SAFETY_RE.test(findingText(n))) score += 4;
  return score;
}

/**
 * Inspection models over-label priority as "urgent" and severity as "high".
 * For pre-purchase, force a balanced distribution by relative rank so buyers
 * see major / moderate / minor — not a wall of majors.
 */
function calibrateFindingSeverity(needsAttention) {
  const enriched = needsAttention.map((n, index) => ({
    index,
    score: compositeFindingScore(n),
    isSafety: SAFETY_RE.test(findingText(n)),
  }));
  enriched.sort((a, b) => b.score - a.score || a.index - b.index);

  const n = enriched.length;
  const majorSlots = n === 0 ? 0 : Math.min(3, Math.max(1, Math.ceil(n * 0.22)));
  const minorSlots = n === 0 ? 0 : Math.min(Math.floor(n * 0.34), Math.max(0, n - majorSlots));

  const byIndex = new Map();
  enriched.forEach((item, rank) => {
    let severity;
    if (rank < majorSlots && (item.isSafety || item.score >= 10 || n <= 3)) {
      severity = "major";
    } else if (rank >= n - minorSlots) {
      severity = "minor";
    } else {
      severity = "moderate";
    }
    // Safety findings should not collapse to minor
    if (item.isSafety && severity === "minor") severity = "moderate";
    // Non-safety items in major slots with weak scores stay moderate
    if (severity === "major" && !item.isSafety && item.score < 10 && n > 3) {
      severity = "moderate";
    }

    let urgency;
    if (severity === "major" && item.isSafety) urgency = "immediate";
    else if (severity === "major") urgency = "near_term";
    else if (severity === "minor") urgency = item.score <= 7 ? "monitor" : "long_term";
    else urgency = "near_term";

    byIndex.set(item.index, { severity, urgency });
  });

  // If calibration produced zero majors but we have a clear safety item, promote the top safety hit
  const hasMajor = [...byIndex.values()].some((v) => v.severity === "major");
  if (!hasMajor) {
    const topSafety = enriched.find((e) => e.isSafety);
    if (topSafety) {
      byIndex.set(topSafety.index, { severity: "major", urgency: "immediate" });
    }
  }

  return byIndex;
}

function mapUrgencyFromPriority(priority, suggestedWhen = "", severity = null) {
  const p = String(priority || "").toLowerCase();
  const when = String(suggestedWhen || "").toLowerCase();
  const sev = String(severity || "").toLowerCase();

  if (sev === "critical" || /immediate|asap|as soon as possible|0-30\s*day|within\s*30/.test(when)) {
    return "immediate";
  }
  // Do NOT treat bare priority "urgent" as immediate — the inspection model overuses it.
  if (p === "low" || /monitor|ongoing|as needed|annually|yearly|optional/.test(when)) {
    return "monitor";
  }
  if (/1-?3\s*year|long.?term|eventually|future|within\s*2\s*year/.test(when)) {
    return "long_term";
  }
  if (p === "high" || p === "urgent" || /near.?term|within\s*(3|6|12)\s*month|this\s*year/.test(when)) {
    return "near_term";
  }
  if (sev === "low") return "monitor";
  return "near_term";
}

const CONDITION_RANK = { poor: 4, fair: 3, unknown: 2, good: 1, excellent: 0 };
const URGENCY_RANK = { immediate: 4, near_term: 3, long_term: 2, monitor: 1 };

function worseCondition(a, b) {
  return (CONDITION_RANK[a] || 0) >= (CONDITION_RANK[b] || 0) ? a : b;
}

function worseUrgency(a, b) {
  return (URGENCY_RANK[a] || 0) >= (URGENCY_RANK[b] || 0) ? a : b;
}

/**
 * Deduplicate systems that collapse to the same Pre-Purchase key
 * (e.g. heating + ac → hvac) so UNIQUE(analysis_id, system_key) is respected.
 */
function mergeSystemsByKey(systems) {
  const byKey = new Map();
  for (const s of systems) {
    const key = normalizeSystemKey(s.systemKey || s.system_key);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...s, systemKey: key });
      continue;
    }
    const mergedSources = [
      ...(existing.evidenceSources || []),
      ...(s.evidenceSources || []),
    ].slice(0, 8);
    byKey.set(key, {
      ...existing,
      condition: worseCondition(existing.condition, s.condition),
      conditionConfidence: Math.max(
        Number(existing.conditionConfidence) || 0,
        Number(s.conditionConfidence) || 0
      ) || null,
      urgency: worseUrgency(existing.urgency, s.urgency),
      evidenceSummary: [existing.evidenceSummary, s.evidenceSummary]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 1000) || null,
      evidenceSources: mergedSources,
      remainingLife: existing.remainingLife || s.remainingLife || null,
      nextService: existing.nextService || s.nextService || null,
      repairCostLow:
        existing.repairCostLow != null && s.repairCostLow != null
          ? Math.min(existing.repairCostLow, s.repairCostLow)
          : existing.repairCostLow ?? s.repairCostLow ?? null,
      repairCostHigh:
        existing.repairCostHigh != null && s.repairCostHigh != null
          ? Math.max(existing.repairCostHigh, s.repairCostHigh)
          : existing.repairCostHigh ?? s.repairCostHigh ?? null,
    });
  }
  return [...byKey.values()];
}

/**
 * Map shared inspection analysis output into Pre-Purchase structured shape.
 * Scoring happens later in finalizeOverallCondition after costs and modifiers.
 * @param {object} analyzed
 */
function mapInspectionResultToPrePurchase(analyzed) {
  const systemsDetected = analyzed.systemsDetected || [];
  const needsAttention = analyzed.needsAttention || [];
  const maintenanceSuggestions = analyzed.maintenanceSuggestions || [];

  const calibrated = calibrateFindingSeverity(needsAttention);

  const findings = needsAttention.map((n, index) => {
    const systemKey = normalizeSystemKey(n.systemType);
    const calibratedSev = calibrated.get(index) || {
      severity: "moderate",
      urgency: "near_term",
    };
    return {
      systemKey,
      severity: calibratedSev.severity,
      urgency: calibratedSev.urgency,
      title: n.title || "Finding",
      description: n.suggestedAction || n.title || null,
      evidence: evidenceExcerpt(n.evidence),
      sourceExcerpt: evidenceExcerpt(n.evidence),
      pageReference: n.evidence?.page || n.evidence?.pageReference || null,
      estimatedCostLow: null,
      estimatedCostHigh: null,
      recommendedAction: n.suggestedAction || null,
      confidence: n.impactScore != null ? Math.min(1, Number(n.impactScore) / 10) : 0.6,
    };
  });

  const recommendations = maintenanceSuggestions.map((m) => ({
    systemKey: normalizeSystemKey(m.systemType),
    urgencyGroup: mapUrgencyFromPriority(m.priority, m.suggestedWhen, m.severity),
    title: m.task || "Recommendation",
    description: [m.rationale, m.suggestedWhen].filter(Boolean).join(" — ") || null,
  }));

  // Also surface needs-attention suggested actions as recommendations when no maintenance dup
  for (const n of needsAttention) {
    if (!n.suggestedAction) continue;
    const title = n.suggestedAction;
    const already = recommendations.some(
      (r) => String(r.title).toLowerCase() === String(title).toLowerCase()
    );
    if (already) continue;
    recommendations.push({
      systemKey: normalizeSystemKey(n.systemType),
      urgencyGroup: mapUrgencyFromPriority(n.priority, "", n.severity),
      title,
      description: n.title || null,
    });
  }

  const systemsRaw = systemsDetected.map((s) => {
    const systemKey = normalizeSystemKey(s.systemType);
    const systemFindings = findings.filter((f) => f.systemKey === systemKey);
    let urgency = "monitor";
    if (systemFindings.some((f) => f.urgency === "immediate" || f.severity === "major")) {
      urgency = "immediate";
    } else if (systemFindings.some((f) => f.urgency === "near_term" || f.severity === "moderate")) {
      urgency = "near_term";
    } else if (systemFindings.length) {
      urgency = "long_term";
    }
    return {
      systemKey,
      condition: ["excellent", "good", "fair", "poor"].includes(s.condition) ? s.condition : "unknown",
      conditionConfidence: s.confidence ?? null,
      urgency,
      repairCostLow: null,
      repairCostHigh: null,
      remainingLife: null,
      nextService: null,
      evidenceSummary: s.conditionRationale || evidenceExcerpt(s.evidence) || null,
      evidenceSources: s.evidence
        ? [{ excerpt: evidenceExcerpt(s.evidence), pageReference: s.evidence?.page || null }]
        : [],
    };
  });

  // Ensure systems exist for findings that weren't in systemsDetected
  for (const f of findings) {
    if (!systemsRaw.some((s) => s.systemKey === f.systemKey)) {
      systemsRaw.push({
        systemKey: f.systemKey,
        condition: f.severity === "major" ? "poor" : f.severity === "minor" ? "good" : "fair",
        conditionConfidence: f.confidence ?? 0.5,
        urgency: f.urgency || "near_term",
        repairCostLow: null,
        repairCostHigh: null,
        remainingLife: null,
        nextService: null,
        evidenceSummary: f.description || f.title,
        evidenceSources: f.sourceExcerpt
          ? [{ excerpt: f.sourceExcerpt, pageReference: f.pageReference }]
          : [],
      });
    }
  }

  // Collapse aliases (heating+ac→hvac, gutters→roof, etc.) so we never violate
  // UNIQUE (analysis_id, system_key).
  const systems = mergeSystemsByKey(systemsRaw);

  const positiveFindings = systems
    .filter((s) => s.condition === "excellent" || s.condition === "good")
    .slice(0, 5)
    .map((s) => `${labelForSystem(s.systemKey)} appears in ${s.condition} condition`);

  const topConcerns = findings.slice(0, 5).map((f) => ({
    title: f.title,
    severity: f.severity,
    systemKey: f.systemKey,
  }));

  return {
    overallConditionScore: null,
    overallConditionRating: null,
    scoringAudit: null,
    conditionModifiers: null,
    executiveSummary: analyzed.summary || null,
    repairCostLow: null,
    repairCostHigh: null,
    repairConfidence: null,
    positiveFindings,
    topConcerns,
    systems,
    findings,
    recommendations,
  };
}

async function enrichWithCostEstimates(openai, structured, usageCtx) {
  if (!openai || !structured?.findings?.length) return structured;

  const payload = {
    overallConditionRating: structured.overallConditionRating,
    systems: (structured.systems || []).map((s) => ({
      systemKey: s.systemKey,
      condition: s.condition,
      urgency: s.urgency,
      evidenceSummary: s.evidenceSummary,
    })),
    findings: (structured.findings || []).map((f, index) => ({
      index,
      systemKey: f.systemKey,
      severity: f.severity,
      urgency: f.urgency,
      title: f.title,
      description: f.description,
      recommendedAction: f.recommendedAction,
    })),
  };

  try {
    const completion = await chatCompletionWithRetry(
      openai,
      {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You output only valid JSON with rough USD repair cost estimates. Be conservative. Prefer null when uncertain.",
          },
          {
            role: "user",
            content: COST_ENRICHMENT_PROMPT + JSON.stringify(payload),
          },
        ],
        temperature: 0.2,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      },
      { label: "pre-purchase-cost-enrichment" }
    );

    if (usageCtx && completion.usage) {
      logAiUsage({
        accountId: usageCtx.accountId,
        userId: usageCtx.userId,
        model: `openai/${MODEL}`,
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        endpoint: "pre-purchase/cost-enrichment",
      }).catch(() => {});
    }

    const costs = parseJsonContent(completion.choices[0]?.message?.content);
    if (!costs) return structured;

    if (costs.repairCostLow != null) structured.repairCostLow = Number(costs.repairCostLow) || null;
    if (costs.repairCostHigh != null) structured.repairCostHigh = Number(costs.repairCostHigh) || null;
    if (["low", "medium", "high"].includes(costs.repairConfidence)) {
      structured.repairConfidence = costs.repairConfidence;
    } else if (structured.repairCostLow != null || structured.repairCostHigh != null) {
      structured.repairConfidence = "medium";
    }

    if (Array.isArray(costs.findingCosts)) {
      for (const row of costs.findingCosts) {
        const idx = Number(row.index);
        if (!Number.isInteger(idx) || !structured.findings[idx]) continue;
        if (row.estimatedCostLow != null) {
          structured.findings[idx].estimatedCostLow = Number(row.estimatedCostLow) || null;
        }
        if (row.estimatedCostHigh != null) {
          structured.findings[idx].estimatedCostHigh = Number(row.estimatedCostHigh) || null;
        }
      }
    }

    if (Array.isArray(costs.systemCosts)) {
      for (const row of costs.systemCosts) {
        const key = normalizeSystemKey(row.systemKey);
        const sys = structured.systems.find((s) => s.systemKey === key);
        if (!sys) continue;
        if (row.repairCostLow != null) sys.repairCostLow = Number(row.repairCostLow) || null;
        if (row.repairCostHigh != null) sys.repairCostHigh = Number(row.repairCostHigh) || null;
      }
    }
  } catch (err) {
    console.warn("[prePurchaseAnalysis] cost enrichment failed:", err.message);
  }

  return structured;
}

async function enrichWithConditionModifiers(openai, structured, usageCtx) {
  if (!openai || !structured) return structured;

  const payload = {
    repairCostLow: structured.repairCostLow ?? null,
    repairCostHigh: structured.repairCostHigh ?? null,
    systems: (structured.systems || []).map((s) => ({
      systemKey: s.systemKey,
      condition: s.condition,
      urgency: s.urgency,
      evidenceSummary: s.evidenceSummary,
      repairCostLow: s.repairCostLow ?? null,
      repairCostHigh: s.repairCostHigh ?? null,
    })),
    findings: (structured.findings || []).slice(0, 40).map((f) => ({
      systemKey: f.systemKey,
      severity: f.severity,
      urgency: f.urgency,
      title: f.title,
      description: f.description,
    })),
  };

  try {
    const completion = await chatCompletionWithRetry(
      openai,
      {
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You output only valid JSON with qualitative condition modifiers. Do not invent a 0–100 score. Finding count must not drive modifiers.",
          },
          {
            role: "user",
            content: CONDITION_MODIFIERS_PROMPT + JSON.stringify(payload),
          },
        ],
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: "json_object" },
      },
      { label: "pre-purchase-condition-modifiers" }
    );

    if (usageCtx && completion.usage) {
      logAiUsage({
        accountId: usageCtx.accountId,
        userId: usageCtx.userId,
        model: `openai/${MODEL}`,
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        endpoint: "pre-purchase/condition-modifiers",
      }).catch(() => {});
    }

    const parsed = parseJsonContent(completion.choices[0]?.message?.content);
    if (!parsed) return structured;
    structured.conditionModifiers = parsed;
  } catch (err) {
    console.warn("[prePurchaseAnalysis] condition modifiers failed:", err.message);
    structured.conditionModifiers = null;
  }

  return structured;
}

/** Recompute score after costs, modifiers, and optional property value are known. */
async function finalizeOverallCondition(structured, analysis) {
  const estimatedPropertyValue = await resolveEstimatedPropertyValue(analysis);
  return applyOverallConditionScore(structured, { estimatedPropertyValue });
}

function buildPropertyContext(analysis) {
  const identity = analysis.identity_data || analysis.identityData || {};
  const bits = [
    analysis.display_name || analysis.displayName,
    analysis.street,
    [analysis.city, analysis.state, analysis.zip].filter(Boolean).join(", "),
  ];
  if (identity.yearBuilt || identity.year_built) {
    bits.push(`Year built: ${identity.yearBuilt || identity.year_built}`);
  }
  if (identity.sqft || identity.livingArea || identity.living_area) {
    bits.push(`Sqft: ${identity.sqft || identity.livingArea || identity.living_area}`);
  }
  if (identity.beds || identity.bedrooms) {
    bits.push(`Beds: ${identity.beds || identity.bedrooms}`);
  }
  if (identity.baths || identity.bathrooms) {
    bits.push(`Baths: ${identity.baths || identity.bathrooms}`);
  }
  return bits.filter(Boolean).join(" — ");
}

async function loadCategoryRows() {
  const result = await db.query(
    `SELECT id, name, parent_id FROM professional_categories ORDER BY name ASC`
  );
  return result.rows;
}

function findCategoryIdForSystem(systemKey, categories) {
  const keywords = SYSTEM_CATEGORY_KEYWORDS[systemKey] || SYSTEM_CATEGORY_KEYWORDS.other;
  const lower = categories.map((c) => ({ ...c, _n: String(c.name || "").toLowerCase() }));
  for (const kw of keywords) {
    const hit = lower.find((c) => c._n.includes(kw));
    if (hit) return hit.id;
  }
  return null;
}

const SYSTEM_URGENCY_RANK = {
  immediate: 0,
  near_term: 1,
  long_term: 2,
  monitor: 3,
};

/** Lower rank = higher priority for professional matching. */
function systemMatchRank(systemKey, systems, recommendations) {
  let best = 99;
  for (const s of systems) {
    const key = s.system_key || s.systemKey;
    if (key !== systemKey) continue;
    const urgency = String(s.urgency || "").toLowerCase();
    let rank = SYSTEM_URGENCY_RANK[urgency] ?? 50;
    if (String(s.condition || "").toLowerCase() === "poor") {
      rank = Math.min(rank, 0);
    }
    if (rank < best) best = rank;
  }
  for (const r of recommendations) {
    const key = r.system_key || r.systemKey;
    if (key !== systemKey) continue;
    const group = String(r.urgency_group || r.urgencyGroup || "").toLowerCase();
    const rank = SYSTEM_URGENCY_RANK[group] ?? 50;
    if (rank < best) best = rank;
  }
  return best;
}

function orderedSystemKeysForMatching(systems, recommendations) {
  const keys = [
    ...new Set([
      ...systems.map((s) => s.system_key || s.systemKey),
      ...recommendations.map((r) => r.system_key || r.systemKey).filter(Boolean),
    ]),
  ].filter(Boolean);

  return keys.sort(
    (a, b) =>
      systemMatchRank(a, systems, recommendations) -
      systemMatchRank(b, systems, recommendations)
  );
}

async function lookupProfessionalsForMatch(categoryId, analysis) {
  const base = {};
  if (categoryId) base.category_id = categoryId;

  const attempts = [];
  if (analysis.city || analysis.state) {
    attempts.push({
      ...base,
      ...(analysis.city ? { city: analysis.city } : {}),
      ...(analysis.state ? { state: analysis.state } : {}),
    });
  }
  if (analysis.state) {
    attempts.push({ ...base, state: analysis.state });
  }
  attempts.push({ ...base });

  const seenFilter = new Set();
  for (const filters of attempts) {
    const sig = JSON.stringify(filters);
    if (seenFilter.has(sig)) continue;
    seenFilter.add(sig);
    try {
      const pros = await Professional.getAll(filters);
      if (pros.length) return pros;
    } catch (err) {
      console.warn("[prePurchaseAnalysis] professional lookup failed:", err.message);
    }
  }
  return [];
}

function scoreProfessionalMatch(pro, analysis) {
  const sameCity =
    analysis.city &&
    String(pro.city || "").toLowerCase() === String(analysis.city).toLowerCase();
  const sameState =
    analysis.state &&
    String(pro.state || "").toLowerCase() === String(analysis.state).toLowerCase();
  return (
    (Number(pro.rating) || 0) * 10 +
    Math.min(Number(pro.review_count) || 0, 50) +
    (pro.is_verified ? 15 : 0) +
    (sameCity ? 20 : 0) +
    (!sameCity && sameState ? 10 : 0)
  );
}

async function matchProfessionals(analysis, systems, recommendations) {
  const categories = await loadCategoryRows();
  const systemKeys = orderedSystemKeysForMatching(systems, recommendations);

  const seenPros = new Set();
  const matches = [];

  for (const systemKey of systemKeys.slice(0, 8)) {
    const categoryId = findCategoryIdForSystem(systemKey, categories);
    const pros = await lookupProfessionalsForMatch(categoryId, analysis);

    for (const pro of pros.slice(0, 3)) {
      if (seenPros.has(pro.id)) continue;
      seenPros.add(pro.id);
      matches.push({
        analysis_id: analysis.id,
        system_key: systemKey,
        professional_id: pro.id,
        match_reason: `Matched for ${labelForSystem(systemKey)} based on specialty and service area`,
        match_score: scoreProfessionalMatch(pro, analysis),
      });
      if (matches.length >= 12) break;
    }
    if (matches.length >= 12) break;
  }

  for (const m of matches) {
    await PrePurchaseAnalysis.insertProfessionalMatch(m);
  }
}

async function persistStructuredResult(analysisId, data) {
  const systems = mergeSystemsByKey(Array.isArray(data.systems) ? data.systems : []);
  const findings = Array.isArray(data.findings) ? data.findings : [];
  const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];

  const systemIdByKey = {};
  let sort = 0;
  for (const s of systems) {
    const key = normalizeSystemKey(s.systemKey || s.system_key);
    if (systemIdByKey[key]) continue;
    const issueCount = findings.filter(
      (f) => normalizeSystemKey(f.systemKey || f.system_key) === key
    ).length;
    const row = await PrePurchaseAnalysis.insertSystem({
      analysis_id: analysisId,
      system_key: key,
      system_label: labelForSystem(key),
      condition: s.condition || "unknown",
      condition_confidence: s.conditionConfidence ?? s.condition_confidence ?? null,
      issues_count: issueCount,
      repair_cost_low: s.repairCostLow ?? s.repair_cost_low ?? null,
      repair_cost_high: s.repairCostHigh ?? s.repair_cost_high ?? null,
      urgency: s.urgency || null,
      evidence_summary: s.evidenceSummary || s.evidence_summary || null,
      evidence_sources: s.evidenceSources || s.evidence_sources || [],
      details: {
        remainingLife: s.remainingLife || s.remaining_life || null,
        nextService: s.nextService || s.next_service || null,
      },
      sort_order: sort++,
    });
    systemIdByKey[key] = row.id;
  }

  let fSort = 0;
  for (const f of findings) {
    const key = normalizeSystemKey(f.systemKey || f.system_key);
    await PrePurchaseAnalysis.insertFinding({
      analysis_id: analysisId,
      system_id: systemIdByKey[key] || null,
      severity: ["major", "moderate", "minor"].includes(f.severity) ? f.severity : "moderate",
      urgency: f.urgency || null,
      title: f.title || "Finding",
      description: f.description || null,
      evidence: f.evidence || null,
      source_excerpt: f.sourceExcerpt || f.source_excerpt || null,
      page_reference: f.pageReference || f.page_reference || null,
      estimated_cost_low: f.estimatedCostLow ?? f.estimated_cost_low ?? null,
      estimated_cost_high: f.estimatedCostHigh ?? f.estimated_cost_high ?? null,
      recommended_action: f.recommendedAction || f.recommended_action || null,
      confidence: f.confidence ?? null,
      sort_order: fSort++,
    });
  }

  let rSort = 0;
  for (const r of recommendations) {
    await PrePurchaseAnalysis.insertRecommendation({
      analysis_id: analysisId,
      system_key: r.systemKey || r.system_key || null,
      urgency_group: ["immediate", "near_term", "long_term", "monitor"].includes(
        r.urgencyGroup || r.urgency_group
      )
        ? r.urgencyGroup || r.urgency_group
        : "near_term",
      title: r.title || "Recommendation",
      description: r.description || null,
      sort_order: rSort++,
    });
  }

  const score = data.overallConditionScore ?? data.overall_condition_score ?? null;
  const rating =
    data.overallConditionRating ||
    data.overall_condition_rating ||
    scoreToRating(score);

  await PrePurchaseAnalysis.update(analysisId, {
    overallConditionScore: score,
    overallConditionRating: rating,
    executiveSummary: data.executiveSummary || data.executive_summary || null,
    repairCostLow: data.repairCostLow ?? data.repair_cost_low ?? null,
    repairCostHigh: data.repairCostHigh ?? data.repair_cost_high ?? null,
    repairConfidence: data.repairConfidence || data.repair_confidence || null,
    positiveFindings: data.positiveFindings || data.positive_findings || [],
    topConcerns: data.topConcerns || data.top_concerns || [],
    scoringAudit: data.scoringAudit || data.scoring_audit || null,
  });
}

function mapProgressFromInspectionMessage(msg) {
  const lower = String(msg || "").toLowerCase();
  if (lower.includes("inventory") || lower.includes("identifying") || lower.includes("system")) {
    return {
      status: "identifying_systems",
      progressPct: 40,
      progressMessage: msg || "Identifying systems",
    };
  }
  if (lower.includes("finding") || lower.includes("issue") || lower.includes("global")) {
    return {
      status: "detecting_issues",
      progressPct: 60,
      progressMessage: msg || "Detecting issues",
    };
  }
  if (lower.includes("maintenance") || lower.includes("recommend")) {
    return {
      status: "generating_recommendations",
      progressPct: 75,
      progressMessage: msg || "Generating recommendations",
    };
  }
  return {
    status: "identifying_systems",
    progressPct: 45,
    progressMessage: msg || "Analyzing with AI",
  };
}

/**
 * Run full analysis pipeline for an analysis id.
 */
async function runAnalysis(analysisId) {
  const analysis = await PrePurchaseAnalysis.get(analysisId);
  const usageCtx = {
    accountId: analysis.account_id,
    userId: analysis.created_by,
  };

  try {
    await PrePurchaseAnalysis.clearResults(analysisId);
    await PrePurchaseAnalysis.update(analysisId, {
      status: "extracting",
      progressPct: 10,
      progressMessage: "Extracting documents",
      errorMessage: null,
      startedAt: new Date().toISOString(),
    });

    const documents = await PrePurchaseAnalysis.getDocuments(analysisId);
    if (!documents.length) {
      throw new Error("No documents attached to this analysis");
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

    const textParts = [];
    for (const doc of documents) {
      await PrePurchaseAnalysis.updateDocumentStatus(doc.id, "processing");
      try {
        const file = await getFile(doc.document_key);
        const buffer = Buffer.isBuffer(file)
          ? file
          : Buffer.isBuffer(file?.Body)
            ? file.Body
            : Buffer.from(await file.Body.transformToByteArray());
        const mime = doc.mime_type || file?.ContentType || "application/octet-stream";

        let text = "";
        let pageCount = doc.page_count;
        if (mime === "application/pdf" || doc.document_key.toLowerCase().endsWith(".pdf")) {
          const extracted = await extractTextFromPdf(buffer);
          text = extracted.text;
          pageCount = extracted.pageCount || pageCount;
        } else if (isImageMime(mime) && openai) {
          text = await extractViaVision(openai, buffer, mime, usageCtx);
        } else {
          text = "";
        }

        if (pageCount != null && pageCount !== doc.page_count) {
          await db.query(
            `UPDATE pre_purchase_documents SET page_count = $2, updated_at = NOW() WHERE id = $1`,
            [doc.id, pageCount]
          );
        }

        if (text && text.trim()) {
          textParts.push(
            `\n\n===== DOCUMENT: ${doc.document_name} (${doc.document_type}) =====\n${text.trim()}`
          );
          await PrePurchaseAnalysis.updateDocumentStatus(doc.id, "completed");
        } else {
          await PrePurchaseAnalysis.updateDocumentStatus(doc.id, "skipped");
        }
      } catch (err) {
        console.error("[prePurchaseAnalysis] document extract failed:", doc.id, err.message);
        await PrePurchaseAnalysis.updateDocumentStatus(doc.id, "failed");
      }
    }

    const combinedText = textParts.join("\n");
    if (combinedText.trim().length < 100) {
      throw new Error(
        "Could not extract enough text from the uploaded documents. Please upload a readable PDF inspection report."
      );
    }

    await PrePurchaseAnalysis.updateProgress(analysisId, {
      status: "identifying_systems",
      progressPct: 35,
      progressMessage: "Identifying systems",
    });

    const propertyContext = buildPropertyContext(analysis);

    const analyzed = await analyzeInspectionText({
      text: combinedText,
      propertyContext,
      usageCtx,
      onProgress: async (msg) => {
        const mapped = mapProgressFromInspectionMessage(msg);
        await PrePurchaseAnalysis.updateProgress(analysisId, mapped);
      },
    });

    await PrePurchaseAnalysis.updateProgress(analysisId, {
      status: "detecting_issues",
      progressPct: 65,
      progressMessage: "Detecting issues",
    });

    let structured = mapInspectionResultToPrePurchase(analyzed);

    await PrePurchaseAnalysis.updateProgress(analysisId, {
      status: "generating_recommendations",
      progressPct: 80,
      progressMessage: "Estimating repair costs",
    });

    structured = await enrichWithCostEstimates(openai, structured, usageCtx);
    structured = await enrichWithConditionModifiers(openai, structured, usageCtx);
    structured = await finalizeOverallCondition(structured, analysis);

    await persistStructuredResult(analysisId, structured);

    await PrePurchaseAnalysis.updateProgress(analysisId, {
      status: "generating_recommendations",
      progressPct: 90,
      progressMessage: "Matching professionals",
    });

    const systems = await PrePurchaseAnalysis.getSystems(analysisId);
    const recommendations = await PrePurchaseAnalysis.getRecommendations(analysisId);
    await matchProfessionals(analysis, systems, recommendations);

    await PrePurchaseAnalysis.update(analysisId, {
      status: "completed",
      progressPct: 100,
      progressMessage: "Completed",
      errorMessage: null,
      completedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[prePurchaseAnalysis] runAnalysis failed:", analysisId, err);
    await PrePurchaseAnalysis.update(analysisId, {
      status: "failed",
      progressPct: 100,
      progressMessage: "Failed",
      errorMessage: err.message || "Analysis failed",
    }).catch(() => {});
  }
}

module.exports = {
  runAnalysis,
  mapInspectionResultToPrePurchase,
  computeOverallConditionScore,
  scoreToRating,
  resolveEstimatedPropertyValue,
  SYSTEM_DEFS,
  normalizeSystemKey,
};
