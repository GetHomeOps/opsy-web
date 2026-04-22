/**
 * Best-effort guesses for system_key + document_type from a filename.
 *
 * Pure, side-effect free. Patterns are intentionally permissive (substring
 * match against a normalized filename). When in doubt we return null and
 * leave the field empty so the user can choose.
 */

const SYSTEM_KEYWORDS = [
  // [system_key, [keywords...]]
  ["inspectionReport", ["inspection report", "inspectionreport", "home inspection", "buyer inspection"]],
  ["roof", ["roof", "shingle", "shingles"]],
  ["gutters", ["gutter", "downspout"]],
  ["foundation", ["foundation", "footing", "slab"]],
  ["exterior", ["siding", "exterior", "stucco", "facade"]],
  ["windows", ["window", "door", "weatherstrip"]],
  ["heating", ["furnace", "boiler", "heater", "heating"]],
  ["ac", ["ac ", "a/c", "air-conditioning", "air conditioning", "hvac", "mini-split", "minisplit"]],
  ["waterHeating", ["water heater", "waterheater", "water-heating", "tankless"]],
  ["electrical", ["electrical", "electric ", "panel", "breaker", "wiring"]],
  ["plumbing", ["plumb", "pipe", "drain", "sewer"]],
  ["safety", ["smoke detector", "smoke-detector", "co alarm", "fire safety", "alarm"]],
];

const TYPE_KEYWORDS = [
  ["inspection", ["inspection"]],
  ["warranty", ["warranty", "guarantee"]],
  ["receipt", ["receipt", "invoice", "paid"]],
  ["permit", ["permit"]],
  ["manual", ["manual", "guide", "instructions"]],
  ["insurance", ["insurance", "policy"]],
  ["mortgage", ["mortgage", "deed", "title"]],
  ["contract", ["contract", "agreement", "estimate", "quote"]],
];

function normalize(name) {
  if (!name) return "";
  return String(name)
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** YYYY-MM-DD or MM-DD-YYYY or YYYY only (returns ISO date string or null). */
function guessDate(name) {
  if (!name) return null;
  const s = String(name);
  const iso = s.match(/(\d{4})[-_/.](\d{2})[-_/.](\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m}-${d}`;
  }
  const us = s.match(/(\d{2})[-_/.](\d{2})[-_/.](\d{4})/);
  if (us) {
    const [, m, d, y] = us;
    return `${y}-${m}-${d}`;
  }
  const yearOnly = s.match(/(?:^|[^\d])(20\d{2}|19\d{2})(?:[^\d]|$)/);
  if (yearOnly) {
    return `${yearOnly[1]}-01-01`;
  }
  return null;
}

function stripExtension(name) {
  if (!name) return "";
  return String(name).replace(/\.[a-z0-9]+$/i, "");
}

/** Title-case helper for proposed document name. */
function prettyName(name) {
  const base = stripExtension(name).replace(/[._-]+/g, " ").trim();
  if (!base) return "";
  return base
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Run all heuristics over a filename.
 *
 * @param {string} filename
 * @param {Object} [options]
 * @param {Set<string>} [options.allowedSystemKeys] - if provided, only return system_key from this set.
 * @returns {{ system_key: string|null, document_type: string|null, document_name: string, document_date: string|null }}
 */
export function guessFromFilename(filename, options = {}) {
  const norm = normalize(filename);
  const allowed = options.allowedSystemKeys;

  let systemKey = null;
  for (const [key, words] of SYSTEM_KEYWORDS) {
    if (allowed && !allowed.has(key)) continue;
    if (words.some((w) => norm.includes(w))) {
      systemKey = key;
      break;
    }
  }

  let docType = null;
  for (const [key, words] of TYPE_KEYWORDS) {
    if (words.some((w) => norm.includes(w))) {
      docType = key;
      break;
    }
  }

  if (!docType && systemKey === "inspectionReport") {
    docType = "inspection";
  }

  return {
    system_key: systemKey,
    document_type: docType,
    document_name: prettyName(filename),
    document_date: guessDate(filename),
  };
}
