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
const { triggerReanalysisOnInspection } = require("./ai/propertyReanalysisService");
const { CANONICAL_SYSTEMS, isExcludedSystem, normalizeSystemType } = require("./systemTypes");
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

Output format:
{
  "condition": "good|fair|poor|excellent|unknown",
  "conditionConfidence": 0.8,
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

/* Legacy single-pass prompt (kept as fallback for short reports) */
const ANALYSIS_PROMPT = `You are an expert home inspector analyzing a property inspection report. Extract structured findings that represent ACTUAL DEFICIENCIES, DEFECTS, SAFETY CONCERNS, or EXPLICIT RECOMMENDATIONS.

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
2. Use a custom systemType when none of the above fit well (e.g. "pool", "deck", "septic"). Use lowercase camelCase.

CRITICAL: Do NOT suggest or use "Appliances" or appliance-related systems. We track only property systems, not appliances.

DEDUPLICATION: Do NOT create redundant or overlapping systems. Each area maps to one system. "structure"/"foundation" -> foundation. "fuel storage"/"oil tank" -> heating. "chimney"/"fireplace" -> heating. "attic"/"insulation" -> exterior. "crawl space"/"basement" -> foundation. "garage"/"garage door" -> exterior. "ventilation" -> ac. "smoke detectors"/"CO detectors" -> safety. Do NOT include "inspections" as a system.

- For suggestedSystemsToAdd: include every system the report inspected with findings.
- Use confidence 0.7-0.95 for items with clear verbatim evidence; 0.5-0.7 for indirect evidence. Do NOT include items below 0.5 confidence.
- For condition rating use exactly: excellent, good, fair, poor, unknown.
- Overall condition: infer from findings, severity, age, and tone. Only use "unknown" when the report has almost no usable information.
- suggestedWhen: use phrases like "within 30 days", "within 6 months", "annually", "as soon as possible".
- Keep excerpts short (1-2 sentences max).

Output format (strict JSON):
{
  "condition": { "rating": "good", "confidence": 0.74, "rationale": "brief explanation" },
  "systemsDetected": [{ "systemType": "HVAC", "condition": "good", "confidence": 0.81, "evidence": "short excerpt" }],
  "needsAttention": [{ "title": "...", "systemType": "Roof", "severity": "high", "priority": "urgent", "impactScore": 7, "suggestedAction": "...", "evidence": "verbatim quote" }],
  "suggestedSystemsToAdd": [{ "systemType": "Roof", "reason": "...", "confidence": 0.77 }],
  "maintenanceSuggestions": [{ "systemType": "HVAC", "task": "...", "suggestedWhen": "within 30 days", "priority": "high", "impactScore": 6, "rationale": "why — grounded in report", "confidence": 0.76, "evidence": "verbatim quote from report" }],
  "summary": "2-3 sentence summary of the report",
  "citations": [{ "page": 3, "excerpt": "short excerpt" }]
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

const SHORT_REPORT_THRESHOLD = 8000;
const MAX_CONCURRENT_SYSTEM_CALLS = 4;
const MIN_EVIDENCE_LENGTH = 15;

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
 * Check if an item has valid evidence (direct quote from report).
 * Items without evidence may be invented; we filter them out for accuracy.
 */
function hasValidEvidence(item) {
  const ev = (item?.evidence || item?.rationale || "").toString().trim();
  return ev.length >= MIN_EVIDENCE_LENGTH && !/^(n\/a|none|na|—|–|-)$/i.test(ev);
}

/**
 * Extract relevant text for a specific system from the full report.
 * Uses section headings to find relevant portions; falls back to full text.
 */
function extractSystemSection(fullText, systemType, sectionHint) {
  const hints = [systemType, sectionHint].filter(Boolean);
  const headingPatterns = hints.flatMap((h) => {
    const esc = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [
      new RegExp(`(?:^|\\n)\\s*#{1,4}\\s*${esc}[^\\n]*`, "im"),
      new RegExp(`(?:^|\\n)\\s*\\*{0,2}${esc}\\*{0,2}\\s*[:—\\-]?`, "im"),
      new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\n[-=]{2,}`, "im"),
    ];
  });

  for (const re of headingPatterns) {
    const match = re.exec(fullText);
    if (match) {
      const startIdx = match.index;
      const nextHeading = fullText.slice(startIdx + match[0].length).search(
        /\n\s*(?:#{1,4}\s|\*{2}[A-Z]|[A-Z][A-Z\s/]{3,}[:—\-]\s*\n|[A-Z][a-z]+ [A-Z][a-z]+\s*\n[-=]{2,})/
      );
      const endIdx = nextHeading >= 0
        ? startIdx + match[0].length + nextHeading + 500
        : startIdx + 8000;
      return fullText.slice(Math.max(0, startIdx - 200), Math.min(fullText.length, endIdx));
    }
  }
  return fullText;
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
  const inventoryCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You output only valid JSON. No markdown, no code blocks, no extra text." },
      { role: "user", content: ctxPrefix + INVENTORY_PROMPT + preDetectionHint + textToUse },
    ],
    temperature: 0.15,
    response_format: { type: "json_object" },
  });
  if (usageCtx && inventoryCompletion.usage) {
    logAiUsage({
      accountId: usageCtx.accountId,
      userId: usageCtx.userId,
      model: "openai/gpt-4o",
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
        const sectionText = extractSystemSection(textToUse, sys.systemType, sys.sectionHint);
        const maxSectionChars = 20000;
        const trimmed = sectionText.length > maxSectionChars ? sectionText.slice(0, maxSectionChars) : sectionText;
        const prompt = PER_SYSTEM_PROMPT.replace(/\{SYSTEM_TYPE\}/g, sys.systemType);

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You output only valid JSON. No markdown, no code blocks, no extra text." },
            { role: "user", content: prompt + trimmed },
          ],
          temperature: 0.15,
          response_format: { type: "json_object" },
        });
        if (usageCtx && completion.usage) {
          logAiUsage({
            accountId: usageCtx.accountId,
            userId: usageCtx.userId,
            model: "openai/gpt-4o",
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            endpoint: `inspection-analysis/system/${sys.systemType}`,
          }).catch((err) => console.error("[inspectionAnalysis] logAiUsage error:", err.message));
        }

        const content = completion.choices[0]?.message?.content;
        if (!content) return null;
        return { systemType: sys.systemType, data: JSON.parse(content) };
      })
    );

    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const { systemType, data } = r.value;
      const sysCondition = (data.condition || "unknown").toLowerCase();
      const hasCondition = ["excellent", "good", "fair", "poor"].includes(sysCondition);
      allSystemsDetected.push({
        systemType,
        condition: hasCondition ? sysCondition : "unknown",
        confidence: hasCondition ? (data.conditionConfidence ?? 0.5) : null,
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

  const overallCondition = inventory.overallCondition || {};
  return {
    condition: overallCondition,
    systemsDetected: allSystemsDetected,
    needsAttention: sortNeedsAttention(allNeedsAttention),
    maintenanceSuggestions: sortMaintenanceSuggestions(allMaintenanceSuggestions),
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
 * Run legacy single-pass analysis for short reports.
 */
async function runSinglePassAnalysis(openai, textToUse, propertyContext, keywordDetections, usageCtx) {
  const preDetectedSystems = keywordDetections.map((d) => d.system);
  const preDetectionHint = preDetectedSystems.length > 0
    ? `\n\nA keyword scan found references to: ${preDetectedSystems.join(", ")}. Only include them in systemsDetected and suggestedSystemsToAdd if the report has substantive findings or condition assessments for them.\n\n`
    : "";

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You output only valid JSON. No markdown, no code blocks, no extra text." },
      {
        role: "user",
        content: (propertyContext ? `PROPERTY CONTEXT:\n${propertyContext}\n` : "") + ANALYSIS_PROMPT + preDetectionHint + textToUse,
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  if (usageCtx && completion.usage) {
    logAiUsage({
      accountId: usageCtx.accountId,
      userId: usageCtx.userId,
      model: "openai/gpt-4o",
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

  const useMultiPass = textToUse.length > SHORT_REPORT_THRESHOLD;

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
  const validCondition = ["excellent", "good", "fair", "poor"].includes(conditionRating)
    ? conditionRating
    : "unknown";

  const systemsDetectedSeen = new Set();
  const systemsDetected = (parsed.systemsDetected || [])
    .map((s) => {
      const normalized = normalizeSystemType(s.systemType) || s.systemType;
      const sysCondition = (s.condition || "unknown").toLowerCase();
      const hasCondition = ["excellent", "good", "fair", "poor"].includes(sysCondition);
      return {
        systemType: normalized,
        condition: hasCondition ? sysCondition : "unknown",
        confidence: hasCondition ? (s.confidence ?? 0.5) : null,
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

  const maintenanceSuggestions = sortMaintenanceSuggestions(
    (parsed.maintenanceSuggestions || [])
      .filter((s) => !isExcludedSystem(s.systemType) && hasValidEvidence(s))
      .map((s) => ({
        systemType: normalizeSystemType(s.systemType) || s.systemType,
        task: s.task || "",
        suggestedWhen: s.suggestedWhen || "",
        priority: s.priority || "medium",
        rationale: s.rationale || "",
        confidence: s.confidence ?? 0.5,
        impactScore: s.impactScore ?? 5,
        evidence: s.evidence || null,
      }))
  );

  const needsAttention = sortNeedsAttention(
    (parsed.needsAttention || [])
      .filter((n) => !isExcludedSystem(n.systemType) && hasValidEvidence(n))
      .map((n) => ({
        title: n.title || "",
        systemType: n.systemType ? normalizeSystemType(n.systemType) || n.systemType : null,
        severity: n.severity || "medium",
        evidence: n.evidence || null,
        suggestedAction: n.suggestedAction || "",
        priority: n.priority || "medium",
        impactScore: n.impactScore ?? 5,
      }))
  );

  try {
    const result = await InspectionAnalysisResult.create({
      job_id: jobId,
      property_id: job.property_id,
      condition_rating: validCondition,
      condition_confidence: validCondition === "unknown" ? null : (condition.confidence ?? null),
      condition_rationale: condition.rationale ?? null,
      systems_detected: systemsDetected,
      needs_attention: needsAttention,
      suggested_systems_to_add: suggestedSystemsToAdd,
      maintenance_suggestions: maintenanceSuggestions,
      summary: parsed.summary || null,
      citations: parsed.citations || [],
    });

    // Auto-generate checklist items from the analysis
    const InspectionChecklistItem = require("../models/inspectionChecklistItem");
    await InspectionChecklistItem.generateFromAnalysis(result).catch((err) =>
      console.error("[inspectionAnalysis] Checklist generation failed:", err.message)
    );

    await InspectionAnalysisJob.updateStatus(jobId, { status: "completed", progress: "Done" });

    triggerReanalysisOnInspection(job.property_id, result).catch((err) =>
      console.error("[propertyReanalysis] Inspection trigger failed:", err.message)
    );
  } catch (err) {
    console.error("[inspectionAnalysis] Save result error:", err);
    await InspectionAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: "Failed to save analysis result",
    });
  }
}

module.exports = { runAnalysis, CANONICAL_SYSTEMS, normalizeSystemType };
