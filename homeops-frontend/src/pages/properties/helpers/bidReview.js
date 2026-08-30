export const BID_STATUS_LABELS = {
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

export function bidStatusLabel(status) {
  return BID_STATUS_LABELS[status] || "No Bids";
}

export function parseMoney(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value).replace(/[^0-9.-]/g, "");
  if (!s || s === "-" || s === "." || s === "-.") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(n));
}

export function inferCertainty(field) {
  const raw = String(field?.certainty || "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (["stated", "clearly_stated", "clear"].includes(raw)) return "stated";
  if (["inferred", "ambiguous", "unclear", "potentially_ambiguous"].includes(raw)) {
    return "inferred";
  }
  if (["not_found", "missing", "unknown"].includes(raw)) return "not_found";
  if (field?.value == null || field.value === "") return "not_found";
  const conf = Number(field?.confidence);
  const hasEvidence = Boolean(field?.evidence && String(field.evidence).trim());
  if (hasEvidence && (!Number.isFinite(conf) || conf >= 0.75)) return "stated";
  if (Number.isFinite(conf) && conf < 0.5) return "inferred";
  if (hasEvidence) return "stated";
  return "inferred";
}

export function priceRangeLabel(min, max) {
  const a = formatMoney(min);
  const b = formatMoney(max);
  if (a && b && a !== b) return `${a} – ${b}`;
  return a || b || "Price not listed";
}

export function groupBidsByActionItem(bids = [], actionItems = []) {
  const itemsById = new Map(
    (actionItems || []).map((item) => [Number(item.id), item]),
  );
  const groups = new Map();
  const unlinked = [];

  for (const bid of bids || []) {
    const itemId = bid.checklistItemId ?? bid.checklist_item_id ?? null;
    if (itemId == null || itemId === "") {
      unlinked.push(bid);
      continue;
    }
    const key = Number(itemId);
    if (!groups.has(key)) {
      const item = itemsById.get(key);
      groups.set(key, {
        checklistItemId: key,
        title: item?.title || "Action Item",
        bidStatus: item?.bid_status || item?.bidStatus || "collecting",
        selectedBidDocumentId:
          item?.selected_bid_document_id || item?.selectedBidDocumentId || null,
        bids: [],
      });
    }
    groups.get(key).bids.push(bid);
  }

  const grouped = [...groups.values()].map((group) => {
    const amounts = group.bids
      .map((bid) => parseMoney(bid.total ?? bid.totalAmount))
      .filter((n) => n != null);
    const min = amounts.length ? Math.min(...amounts) : null;
    const max = amounts.length ? Math.max(...amounts) : null;
    return {
      ...group,
      bidCount: group.bids.length,
      priceMin: min,
      priceMax: max,
      priceRange: priceRangeLabel(min, max),
      bidStatusLabel: bidStatusLabel(group.bidStatus),
    };
  });

  return { grouped, unlinked };
}

export function selectedQuestionsForContractor(questions, documentId) {
  const block = (questions || []).find(
    (entry) => Number(entry.documentId) === Number(documentId),
  );
  if (!block) return [];
  return (block.groups || []).flatMap((group) =>
    (group.items || []).filter((item) => item.selected !== false),
  );
}

export function buildAskContractorMessage({
  contractorName,
  senderName,
  questions = [],
}) {
  const first = String(contractorName || "there").split(/\s+/)[0] || "there";
  const lines = (questions || [])
    .map((q, i) => `${i + 1}. ${q.text || q}`)
    .join("\n");
  const signOff = senderName ? `\n\nThanks,\n${senderName}` : "\n\nThanks,";
  return `Hi ${first},\n\nThanks for sending over your proposal. Before we make a decision, we had a few questions:\n\n${lines}${signOff}`;
}

export function unansweredQuestionCount(questions, documentId) {
  return selectedQuestionsForContractor(questions, documentId).length;
}
