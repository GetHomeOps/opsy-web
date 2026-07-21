export const PRE_PURCHASE_DISCLAIMER =
  "This Opsy Scout analysis is informational only. Findings, condition scores, and repair-cost ranges are estimates based on uploaded documents—not guaranteed facts, appraisals, or substitutes for a licensed home inspection, engineering review, or contractor quote.";

export const ANALYSIS_STAGES = [
  {key: "uploading", label: "Uploading"},
  {key: "extracting", label: "Extracting documents"},
  {key: "identifying_systems", label: "Identifying systems"},
  {key: "detecting_issues", label: "Detecting issues"},
  {key: "generating_recommendations", label: "Generating recommendations"},
  {key: "completed", label: "Completed"},
];

export const IN_PROGRESS_STATUSES = [
  "uploading",
  "extracting",
  "identifying_systems",
  "detecting_issues",
  "generating_recommendations",
];

export function isInProgress(status) {
  return IN_PROGRESS_STATUSES.includes(status);
}

export function isTerminal(status) {
  return status === "completed" || status === "failed";
}

export const CONDITION_BADGE = {
  excellent: "emerald",
  good: "emerald",
  fair: "amber",
  poor: "red",
  unknown: "neutral",
};

export const SEVERITY_BADGE = {
  major: "red",
  moderate: "amber",
  minor: "neutral",
};

/** Public-records (ATTOM/RentCast) field groups shared by the setup modal and profile card.
 * Aligned with properties Identity tab sections where lookup data is available. */
export const DETAIL_FIELD_GROUPS = [
  {
    label: "Identity & Address",
    fields: [
      {key: "taxId", label: "Tax / Parcel ID"},
      {key: "county", label: "County"},
    ],
  },
  {
    label: "Ownership",
    fields: [
      {key: "ownerName", label: "Owner Name"},
      {key: "ownerName2", label: "Owner Name 2"},
      {key: "ownerCity", label: "Owner City"},
    ],
  },
  {
    label: "General",
    fields: [
      {key: "propertyType", label: "Property Type"},
      {key: "subType", label: "Sub Type"},
      {key: "roofType", label: "Roof Type"},
      {key: "yearBuilt", label: "Year Built", type: "number"},
    ],
  },
  {
    label: "Size & Lot",
    fields: [
      {key: "sqFtTotal", label: "Total ft²", type: "number"},
      {key: "sqFtFinished", label: "Finished ft²", type: "number"},
      {key: "garageSqFt", label: "Garage ft²", type: "number"},
      {key: "totalDwellingSqFt", label: "Total Dwelling ft²", type: "number"},
      {key: "lotSize", label: "Lot Size"},
    ],
  },
  {
    label: "Rooms & Baths",
    fields: [
      {key: "bedCount", label: "Bedrooms", type: "number"},
      {key: "bathCount", label: "Bathrooms", type: "number"},
      {key: "fullBaths", label: "Full Baths", type: "number"},
      {key: "threeQuarterBaths", label: "3/4 Baths", type: "number"},
      {key: "halfBaths", label: "Half Baths", type: "number"},
      {key: "numberOfShowers", label: "Showers", type: "number"},
      {key: "numberOfBathtubs", label: "Bathtubs", type: "number"},
    ],
  },
  {
    label: "Features & Parking",
    fields: [
      {key: "fireplaces", label: "Fireplaces", type: "number"},
      {key: "fireplaceTypes", label: "Fireplace Type"},
      {key: "basement", label: "Basement"},
      {key: "parkingType", label: "Parking Type"},
      {key: "totalCoveredParking", label: "Covered Parking", type: "number"},
      {key: "totalUncoveredParking", label: "Uncovered Parking", type: "number"},
    ],
  },
  {
    label: "Schools",
    fields: [
      {key: "schoolDistrict", label: "School District"},
      {key: "elementarySchool", label: "Elementary"},
      {key: "juniorHighSchool", label: "Junior High"},
      {key: "seniorHighSchool", label: "Senior High"},
    ],
  },
];

/** @deprecated Prefer IdentityTab + properties IDENTITY_SECTIONS for profile display. */
export const IDENTITY_PROFILE_FIELD_GROUPS = DETAIL_FIELD_GROUPS.filter(
  (group) => group.label !== "Ownership"
);

export const TOTAL_DETAIL_FIELDS = DETAIL_FIELD_GROUPS.reduce(
  (acc, g) => acc + g.fields.length,
  0
);

export const STATUS_LABELS = {
  draft: "Draft",
  uploading: "Uploading",
  extracting: "Extracting",
  identifying_systems: "Identifying systems",
  detecting_issues: "Detecting issues",
  generating_recommendations: "Generating recommendations",
  completed: "Completed",
  failed: "Failed",
};

export function formatAddress(analysis) {
  if (!analysis) return "";
  const line1 = analysis.street || "";
  const line2 = [analysis.city, analysis.state, analysis.zip].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(", ");
}

export function formatDisplayName(analysis) {
  if (!analysis) return "Untitled analysis";
  return analysis.displayName || analysis.street || formatAddress(analysis) || "Untitled analysis";
}

export function formatCurrency(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export function formatCostRange(low, high) {
  if (low == null && high == null) return "—";
  if (low != null && high != null) return `${formatCurrency(low)} – ${formatCurrency(high)}`;
  return formatCurrency(low ?? high);
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function inferDocumentType(fileName) {
  const n = String(fileName || "").toLowerCase();
  if (n.includes("inspect")) return "inspection";
  if (n.includes("disclos")) return "disclosure";
  if (n.includes("estimate") || n.includes("quote") || n.includes("bid")) return "estimate";
  return "other";
}

export function inferMimeType(file) {
  if (file?.type) return file.type;
  const n = String(file?.name || "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return null;
}

export const URGENCY_LABELS = {
  immediate: "Immediate",
  near_term: "Near term",
  long_term: "Long term",
  monitor: "Monitor",
};

export const URGENCY_TIMING = {
  immediate: "Immediately",
  near_term: "Within 6 Months",
  long_term: "1–2 Years",
  monitor: "Ongoing",
};

export const URGENCY_BADGE = {
  immediate: "red",
  near_term: "amber",
  long_term: "brand",
  monitor: "neutral",
};

export const CONDITION_COLORS = {
  excellent: "#059669",
  good: "#10b981",
  fair: "#d97706",
  poor: "#dc2626",
  unknown: "#9ca3af",
};

export const SEVERITY_COLORS = {
  major: "#dc2626",
  moderate: "#d97706",
  minor: "#0284c7",
};

export function confidenceLabel(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  // Accept 0–1 fractions or 0–100 percentages
  const pct = n <= 1 ? n * 100 : n;
  if (pct >= 75) return "High";
  if (pct >= 45) return "Medium";
  return "Low";
}

export function formatConfidence(value) {
  const label = confidenceLabel(value);
  if (!label) return "—";
  return label;
}

/** Remaining life / next service from system.details (AI-extracted). */
export function formatRemainingLife(system) {
  const details = system?.details || {};
  const remaining =
    details.remainingLife ||
    details.remaining_life ||
    system?.remainingLife ||
    null;
  const nextService =
    details.nextService ||
    details.next_service ||
    system?.nextService ||
    null;
  if (remaining && nextService) {
    return {primary: remaining, secondary: nextService};
  }
  if (remaining) return {primary: remaining, secondary: null};
  if (nextService) return {primary: nextService, secondary: null};
  return {primary: "—", secondary: null};
}

export function countSystemsByCondition(systems = []) {
  const counts = {excellent: 0, good: 0, fair: 0, poor: 0, unknown: 0};
  for (const s of systems) {
    const key = counts[s.condition] != null ? s.condition : "unknown";
    counts[key] += 1;
  }
  return counts;
}

export function highPrioritySystems(systems = []) {
  return systems.filter(
    (s) => s.urgency === "immediate" || s.condition === "poor"
  );
}

/**
 * Shared rail selection for Overview / Systems / Recommendations.
 * Priority-system matches first (API score order preserved), then fill from the rest.
 */
export function selectRailProfessionals(matches = [], systems = [], limit = 4) {
  const list = Array.isArray(matches) ? matches : [];
  if (!list.length || limit <= 0) return [];

  const priorityKeys = new Set(
    highPrioritySystems(systems)
      .map((s) => s.systemKey)
      .filter(Boolean)
  );

  if (!priorityKeys.size) {
    return list.slice(0, limit);
  }

  const priority = [];
  const rest = [];
  for (const m of list) {
    if (m?.systemKey && priorityKeys.has(m.systemKey)) {
      priority.push(m);
    } else {
      rest.push(m);
    }
  }

  if (!priority.length) {
    return list.slice(0, limit);
  }

  return [...priority, ...rest].slice(0, limit);
}

export function negotiationImplication(finding) {
  const severity = finding?.severity;
  const high = Number(finding?.estimatedCostHigh) || 0;
  const system = finding?.systemLabel || "this system";
  if (severity === "major" || high >= 5000) {
    return `Strong negotiation leverage — ${system} issues of this scale often support a price adjustment, repair credit, or seller-funded remediation before closing.`;
  }
  if (severity === "moderate" || high >= 1500) {
    return `Moderate negotiation point — document ${system} repairs and request estimates; a modest credit or pre-closing fix is reasonable to discuss.`;
  }
  return `Limited negotiation weight — treat as a disclosure item and plan routine follow-up rather than a major deal contingency.`;
}

export function professionalDisplayName(m) {
  return (
    m?.companyName ||
    m?.contactName ||
    [m?.firstName, m?.lastName].filter(Boolean).join(" ") ||
    "Professional"
  );
}

export function professionalLocation(m) {
  return (
    m?.serviceArea || [m?.city, m?.state].filter(Boolean).join(", ") || null
  );
}

/** Midpoint cost for budget charts when only a range exists. */
export function findingMidCost(f) {
  const lo = f?.estimatedCostLow != null ? Number(f.estimatedCostLow) : null;
  const hi = f?.estimatedCostHigh != null ? Number(f.estimatedCostHigh) : null;
  if (lo != null && hi != null) return (lo + hi) / 2;
  return lo ?? hi ?? 0;
}

export function sumFindingCostsByUrgency(findings = []) {
  const buckets = {immediate: 0, near_term: 0, long_term: 0, monitor: 0};
  for (const f of findings) {
    const key = buckets[f.urgency] != null ? f.urgency : "near_term";
    buckets[key] += findingMidCost(f);
  }
  return buckets;
}
