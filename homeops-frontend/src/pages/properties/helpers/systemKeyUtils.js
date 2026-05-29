/** Maximum length for system_key (e.g. database column limit). */
export const MAX_SYSTEM_KEY_LENGTH = 50;

/**
 * Parse display name from a persisted custom system_key (custom-solar-panels → Solar Panels).
 */
export function parseCustomSystemName(systemKey) {
  if (!systemKey?.startsWith("custom-")) return null;
  const slug = systemKey.replace(/^custom-/, "");
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Resolve a custom system's display name to its persisted backend system_key.
 * Reuses an existing key when the property already has a matching custom system.
 */
export function resolveCustomSystemBackendKey(displayName, existingSystems = []) {
  const normalized = (displayName || "").trim().toLowerCase();
  if (!normalized) return slugifyCustomSystemName(displayName);

  for (const sys of existingSystems ?? []) {
    const key = (sys.system_key ?? sys.systemKey ?? "").toString();
    if (!key.startsWith("custom-")) continue;
    const parsed = parseCustomSystemName(key);
    if (parsed && parsed.toLowerCase() === normalized) return key;
  }

  return slugifyCustomSystemName(displayName);
}

/**
 * Build UI folder/section entries for custom systems using persisted system_key ids.
 */
export function buildCustomSystemsForUi(customSystemNames = [], existingSystems = []) {
  return (customSystemNames ?? []).map((name, index) => ({
    id: resolveCustomSystemBackendKey(name, existingSystems),
    label: name,
    index,
  }));
}

/**
 * Resolve a UI section/folder id to the backend system_key used for documents.
 * Handles legacy ids like custom-Flooring-0 as well as persisted keys like custom-flooring.
 */
export function resolveUploadSystemKey(
  systemType,
  existingSystems = [],
  customSystemNames = [],
) {
  if (!systemType || !String(systemType).startsWith("custom-")) {
    return systemType;
  }

  const type = String(systemType);

  const exact = (existingSystems ?? []).find(
    (s) => (s.system_key ?? s.systemKey) === type,
  );
  if (exact) return type;

  const uiMatch = type.match(/^custom-(.+)-(\d+)$/);
  if (uiMatch) {
    const [, namePart] = uiMatch;
    const matchedName =
      (customSystemNames ?? []).find(
        (n) => n === namePart || n.toLowerCase() === namePart.toLowerCase(),
      ) ?? namePart.replace(/-/g, " ");
    return resolveCustomSystemBackendKey(matchedName, existingSystems);
  }

  const setupMatch = (customSystemNames ?? []).find((n) => `custom-${n}` === type);
  if (setupMatch) {
    return resolveCustomSystemBackendKey(setupMatch, existingSystems);
  }

  const parsed = parseCustomSystemName(type);
  if (parsed) return resolveCustomSystemBackendKey(parsed, existingSystems);

  return resolveCustomSystemBackendKey(type.replace(/^custom-/, ""), existingSystems);
}

/**
 * Returns display names with counters for duplicates (e.g. "Pool", "Pool 2", "Pool 3").
 * Strips trailing " N" or " NNNNN" to get base name before counting.
 *
 * @param {string[]} names - Array of custom system names (may include duplicates or backend suffixes)
 * @returns {string[]} Display names with counters for duplicates
 */
export function getDisplayNamesWithCounters(names) {
  if (!Array.isArray(names)) return [];
  const baseCounts = {};
  return names.map((name) => {
    const base = (name || "").replace(/\s+\d+$/, "") || name || "Unknown";
    baseCounts[base] = (baseCounts[base] || 0) + 1;
    const count = baseCounts[base];
    return count === 1 ? base : `${base} ${count}`;
  });
}

/**
 * Create a URL-safe slug from a custom system name.
 * Result is truncated to MAX_SYSTEM_KEY_LENGTH.
 */
export function slugifyCustomSystemName(name) {
  if (!name || typeof name !== "string") return "custom-unknown";
  const slug =
    "custom-" +
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  return slug.slice(0, MAX_SYSTEM_KEY_LENGTH);
}

/**
 * Ensures system_key is within max length and unique among used keys.
 * If key is already used, appends a random number (e.g. -3847).
 *
 * @param {string} key - The system key (predefined id or custom slug)
 * @param {Set<string>} usedKeys - Set of keys already used in this batch
 * @returns {string} Key guaranteed to be under MAX_SYSTEM_KEY_LENGTH and unique
 */
export function ensureUniqueSystemKey(key, usedKeys = new Set()) {
  if (!key || typeof key !== "string") return "unknown";
  let result = key.slice(0, MAX_SYSTEM_KEY_LENGTH);
  const suffixReserved = 6; // "-" + 5 digit random

  while (usedKeys.has(result)) {
    const rand = Math.floor(10000 + Math.random() * 90000); // 5-digit random
    const base = result
      .slice(0, MAX_SYSTEM_KEY_LENGTH - suffixReserved)
      .replace(/-+$/, "");
    result = (base || "custom-dup").slice(0, MAX_SYSTEM_KEY_LENGTH - suffixReserved) + "-" + rand;
    result = result.slice(0, MAX_SYSTEM_KEY_LENGTH);
  }
  usedKeys.add(result);
  return result;
}
