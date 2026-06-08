"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildFlatPropertyData,
  findPropertyDataGaps,
  gapsToEmailMerge,
} = require("./propertyInvitationDataGaps");

describe("propertyInvitationDataGaps", () => {
  it("finds document and incomplete system gaps", () => {
    const propertyData = buildFlatPropertyData(
      {
        address: "123 Elm Street, Portland, OR",
        address_line_1: "123 Elm Street",
        city: "Portland",
        state: "OR",
        zip: "97201",
        property_name: "Elm Home",
        year_built: 1990,
      },
      [
        {
          system_key: "roof",
          included: true,
          data: { material: "Asphalt" },
        },
      ]
    );

    const gaps = findPropertyDataGaps(propertyData, {
      documentCount: 0,
      maintenanceRecordCount: 0,
    });

    assert.ok(gaps.some((g) => g.title === "Documents"));
    assert.ok(gaps.some((g) => g.title === "Roof"));
    assert.ok(gaps.some((g) => g.title === "Maintenance history"));
  });

  it("maps gaps to Customer.io merge fields", () => {
    const merge = gapsToEmailMerge(
      [
        { title: "Documents", body: "No docs yet." },
        { title: "Heating", body: "2 of 8 details filled." },
      ],
      { address_line_1: "456 Oak Ave" }
    );

    assert.equal(merge.propertyStreet, "456 Oak Ave");
    assert.equal(merge.missingDataCount, 2);
    assert.equal(merge.missingDataItem1Title, "Documents");
    assert.equal(merge.missingDataItem2Title, "Heating");
    assert.match(merge.missingDataHtml, /Documents/);
  });
});
