"use strict";

/**
 * Compose the Financials dashboard DTO and enqueue a one-time ATTOM backfill
 * when an existing property has no financial snapshot.
 */

const AttomLookupJob = require("../models/attomLookupJob");
const PropertyFinancials = require("../models/propertyFinancials");
const PropertyDocument = require("../models/propertyDocuments");
const { enqueue } = require("./attomLookupQueue");
const { composeFromRow } = require("./propertyFinancialsCompose");

async function maybeEnqueueFinancialsBackfill(property, row) {
  if (row?.attom_fetched_at) {
    return { attomStatus: "ready", enqueued: false };
  }

  const addressLine1 = (property.address_line_1 || property.address || "").trim();
  const hasPlace = Boolean(property.city && property.state) || Boolean(property.zip);
  if (!addressLine1 || !hasPlace) {
    return { attomStatus: "unavailable", enqueued: false };
  }

  const active = await AttomLookupJob.getLatestActiveForProperty(property.id);
  if (active) {
    return { attomStatus: "loading", enqueued: false };
  }

  const latestBackfill = await AttomLookupJob.getLatestFinancialsBackfill(property.id);
  if (latestBackfill?.status === "failed") {
    return { attomStatus: "error", enqueued: false };
  }
  if (latestBackfill?.status === "completed") {
    return { attomStatus: "unavailable", enqueued: false };
  }

  const job = await AttomLookupJob.create({
    property_id: property.id,
    account_id: property.account_id,
    user_id: null,
    trigger: "financials_backfill",
  });
  enqueue(job.id);
  return { attomStatus: "loading", enqueued: true };
}

async function getComposedFinancials(property) {
  const [row, documents, snapshots] = await Promise.all([
    PropertyFinancials.get(property.id),
    PropertyDocument.getByPropertyId(property.id).catch(() => []),
    PropertyFinancials.listSnapshots(property.id).catch(() => []),
  ]);

  const { attomStatus } = await maybeEnqueueFinancialsBackfill(property, row);
  return composeFromRow(row, { documents, snapshots, attomStatus });
}

module.exports = {
  getComposedFinancials,
  maybeEnqueueFinancialsBackfill,
  composeFromRow,
};
