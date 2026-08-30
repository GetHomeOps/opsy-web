"use strict";

const { BadRequestError } = require("../expressError");

const BID_STATUSES = {
  NO_BIDS: "no_bids",
  COLLECTING: "collecting",
  REVIEWING: "reviewing",
  AWAITING_CLARIFICATION: "awaiting_clarification",
  READY_FOR_DECISION: "ready_for_decision",
  BID_SELECTED: "bid_selected",
  AWARDED: "awarded",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

const BID_STATUS_VALUES = Object.values(BID_STATUSES);

const BID_STATUS_LABELS = {
  no_bids: "No Bids",
  collecting: "Collecting Bids",
  reviewing: "Reviewing",
  awaiting_clarification: "Awaiting Clarification",
  ready_for_decision: "Ready for Decision",
  bid_selected: "Bid Selected",
  awarded: "Awarded",
  in_progress: "In Progress",
  completed: "Completed",
};

const MANUAL_BID_STATUSES = new Set([
  BID_STATUSES.AWAITING_CLARIFICATION,
  BID_STATUSES.READY_FOR_DECISION,
]);

/**
 * Derive bid-review status from bid count, selection, and current flags.
 * Does not overwrite awarded / awaiting_clarification / ready_for_decision
 * unless selection or completion takes precedence.
 */
function deriveBidStatus({
  bidCount = 0,
  selectedBidId = null,
  currentStatus = null,
  actionItemStatus = null,
} = {}) {
  if (String(actionItemStatus || "").toLowerCase() === "completed") {
    return BID_STATUSES.COMPLETED;
  }
  if (selectedBidId) {
    if (currentStatus === BID_STATUSES.AWARDED) return BID_STATUSES.AWARDED;
    if (
      currentStatus === BID_STATUSES.IN_PROGRESS ||
      String(actionItemStatus || "").toLowerCase() === "in_progress"
    ) {
      return BID_STATUSES.IN_PROGRESS;
    }
    return BID_STATUSES.BID_SELECTED;
  }
  if (Number(bidCount) <= 0) return BID_STATUSES.NO_BIDS;
  if (currentStatus === BID_STATUSES.AWAITING_CLARIFICATION) {
    return BID_STATUSES.AWAITING_CLARIFICATION;
  }
  if (currentStatus === BID_STATUSES.READY_FOR_DECISION) {
    return BID_STATUSES.READY_FOR_DECISION;
  }
  if (Number(bidCount) === 1) return BID_STATUSES.COLLECTING;
  return BID_STATUSES.REVIEWING;
}

function isManualBidStatus(status) {
  return MANUAL_BID_STATUSES.has(status);
}

function assertDocumentCanLinkToItem(doc, item) {
  if (!doc || !item) {
    throw new BadRequestError("Document and action item are required");
  }
  if (Number(doc.property_id) !== Number(item.property_id)) {
    throw new BadRequestError("Action item must belong to the same property");
  }
  const docKey = String(doc.system_key || "").trim().toLowerCase();
  const itemKey = String(item.system_key || "").trim().toLowerCase();
  if (docKey && itemKey && docKey !== itemKey) {
    throw new BadRequestError("Action item must belong to the same system");
  }
  return true;
}

function parseMoney(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).replace(/[^0-9.-]/g, "");
  if (!s || s === "-" || s === "." || s === "-.") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

function priceStats(amounts) {
  const nums = (amounts || [])
    .map((v) => parseMoney(v))
    .filter((n) => n != null);
  if (!nums.length) {
    return { min: null, max: null, avg: null, spread: null, count: 0 };
  }
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((sum, n) => sum + n, 0) / nums.length;
  return {
    min,
    max,
    avg,
    spread: max - min,
    count: nums.length,
  };
}

module.exports = {
  BID_STATUSES,
  BID_STATUS_VALUES,
  BID_STATUS_LABELS,
  deriveBidStatus,
  isManualBidStatus,
  assertDocumentCanLinkToItem,
  parseMoney,
  formatMoney,
  priceStats,
};
