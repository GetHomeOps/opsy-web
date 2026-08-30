import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import ModalBlank from "../../../../../components/ModalBlank";
import AppApi from "../../../../../api/api";
import ContractorDropdown from "../../maintenance/ContractorDropdown";
import { OpsyModalIcon } from "../../documents/documentAnalysisModalShared";
import {
  bidStatusLabel,
  buildAskContractorMessage,
  formatMoney,
  inferCertainty,
  unansweredQuestionCount,
} from "../../../helpers/bidReview";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "compare", label: "Compare" },
  { id: "questions", label: "Questions" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
];

function CertaintyMark({ certainty }) {
  if (certainty === "inferred") {
    return (
      <span className="inline-flex items-center gap-0.5 text-amber-600 text-[10px] font-medium">
        <AlertTriangle className="w-3 h-3" />
        Unclear
      </span>
    );
  }
  if (certainty === "not_found") {
    return <span className="text-[10px] text-gray-400">Not listed</span>;
  }
  return null;
}

function BidCard({
  bid,
  selected,
  unanswered,
  onView,
  onSelect,
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {bid.contractorName || bid.documentName || "Contractor"}
          </p>
          <p className="text-lg font-semibold text-[#456564]">
            {bid.totalDisplay || formatMoney(bid.totalAmount) || "—"}
          </p>
        </div>
        {selected && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
            <Check className="w-3 h-3" />
            Selected
          </span>
        )}
      </div>
      {unanswered > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {unanswered} unanswered question{unanswered === 1 ? "" : "s"}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onView}
          className="text-xs font-medium text-[#456564] hover:underline"
        >
          View Bid
        </button>
        {!selected && (
          <button
            type="button"
            onClick={onSelect}
            className="text-xs font-medium px-2.5 py-1 rounded-lg btn-primary"
          >
            Select Bid
          </button>
        )}
      </div>
    </div>
  );
}

export default function BidReviewPanel({
  open,
  onClose,
  propertyId,
  itemId,
  contacts = [],
  onOpenDocument,
}) {
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [item, setItem] = useState(null);
  const [review, setReview] = useState(null);
  const [bids, setBids] = useState([]);
  const [error, setError] = useState("");
  const [confirmBid, setConfirmBid] = useState(null);
  const [askFor, setAskFor] = useState(null);
  const [askMessage, setAskMessage] = useState("");
  const [askEmail, setAskEmail] = useState("");
  const [askName, setAskName] = useState("");
  const [sending, setSending] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newQuestionDoc, setNewQuestionDoc] = useState("");

  const load = useCallback(async () => {
    if (!propertyId || !itemId) return;
    setLoading(true);
    setError("");
    try {
      const payload = await AppApi.getActionItemBidReview(propertyId, itemId);
      setItem(payload.item);
      setReview(payload.review);
      setBids(payload.bids || []);
    } catch (err) {
      setError(err.message || "Could not load bid review.");
    } finally {
      setLoading(false);
    }
  }, [propertyId, itemId]);

  useEffect(() => {
    if (open) {
      setTab("overview");
      load();
    }
  }, [open, load]);

  const comparison = review?.comparison || {};
  const questions = review?.questions || [];
  const selectedId = item?.selected_bid_document_id;
  const selectedBid = bids.find((b) => Number(b.documentId) === Number(selectedId));

  const ensureCompare = async () => {
    if (review?.comparison?.matrix?.length || comparing) return;
    if (bids.length < 1) return;
    setComparing(true);
    try {
      const payload = await AppApi.compareActionItemBids(propertyId, itemId);
      setItem(payload.item);
      setReview(payload.review);
      setBids(payload.bids || bids);
    } catch (err) {
      setError(err.message || "Comparison failed.");
    } finally {
      setComparing(false);
    }
  };

  useEffect(() => {
    if (open && bids.length >= 1 && !review?.comparison?.summary) {
      ensureCompare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bids.length, review?.comparison?.summary]);

  const stats = comparison.stats || {};

  const persistQuestions = async (next) => {
    setReview((prev) => ({ ...(prev || {}), questions: next }));
    try {
      await AppApi.updateBidQuestions(propertyId, itemId, next);
    } catch (err) {
      setError(err.message || "Could not save questions.");
    }
  };

  const toggleQuestion = (documentId, questionId) => {
    const next = questions.map((block) => {
      if (Number(block.documentId) !== Number(documentId)) return block;
      return {
        ...block,
        groups: (block.groups || []).map((group) => ({
          ...group,
          items: (group.items || []).map((q) =>
            q.id === questionId ? { ...q, selected: q.selected === false } : q,
          ),
        })),
      };
    });
    persistQuestions(next);
  };

  const editQuestion = (documentId, questionId, text) => {
    const next = questions.map((block) => {
      if (Number(block.documentId) !== Number(documentId)) return block;
      return {
        ...block,
        groups: (block.groups || []).map((group) => ({
          ...group,
          items: (group.items || []).map((q) =>
            q.id === questionId ? { ...q, text } : q,
          ),
        })),
      };
    });
    persistQuestions(next);
  };

  const addQuestion = () => {
    if (!newQuestion.trim() || !newQuestionDoc) return;
    const next = questions.map((block) => {
      if (Number(block.documentId) !== Number(newQuestionDoc)) return block;
      const groups = [...(block.groups || [])];
      const other = groups.find((g) => g.category === "Other");
      const item = {
        id: `user_${Date.now()}`,
        text: newQuestion.trim(),
        selected: true,
        source: "user",
      };
      if (other) other.items = [...other.items, item];
      else groups.push({ category: "Other", items: [item] });
      return { ...block, groups };
    });
    persistQuestions(next);
    setNewQuestion("");
  };

  const openAsk = (bid) => {
    const selectedQs = (questions.find((b) => Number(b.documentId) === Number(bid.documentId))
      ?.groups || [])
      .flatMap((g) => (g.items || []).filter((q) => q.selected !== false));
    setAskFor(bid);
    setAskName(bid.contractorName || "");
    setAskEmail(bid.installerEmail || "");
    setAskMessage(
      buildAskContractorMessage({
        contractorName: bid.contractorName,
        questions: selectedQs,
      }),
    );
  };

  const sendAsk = async () => {
    if (!askEmail || !askMessage) return;
    setSending(true);
    try {
      const payload = await AppApi.askContractorAboutBid(propertyId, itemId, {
        to: askEmail,
        contractorName: askName,
        message: askMessage,
        documentId: askFor?.documentId,
      });
      if (payload.item) setItem(payload.item);
      setAskFor(null);
      await load();
    } catch (err) {
      setError(err.message || "Could not send email.");
    } finally {
      setSending(false);
    }
  };

  const confirmSelect = async () => {
    if (!confirmBid) return;
    setSending(true);
    try {
      const payload = await AppApi.selectActionItemBid(
        propertyId,
        itemId,
        confirmBid.documentId,
      );
      setItem(payload.item);
      setConfirmBid(null);
    } catch (err) {
      setError(err.message || "Could not select bid.");
    } finally {
      setSending(false);
    }
  };

  const handleViewDocument = async (bid) => {
    if (!bid?.documentKey) return;
    if (onOpenDocument) {
      onOpenDocument(bid.documentKey);
      return;
    }
    try {
      const url = await AppApi.getPresignedPreviewUrl(bid.documentKey);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err.message || "Could not open document.");
    }
  };

  const highlights = comparison.highlights || [];
  const matrix = comparison.matrix || [];
  const snapshots = useMemo(
    () =>
      comparison.snapshots?.length
        ? comparison.snapshots
        : bids.map((b) => ({
            documentId: b.documentId,
            contractorName: b.contractorName,
          })),
    [comparison.snapshots, bids],
  );

  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={(isOpen) => !isOpen && onClose?.()}
      contentClassName="relative w-full max-w-6xl h-[min(90vh,880px)] overflow-hidden flex flex-col"
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <OpsyModalIcon />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                {item?.title || "Bid review"}
              </h2>
              <p className="text-xs text-gray-500">
                {bids.length} bid{bids.length === 1 ? "" : "s"}
                {item?.bid_status ? ` · ${bidStatusLabel(item.bid_status)}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-shrink-0 flex border-b border-gray-200 dark:border-gray-700 px-5 overflow-x-auto">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap ${
                tab === entry.id
                  ? "border-[#456564] text-[#456564]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex justify-center py-16 text-gray-500">
              <Loader2 className="w-7 h-7 animate-spin text-[#456564]" />
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-red-600 mb-3">{error}</p>
          )}

          {!loading && tab === "overview" && (
            <div className="space-y-4">
              {selectedBid && (
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/15 p-4">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold mb-1">
                    Preferred bid
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {selectedBid.contractorName} · {selectedBid.totalDisplay || "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    This is your preferred bid. Other bids stay on file. Awarding the job comes later.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  ["Bids", String(bids.length)],
                  ["Lowest", stats.minDisplay || "—"],
                  ["Average", stats.avgDisplay || "—"],
                  ["Highest", stats.maxDisplay || "—"],
                  ["Spread", stats.spreadDisplay || "—"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5"
                  >
                    <p className="text-[10px] uppercase tracking-wide text-gray-400">
                      {label}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
                  Summary
                </p>
                {comparing && !comparison.summary ? (
                  <p className="text-sm text-gray-500">Comparing bids…</p>
                ) : (
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {comparison.summary ||
                      "Save two or more bids to generate a comparison summary."}
                  </p>
                )}
                {highlights.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {highlights.slice(0, 6).map((h, i) => (
                      <li
                        key={`${h.type}-${i}`}
                        className="text-xs text-gray-600 dark:text-gray-400"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {h.label}:
                        </span>{" "}
                        {h.detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {bids.map((bid) => (
                  <BidCard
                    key={bid.documentId}
                    bid={bid}
                    selected={Number(bid.documentId) === Number(selectedId)}
                    unanswered={unansweredQuestionCount(questions, bid.documentId)}
                    onView={() => handleViewDocument(bid)}
                    onSelect={() => setConfirmBid(bid)}
                  />
                ))}
              </div>
            </div>
          )}

          {!loading && tab === "compare" && (
            <div>
              {bids.length < 2 ? (
                <p className="text-sm text-gray-500 py-10 text-center">
                  Add another bid to compare price, scope, and terms side by side.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left text-[10px] uppercase tracking-wide text-gray-400 font-medium py-2 pr-3">
                          Item
                        </th>
                        {snapshots.map((snap) => (
                          <th
                            key={snap.documentId}
                            className="text-left text-[10px] uppercase tracking-wide text-gray-400 font-medium py-2 px-2 min-w-[8rem]"
                          >
                            {snap.contractorName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row) => (
                        <tr
                          key={row.key}
                          className="border-b border-gray-50 dark:border-gray-800/60"
                        >
                          <td className="py-2 pr-3 text-xs font-medium text-gray-700 dark:text-gray-300">
                            {row.label}
                          </td>
                          {snapshots.map((snap) => {
                            const cell = row.cells?.[snap.documentId] || {};
                            const certainty = cell.certainty || inferCertainty(cell);
                            return (
                              <td key={snap.documentId} className="py-2 px-2 align-top">
                                <p className="text-xs text-gray-900 dark:text-gray-100">
                                  {certainty === "not_found"
                                    ? "Not listed"
                                    : cell.display || "—"}
                                </p>
                                <CertaintyMark certainty={certainty} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!loading && tab === "questions" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    setComparing(true);
                    try {
                      const payload = await AppApi.regenerateBidQuestions(
                        propertyId,
                        itemId,
                      );
                      setReview(payload.review);
                      setBids(payload.bids || bids);
                    } finally {
                      setComparing(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#456564]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${comparing ? "animate-spin" : ""}`} />
                  Regenerate questions
                </button>
              </div>
              {questions.map((block) => (
                <div
                  key={block.documentId}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {block.contractorName}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        openAsk(
                          bids.find(
                            (b) => Number(b.documentId) === Number(block.documentId),
                          ) || { documentId: block.documentId, contractorName: block.contractorName },
                        )
                      }
                      className="text-xs font-medium px-2.5 py-1 rounded-lg btn-primary"
                    >
                      Ask Contractor
                    </button>
                  </div>
                  {(block.groups || []).map((group) => (
                    <div key={group.category}>
                      <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-1.5">
                        {group.category}
                      </p>
                      <ul className="space-y-1.5">
                        {(group.items || []).map((q) => (
                          <li key={q.id} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={q.selected !== false}
                              onChange={() => toggleQuestion(block.documentId, q.id)}
                              className="form-checkbox mt-0.5 shrink-0"
                              aria-label="Include this question"
                            />
                            <input
                              type="text"
                              value={q.text}
                              onChange={(e) =>
                                editQuestion(block.documentId, q.id, e.target.value)
                              }
                              className="flex-1 min-w-0 text-xs leading-5 py-0 bg-transparent border-b border-transparent focus:border-gray-300 focus:outline-none text-gray-800 dark:text-gray-200"
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
              {questions.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newQuestionDoc}
                    onChange={(e) => setNewQuestionDoc(e.target.value)}
                    className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800"
                  >
                    <option value="">Contractor…</option>
                    {questions.map((b) => (
                      <option key={b.documentId} value={b.documentId}>
                        {b.contractorName}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    placeholder="Add your own question"
                    className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800"
                  />
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#456564]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && tab === "documents" && (
            <div className="space-y-3">
              {bids.map((bid) => (
                <div
                  key={bid.documentId}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {bid.documentName || bid.contractorName}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleViewDocument(bid)}
                      className="inline-flex items-center gap-1 text-xs text-[#456564]"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Open PDF
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {(bid.findings || []).slice(0, 12).map((field, i) => {
                      const certainty = inferCertainty(field);
                      return (
                        <li key={field.fieldKey || i} className="text-xs text-gray-600">
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {field.label || field.fieldKey}:
                          </span>{" "}
                          {certainty === "not_found"
                            ? "Not listed"
                            : String(field.value ?? "—")}{" "}
                          <CertaintyMark certainty={certainty} />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {!loading && tab === "activity" && (
            <ul className="space-y-2">
              {(review?.activity || []).length === 0 && (
                <p className="text-sm text-gray-500">No activity yet.</p>
              )}
              {[...(review?.activity || [])].reverse().map((event, i) => (
                <li
                  key={`${event.at}-${i}`}
                  className="text-xs text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2"
                >
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {String(event.type || "").replace(/_/g, " ")}
                  </span>
                  {event.at && (
                    <span className="text-gray-400">
                      {" "}
                      · {new Date(event.at).toLocaleString()}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirmBid && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-4 z-10">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 max-w-md w-full space-y-3 shadow-xl">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Select this bid?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Mark <strong>{confirmBid.contractorName}</strong>
              {confirmBid.totalDisplay ? ` (${confirmBid.totalDisplay})` : ""} as
              your preferred bid. Other bids stay visible. This is not an award
              and does not schedule work.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmBid(null)}
                className="text-xs text-gray-500 px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSelect}
                disabled={sending}
                className="btn-primary text-xs px-3 py-1.5 rounded-lg"
              >
                {sending ? "Saving…" : "Select bid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {askFor && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-4 z-10">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 max-w-lg w-full space-y-3 shadow-xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Ask Contractor
            </h3>
            <ContractorDropdown
              value={askName}
              contractorEmail={askEmail}
              contacts={contacts}
              onSelect={(contact) => {
                setAskName(contact?.name || askName);
                if (contact?.email) setAskEmail(contact.email);
              }}
              onClear={() => {}}
            />
            <input
              type="email"
              value={askEmail}
              onChange={(e) => setAskEmail(e.target.value)}
              placeholder="Contractor email"
              className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-800"
            />
            <textarea
              value={askMessage}
              onChange={(e) => setAskMessage(e.target.value)}
              rows={8}
              className="w-full text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2.5 py-1.5 bg-white dark:bg-gray-800"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAskFor(null)}
                className="text-xs text-gray-500 px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendAsk}
                disabled={sending || !askEmail}
                className="btn-primary text-xs px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalBlank>
  );
}
