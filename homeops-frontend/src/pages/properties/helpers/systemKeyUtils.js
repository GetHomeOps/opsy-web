/** Maximum length for system_key (e.g. database column limit). */
export const MAX_SYSTEM_KEY_LENGTH = 50;

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
