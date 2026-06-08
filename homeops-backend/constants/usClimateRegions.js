"use strict";

/**
 * Maps US state/territory codes to broad climate regions for email copy
 * (seasonal maintenance tips, regional messaging).
 */
const STATE_TO_REGION = {
  AK: "Alaska",
  AL: "Southeast",
  AR: "South Central",
  AZ: "Southwest",
  CA: "California",
  CO: "Mountain West",
  CT: "Northeast",
  DC: "Mid-Atlantic",
  DE: "Mid-Atlantic",
  FL: "Southeast",
  GA: "Southeast",
  HI: "Hawaii",
  IA: "Midwest",
  ID: "Pacific Northwest",
  IL: "Midwest",
  IN: "Midwest",
  KS: "Midwest",
  KY: "Southeast",
  LA: "South Central",
  MA: "Northeast",
  MD: "Mid-Atlantic",
  ME: "Northeast",
  MI: "Midwest",
  MN: "Midwest",
  MO: "Midwest",
  MS: "Southeast",
  MT: "Mountain West",
  NC: "Southeast",
  ND: "Midwest",
  NE: "Midwest",
  NH: "Northeast",
  NJ: "Northeast",
  NM: "Southwest",
  NV: "Southwest",
  NY: "Northeast",
  OH: "Midwest",
  OK: "South Central",
  OR: "Pacific Northwest",
  PA: "Northeast",
  RI: "Northeast",
  SC: "Southeast",
  SD: "Midwest",
  TN: "Southeast",
  TX: "South Central",
  UT: "Mountain West",
  VA: "Mid-Atlantic",
  VT: "Northeast",
  WA: "Pacific Northwest",
  WI: "Midwest",
  WV: "Mid-Atlantic",
  WY: "Mountain West",
};

const DEFAULT_REGION = "National";

function normalizeStateCode(state) {
  const raw = String(state || "").trim();
  if (!raw) return "";
  if (raw.length === 2) return raw.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
}

/** Resolve a property state code to a broad climate region label. */
function resolveClimateRegion(state) {
  const code = normalizeStateCode(state);
  if (!code) return DEFAULT_REGION;
  return STATE_TO_REGION[code] || DEFAULT_REGION;
}

module.exports = {
  STATE_TO_REGION,
  DEFAULT_REGION,
  normalizeStateCode,
  resolveClimateRegion,
};
