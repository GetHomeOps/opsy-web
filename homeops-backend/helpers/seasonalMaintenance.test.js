"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolveClimateRegion } = require("../constants/usClimateRegions");
const {
  getSeasonFromMonth,
  buildSeasonalMaintenanceEventFields,
} = require("./seasonalMaintenance");

describe("seasonalMaintenance", () => {
  it("maps state codes to broad climate regions", () => {
    assert.equal(resolveClimateRegion("WA"), "Pacific Northwest");
    assert.equal(resolveClimateRegion("or"), "Pacific Northwest");
    assert.equal(resolveClimateRegion("CA"), "California");
    assert.equal(resolveClimateRegion(""), "National");
    assert.equal(resolveClimateRegion("ZZ"), "National");
  });

  it("resolves seasons from month", () => {
    assert.equal(getSeasonFromMonth(1), "winter");
    assert.equal(getSeasonFromMonth(12), "winter");
    assert.equal(getSeasonFromMonth(4), "spring");
    assert.equal(getSeasonFromMonth(7), "summer");
    assert.equal(getSeasonFromMonth(10), "fall");
  });

  it("builds all seasonal tip fields for a region", () => {
    const fields = buildSeasonalMaintenanceEventFields({ state: "WA" });
    assert.equal(fields.region, "Pacific Northwest");
    assert.ok(fields.maintenance_tip);
    assert.ok(fields.maintenance_tip_winter.includes("ice dams"));
    assert.ok(fields.maintenance_tip_spring.includes("moss"));
    assert.ok(fields.maintenance_tip_summer);
    assert.ok(fields.maintenance_tip_fall.includes("gutters"));
  });

  it("honors an explicit region override", () => {
    const fields = buildSeasonalMaintenanceEventFields({
      state: "TX",
      region: "Pacific Northwest",
    });
    assert.equal(fields.region, "Pacific Northwest");
    assert.ok(fields.maintenance_tip_winter.includes("ice dams"));
  });
});
