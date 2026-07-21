import {
  PRE_PURCHASE_DISCLAIMER,
  formatAddress,
  formatCostRange,
  formatDisplayName,
} from "./prePurchaseUtils";

const SCORE_BLURBS = {
  excellent: "The home appears well maintained with few notable deficiencies.",
  good: "The home is in solid shape with mostly routine maintenance items.",
  fair: "The home shows typical wear for its age with several items needing attention.",
  poor: "The home has significant deferred maintenance that warrants careful review.",
  unknown: "Condition scoring was limited by available document detail.",
};

function formatAnalysisDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function concernTitle(c) {
  if (typeof c === "string") return c;
  return c?.title || String(c ?? "");
}

function concernSeverity(c) {
  return typeof c === "object" && c ? c.severity || null : null;
}

function positiveTitle(p) {
  if (typeof p === "string") return p;
  return p?.title || String(p ?? "");
}

function recommendationTitle(r) {
  if (typeof r === "string") return r;
  return r?.title || String(r ?? "");
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

/**
 * Normalize homeowner-facing takeaways shared by Presentation mode and PDF export.
 */
export function buildScoutTakeaways(analysis) {
  if (!analysis) return null;

  const counts = analysis.issueCounts || {major: 0, moderate: 0, minor: 0};
  const major = counts.major || 0;
  const moderate = counts.moderate || 0;
  const minor = counts.minor || 0;
  const rating = analysis.overallConditionRating || "unknown";
  const name = formatDisplayName(analysis);
  const address = formatAddress(analysis);
  const analysisDate = formatAnalysisDate(
    analysis.analyzedAt || analysis.updatedAt || analysis.createdAt
  );

  const concerns = (analysis.topConcerns || [])
    .slice(0, 5)
    .map((c) => ({
      title: concernTitle(c),
      severity: concernSeverity(c),
    }))
    .filter((c) => c.title);

  const positives = (analysis.positiveFindings || [])
    .slice(0, 5)
    .map(positiveTitle)
    .filter(Boolean);

  const recommendations = (analysis.recommendations || [])
    .slice(0, 5)
    .map(recommendationTitle)
    .filter(Boolean);

  return {
    name,
    address,
    analysisDate,
    rating,
    ratingLabel: rating.charAt(0).toUpperCase() + rating.slice(1),
    score: analysis.overallConditionScore ?? null,
    scoreBlurb: SCORE_BLURBS[rating] || SCORE_BLURBS.unknown,
    executiveSummary: analysis.executiveSummary || "No summary available yet.",
    issueCounts: {major, moderate, minor},
    totalIssues: major + moderate + minor,
    repairRange: formatCostRange(
      analysis.repairCostLow,
      analysis.repairCostHigh
    ),
    repairConfidence: analysis.repairConfidence || null,
    concerns,
    positives,
    recommendations,
    disclaimer: PRE_PURCHASE_DISCLAIMER,
    fileSlug: slugify(name) || String(analysis.id || "report"),
  };
}
