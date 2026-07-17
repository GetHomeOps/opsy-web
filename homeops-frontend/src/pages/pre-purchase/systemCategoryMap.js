/**
 * Mirrors backend SYSTEM_CATEGORY_KEYWORDS in prePurchaseAnalysisService.js
 * so the UI can deep-link to directory search filtered by need.
 */
export const SYSTEM_CATEGORY_KEYWORDS = {
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

/** Flatten hierarchy into a single list of {id, name} (parents + children). */
export function flattenCategoryHierarchy(hierarchy = []) {
  const rows = [];
  for (const parent of hierarchy) {
    if (parent?.id != null) {
      rows.push({id: parent.id, name: parent.name || ""});
    }
    const children = parent?.children || parent?.subcategories || [];
    for (const child of children) {
      if (child?.id != null) {
        rows.push({id: child.id, name: child.name || ""});
      }
    }
  }
  return rows;
}

export function findCategoryIdForSystem(systemKey, categories = []) {
  const keywords =
    SYSTEM_CATEGORY_KEYWORDS[systemKey] || SYSTEM_CATEGORY_KEYWORDS.other;
  const lower = categories.map((c) => ({
    ...c,
    _n: String(c.name || "").toLowerCase(),
  }));
  for (const kw of keywords) {
    const hit = lower.find((c) => c._n.includes(kw));
    if (hit) return hit.id;
  }
  return null;
}

/**
 * Build directory search path for a system need.
 * @returns {string} path+query e.g. /acct/professionals/search?category=3&city=Austin&state=TX
 */
export function buildProfessionalsSearchPath({
  accountUrl,
  systemKey,
  categories = [],
  city,
  state,
}) {
  const base = accountUrl
    ? `/${accountUrl}/professionals/search`
    : "/professionals/search";
  const params = new URLSearchParams();
  const categoryId = findCategoryIdForSystem(systemKey, categories);
  if (categoryId) params.set("category", String(categoryId));
  if (city) params.set("city", city);
  if (state) params.set("state", state);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
