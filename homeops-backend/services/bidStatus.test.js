"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  deriveBidStatus,
  assertDocumentCanLinkToItem,
  parseMoney,
  formatMoney,
  priceStats,
  BID_STATUSES,
} = require("./bidStatus");

describe("deriveBidStatus", () => {
  it("is no_bids when nothing is linked", () => {
    assert.equal(deriveBidStatus({ bidCount: 0 }), BID_STATUSES.NO_BIDS);
  });

  it("is collecting for a single bid", () => {
    assert.equal(deriveBidStatus({ bidCount: 1 }), BID_STATUSES.COLLECTING);
  });

  it("is reviewing for two or more bids", () => {
    assert.equal(deriveBidStatus({ bidCount: 2 }), BID_STATUSES.REVIEWING);
    assert.equal(deriveBidStatus({ bidCount: 3 }), BID_STATUSES.REVIEWING);
  });

  it("keeps awaiting_clarification until a bid is selected", () => {
    assert.equal(
      deriveBidStatus({
        bidCount: 2,
        currentStatus: BID_STATUSES.AWAITING_CLARIFICATION,
      }),
      BID_STATUSES.AWAITING_CLARIFICATION,
    );
  });

  it("is bid_selected when a bid is chosen", () => {
    assert.equal(
      deriveBidStatus({ bidCount: 2, selectedBidId: 9 }),
      BID_STATUSES.BID_SELECTED,
    );
  });

  it("is completed when the action item is completed", () => {
    assert.equal(
      deriveBidStatus({ bidCount: 2, selectedBidId: 9, actionItemStatus: "completed" }),
      BID_STATUSES.COMPLETED,
    );
  });
});

describe("assertDocumentCanLinkToItem", () => {
  it("accepts the same property and system", () => {
    assert.equal(
      assertDocumentCanLinkToItem(
        { property_id: 1, system_key: "Flooring" },
        { property_id: 1, system_key: "flooring" },
      ),
      true,
    );
  });

  it("rejects a different property", () => {
    assert.throws(
      () =>
        assertDocumentCanLinkToItem(
          { property_id: 1, system_key: "roof" },
          { property_id: 2, system_key: "roof" },
        ),
      /same property/,
    );
  });

  it("rejects a different system", () => {
    assert.throws(
      () =>
        assertDocumentCanLinkToItem(
          { property_id: 1, system_key: "roof" },
          { property_id: 1, system_key: "hvac" },
        ),
      /same system/,
    );
  });
});

describe("parseMoney and priceStats", () => {
  it("parses currency strings", () => {
    assert.equal(parseMoney("$15,871"), 15871);
    assert.equal(parseMoney("17800.50"), 17800.5);
    assert.equal(parseMoney(""), null);
  });

  it("computes min / avg / max / spread", () => {
    const stats = priceStats(["$100", "$200", 300]);
    assert.equal(stats.min, 100);
    assert.equal(stats.max, 300);
    assert.equal(stats.avg, 200);
    assert.equal(stats.spread, 200);
    assert.equal(formatMoney(15871), "$15,871");
  });
});
