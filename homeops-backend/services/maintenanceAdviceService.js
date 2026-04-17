"use strict";

/**
 * AI Maintenance Advisor Service
 *
 * Analyzes property and system data (inspection reports, reanalysis, user-entered
 * system info) and returns actionable suggestions like "Replace X" or "Maintain Y".
 */

const OpenAI = require("openai");
const db = require("../db");
const InspectionAnalysisResult = require("../models/inspectionAnalysisResult");
const { getAiSummaryForProperty } = require("./ai/propertyReanalysisService");
const { normalizeSystemType } = require("./systemTypes");
const { isPropertyUid } = require("../helpers/properties");

const MODEL = process.env.AI_MAINTENANCE_ADVICE_MODEL || "gpt-4o-mini";

function matchesSystem(systemKey, rawType) {
  if (!systemKey || !rawType) return false;
  const key = String(systemKey).toLowerCase().replace(/-/g, "");
  const norm = normalizeSystemType(rawType);
  if (!norm) return false;
  const normLower = String(norm).toLowerCase();
  return key === normLower || key.includes(normLower) || normLower.includes(key);
}

/**
 * Get inspection findings for the specified system.
 */
function filterFindingsForSystem(analysis, systemType) {
  if (!analysis) return { needsAttention: [], maintenanceSuggestions: [] };
  const needs = (analysis.needs_attention || analysis.needsAttention || []).filter(
    (n) => matchesSystem(systemType, n.systemType || n.system_type)
  );
  const maint = (
    analysis.maintenance_suggestions || analysis.maintenanceSuggestions || []
  ).filter((m) => matchesSystem(systemType, m.systemType || m.system_type));
  return { needsAttention: needs, maintenanceSuggestions: maint };
}

/**
 * Get maintenance recommendations for the system from reanalysis.
 */
function filterReanalysisForSystem(aiSummary, systemType) {
  if (!aiSummary?.maintenanceRecommendations) return [];
  return (aiSummary.maintenanceRecommendations || []).filter((r) => {
    const name = r.systemName || r.systemType || r.system_key || "";
    return matchesSystem(systemType, name);
  });
}

/**
 * Build system context string from frontend-provided systemContext.
 * Returns { text, hasData } so callers can tell if real data was present.
 */
function buildSystemContextString(systemContext) {
  if (!systemContext || typeof systemContext !== "object")
    return { text: "No system details available.", hasData: false };
  const lines = [];
  for (const [key, val] of Object.entries(systemContext)) {
    if (val == null || val === "") continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    lines.push(`${label}: ${val}`);
  }
  return lines.length
    ? { text: lines.join("\n"), hasData: true }
    : { text: "No system details available.", hasData: false };
}

/**
 * Generate AI maintenance advice for a property/system.
 *
 * @param {Object} params
 * @param {string|number} params.propertyId - Property id (numeric or property_uid)
 * @param {string} params.systemType - e.g. "roof", "heating"
 * @param {string} params.systemName - Display name e.g. "Roof"
 * @param {Object} [params.systemContext] - Optional system-specific data from property (lastInspection, condition, issues, etc.)
 * @param {string} [params.scheduleType] - "inspection" | "maintenance" — tailors contractor questions for the email step
 * @returns {Promise<{ recommendedFrequency, riskWarning, suggestedQuestions, suggestions }>}
 */
async function getMaintenanceAdvice({
  propertyId,
  systemType,
  systemName,
  systemContext = {},
  scheduleType = null,
}) {
  // Resolve property id: 8 digits = property_uid, other digits = primary-key id
  let resolvedId;
  const rawStr = String(propertyId);
  if (isPropertyUid(rawStr)) {
    const propRes = await db.query(
      `SELECT id FROM properties WHERE property_uid = $1`,
      [rawStr]
    );
    if (propRes.rows.length === 0) {
      throw new Error("Property not found");
    }
    resolvedId = propRes.rows[0].id;
  } else if (/^\d+$/.test(rawStr)) {
    resolvedId = parseInt(rawStr, 10);
  } else {
    throw new Error("Property not found");
  }

  const [analysis, aiSummary] = await Promise.all([
    InspectionAnalysisResult.getByPropertyId(resolvedId),
    getAiSummaryForProperty(resolvedId),
  ]);

  const { needsAttention, maintenanceSuggestions } = filterFindingsForSystem(
    analysis,
    systemType
  );
  const reanalysisMaint = filterReanalysisForSystem(aiSummary, systemType);

  const { text: systemContextStr, hasData: hasSystemContext } =
    buildSystemContextString(systemContext);

  const hasInspectionData =
    needsAttention.length > 0 || maintenanceSuggestions.length > 0;
  const hasReanalysisData = reanalysisMaint.length > 0;

  if (!hasSystemContext && !hasInspectionData && !hasReanalysisData) {
    return getNoDataResponse(systemName, scheduleType);
  }

  const visitKind =
    scheduleType === "maintenance"
      ? "maintenance or repair visit"
      : scheduleType === "inspection"
        ? "inspection"
        : "scheduled service visit (inspection or maintenance)";

  const inspectionBlock = hasInspectionData
    ? `
INSPECTION REPORT FINDINGS (for ${systemName}):
${needsAttention.length > 0 ? `Needs attention:\n${JSON.stringify(needsAttention, null, 2)}` : ""}
${maintenanceSuggestions.length > 0 ? `Maintenance suggestions:\n${JSON.stringify(maintenanceSuggestions, null, 2)}` : ""}`
    : "";

  const reanalysisBlock = hasReanalysisData
    ? `
REANALYSIS MAINTENANCE RECOMMENDATIONS:
${JSON.stringify(reanalysisMaint, null, 2)}`
    : "";

  const prompt = `You are an expert home maintenance advisor. Analyze the following information about the "${systemName}" system for a property and provide practical advice.

The homeowner is emailing a contractor to schedule: ${visitKind}. Tailor "suggestedQuestions" to things they can paste into that email—concise, polite, and specific to the data below (findings, risks, system age, overdue items). Avoid generic filler.

PROPERTY/SYSTEM DATA ENTERED BY USER:
${systemContextStr}
${inspectionBlock}
${reanalysisBlock}

Provide a JSON response with exactly these keys:
- recommendedFrequency: A brief sentence on recommended inspection/maintenance frequency (e.g. "Annual inspection recommended", "Every 6 months for filter replacement")
- riskWarning: If there is something urgent (overdue maintenance, poor condition, critical finding), a 1-2 sentence warning. Otherwise null.
- suggestedQuestions: Array of 3-5 short questions or request lines the homeowner can add to their scheduling email to the contractor. Each should be a single sentence or question, grounded in the data above (e.g. "Can you assess whether the flashing noted in the report needs repair?"). Not generic marketing questions unless no specific findings exist.
- suggestions: Array of 2-6 actionable recommendations in second-person, imperative form. Be specific based on the data:
  - For items that need REPLACEMENT: "Replace [component]" with brief reason (e.g. "Replace roof shingles due to age (15+ years)")
  - For items that need MAINTENANCE: "Maintain [or have maintained] [task]" (e.g. "Have gutters cleaned annually", "Replace HVAC filters every 90 days")
  - Base suggestions on inspection findings, maintenance suggestions, condition, last service date, warranty, and age
  - IMPORTANT: Only provide suggestions that are grounded in the actual data above. Do NOT invent generic recommendations.
  - Use clear, concise language. No preamble or filler.

Output ONLY valid JSON, no markdown.`;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return getFallbackAdvice(systemName, systemContext);
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) return getFallbackAdvice(systemName, systemContext);

  try {
    const parsed = JSON.parse(content);
    return {
      recommendedFrequency:
        parsed.recommendedFrequency || "Annual inspection recommended",
      riskWarning: parsed.riskWarning || null,
      suggestedQuestions:
        Array.isArray(parsed.suggestedQuestions) && parsed.suggestedQuestions.length > 0
          ? parsed.suggestedQuestions
          : [
            "What is included in a standard maintenance visit?",
            "Do you offer a maintenance plan or service contract?",
            "Are there any signs of wear I should monitor between visits?",
          ],
      suggestions:
        Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
          ? parsed.suggestions
          : [],
    };
  } catch {
    return getFallbackAdvice(systemName, systemContext);
  }
}

function getNoDataResponse(systemName, scheduleType = null) {
  const visit =
    scheduleType === "maintenance"
      ? "maintenance visit"
      : scheduleType === "inspection"
        ? "inspection"
        : "visit";
  const sys = systemName || "this system";
  return {
    noData: true,
    recommendedFrequency: null,
    riskWarning: null,
    suggestedQuestions: [
      `What is typically included in your ${visit} for ${sys}?`,
      "What access or preparation do you need from me before you arrive?",
      "How long should I expect the appointment to take?",
      "Do you provide a written summary or photos after the visit?",
    ],
    suggestions: [],
  };
}

function getFallbackAdvice(systemName, systemContext) {
  const { hasData } = buildSystemContextString(systemContext);
  if (!hasData) return getNoDataResponse(systemName);

  const lastDate = systemContext?.lastInspection || systemContext?.lastMaintenance;
  const isOverdue =
    lastDate &&
    new Date(lastDate) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  return {
    recommendedFrequency: "Annual inspection recommended",
    riskWarning: isOverdue
      ? `Last maintenance was over a year ago. Consider scheduling soon to prevent potential issues.`
      : null,
    suggestedQuestions: [
      "What is included in a standard maintenance visit?",
      "Do you offer a maintenance plan or service contract?",
      "Are there any signs of wear I should monitor between visits?",
    ],
    suggestions: isOverdue
      ? ["Schedule an inspection or maintenance visit soon"]
      : [],
  };
}

module.exports = { getMaintenanceAdvice };
