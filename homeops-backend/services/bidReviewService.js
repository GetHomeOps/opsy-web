"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const InspectionChecklistItem = require("../models/inspectionChecklistItem");
const PropertyDocument = require("../models/propertyDocuments");
const DocumentAnalysisResult = require("../models/documentAnalysisResult");
const ActionItemBidReview = require("../models/actionItemBidReview");
const {
  deriveBidStatus,
  assertDocumentCanLinkToItem,
  parseMoney,
  formatMoney,
  priceStats,
  BID_STATUS_LABELS,
} = require("./bidStatus");
const {
  buildComparisonPayload,
  enrichComparisonWithAi,
  mergeCustomQuestions,
  filterAnsweredQuestions,
} = require("./bidComparisonService");
const { formatResultForApi } = require("./documentAnalysisFieldMapper");

function activityEvent(type, userId, payload = {}) {
  return {
    type,
    at: new Date().toISOString(),
    by: userId || null,
    payload,
  };
}

function formatReviewRow(row) {
  if (!row) return null;
  return {
    checklistItemId: row.checklist_item_id,
    comparison: row.comparison || {},
    questions: row.questions || [],
    activity: row.activity || [],
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

async function countBidsForItem(checklistItemId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS n
       FROM property_documents
      WHERE checklist_item_id = $1`,
    [checklistItemId],
  );
  return result.rows[0]?.n ?? 0;
}

async function refreshItemBidStatus(item, { preferredStatus = null } = {}) {
  const bidCount = await countBidsForItem(item.id);
  const next = deriveBidStatus({
    bidCount,
    selectedBidId: item.selected_bid_document_id,
    currentStatus: preferredStatus || item.bid_status,
    actionItemStatus: item.status,
  });
  if (next === item.bid_status) return item;
  return InspectionChecklistItem.update(item.id, { bid_status: next });
}

async function listBidAnalysisForSystem(propertyId, systemKey) {
  const approved = await DocumentAnalysisResult.listApprovedBySystem(
    propertyId,
    systemKey,
  );
  const pending = await DocumentAnalysisResult.listPendingByProperty(propertyId);
  const pendingForSystem = pending.filter(
    (p) => String(p.system_key).toLowerCase() === String(systemKey).toLowerCase(),
  );
  const rows = [...pendingForSystem, ...approved];
  const seen = new Set();
  const unique = [];
  for (const row of rows) {
    const key = `${row.property_document_id}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique.filter((row) => {
    const cat = String(row.detected_category || "").toLowerCase();
    const type = String(row.document_type || "").toLowerCase();
    return cat === "bid" || type === "bid" || type === "quote" || type === "estimate";
  });
}

function toBidCard(row, formatted) {
  const findings = formatted?.findings || row.findings || [];
  const applied = formatted?.appliedFields || row.applied_fields || [];
  const byKey = new Map();
  for (const field of [...findings, ...applied]) {
    const key = field.fieldKey || field.key;
    if (key && !byKey.has(key)) byKey.set(key, field);
  }
  const valueOf = (...keys) => {
    for (const key of keys) {
      const field = byKey.get(key);
      if (field?.value != null && field.value !== "") return field.value;
    }
    return null;
  };
  const total = valueOf("totalPrice", "cost", "price", "amount");
  return {
    analysisResultId: row.id,
    documentId: row.property_document_id,
    documentName: row.document_name,
    documentKey: row.document_key,
    documentType: row.document_type,
    reviewStatus: row.review_status,
    checklistItemId: row.checklist_item_id ?? null,
    contractorName: valueOf("installer", "vendor", "contractor") || row.document_name,
    installerEmail: valueOf("installerEmail"),
    total,
    totalAmount: parseMoney(total),
    totalDisplay: formatMoney(parseMoney(total)) || (total != null ? String(total) : null),
    validUntil: valueOf("validUntil"),
    findings,
    appliedFields: applied,
    formatted,
  };
}

async function getSystemBidReviews(propertyId, systemKey, { contacts, property, systemRow } = {}) {
  const items = await InspectionChecklistItem.getByPropertyId(propertyId, { systemKey });
  const analysisRows = await listBidAnalysisForSystem(propertyId, systemKey);
  const cards = analysisRows.map((row) =>
    toBidCard(
      row,
      formatResultForApi(row, systemRow || null, { contacts, property }),
    ),
  );

  const cardsByItem = new Map();
  const unlinked = [];
  for (const card of cards) {
    if (card.checklistItemId) {
      const list = cardsByItem.get(Number(card.checklistItemId)) || [];
      list.push(card);
      cardsByItem.set(Number(card.checklistItemId), list);
    } else {
      unlinked.push(card);
    }
  }

  const groups = items
    .map((item) => {
      const bids = cardsByItem.get(Number(item.id)) || [];
      const stats = priceStats(bids.map((b) => b.totalAmount));
      return {
        checklistItemId: item.id,
        title: item.title,
        description: item.description,
        priority: item.priority,
        status: item.status,
        bidStatus: item.bid_status || "no_bids",
        bidStatusLabel: BID_STATUS_LABELS[item.bid_status] || "No Bids",
        selectedBidDocumentId: item.selected_bid_document_id,
        bidSelectedAt: item.bid_selected_at,
        bidCount: bids.length,
        priceMin: stats.min,
        priceMax: stats.max,
        priceAvg: stats.avg,
        priceSpread: stats.spread,
        priceMinDisplay: formatMoney(stats.min),
        priceMaxDisplay: formatMoney(stats.max),
        bids,
      };
    })
    .filter((g) => g.bidCount > 0);

  const orphanIds = [...cardsByItem.keys()].filter(
    (id) => !items.some((item) => Number(item.id) === Number(id)),
  );
  for (const id of orphanIds) {
    const bids = cardsByItem.get(id) || [];
    unlinked.push(...bids);
  }

  return {
    groups,
    unlinked,
    actionItems: items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      bidStatus: item.bid_status || "no_bids",
      bidCount: item.bid_count || cardsByItem.get(Number(item.id))?.length || 0,
    })),
  };
}

async function linkDocumentToItem(documentId, checklistItemId, userId) {
  const doc = await PropertyDocument.get(documentId);
  const item = await InspectionChecklistItem.get(checklistItemId);
  assertDocumentCanLinkToItem(doc, item);

  const updated = await PropertyDocument.update(documentId, {
    checklist_item_id: checklistItemId,
  });
  const refreshed = await refreshItemBidStatus(item);
  await ActionItemBidReview.appendActivity(
    checklistItemId,
    activityEvent("bid_linked", userId, {
      documentId,
      documentName: doc.document_name,
    }),
  );
  return { document: updated, item: refreshed };
}

async function unlinkDocument(documentId, userId) {
  const doc = await PropertyDocument.get(documentId);
  const previousItemId = doc.checklist_item_id;
  const updated = await PropertyDocument.update(documentId, {
    checklist_item_id: null,
  });
  if (previousItemId) {
    const item = await InspectionChecklistItem.get(previousItemId).catch(() => null);
    if (item) {
      if (Number(item.selected_bid_document_id) === Number(documentId)) {
        await InspectionChecklistItem.update(item.id, {
          selected_bid_document_id: null,
          bid_selected_at: null,
        });
        const reloaded = await InspectionChecklistItem.get(item.id);
        await refreshItemBidStatus(reloaded);
      } else {
        await refreshItemBidStatus(item);
      }
      await ActionItemBidReview.appendActivity(
        previousItemId,
        activityEvent("bid_unlinked", userId, { documentId }),
      );
    }
  }
  return { document: updated };
}

async function loadLinkedBidCards(item) {
  const rows = await DocumentAnalysisResult.listByChecklistItem(item.id);
  return rows
    .filter((row) => {
      const cat = String(row.detected_category || "").toLowerCase();
      const type = String(row.document_type || "").toLowerCase();
      return cat === "bid" || type === "bid" || type === "quote" || type === "estimate";
    })
    .map((row) =>
      toBidCard(row, formatResultForApi(row, null, {})),
    );
}

async function compareItem(item, { regenerateQuestions = false, userId } = {}) {
  const bids = await loadLinkedBidCards(item);
  if (!bids.length) {
    throw new BadRequestError("Link at least one bid to this action item first.");
  }
  const existing = await ActionItemBidReview.get(item.id);
  let payload = buildComparisonPayload(bids, { actionItemTitle: item.title });
  payload = await enrichComparisonWithAi(payload, { actionItemTitle: item.title });
  if (existing?.questions && !regenerateQuestions) {
    payload.questions = mergeCustomQuestions(existing.questions, payload.questions);
  } else if (existing?.questions && regenerateQuestions) {
    payload.questions = mergeCustomQuestions(existing.questions, payload.questions);
    payload.questions = filterAnsweredQuestions(payload.questions, payload.snapshots);
  }

  const review = await ActionItemBidReview.upsert(item.id, {
    comparison: {
      summary: payload.summary,
      stats: payload.stats,
      matrix: payload.matrix,
      highlights: payload.highlights,
      snapshots: payload.snapshots,
      bidCount: payload.bidCount,
    },
    questions: payload.questions,
    activity: [
      ...(Array.isArray(existing?.activity) ? existing.activity : []),
      activityEvent(regenerateQuestions ? "questions_regenerated" : "compared", userId, {
        bidCount: bids.length,
      }),
    ],
    generatedAt: new Date().toISOString(),
  });

  const refreshed = await refreshItemBidStatus(item);
  return { item: refreshed, review: formatReviewRow(review), bids };
}

async function getItemReview(item) {
  const bids = await loadLinkedBidCards(item);
  const review = await ActionItemBidReview.get(item.id);
  return { item, review: formatReviewRow(review), bids };
}

async function updateQuestions(item, questions, userId) {
  const existing = await ActionItemBidReview.get(item.id);
  const review = await ActionItemBidReview.upsert(item.id, {
    comparison: existing?.comparison,
    questions,
    activity: [
      ...(Array.isArray(existing?.activity) ? existing.activity : []),
      activityEvent("questions_updated", userId, {}),
    ],
    generatedAt: existing?.generated_at,
  });
  return { review: formatReviewRow(review) };
}

async function selectBid(item, documentId, userId) {
  const doc = await PropertyDocument.get(documentId);
  if (Number(doc.checklist_item_id) !== Number(item.id)) {
    throw new BadRequestError("That bid is not linked to this action item.");
  }
  const updated = await InspectionChecklistItem.update(item.id, {
    selected_bid_document_id: documentId,
    bid_selected_at: new Date().toISOString(),
    bid_status: "bid_selected",
  });
  await ActionItemBidReview.appendActivity(
    item.id,
    activityEvent("bid_selected", userId, {
      documentId,
      documentName: doc.document_name,
    }),
  );
  return { item: updated };
}

async function markAwaitingClarification(item) {
  return InspectionChecklistItem.update(item.id, {
    bid_status: "awaiting_clarification",
  });
}

module.exports = {
  formatReviewRow,
  getSystemBidReviews,
  linkDocumentToItem,
  unlinkDocument,
  compareItem,
  getItemReview,
  updateQuestions,
  selectBid,
  markAwaitingClarification,
  refreshItemBidStatus,
  countBidsForItem,
};
