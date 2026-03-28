const nameCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

/**
 * Parents A→Z, then each parent's children A→Z (same order as the categories table).
 */
export function sortCategoryHierarchy(hierarchy) {
  if (!hierarchy?.length) return [];
  const parents = [...hierarchy].sort((a, b) =>
    nameCollator.compare(a.name || "", b.name || ""),
  );
  return parents.map((p) => ({
    ...p,
    children: [...(p.children || [])].sort((a, b) =>
      nameCollator.compare(a.name || "", b.name || ""),
    ),
  }));
}

/**
 * Flat id list: each parent row then its subcategories (depth-first, alphabetical).
 */
export function flatNavigationIdsFromHierarchy(hierarchy) {
  const ids = [];
  for (const p of sortCategoryHierarchy(hierarchy)) {
    ids.push(String(p.id));
    for (const c of p.children || []) {
      ids.push(String(c.id));
    }
  }
  return ids;
}
