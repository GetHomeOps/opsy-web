"use strict";

/**
 * Inspection Report Analysis Service
 *
 * Downloads PDF from S3, extracts text, calls OpenAI for structured analysis,
 * normalizes to canonical system list.
 */

const { PDFParse } = require("pdf-parse");
const OpenAI = require("openai");
const db = require("../db");
const { getFile } = require("./s3Service");
const InspectionAnalysisJob = require("../models/inspectionAnalysisJob");
const InspectionAnalysisResult = require("../models/inspectionAnalysisResult");
const { AWS_S3_BUCKET } = require("../config");

const { detectSystemsFromText } = require("./aiChatService");
const {
  CANONICAL_SYSTEMS,
  isExcludedSystem,
  normalizeSystemType,
  resolveFindingSystemType,
} = require("./systemTypes");
const { logAiUsage } = require("./usageService");

async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
}

async function extractTextFromBuffer(buffer, mimeType) {
  if (mimeType === "application/pdf" || !mimeType) {
    try {
      return await extractTextFromPdf(buffer);
    } catch (err) {
      console.error("[inspectionAnalysis] PDF parse error:", err.message);
      return "";
    }
  }
  return "";
}

const MAX_RATE_LIMIT_WAIT_MS = 35000;

/**
 * Call the OpenAI chat completion API with retry/backoff on rate limits (429)
 * and transient 5xx errors. When the API reports "try again in Xs", we honor
 * that delay; otherwise we back off exponentially. This prevents a transient
 * TPM rate limit from silently dropping an entire pass's findings.
 */
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
        `[inspectionAnalysis] ${label}: ${status} rate/transient error — retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

const CANONICAL_SYSTEMS_LIST = CANONICAL_SYSTEMS.join(", ");

/* ── Multi-pass prompts ── */

const INVENTORY_PROMPT = `You are an expert home inspector. Analyze this inspection report and identify systems that are SUBSTANTIVELY discussed — meaning the report includes inspection findings, condition assessments, deficiencies, or recommendations for that system.

CRITICAL RULES:
- Output ONLY valid JSON. No markdown, no extra text.
- Only include a system if the report has substantive content about it (condition noted, findings listed, or recommendations made). Do NOT include systems that are merely mentioned in a table of contents, header, or checklist with no findings.
- Do NOT include appliances (dishwasher, refrigerator, oven, stove, washer, dryer, microwave, garbage disposal).
- Do NOT create redundant or overlapping systems. Each finding should map to exactly ONE system.
- Do NOT suggest "inspections" as a system — it is a process, not a property system.
- Consolidate related concepts into canonical types: "structure"/"framing" -> foundation, "fuel storage"/"oil tank" -> heating, "chimney"/"fireplace" -> heating, "attic"/"insulation" -> exterior, "crawl space"/"basement" -> foundation, "garage"/"garage door" -> exterior, "ventilation" -> ac, "smoke detectors"/"CO detectors" -> safety.
- Only suggest a custom systemType if NO canonical type is a reasonable fit (e.g. "pool", "septic", "solar").

For each system, map to a canonical type when it fits: ${CANONICAL_SYSTEMS_LIST}
Otherwise use a custom type in camelCase (e.g. "pool", "deck", "septic").

Output format:
{
  "systems": [
    { "systemType": "roof", "sectionHint": "keywords or heading text that identifies this system's section in the report" },
    { "systemType": "plumbing", "sectionHint": "..." }
  ],
  "overallCondition": { "rating": "good|fair|poor|excellent|unknown", "confidence": 0.7, "rationale": "brief reason" },
  "summary": "2-3 sentence overall summary of the report"
}

Report text:
`;

const PER_SYSTEM_PROMPT = `You are an expert home inspector. You are analyzing ONLY the "{SYSTEM_TYPE}" system from an inspection report. Extract findings that represent ACTUAL DEFICIENCIES, DEFECTS, SAFETY CONCERNS, or EXPLICIT RECOMMENDATIONS made by the inspector.

CONDITION ASSESSMENT — ALWAYS REQUIRED:
- You MUST always provide a "condition" rating and "conditionConfidence" for this system. NEVER use "unknown".
- If the report explicitly rates this system, use that rating and high confidence (0.8-0.95).
- If the report does NOT explicitly rate the system but describes its state (e.g. age, deficiencies, positive observations), INFER the condition from the findings:
  * "excellent": No deficiencies found, system described as new/recently replaced/in great shape.
  * "good": Minor or no deficiencies, system is functional with normal wear.
  * "fair": Some deficiencies noted, aging components, deferred maintenance items.
  * "poor": Multiple deficiencies, active failures, safety concerns, or near end-of-life.
- When inferring, set conditionConfidence to 0.5-0.75 to reflect that it is an assessment rather than an explicit report statement.
- Provide a short "conditionRationale" explaining how you arrived at the rating.

CRITICAL RULES — WHAT TO INCLUDE:
- Output ONLY valid JSON. No markdown, no extra text.
- ONLY include items where the report identifies an actual problem, deficiency, defect, safety hazard, code violation, deferred maintenance, or explicit recommendation to repair/replace/service something.
- EVIDENCE REQUIRED: Every needsAttention and maintenanceSuggestions item MUST have an "evidence" field containing a VERBATIM quote (1-2 sentences, copied exactly) from the report that demonstrates the deficiency or recommendation. If you cannot find a verbatim quote, do NOT include the item.

CRITICAL RULES — WHAT TO EXCLUDE:
- DO NOT include informational observations that are NOT deficiencies (e.g. "water heater is 5 years old", "roof is asphalt shingle", "house has copper wiring"). Age or type alone is not a finding.
- DO NOT include items where the report says "satisfactory", "functional", "no deficiencies", "no issues", "N/A", or similar positive/neutral language.
- DO NOT apply general maintenance knowledge. If the report does not explicitly flag something as needing action, omit it entirely.
- DO NOT create findings from checklist items that are simply marked as present or inspected without a noted concern.

SEVERITY & PRIORITY — STRICT GRADING:
- "critical" / "urgent": Report uses words like "safety hazard", "immediate", "dangerous", "code violation", "structural damage", or explicitly says repair is urgent.
- "high": Report says "recommend repair", "should be repaired", "needs replacement", "deteriorated", "failing", or describes active damage/leaks/failure.
- "medium": Report says "monitor", "consider", "aging", "minor", "cosmetic", or describes wear without active failure.
- "low": Report mentions as a minor note or future consideration with no current impact.
- When the report does not use severity language, infer from the described condition. Default to "medium" only if the item genuinely warrants attention.

IMPACT SCORE (1-10): Rate each finding's real-world impact on habitability, safety, and property value:
- 8-10: Safety hazards, active water intrusion, structural concerns, code violations
- 5-7: Active deficiencies needing professional repair (leaks, failing components, significant wear)
- 3-4: Minor deficiencies, cosmetic issues, deferred maintenance
- 1-2: Informational items (should generally be excluded per rules above)

- suggestedWhen: use phrases like "within 30 days", "within 6 months", "annually", "as soon as possible".
- Use confidence 0.7-0.95 for items with clear verbatim evidence; 0.5-0.7 for items where evidence is indirect but present. Do NOT include items below 0.5 confidence.

DEDUPLICATION — MINIMIZE DUPLICATES:
- Do NOT include duplicate or near-duplicate items. Each distinct finding or recommendation should appear exactly once.
- If the report mentions the same issue in multiple places (e.g. front stairs and rear stairs for handrails), consolidate into a single entry. Use the most complete description and strongest evidence.
- Avoid rephrased versions of the same recommendation (e.g. "Install graspable handrail" vs "Install a graspable handrail that is..."). Choose one clear phrasing.
- Before adding each item, check that you have not already included an equivalent finding. Prefer quality over quantity.

Output format:
{
  "condition": "good|fair|poor|excellent",
  "conditionConfidence": 0.8,
  "conditionRationale": "brief explanation of how condition was determined",
  "evidence": "short excerpt about overall system condition",
  "needsAttention": [
    { "title": "descriptive title", "severity": "high", "priority": "urgent", "impactScore": 7, "suggestedAction": "what to do", "evidence": "verbatim quote from report supporting this finding" }
  ],
  "maintenanceSuggestions": [
    { "task": "what to do", "suggestedWhen": "within 30 days", "priority": "high", "impactScore": 6, "rationale": "why — grounded in report", "confidence": 0.76, "evidence": "verbatim quote from report supporting this suggestion" }
  ],
  "citations": [{ "page": 3, "excerpt": "short excerpt" }]
}

Report text for {SYSTEM_TYPE}:
`;

/* Single comprehensive prompt — used only for very short reports (<= SINGLE_PASS_MAX_CHARS). */
const ANALYSIS_PROMPT = `You are an expert home inspector analyzing a property inspection report. Extract structured findings that represent ACTUAL DEFICIENCIES, DEFECTS, SAFETY CONCERNS, or EXPLICIT RECOMMENDATIONS.

COMPLETENESS — CAPTURE EVERY RECOMMENDATION:
- Read the ENTIRE report. Inspectors often place a consolidated list in a "SUMMARY", "RECOMMENDATIONS", or numbered "Recommendations" section — harvest every item from those sections AND any deficiencies described inline in the system sections.
- Do not stop early or skip sections. Scan interior, carpentry, cabinetry, trim, drywall, site, and general sections too, not just the major mechanical systems.
- Each distinct recommendation must appear EXACTLY ONCE (see DEDUPLICATION below).

CRITICAL RULES — WHAT TO INCLUDE:
- Output ONLY valid JSON. No markdown, no extra text.
- Extract every system that is inspected or mentioned with findings.
- For needsAttention and maintenanceSuggestions, ONLY include items where the report identifies an actual problem, deficiency, defect, safety hazard, code violation, deferred maintenance, or explicit recommendation to repair/replace/service something.
- EVIDENCE REQUIRED: Every needsAttention and maintenanceSuggestions item MUST have an "evidence" field containing a VERBATIM quote (1-2 sentences, copied exactly) from the report. If you cannot find a verbatim quote, do NOT include the item.

CRITICAL RULES — WHAT TO EXCLUDE:
- DO NOT include informational observations that are NOT deficiencies (e.g. "water heater is 5 years old", "roof is asphalt shingle"). Age or type alone is not a finding.
- DO NOT include items where the report says "satisfactory", "functional", "no deficiencies", "no issues", "N/A", or similar positive/neutral language.
- DO NOT apply general maintenance knowledge. If the report does not explicitly flag something as needing action, omit it entirely.
- DO NOT create findings from checklist items simply marked as present or inspected without a noted concern.

SEVERITY & PRIORITY — STRICT GRADING:
- "critical" / "urgent": Report uses words like "safety hazard", "immediate", "dangerous", "code violation", "structural damage", or explicitly says repair is urgent.
- "high": Report says "recommend repair", "should be repaired", "needs replacement", "deteriorated", "failing", or describes active damage/leaks/failure.
- "medium": Report says "monitor", "consider", "aging", "minor", "cosmetic", or describes wear without active failure.
- "low": Report mentions as a minor note or future consideration with no current impact.
- When the report does not use severity language, infer from the described condition. Default to "medium" only if the item genuinely warrants attention.

IMPACT SCORE (1-10): Rate each finding's real-world impact on habitability, safety, and property value:
- 8-10: Safety hazards, active water intrusion, structural concerns, code violations
- 5-7: Active deficiencies needing professional repair (leaks, failing components, significant wear)
- 3-4: Minor deficiencies, cosmetic issues, deferred maintenance
- 1-2: Informational items (should generally be excluded per rules above)

SYSTEM TYPE: For each finding, choose the best-fitting system:
1. Use a canonical type when it fits: ${CANONICAL_SYSTEMS_LIST}
2. For findings in interior, carpentry, cabinetry, drywall, trim, general, or appliance/disposal sections that do not fit a canonical system, use systemType "interior".
3. Otherwise use a custom systemType when none of the above fit well (e.g. "pool", "deck", "septic"). Use lowercase camelCase.

CRITICAL: Never use "appliances" or a specific appliance name (dishwasher, disposal, refrigerator, etc.) as the systemType — use "interior" instead. Do NOT invent appliance systems; we track property systems, but DO keep an explicit inspector recommendation even if it concerns an appliance, attributing it to "interior".

DEDUPLICATION — SYSTEMS: Do NOT create redundant or overlapping systems. Each area maps to one system. "structure"/"foundation" -> foundation. "fuel storage"/"oil tank" -> heating. "chimney"/"fireplace" -> heating. "attic"/"insulation" -> exterior. "crawl space"/"basement" -> foundation. "garage"/"garage door" -> exterior. "ventilation" -> ac. "smoke detectors"/"CO detectors" -> safety. Do NOT include "inspections" as a system.

DEDUPLICATION — FINDINGS: Do NOT include duplicate or near-duplicate items in needsAttention or maintenanceSuggestions. Each distinct issue should appear only ONCE. If the report mentions the same issue in multiple places, consolidate into a single entry. Avoid rephrased versions of the same recommendation — pick one clear formulation and include it once.

- For suggestedSystemsToAdd: include every system the report inspected with findings.
- Use confidence 0.7-0.95 for items with clear verbatim evidence; 0.5-0.7 for indirect evidence. Do NOT include items below 0.5 confidence.
- For condition rating use exactly: excellent, good, fair, poor, unknown.
- Overall condition: infer from findings, severity, age, and tone. Only use "unknown" when the report has almost no usable information.
- suggestedWhen: use phrases like "within 30 days", "within 6 months", "annually", "as soon as possible".
- Keep excerpts short (1-2 sentences max).

PER-SYSTEM CONDITION — ALWAYS REQUIRED:
- For every system in systemsDetected, you MUST provide a "condition" and "confidence". NEVER use "unknown".
- If the report explicitly rates the system, use that rating with high confidence (0.8-0.95).
- If the report does NOT explicitly rate it, INFER the condition from findings, age, and tone:
  * "excellent": No deficiencies, described as new or in great shape.
  * "good": Minor or no deficiencies, functional with normal wear.
  * "fair": Some deficiencies, aging components, deferred maintenance.
  * "poor": Multiple deficiencies, active failures, safety concerns.
- When inferring, use conditionConfidence 0.5-0.75 to reflect the assessment nature.
- Include a brief "conditionRationale" for each system.

Output format (strict JSON):
{
  "condition": { "rating": "good", "confidence": 0.74, "rationale": "brief explanation" },
  "systemsDetected": [{ "systemType": "HVAC", "condition": "good", "confidence": 0.81, "conditionRationale": "brief reason", "evidence": "short excerpt" }],
  "needsAttention": [{ "title": "...", "systemType": "Roof", "severity": "high", "priority": "urgent", "impactScore": 7, "suggestedAction": "...", "evidence": "verbatim quote" }],
  "suggestedSystemsToAdd": [{ "systemType": "Roof", "reason": "...", "confidence": 0.77 }],
  "maintenanceSuggestions": [{ "systemType": "HVAC", "task": "...", "suggestedWhen": "within 30 days", "priority": "high", "impactScore": 6, "rationale": "why — grounded in report", "confidence": 0.76, "evidence": "verbatim quote from report" }],
  "summary": "2-3 sentence summary of the report",
  "citations": [{ "page": 3, "excerpt": "short excerpt" }]
}

Report text:
`;

/*
 * Global findings sweep (multi-pass). Runs once over the ENTIRE report to catch
 * every explicit deficiency/recommendation regardless of which "system" it falls
 * under. This is the comprehensiveness guarantee: per-system passes only run for
 * systems the inventory enumerated, so findings in Interior/Carpentry/General/
 * Appliance sections (which are not tracked systems) would otherwise be missed.
 */
const GLOBAL_FINDINGS_PROMPT = `You are an expert home inspector. Read the ENTIRE inspection report below and extract EVERY explicit deficiency, defect, safety concern, or recommendation the inspector made — no matter where it appears.

COMPLETENESS — THIS IS THE PRIORITY:
- Inspectors often place a consolidated list in a "SUMMARY", "RECOMMENDATIONS", or numbered "Recommendations" section. Capture every item from those sections AND any deficiencies described inline in system sections.
- Do not stop early. Scan the whole document, including interior, carpentry, cabinetry, appliances, site, and general sections.
- Each distinct recommendation must appear EXACTLY ONCE. Do not output duplicates or rephrased versions of the same item.

CRITICAL RULES — WHAT TO INCLUDE:
- Output ONLY valid JSON. No markdown, no extra text.
- ONLY include items where the report identifies an actual problem, deficiency, defect, safety hazard, code violation, deferred maintenance, or an explicit recommendation to repair/replace/clean/correct/evaluate something.
- EVIDENCE REQUIRED: every item MUST have an "evidence" field containing a VERBATIM quote (1-2 sentences, copied exactly) from the report. If you cannot find a verbatim quote, do NOT include the item.

CRITICAL RULES — WHAT TO EXCLUDE (no bloat, no hallucination):
- DO NOT include items where the report says "no observable defects", "no deficiencies", "satisfactory", "functional", "operating normally", "good condition", "no issues", "N/A", or similar positive/neutral language.
- DO NOT include informational observations that are not deficiencies (age, material type, how a system works).
- DO NOT apply general maintenance knowledge. If the report does not explicitly flag it, omit it.

SYSTEM ATTRIBUTION:
- Map each finding to the best-fitting tracked system: ${CANONICAL_SYSTEMS_LIST}.
- For findings in interior, carpentry, cabinetry, drywall, trim, general, or appliance/disposal sections that do not fit a canonical system, use systemType "interior".
- Never use "appliances" or a specific appliance name as the systemType; use "interior" instead.

SEVERITY: critical/urgent for safety hazards or "immediate"; high for "recommend repair/replace", active damage; medium for "monitor/consider/minor"; low for minor notes. Infer from the report's own language and timeframe (e.g. "Immediate", "As soon as possible").
IMPACT SCORE (1-10): 8-10 safety/structural/water intrusion; 5-7 active deficiencies needing professional repair; 3-4 minor/cosmetic/deferred.

Output format (strict JSON):
{
  "needsAttention": [{ "title": "short descriptive title", "systemType": "exterior", "severity": "high", "priority": "urgent", "impactScore": 7, "suggestedAction": "what to do", "evidence": "verbatim quote from report" }],
  "maintenanceSuggestions": [{ "systemType": "interior", "task": "what to do", "suggestedWhen": "as soon as possible", "priority": "medium", "impactScore": 4, "rationale": "why — grounded in report", "confidence": 0.8, "evidence": "verbatim quote from report" }]
}

Report text:
`;

/** Fetch property context (existing systems) for analysis. */
async function getPropertyContextForAnalysis(propertyId) {
  const [propRes, systemsRes] = await Promise.all([
    db.query(
      `SELECT property_name, address, city, state, year_built FROM properties WHERE id = $1`,
      [propertyId]
    ),
    db.query(
      `SELECT system_key FROM property_systems WHERE property_id = $1`,
      [propertyId]
    ),
  ]);
  const prop = propRes.rows[0] || {};
  const existingSystems = (systemsRes.rows || []).map((r) => r.system_key).filter(Boolean);
  const parts = [];
  if (prop.property_name || prop.address) {
    parts.push(`Property: ${prop.property_name || "Unnamed"} at ${[prop.address, prop.city, prop.state].filter(Boolean).join(", ")}${prop.year_built ? ` (built ${prop.year_built})` : ""}`);
  }
  if (existingSystems.length > 0) {
    parts.push(`Property ALREADY tracks these systems: ${existingSystems.join(", ")}. Suggest adding any system the report inspected that is NOT in this list.`);
  }
  return parts.length > 0 ? parts.join("\n") + "\n\n" : "";
}

/**
 * Only very short reports are analyzed in a SINGLE comprehensive pass (one LLM
 * call). Anything larger uses multi-pass (inventory + focused per-system passes
 * + global sweep), which has substantially higher recall: a single combined call
 * tends to summarize and drop individual findings (e.g. it returned 3 of 6
 * electrical items on a 52k-char report), whereas the per-system passes
 * enumerate each system exhaustively. The TPM concern that previously motivated
 * preferring single-pass is now handled by chatCompletionWithRetry's rate-limit
 * backoff, so we default to the more complete multi-pass path.
 */
const SINGLE_PASS_MAX_CHARS = 8000;
const MIN_EVIDENCE_LENGTH = 15;

/**
 * Models, split by role:
 * - REASONING_MODEL (gpt-4o): low-volume, judgment-heavy passes — the system
 *   inventory/overall-condition pass and the single-pass path for tiny reports.
 * - EXTRACTION_MODEL (gpt-4o-mini): high-volume, well-constrained extraction —
 *   the per-system passes and the global findings sweep. These dominate token
 *   throughput, and gpt-4o has only a 30k tokens-per-minute (TPM) ceiling on
 *   this account (full ~50k-char report ≈ 13k tokens PER call), which throttled
 *   the analysis to 12-26s backoffs and even dropped systems. gpt-4o-mini has a
 *   far higher TPM limit, so we can send the FULL report to every pass (maximum
 *   recall) without throttling, and it is faster and cheaper per token.
 */
const REASONING_MODEL = "gpt-4o";
const EXTRACTION_MODEL = "gpt-4o-mini";

/**
 * Per-system passes run concurrently. gpt-4o-mini's high TPM ceiling lets us run
 * several full-report calls at once without rate limiting; this is the main
 * latency win versus running them in small serial batches.
 */
const MAX_CONCURRENT_SYSTEM_CALLS = 5;

/**
 * Send the FULL report to each per-system pass (findings for one system are
 * routinely scattered across the whole document, so slicing drops them). Only
 * reports larger than this fall back to gathering every heading occurrence (see
 * extractAllSystemSections). The cap is effectively the post-truncation report
 * size, so in practice every report sends full text.
 */
const FULL_TEXT_PER_SYSTEM_THRESHOLD = 100000;
/** Max characters of gathered per-system text for reports above the threshold. */
const MAX_SECTION_CHARS = 30000;
/** Deterministic sampling seed (best-effort) for reproducible analyses. */
const ANALYSIS_SEED = 7;

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

function severityScore(item) {
  const sev = SEVERITY_RANK[item.severity] ?? 2;
  const pri = PRIORITY_RANK[item.priority] ?? 2;
  const impact = item.impactScore ?? 5;
  return (3 - sev) * 100 + (3 - pri) * 10 + impact;
}

function priorityScore(item) {
  const pri = PRIORITY_RANK[item.priority] ?? 2;
  const impact = item.impactScore ?? 5;
  return (3 - pri) * 100 + impact;
}

function sortNeedsAttention(items) {
  return [...items].sort((a, b) => severityScore(b) - severityScore(a));
}

function sortMaintenanceSuggestions(items) {
  return [...items].sort((a, b) => priorityScore(b) - priorityScore(a));
}

/**
 * Normalize evidence string for deduplication (collapse whitespace, lowercase,
 * common variants). Helps detect when the same report quote appears under multiple systems.
 */
function normalizeEvidenceForDedup(ev) {
  if (!ev || typeof ev !== "string") return "";
  return ev
    .toLowerCase()
    .trim()
    .replace(/°/g, " degrees ")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

/** Min length for evidence to use as dedup key; shorter kept but not used to detect duplicates. */
const MIN_EVIDENCE_DEDUP_LENGTH = 30;

/**
 * Deduplicate findings that share the same evidence (report quote).
 * When duplicate evidence is found across systems, keep the item with the highest score.
 * Prevents the same finding from appearing under both "plumbing" and "waterHeating" etc.
 * Also treats as duplicate when one evidence string contains the other (handles truncation).
 */
function deduplicateFindingsByEvidence(items, scoreFn) {
  const byEvidence = new Map();
  const normToKey = new Map(); // norm -> canonical key (for containment checks)

  for (const item of items) {
    const ev = (item.evidence || item.rationale || "").toString().trim();
    const norm = normalizeEvidenceForDedup(ev);
    if (norm.length < MIN_EVIDENCE_LENGTH) {
      byEvidence.set(`__short_${byEvidence.size}`, item);
      continue;
    }

    // Exact match
    let canonicalKey = normToKey.get(norm);
    if (!canonicalKey) {
      // Check for containment: is this a subset of an existing key, or does an existing key overlap?
      for (const [key, existingNorm] of normToKey) {
        if (key.startsWith("__short")) continue;
        const shorter = norm.length < existingNorm.length ? norm : existingNorm;
        const longer = norm.length >= existingNorm.length ? norm : existingNorm;
        if (shorter.length >= MIN_EVIDENCE_DEDUP_LENGTH && longer.includes(shorter)) {
          canonicalKey = key;
          break;
        }
      }
      if (!canonicalKey) {
        canonicalKey = norm;
        normToKey.set(norm, norm);
      }
    }

    const existing = byEvidence.get(canonicalKey);
    if (!existing || scoreFn(item) > scoreFn(existing)) {
      byEvidence.set(canonicalKey, item);
      if (canonicalKey === norm) normToKey.set(norm, norm);
    }
  }
  return Array.from(byEvidence.values());
}

/** Normalize a title/task for dedup (lowercase, strip punctuation, collapse whitespace). */
function normalizeTitleForDedup(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Min length for a normalized title to be used for containment-based dedup. */
const MIN_TITLE_DEDUP_LENGTH = 8;

/**
 * Words that carry no distinguishing meaning for a finding title and would
 * otherwise prevent two phrasings of the same issue from matching. Includes
 * articles/prepositions plus generic action verbs ("install", "repair") and
 * filler ("recommend", "missing", "certain") so that, e.g., "Lack of GFCI
 * Protection" and "GFCI protection missing at certain locations" reduce to the
 * same significant tokens {gfci, protection}.
 */
const TITLE_STOPWORDS = new Set([
  "the", "a", "an", "of", "at", "in", "on", "to", "from", "and", "or", "for",
  "with", "is", "are", "be", "by", "as", "that", "this", "these", "those", "it",
  "install", "installing", "installation", "repair", "repairing", "replace",
  "replacing", "replacement", "remove", "removing", "removal", "fix", "fixing",
  "service", "servicing", "evaluate", "evaluation", "correct", "correction",
  "address", "prevent", "reduce", "recommend", "recommended", "recommends",
  "recommendation", "needs", "need", "needed", "should", "missing", "lack",
  "lacking", "certain", "various", "location", "locations", "area", "areas",
  "some", "all", "where", "near", "due", "not", "no",
]);

/** Extract the set of significant (non-stopword) tokens from a title/task. */
function significantTokens(str) {
  const norm = normalizeTitleForDedup(str);
  if (!norm) return new Set();
  return new Set(
    norm.split(" ").filter((t) => t.length > 1 && !TITLE_STOPWORDS.has(t))
  );
}

/** Min number of shared significant tokens required to treat two titles as the same. */
const MIN_SHARED_SIGNIFICANT_TOKENS = 2;
/** Jaccard threshold (token overlap) above which two titles are considered duplicates. */
const TITLE_JACCARD_THRESHOLD = 0.6;

/**
 * Decide whether two titles/tasks describe the same underlying issue, using
 * significant-token overlap rather than raw substring containment. Catches
 * rephrasings the old containment check missed, e.g.:
 *   "Moss growth on roofing material" vs "Remove moss from roofing material"
 *   "Lack of GFCI Protection"        vs "GFCI protection missing at certain locations"
 *   "Construction debris in waste disposal" vs "Remove construction debris from waste disposal grinder"
 * while keeping genuinely distinct items apart (e.g. "GFCI receptacle not
 * resetting" vs "Lack of GFCI protection" share only {gfci}).
 */
function titlesAreSimilar(a, b) {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;

  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  if (inter === 0) return false;

  const smaller = Math.min(ta.size, tb.size);
  // Subset: every significant token of the shorter title is in the longer one.
  if (smaller >= MIN_SHARED_SIGNIFICANT_TOKENS && inter === smaller) return true;

  const union = ta.size + tb.size - inter;
  return inter / union >= TITLE_JACCARD_THRESHOLD;
}

/**
 * Deduplicate findings whose title/task describes the same issue. Complements
 * evidence-based dedup: the same real-world issue can be reported under two
 * systems (or by both a per-system pass and the global sweep) with different
 * evidence quotes and slightly different wording. Keeps the highest-scored item.
 */
function deduplicateFindingsByTitle(items, getTitle, scoreFn) {
  const kept = []; // { item, title }
  const passthrough = [];

  for (const item of items) {
    const title = getTitle(item);
    const norm = normalizeTitleForDedup(title);
    if (norm.length < MIN_TITLE_DEDUP_LENGTH) {
      passthrough.push(item);
      continue;
    }

    const matchIdx = kept.findIndex((k) => titlesAreSimilar(k.title, title));
    if (matchIdx === -1) {
      kept.push({ item, title });
    } else if (scoreFn(item) > scoreFn(kept[matchIdx].item)) {
      kept[matchIdx] = { item, title };
    }
  }
  return [...kept.map((k) => k.item), ...passthrough];
}

/** Run both evidence- and title-based dedup for a set of findings. */
function dedupeFindings(items, getTitle, scoreFn) {
  const byEvidence = deduplicateFindingsByEvidence(items, scoreFn);
  return deduplicateFindingsByTitle(byEvidence, getTitle, scoreFn);
}

/**
 * Remove maintenance suggestions that duplicate a needs-attention item. The same
 * issue is frequently surfaced as both an urgent finding AND a maintenance task
 * (e.g. "Construction debris in waste disposal" + "Remove construction debris
 * from waste disposal grinder"). The needs-attention entry is the more prominent
 * one, so it wins and the redundant maintenance task is dropped. Matches on
 * shared evidence quote or similar title/task.
 */
function dropMaintenanceDuplicatedInNeedsAttention(needsAttention, maintenance) {
  if (needsAttention.length === 0) return maintenance;
  const naEvidence = needsAttention
    .map((n) => normalizeEvidenceForDedup(n.evidence || ""))
    .filter((e) => e.length >= MIN_EVIDENCE_DEDUP_LENGTH);

  return maintenance.filter((m) => {
    const mEv = normalizeEvidenceForDedup(m.evidence || m.rationale || "");
    if (mEv.length >= MIN_EVIDENCE_DEDUP_LENGTH) {
      for (const naEv of naEvidence) {
        const shorter = mEv.length < naEv.length ? mEv : naEv;
        const longer = mEv.length >= naEv.length ? mEv : naEv;
        if (longer.includes(shorter)) return false;
      }
    }
    return !needsAttention.some((n) => titlesAreSimilar(n.title, m.task));
  });
}

/**
 * Check if an item has valid evidence (direct quote from report).
 * Items without evidence may be invented; we filter them out for accuracy.
 */
function hasValidEvidence(item) {
  const ev = (item?.evidence || item?.rationale || "").toString().trim();
  return ev.length >= MIN_EVIDENCE_LENGTH && !/^(n\/a|none|na|—|–|-)$/i.test(ev);
}

/* ── Condition ↔ findings reconciliation ── */

/** Severity order (higher = worse) for clamping a system's condition. */
const CONDITION_SEVERITY_ORDER = { excellent: 0, good: 1, fair: 2, poor: 3 };

/** Canonical key used to match a finding/maintenance item to a detected system. */
function actionSystemKey(systemType) {
  const norm = normalizeSystemType(systemType) || systemType || "";
  return norm.toString().trim().toLowerCase();
}

/**
 * Condition implied by a system's surviving action items. This is the SINGLE
 * source of truth for any system that has items, applied identically whether the
 * system was detected by the model or appended from the global findings sweep —
 * so two systems with comparable items always rate the same way.
 *
 * The rating reflects the system's OVERALL condition, not the urgency of a
 * single fix. Urgency/priority ("urgent") signals how SOON a repair is needed,
 * not how bad the whole system is — a couple of localized safety repairs (a trip
 * hazard, a loose tread) don't make an otherwise sound exterior "poor". So we
 * grade by real-world impact and how widespread the issues are:
 *   - "poor": a genuinely severe/systemic problem in the DEFICIENCY findings
 *     (needs-attention) — an explicitly critical-severity finding, a CLUSTER of
 *     high-impact failures (>= 2 items at impact >= 8, e.g. structural damage /
 *     active water intrusion), OR many serious deficiencies (>= 3) indicating
 *     widespread trouble. Routine maintenance NEVER drives "poor".
 *   - "fair": some real (but contained) deficiencies, OR meaningful deferred
 *     upkeep (the common case for a handful of moderate repairs — including one
 *     or two localized safety fixes such as a trip hazard or a loose stair tread,
 *     which are urgent to address but do NOT mean the whole system is poor).
 *   - "good": only minor/cosmetic items (e.g. a single routine maintenance task).
 *   - null: no items (caller keeps/caps the model's holistic rating).
 *
 * Two deliberate guards against over-rating:
 *  1. The extraction prompts score any safety hazard at impact 8-10, so a lone
 *     urgent-but-localized repair (a trip hazard) routinely carries impact 8. We
 *     therefore do NOT treat a single high-impact item as "poor"; "poor" reflects
 *     breadth/severity, not the urgency of one fix.
 *  2. Maintenance suggestions are routine UPKEEP, not deficiencies, and the model
 *     frequently over-scores their impact (e.g. "reapply caulking" at impact 6).
 *     They are weighted far lower than needs-attention findings and can lift a
 *     system to "fair" at most — never "poor".
 */
const SERIOUS_IMPACT_THRESHOLD = 6;
const CRITICAL_IMPACT_THRESHOLD = 8;
const WIDESPREAD_SERIOUS_COUNT = 3;
/** Number of high-impact (impact >= 8) failures that together signal "poor". */
const SEVERE_CLUSTER_COUNT = 2;

/**
 * A reconciliation item is "upkeep" (a maintenance suggestion) rather than a
 * deficiency (needs-attention) finding. Needs-attention items always carry a
 * `severity` and a `title`; maintenance items carry a `task` and no `severity`.
 */
function isUpkeepItem(it) {
  return it.task !== undefined || it.severity === undefined || it.severity === null;
}

function conditionFromItems(items) {
  if (!items || items.length === 0) return null;
  let maxDefectImpact = 0;
  let seriousCount = 0; // deficiencies: high severity or impact >= SERIOUS_IMPACT_THRESHOLD
  let severeCount = 0; // deficiencies: critical severity or impact >= CRITICAL_IMPACT_THRESHOLD
  let hasCriticalSeverity = false;
  let upkeepCount = 0;
  let maxUpkeepImpact = 0;

  for (const it of items) {
    const impact = typeof it.impactScore === "number" ? it.impactScore : 5;
    if (isUpkeepItem(it)) {
      upkeepCount++;
      maxUpkeepImpact = Math.max(maxUpkeepImpact, impact);
      continue;
    }
    const sev = (it.severity || "").toLowerCase();
    maxDefectImpact = Math.max(maxDefectImpact, impact);
    if (sev === "critical") hasCriticalSeverity = true;
    if (sev === "critical" || impact >= CRITICAL_IMPACT_THRESHOLD) severeCount++;
    if (sev === "critical" || sev === "high" || impact >= SERIOUS_IMPACT_THRESHOLD) {
      seriousCount++;
    }
  }

  // "poor" requires genuinely systemic DEFICIENCIES: an explicitly critical
  // finding, a cluster of high-impact failures, or many serious deficiencies —
  // NOT a single localized safety repair, and NEVER routine maintenance alone.
  if (
    hasCriticalSeverity ||
    severeCount >= SEVERE_CLUSTER_COUNT ||
    seriousCount >= WIDESPREAD_SERIOUS_COUNT
  ) {
    return "poor";
  }
  // "fair" for contained deficiencies OR meaningful deferred upkeep (a
  // non-trivial task, or several routine ones).
  if (
    seriousCount >= 1 ||
    maxDefectImpact >= 4 ||
    maxUpkeepImpact >= SERIOUS_IMPACT_THRESHOLD ||
    upkeepCount >= 2
  ) {
    return "fair";
  }
  return "good";
}

/**
 * Reconcile the detected-systems list with the action items that actually
 * survive into the final checklist, using ONE symmetric rule so the "Systems
 * detected" card and the checklist never disagree and comparable systems always
 * rate the same way:
 *
 * - A system WITH action items takes its condition straight from
 *   `conditionFromItems` (model rating ignored), so the badge reflects the
 *   overall severity of the issues and is consistent whether or not the model
 *   happened to enumerate the system (e.g. a few moderate exterior repairs read
 *   "fair", not "poor").
 * - A system WITHOUT action items keeps its model rating but is capped at "good"
 *   (a "fair"/"poor" rating with nothing to fix offers the customer no path to
 *   improve, so it can't read worse than "good"; "excellent" is preserved).
 * - Any system that has items but no detected-systems entry (e.g. "interior"
 *   from the global sweep) is appended, so every checklist system also shows in
 *   the card with a rating.
 */
function reconcileSystemConditionsWithFindings(
  systemsDetected,
  needsAttention,
  maintenanceSuggestions,
) {
  const itemsBySystem = new Map();
  const addItem = (systemType, item) => {
    const key = actionSystemKey(systemType);
    if (!key) return;
    if (!itemsBySystem.has(key)) {
      itemsBySystem.set(key, { items: [], systemType });
    }
    itemsBySystem.get(key).items.push(item);
  };
  for (const n of needsAttention || []) addItem(n.systemType, n);
  for (const m of maintenanceSuggestions || []) addItem(m.systemType, m);

  const GOOD_ORDER = CONDITION_SEVERITY_ORDER.good;
  const seenKeys = new Set();
  const reconciled = (systemsDetected || []).map((s) => {
    seenKeys.add(actionSystemKey(s.systemType));
    const current = (s.condition || "").toLowerCase();
    const currentOrder = CONDITION_SEVERITY_ORDER[current];
    if (currentOrder === undefined) return s; // leave unexpected values untouched

    const entry = itemsBySystem.get(actionSystemKey(s.systemType));
    const itemCondition = conditionFromItems(entry ? entry.items : []);

    // No action items → can't read worse than "good"; preserve good/excellent.
    if (!itemCondition) {
      if (currentOrder <= GOOD_ORDER) return s;
      return {
        ...s,
        condition: "good",
        conditionRationale: s.conditionRationale
          ? `${s.conditionRationale} No action items were identified for this system, so its condition is shown as "good".`
          : `No action items were identified for this system, so its condition is shown as "good".`,
      };
    }

    // Has action items → condition is derived from them, identically to appended
    // systems, so two systems with comparable items always match.
    if (current === itemCondition) return s;
    return {
      ...s,
      condition: itemCondition,
      conditionRationale: s.conditionRationale
        ? `${s.conditionRationale} Condition shown as "${itemCondition}" to match the severity of its action items.`
        : `Condition shown as "${itemCondition}" to match the severity of its action items.`,
    };
  });

  // Append any action-item system that isn't already in the detected list, so
  // the systems card covers everything that appears on the checklist.
  for (const [key, { items, systemType }] of itemsBySystem) {
    if (!key || seenKeys.has(key) || isExcludedSystem(systemType)) continue;
    seenKeys.add(key);
    const condition = conditionFromItems(items) || "good";
    reconciled.push({
      systemType: normalizeSystemType(systemType) || systemType,
      condition,
      confidence: 0.6,
      conditionRationale: `Condition shown as "${condition}" based on the action items identified for this system in the report.`,
      evidence: items.find((it) => it.evidence)?.evidence || null,
    });
  }

  return reconciled;
}

/**
 * Gather text for a system from a LARGE report by collecting EVERY heading
 * occurrence (not just the first), since a single system's findings are usually
 * scattered across the document. Merges overlapping windows and caps the total.
 * Falls back to the whole report when no headings match.
 */
function extractAllSystemSections(fullText, systemType, sectionHint, maxChars = MAX_SECTION_CHARS) {
  const hints = [systemType, sectionHint].filter(Boolean);
  const headingPatterns = hints.flatMap((h) => {
    const esc = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [
      new RegExp(`(?:^|\\n)\\s*#{1,4}\\s*${esc}[^\\n]*`, "gim"),
      new RegExp(`(?:^|\\n)\\s*\\*{0,2}${esc}\\*{0,2}\\s*[:—\\-]?`, "gim"),
      new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\n[-=]{2,}`, "gim"),
    ];
  });

  // Collect [start, end] windows around every heading occurrence.
  const WINDOW_BEFORE = 200;
  const WINDOW_AFTER = 1800;
  const ranges = [];
  for (const re of headingPatterns) {
    let match;
    while ((match = re.exec(fullText)) !== null) {
      const startIdx = Math.max(0, match.index - WINDOW_BEFORE);
      const endIdx = Math.min(fullText.length, match.index + match[0].length + WINDOW_AFTER);
      ranges.push([startIdx, endIdx]);
      if (match.index === re.lastIndex) re.lastIndex++; // guard against zero-width matches
    }
  }

  if (ranges.length === 0) {
    return fullText.length > maxChars ? fullText.slice(0, maxChars) : fullText;
  }

  // Merge overlapping/adjacent ranges.
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0].slice()];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], ranges[i][1]);
    } else {
      merged.push(ranges[i].slice());
    }
  }

  let out = "";
  for (const [s, e] of merged) {
    if (out.length >= maxChars) break;
    const chunk = fullText.slice(s, e);
    out += (out ? "\n...\n" : "") + chunk;
  }
  return out.length > maxChars ? out.slice(0, maxChars) : out;
}

/**
 * Resolve the text to send to a per-system extraction pass. Sends the full
 * report for typical sizes (so no scattered findings are missed); for very large
 * reports, gathers every heading occurrence for the system.
 */
function getSystemTextForPass(fullText, systemType, sectionHint) {
  if (fullText.length <= FULL_TEXT_PER_SYSTEM_THRESHOLD) {
    return fullText;
  }
  return extractAllSystemSections(fullText, systemType, sectionHint);
}

/**
 * Global findings sweep: one pass over the FULL report to capture every explicit
 * deficiency/recommendation, including those in sections that are not tracked
 * systems (Interior/Carpentry/General/Appliance). Returns normalized, evidence-
 * gated findings to be merged with the per-system results. Failures are logged
 * and treated as empty so they never break the overall analysis.
 */
async function runGlobalFindingsPass(openai, textToUse, usageCtx) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await chatCompletionWithRetry(openai, {
        model: EXTRACTION_MODEL,
        messages: [
          { role: "system", content: "You output only valid JSON. No markdown, no code blocks, no extra text." },
          { role: "user", content: GLOBAL_FINDINGS_PROMPT + textToUse },
        ],
        temperature: 0,
        seed: ANALYSIS_SEED,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }, { label: "global-findings" });
      if (usageCtx && completion.usage) {
        logAiUsage({
          accountId: usageCtx.accountId,
          userId: usageCtx.userId,
          model: `openai/${EXTRACTION_MODEL}`,
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          endpoint: "inspection-analysis/global-findings",
        }).catch((err) => console.error("[inspectionAnalysis] logAiUsage error:", err.message));
      }
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        lastErr = new Error("Empty response");
        continue;
      }
      const data = JSON.parse(content);

      const needsAttention = (data.needsAttention || [])
        .filter((n) => hasValidEvidence(n) && !isExcludedSystem(n.systemType))
        .map((n) => ({
          title: n.title || "",
          systemType:
            resolveFindingSystemType({
              systemType: n.systemType,
              title: n.title,
              suggestedAction: n.suggestedAction,
            }) ||
            normalizeSystemType(n.systemType) ||
            n.systemType ||
            "interior",
          severity: n.severity || "medium",
          evidence: n.evidence || null,
          suggestedAction: n.suggestedAction || "",
          priority: n.priority || "medium",
          impactScore: n.impactScore ?? 5,
        }));

      const maintenanceSuggestions = (data.maintenanceSuggestions || [])
        .filter((m) => hasValidEvidence(m) && !isExcludedSystem(m.systemType))
        .map((m) => ({
          systemType:
            resolveFindingSystemType({
              systemType: m.systemType,
              task: m.task,
              rationale: m.rationale,
            }) ||
            normalizeSystemType(m.systemType) ||
            m.systemType ||
            "interior",
          task: m.task || "",
          suggestedWhen: m.suggestedWhen || "",
          priority: m.priority || "medium",
          rationale: m.rationale || "",
          confidence: m.confidence ?? 0.5,
          impactScore: m.impactScore ?? 5,
          evidence: m.evidence || null,
        }));

      return { needsAttention, maintenanceSuggestions };
    } catch (err) {
      lastErr = err;
    }
  }
  console.error("[inspectionAnalysis] global findings pass failed:", lastErr?.message || lastErr);
  return { needsAttention: [], maintenanceSuggestions: [] };
}

/**
 * Run multi-pass analysis: inventory pass then per-system extraction.
 * Falls back to single-pass for short reports.
 */
async function runMultiPassAnalysis(openai, textToUse, propertyContext, keywordDetections, progressCb, usageCtx) {
  const preDetectedSystems = keywordDetections.map((d) => d.system);
  const preDetectionHint = preDetectedSystems.length > 0
    ? `\nA keyword scan found references to: ${preDetectedSystems.join(", ")}. Only include them if the report has substantive findings or condition assessments for them.\n`
    : "";
  const ctxPrefix = propertyContext ? `PROPERTY CONTEXT:\n${propertyContext}\n` : "";

  /* ── Pass 1: System Inventory ── */
  await progressCb("Analyzing report — identifying systems...");
  const inventoryCompletion = await chatCompletionWithRetry(openai, {
    model: REASONING_MODEL,
    messages: [
      { role: "system", content: "You output only valid JSON. No markdown, no code blocks, no extra text." },
      { role: "user", content: ctxPrefix + INVENTORY_PROMPT + preDetectionHint + textToUse },
    ],
    temperature: 0,
    seed: ANALYSIS_SEED,
    response_format: { type: "json_object" },
  }, { label: "inventory" });
  if (usageCtx && inventoryCompletion.usage) {
    logAiUsage({
      accountId: usageCtx.accountId,
      userId: usageCtx.userId,
      model: `openai/${REASONING_MODEL}`,
      promptTokens: inventoryCompletion.usage.prompt_tokens,
      completionTokens: inventoryCompletion.usage.completion_tokens,
      endpoint: "inspection-analysis/inventory",
    }).catch((err) => console.error("[inspectionAnalysis] logAiUsage error:", err.message));
  }

  const inventoryContent = inventoryCompletion.choices[0]?.message?.content;
  if (!inventoryContent) throw new Error("Empty response from AI inventory pass");
  const inventory = JSON.parse(inventoryContent);

  const inventorySystems = (inventory.systems || [])
    .map((s) => ({
      systemType: normalizeSystemType(s.systemType) || s.systemType,
      sectionHint: s.sectionHint || "",
    }))
    .filter((s) => s.systemType && !isExcludedSystem(s.systemType));

  const seenSys = new Set();
  const dedupedSystems = inventorySystems.filter((s) => {
    const k = s.systemType.toLowerCase();
    if (seenSys.has(k)) return false;
    seenSys.add(k);
    return true;
  });

  // Coverage safety net: a single inventory pass can miss a system that is
  // clearly present in the report. Add any keyword-detected system the inventory
  // omitted so it still gets a per-system extraction pass. The per-system prompt
  // will produce nothing if the system has no substantive findings.
  for (const det of keywordDetections) {
    const normalized = normalizeSystemType(det.system) || det.system;
    if (!normalized || isExcludedSystem(normalized)) continue;
    const k = normalized.toLowerCase();
    if (seenSys.has(k)) continue;
    seenSys.add(k);
    dedupedSystems.push({ systemType: normalized, sectionHint: "" });
  }

  /* ── Global findings sweep (runs concurrently with the per-system passes) ── */
  // Kick off the full-document sweep now so it overlaps Pass 2 instead of adding
  // a serial round-trip at the end. It only needs the report text, not the
  // per-system results, so there is no ordering dependency. We await it at the
  // merge step below.
  const globalFindingsPromise = runGlobalFindingsPass(openai, textToUse, usageCtx);

  /* ── Pass 2: Per-system extraction (batched) ── */
  const allSystemsDetected = [];
  const allNeedsAttention = [];
  const allMaintenanceSuggestions = [];
  const allCitations = [];

  const batches = [];
  for (let i = 0; i < dedupedSystems.length; i += MAX_CONCURRENT_SYSTEM_CALLS) {
    batches.push(dedupedSystems.slice(i, i + MAX_CONCURRENT_SYSTEM_CALLS));
  }

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    await progressCb(`Analyzing systems (${bi * MAX_CONCURRENT_SYSTEM_CALLS + 1}-${Math.min((bi + 1) * MAX_CONCURRENT_SYSTEM_CALLS, dedupedSystems.length)} of ${dedupedSystems.length})...`);

    const results = await Promise.allSettled(
      batch.map(async (sys) => {
        const trimmed = getSystemTextForPass(textToUse, sys.systemType, sys.sectionHint);
        const prompt = PER_SYSTEM_PROMPT.replace(/\{SYSTEM_TYPE\}/g, sys.systemType);

        // Retry once: a truncated/invalid JSON response (or transient error)
        // would otherwise silently drop this entire system's findings.
        let lastErr;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const completion = await chatCompletionWithRetry(openai, {
              model: EXTRACTION_MODEL,
              messages: [
                { role: "system", content: "You output only valid JSON. No markdown, no code blocks, no extra text." },
                { role: "user", content: prompt + trimmed },
              ],
              temperature: 0,
              seed: ANALYSIS_SEED,
              max_tokens: 4000,
              response_format: { type: "json_object" },
            }, { label: `system/${sys.systemType}` });
            if (usageCtx && completion.usage) {
              logAiUsage({
                accountId: usageCtx.accountId,
                userId: usageCtx.userId,
                model: `openai/${EXTRACTION_MODEL}`,
                promptTokens: completion.usage.prompt_tokens,
                completionTokens: completion.usage.completion_tokens,
                endpoint: `inspection-analysis/system/${sys.systemType}`,
              }).catch((err) => console.error("[inspectionAnalysis] logAiUsage error:", err.message));
            }

            const content = completion.choices[0]?.message?.content;
            if (!content) {
              lastErr = new Error("Empty response");
              continue;
            }
            return { systemType: sys.systemType, data: JSON.parse(content) };
          } catch (err) {
            lastErr = err;
          }
        }
        throw new Error(`per-system extraction failed for "${sys.systemType}": ${lastErr?.message || "unknown error"}`);
      })
    );

    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[inspectionAnalysis] per-system pass dropped:", r.reason?.message || r.reason);
        continue;
      }
      if (!r.value) continue;
      const { systemType, data } = r.value;
      const sysCondition = (data.condition || "unknown").toLowerCase();
      const hasCondition = ["excellent", "good", "fair", "poor"].includes(sysCondition);
      allSystemsDetected.push({
        systemType,
        condition: hasCondition ? sysCondition : "fair",
        confidence: data.conditionConfidence ?? (hasCondition ? 0.5 : 0.4),
        conditionRationale: data.conditionRationale || null,
        evidence: data.evidence || null,
      });

      for (const n of (data.needsAttention || [])) {
        if (!hasValidEvidence(n)) continue;
        allNeedsAttention.push({
          title: n.title || "",
          systemType,
          severity: n.severity || "medium",
          evidence: n.evidence || null,
          suggestedAction: n.suggestedAction || "",
          priority: n.priority || "medium",
          impactScore: n.impactScore ?? 5,
        });
      }

      for (const m of (data.maintenanceSuggestions || [])) {
        if (!hasValidEvidence(m)) continue;
        allMaintenanceSuggestions.push({
          systemType,
          task: m.task || "",
          suggestedWhen: m.suggestedWhen || "",
          priority: m.priority || "medium",
          rationale: m.rationale || "",
          confidence: m.confidence ?? 0.5,
          impactScore: m.impactScore ?? 5,
          evidence: m.evidence || null,
        });
      }

      for (const c of (data.citations || [])) {
        allCitations.push(c);
      }
    }
  }

  /* ── Merge in the global findings sweep ── */
  // Catches explicit recommendations that don't map to an enumerated system
  // (Interior/Carpentry/General/Appliance sections). Merged + deduped below so
  // results are comprehensive and consistent regardless of inventory variance.
  await progressCb("Reviewing report for any remaining recommendations...");
  const globalFindings = await globalFindingsPromise;
  for (const n of globalFindings.needsAttention) allNeedsAttention.push(n);
  for (const m of globalFindings.maintenanceSuggestions) allMaintenanceSuggestions.push(m);

  const systemsWithFindings = new Set();
  for (const s of allSystemsDetected) {
    const cond = (s.condition || "unknown").toLowerCase();
    if (cond !== "unknown" || s.evidence) systemsWithFindings.add(s.systemType.toLowerCase());
  }
  for (const n of allNeedsAttention) {
    if (n.systemType) systemsWithFindings.add(n.systemType.toLowerCase());
  }
  for (const m of allMaintenanceSuggestions) {
    if (m.systemType) systemsWithFindings.add(m.systemType.toLowerCase());
  }

  // Deduplicate findings that appear under multiple systems (same evidence quote
  // or same title/task).
  const dedupedNeedsAttention = dedupeFindings(allNeedsAttention, (n) => n.title, severityScore);
  const dedupedMaintenanceSuggestions = dedupeFindings(allMaintenanceSuggestions, (m) => m.task, priorityScore);

  const overallCondition = inventory.overallCondition || {};
  return {
    condition: overallCondition,
    systemsDetected: allSystemsDetected,
    needsAttention: sortNeedsAttention(dedupedNeedsAttention),
    maintenanceSuggestions: sortMaintenanceSuggestions(dedupedMaintenanceSuggestions),
    suggestedSystemsToAdd: dedupedSystems
      .filter((s) => systemsWithFindings.has(s.systemType.toLowerCase()))
      .map((s) => ({
        systemType: s.systemType,
        reason: s.sectionHint || `Identified in inspection report`,
        confidence: 0.7,
      })),
    summary: inventory.summary || null,
    citations: allCitations,
  };
}

/**
 * Run a single comprehensive analysis pass over the full report in one LLM call.
 * Used only for very short reports (<= SINGLE_PASS_MAX_CHARS), where one call is
 * sufficient to enumerate the few findings present. Larger reports use multi-pass
 * for higher recall. ANALYSIS_PROMPT returns systems, conditions, findings, and
 * summary together.
 */
async function runSinglePassAnalysis(openai, textToUse, propertyContext, keywordDetections, usageCtx) {
  const preDetectedSystems = keywordDetections.map((d) => d.system);
  const preDetectionHint = preDetectedSystems.length > 0
    ? `\n\nA keyword scan found references to: ${preDetectedSystems.join(", ")}. Only include them in systemsDetected and suggestedSystemsToAdd if the report has substantive findings or condition assessments for them.\n\n`
    : "";

  const completion = await chatCompletionWithRetry(openai, {
    model: REASONING_MODEL,
    messages: [
      { role: "system", content: "You output only valid JSON. No markdown, no code blocks, no extra text." },
      {
        role: "user",
        content: (propertyContext ? `PROPERTY CONTEXT:\n${propertyContext}\n` : "") + ANALYSIS_PROMPT + preDetectionHint + textToUse,
      },
    ],
    temperature: 0,
    seed: ANALYSIS_SEED,
    max_tokens: 4096,
    response_format: { type: "json_object" },
  }, { label: "single-pass" });

  if (usageCtx && completion.usage) {
    logAiUsage({
      accountId: usageCtx.accountId,
      userId: usageCtx.userId,
      model: `openai/${REASONING_MODEL}`,
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      endpoint: "inspection-analysis/single-pass",
    }).catch((err) => console.error("[inspectionAnalysis] logAiUsage error:", err.message));
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from AI");
  return JSON.parse(content);
}

async function runAnalysis(jobId) {
  const job = await InspectionAnalysisJob.get(jobId);
  if (job.status !== "queued" && job.status !== "processing") {
    return;
  }

  await InspectionAnalysisJob.updateStatus(jobId, { status: "processing", progress: "Downloading report..." });

  let buffer;
  try {
    if (!AWS_S3_BUCKET) {
      throw new Error("S3 bucket not configured");
    }
    buffer = await getFile(job.s3_key);
  } catch (err) {
    console.error("[inspectionAnalysis] S3 download error:", err);
    await InspectionAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: "Failed to download report from storage",
    });
    return;
  }

  await InspectionAnalysisJob.updateStatus(jobId, { progress: "Extracting text..." });

  let text = await extractTextFromBuffer(buffer, job.mime_type);

  if (!text || text.trim().length < 100) {
    await InspectionAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: "Could not extract enough text from the report. The file may be scanned or corrupted.",
    });
    return;
  }

  const keywordDetections = detectSystemsFromText(text);

  await InspectionAnalysisJob.updateStatus(jobId, { progress: "Analyzing with AI..." });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await InspectionAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: "AI analysis is not configured. Set OPENAI_API_KEY.",
    });
    return;
  }

  const openai = new OpenAI({ apiKey });

  const maxChars = 100000;
  const textToUse = text.length > maxChars ? text.slice(0, maxChars) : text;

  const propertyContext = await getPropertyContextForAnalysis(job.property_id);

  const accountRes = await db.query(
    `SELECT account_id FROM properties WHERE id = $1`,
    [job.property_id]
  );
  const usageCtx = {
    accountId: accountRes.rows[0]?.account_id,
    userId: job.user_id,
  };

  const useMultiPass = textToUse.length > SINGLE_PASS_MAX_CHARS;

  let parsed;
  try {
    if (useMultiPass) {
      console.log(`[inspectionAnalysis] Using multi-pass analysis (${textToUse.length} chars)`);
      parsed = await runMultiPassAnalysis(
        openai,
        textToUse,
        propertyContext,
        keywordDetections,
        (msg) => InspectionAnalysisJob.updateStatus(jobId, { progress: msg }),
        usageCtx,
      );
    } else {
      console.log(`[inspectionAnalysis] Using single-pass analysis (${textToUse.length} chars)`);
      parsed = await runSinglePassAnalysis(openai, textToUse, propertyContext, keywordDetections, usageCtx);
    }
  } catch (err) {
    console.error("[inspectionAnalysis] OpenAI error:", err);
    await InspectionAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: err.message || "AI analysis failed",
    });
    return;
  }

  const condition = parsed.condition || {};
  const conditionRating = (condition.rating || "unknown").toLowerCase();
  const hasValidCondition = ["excellent", "good", "fair", "poor"].includes(conditionRating);

  const systemsDetectedSeen = new Set();
  const systemsDetected = (parsed.systemsDetected || [])
    .map((s) => {
      const normalized = normalizeSystemType(s.systemType) || s.systemType;
      const sysCondition = (s.condition || "unknown").toLowerCase();
      const hasCondition = ["excellent", "good", "fair", "poor"].includes(sysCondition);
      return {
        systemType: normalized,
        condition: hasCondition ? sysCondition : "fair",
        confidence: s.confidence ?? (hasCondition ? 0.5 : 0.4),
        conditionRationale: s.conditionRationale || null,
        evidence: s.evidence || null,
      };
    })
    .filter((s) => {
      const key = (s.systemType || "").toString().toLowerCase();
      if (!key || systemsDetectedSeen.has(key) || isExcludedSystem(s.systemType)) return false;
      systemsDetectedSeen.add(key);
      return true;
    });

  const suggestedSystemsToAddSeen = new Set();
  const suggestedSystemsToAdd = (parsed.suggestedSystemsToAdd || [])
    .map((s) => ({
      systemType: normalizeSystemType(s.systemType) || s.systemType,
      reason: s.reason || "",
      confidence: s.confidence ?? 0.5,
    }))
    .filter((s) => {
      const key = (s.systemType || "").toString().toLowerCase();
      if (!key || suggestedSystemsToAddSeen.has(key) || isExcludedSystem(s.systemType)) return false;
      suggestedSystemsToAddSeen.add(key);
      return true;
    });

  const rawMaintenanceSuggestions = (parsed.maintenanceSuggestions || [])
    .filter((s) => !isExcludedSystem(s.systemType) && hasValidEvidence(s))
    .map((s) => ({
      systemType:
        resolveFindingSystemType({
          systemType: s.systemType,
          task: s.task,
          rationale: s.rationale,
        }) ||
        normalizeSystemType(s.systemType) ||
        s.systemType,
      task: s.task || "",
      suggestedWhen: s.suggestedWhen || "",
      priority: s.priority || "medium",
      rationale: s.rationale || "",
      confidence: s.confidence ?? 0.5,
      impactScore: s.impactScore ?? 5,
      evidence: s.evidence || null,
    }));
  const dedupedMaintenanceSuggestions = dedupeFindings(
    rawMaintenanceSuggestions,
    (m) => m.task,
    priorityScore
  );

  const rawNeedsAttention = (parsed.needsAttention || [])
    .filter((n) => !isExcludedSystem(n.systemType) && hasValidEvidence(n))
    .map((n) => ({
      title: n.title || "",
      systemType: n.systemType
        ? resolveFindingSystemType({
            systemType: n.systemType,
            title: n.title,
            suggestedAction: n.suggestedAction,
          }) ||
          normalizeSystemType(n.systemType) ||
          n.systemType
        : null,
      severity: n.severity || "medium",
      evidence: n.evidence || null,
      suggestedAction: n.suggestedAction || "",
      priority: n.priority || "medium",
      impactScore: n.impactScore ?? 5,
    }));
  const needsAttention = sortNeedsAttention(
    dedupeFindings(rawNeedsAttention, (n) => n.title, severityScore)
  );

  // Cross-list dedup: drop maintenance tasks that restate a needs-attention item
  // so the same issue doesn't appear twice in the checklist (once as a finding,
  // once as a task). Needs-attention is the more prominent surface, so it wins.
  const maintenanceSuggestions = sortMaintenanceSuggestions(
    dropMaintenanceDuplicatedInNeedsAttention(needsAttention, dedupedMaintenanceSuggestions)
  );

  // Reconcile per-system condition ratings against the action items that
  // actually survived evidence-gating and dedup. Without this, a system can be
  // rated "poor"/"fair" while having zero matching action items — a contradiction
  // that leaves the customer no way to improve the rating. We clamp each system's
  // condition toward "good" so a worse-than-good rating always has actionable work.
  const reconciledSystemsDetected = reconcileSystemConditionsWithFindings(
    systemsDetected,
    needsAttention,
    maintenanceSuggestions,
  );

  // The reconcile step appends action-item-only systems (e.g. "interior" from
  // the global findings sweep) to systemsDetected so they appear in the card.
  // The model's suggestedSystemsToAdd list, however, routinely omits these
  // catch-all buckets, so they'd never be offered when the customer adds missing
  // systems to the property. Mirror them into suggestedSystemsToAdd so every
  // detected system that carries action items can actually be created.
  const actionItemSystemKeys = new Set();
  for (const n of needsAttention) {
    const k = actionSystemKey(n.systemType);
    if (k) actionItemSystemKeys.add(k);
  }
  for (const m of maintenanceSuggestions) {
    const k = actionSystemKey(m.systemType);
    if (k) actionItemSystemKeys.add(k);
  }
  for (const s of reconciledSystemsDetected) {
    const key = (s.systemType || "").toString().toLowerCase();
    if (!key || suggestedSystemsToAddSeen.has(key)) continue;
    if (isExcludedSystem(s.systemType)) continue;
    if (!actionItemSystemKeys.has(actionSystemKey(s.systemType))) continue;
    suggestedSystemsToAddSeen.add(key);
    suggestedSystemsToAdd.push({
      systemType: s.systemType,
      reason:
        s.conditionRationale ||
        "Identified in the inspection report with action items",
      confidence: s.confidence ?? 0.6,
    });
  }

  // If the AI couldn't determine a condition AND found no actionable content,
  // the document almost certainly isn't an inspection report (or is unreadable).
  // Fail with a clear, user-facing message instead of inserting "unknown" — which
  // the DB constraint rejects, causing a silent, confusing failure.
  const hasAnyFindings =
    systemsDetected.length > 0 ||
    needsAttention.length > 0 ||
    maintenanceSuggestions.length > 0 ||
    suggestedSystemsToAdd.length > 0;

  if (!hasValidCondition && !hasAnyFindings) {
    await InspectionAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message:
        "We couldn't find any property inspection findings in this document. Please verify it's a complete inspection report (PDF) and try again.",
    });
    return;
  }

  // Findings exist but the AI didn't give us a usable overall rating — default to "fair"
  // so we can persist the analysis (DB constraint only allows excellent/good/fair/poor).
  const validCondition = hasValidCondition ? conditionRating : "fair";

  try {
    const result = await InspectionAnalysisResult.create({
      job_id: jobId,
      property_id: job.property_id,
      condition_rating: validCondition,
      condition_confidence: hasValidCondition ? (condition.confidence ?? null) : null,
      condition_rationale: condition.rationale ?? null,
      systems_detected: reconciledSystemsDetected,
      needs_attention: needsAttention,
      suggested_systems_to_add: suggestedSystemsToAdd,
      maintenance_suggestions: maintenanceSuggestions,
      summary: parsed.summary || null,
      citations: parsed.citations || [],
    });

    // The analysis enters the review queue in `pending_review`. Downstream/dependent
    // outputs (checklist items, property AI reanalysis) are intentionally NOT generated
    // here — they are released only when a Super Admin approves the analysis. This keeps
    // unreviewed AI findings fully hidden from the customer.
    await InspectionAnalysisJob.updateStatus(jobId, { status: "completed", progress: "Done" });

    // Alert Super Admins that a new analysis needs review (in-app + ops email).
    try {
      const { notifyAdminsReviewReady } = require("./inspectionReviewNotifyService");
      const detail = await InspectionAnalysisResult.getReviewDetail(result.id);
      notifyAdminsReviewReady(detail).catch((err) =>
        console.error("[inspectionReviewNotify] admin alert failed:", err.message)
      );
    } catch (err) {
      console.error("[inspectionReviewNotify] admin alert setup failed:", err.message);
    }
  } catch (err) {
    console.error("[inspectionAnalysis] Save result error:", err);
    const isConditionConstraint =
      err?.code === "23514" &&
      typeof err?.constraint === "string" &&
      err.constraint.includes("condition_rating");
    await InspectionAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: isConditionConstraint
        ? "We couldn't determine the property condition from this document. Please verify it's a complete inspection report and try again."
        : "Failed to save analysis result",
    });
  }
}

module.exports = { runAnalysis, CANONICAL_SYSTEMS, normalizeSystemType };
