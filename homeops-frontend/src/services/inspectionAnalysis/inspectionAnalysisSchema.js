/**
 * Inspection Analysis Schema
 * Validates and normalizes API responses to a canonical display format.
 * Accepts both current backend shape and the strict JSON schema.
 */

const PROPERTY_STATES = ["excellent", "good", "fair", "poor", "unknown"];
const PRIORITIES = ["high", "medium", "low", "urgent"];
const SEVERITIES = ["critical", "high", "medium", "low"];

function clamp(n, min, max) {
  if (typeof n !== "number" || Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function normalizePropertyState(raw) {
  if (!raw || typeof raw !== "string") return "unknown";
  const lower = raw.toLowerCase().trim();
  return PROPERTY_STATES.includes(lower) ? lower : "unknown";
}

function normalizePriority(raw) {
  if (!raw || typeof raw !== "string") return "medium";
  const lower = raw.toLowerCase().trim();
  return PRIORITIES.includes(lower) ? lower : "medium";
}

function normalizeSeverity(raw) {
  if (!raw || typeof raw !== "string") return "medium";
  const lower = raw.toLowerCase().trim();
  return SEVERITIES.includes(lower) ? lower : "medium";
}

/**
 * Normalize systems_detected / systemsDetected from backend.
 * Backend: { systemType, confidence, evidence }
 * Canonical: { name, condition, confidence, evidence_quotes[], page_refs[] }
 * Deduplicates by systemType so repeated systems (e.g. waterHeater twice) appear only once.
 */
function normalizeSystemsDetected(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .map((s) => {
      const name = s.name ?? s.systemType ?? s.system_key ?? "—";
      const condition = s.condition ?? "unknown";
      const hasCondition = condition !== "unknown";
      const confidence = hasCondition && s.confidence != null ? clamp(s.confidence, 0, 1) : null;
      const evidence_quotes = Array.isArray(s.evidence_quotes)
        ? s.evidence_quotes
        : s.evidence
          ? [String(s.evidence)]
          : [];
      const page_refs = Array.isArray(s.page_refs) ? s.page_refs : [];
      return {
        name,
        condition,
        confidence,
        evidence_quotes,
        page_refs,
        systemType: s.systemType ?? s.system_key,
      };
    })
    .filter((s) => {
      const key = (s.systemType ?? s.name ?? "").toString().toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Normalize systems_missing_suspected / suggestedSystemsToAdd.
 * Deduplicates by systemType so repeated systems appear only once.
 */
function normalizeSystemsMissingSuspected(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw
    .map((s) => ({
      name: s.name ?? s.systemType ?? s.system_key ?? "—",
      systemType: s.systemType ?? s.system_key,
      reason: s.reason ?? "",
      confidence: clamp(s.confidence ?? 0.5, 0, 1),
    }))
    .filter((s) => {
      const key = (s.systemType ?? s.name ?? "").toString().toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Normalize recommended_actions from maintenanceSuggestions + needsAttention.
 */
function normalizeRecommendedActions(maintenanceSuggestions, needsAttention) {
  const actions = [];
  (maintenanceSuggestions ?? []).forEach((m) => {
    actions.push({
      title: m.task ?? m.title ?? m.systemType ?? "Maintenance",
      priority: normalizePriority(m.priority),
      category: m.systemType ?? "general",
      rationale: m.rationale ?? m.reason ?? "",
      suggested_schedule_window: m.suggestedWhen ?? "",
    });
  });
  (needsAttention ?? []).forEach((n) => {
    actions.push({
      title: n.title ?? "Item needs attention",
      priority: normalizePriority(n.priority),
      category: n.systemType ?? "general",
      rationale: n.suggestedAction ?? n.evidence ?? "",
      suggested_schedule_window: "",
    });
  });
  return actions;
}

/**
 * Normalize risks from needsAttention.
 */
function normalizeRisks(needsAttention) {
  if (!Array.isArray(needsAttention)) return [];
  return needsAttention.map((n) => ({
    title: n.title ?? "Risk",
    severity: normalizeSeverity(n.severity),
    rationale: n.suggestedAction ?? n.evidence ?? "",
    evidence_quotes: n.evidence ? [n.evidence] : [],
    page_refs: n.page_refs ?? [],
  }));
}

/**
 * Normalize citations.
 */
function normalizeCitations(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => ({
    page: c.page ?? null,
    quote: c.quote ?? c.excerpt ?? "",
    section: c.section ?? null,
  }));
}

/**
 * Parse and normalize API response to canonical schema.
 * @param {object} raw - Raw API response (backend or strict schema)
 * @returns {object} Validated, normalized analysis data
 */
export function parseInspectionAnalysis(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid analysis: expected object");
  }

  const conditionRating = raw.conditionRating ?? raw.condition_rating ?? raw.property_state ?? "unknown";
  const property_state = normalizePropertyState(conditionRating);
  const conditionConfidence = property_state === "unknown"
    ? null
    : (raw.conditionConfidence ?? raw.condition_confidence ?? raw.confidence ?? 0.5);
  const confidence = conditionConfidence != null ? clamp(conditionConfidence, 0, 1) : null;

  const summary = typeof raw.summary === "string"
    ? raw.summary.slice(0, 600)
    : "";

  const systems_detected = raw.systems_detected
    ? normalizeSystemsDetected(raw.systems_detected)
    : normalizeSystemsDetected(raw.systemsDetected ?? []);

  const systems_missing_suspected = raw.systems_missing_suspected
    ? normalizeSystemsMissingSuspected(raw.systems_missing_suspected)
    : normalizeSystemsMissingSuspected(raw.suggestedSystemsToAdd ?? []);

  const recommended_actions = raw.recommended_actions
    ? (raw.recommended_actions ?? []).map((a) => ({
        title: a.title ?? "",
        priority: normalizePriority(a.priority),
        category: a.category ?? "general",
        rationale: a.rationale ?? "",
        suggested_schedule_window: a.suggested_schedule_window ?? "",
      }))
    : normalizeRecommendedActions(
        raw.maintenanceSuggestions ?? raw.maintenance_suggestions,
        raw.needsAttention ?? raw.needs_attention,
      );

  const risks = raw.risks
    ? (raw.risks ?? []).map((r) => ({
        title: r.title ?? "",
        severity: normalizeSeverity(r.severity),
        rationale: r.rationale ?? "",
        evidence_quotes: r.evidence_quotes ?? [],
        page_refs: r.page_refs ?? [],
      }))
    : normalizeRisks(raw.needsAttention ?? raw.needs_attention ?? []);

  const citations = normalizeCitations(raw.citations ?? []);

  const meta = {
    model: raw.meta?.model ?? null,
    created_at: raw.meta?.created_at ?? raw.createdAt ?? raw.created_at ?? null,
    doc_id: raw.meta?.doc_id ?? null,
    doc_sha256: raw.meta?.doc_sha256 ?? null,
  };

  return {
    summary,
    property_state,
    confidence,
    systems_detected,
    systems_missing_suspected,
    recommended_actions,
    risks,
    citations,
    meta,
    // Legacy fields for backward compatibility
    conditionRating: property_state,
    conditionConfidence: confidence,
    conditionRationale: raw.conditionRationale ?? raw.condition_rationale ?? null,
    systemsDetected: systems_detected,
    needsAttention: raw.needsAttention ?? raw.needs_attention ?? [],
    suggestedSystemsToAdd: raw.suggestedSystemsToAdd ?? raw.suggested_systems_to_add ?? [],
    maintenanceSuggestions: raw.maintenanceSuggestions ?? raw.maintenance_suggestions ?? [],
    createdAt: meta.created_at,
  };
}
