"use strict";

const { resolveClimateRegion } = require("../constants/usClimateRegions");
const { SEASONS, getTipsForRegion } = require("../data/seasonalMaintenanceTips");

/**
 * Northern-hemisphere seasons from calendar month (1–12).
 * Used for immediate tips at event time; delayed Customer.io emails should
 * pick from maintenance_tip_* fields using send-time month (see docs).
 */
function getSeasonFromMonth(month) {
  const m = Number(month);
  if (!Number.isFinite(m) || m < 1 || m > 12) return "fall";
  if (m === 12 || m <= 2) return "winter";
  if (m <= 5) return "spring";
  if (m <= 8) return "summer";
  return "fall";
}

function getCurrentSeason(date = new Date()) {
  return getSeasonFromMonth(date.getMonth() + 1);
}

/**
 * Build Customer.io event fields for region + seasonal maintenance tips.
 * Includes all four seasons so journey emails sent later can select the tip
 * active at send time via Liquid (event data persists on the trigger).
 */
function buildSeasonalMaintenanceEventFields({ state = "", region = "" } = {}) {
  const resolvedRegion =
    String(region || "").trim() || resolveClimateRegion(state);
  const tips = getTipsForRegion(resolvedRegion);
  const season = getCurrentSeason();

  const fields = {
    region: resolvedRegion,
    season,
    maintenance_tip: tips[season] || tips.fall,
  };

  for (const s of SEASONS) {
    fields[`maintenance_tip_${s}`] = tips[s] || "";
  }

  return fields;
}

module.exports = {
  getSeasonFromMonth,
  getCurrentSeason,
  buildSeasonalMaintenanceEventFields,
};
