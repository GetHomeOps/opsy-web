import React, {useCallback, useEffect, useMemo, useState} from "react";
import {AlertCircle, Check, Loader2, Mail, Send} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import AppApi, {getApiErrorMessage} from "../../../api/api";

function formatRole(inv) {
  const category = (inv.intendedPropertyRole || "").trim();
  const access = (inv.intendedRole || "").trim();
  if (category && access) return `${category} · ${access}`;
  return category || access || "—";
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Modal to list never-sent pending invitations for an account and send selected ones.
 */
function SendPendingInvitationsModal({
  modalOpen,
  setModalOpen,
  currentAccount,
}) {
  const accountId = currentAccount?.id;
  const [invitations, setInvitations] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState(null);

  const loadInvitations = useCallback(async () => {
    if (!accountId) {
      setInvitations([]);
      setLoadError("No account selected.");
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const list = await AppApi.getAccountInvitations(accountId, {
        status: "pending",
        emailNeverSent: true,
      });
      // Prefer property invitations for this Properties Actions flow
      const propertyOnly = (list || []).filter(
        (inv) => inv.type === "property" || inv.propertyId != null,
      );
      setInvitations(propertyOnly);
      setSelectedIds(new Set(propertyOnly.map((inv) => inv.id)));
    } catch (err) {
      setInvitations([]);
      setSelectedIds(new Set());
      setLoadError(
        getApiErrorMessage(err) || "Failed to load pending invitations.",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (!modalOpen) {
      setResults(null);
      setLoadError("");
      setInvitations([]);
      setSelectedIds(new Set());
      setIsSubmitting(false);
      return;
    }
    setResults(null);
    loadInvitations();
  }, [modalOpen, loadInvitations]);

  const allSelected =
    invitations.length > 0 && invitations.every((inv) => selectedIds.has(inv.id));
  const someSelected = selectedIds.size > 0;
  const selectedCount = useMemo(
    () => invitations.filter((inv) => selectedIds.has(inv.id)).length,
    [invitations, selectedIds],
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invitations.map((inv) => inv.id)));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (!someSelected || isSubmitting || !accountId) return;
    setIsSubmitting(true);
    try {
      const invitationIds = invitations
        .filter((inv) => selectedIds.has(inv.id))
        .map((inv) => inv.id);
      const res = await AppApi.sendPendingInvitations({
        invitationIds,
        accountId,
      });
      const sentIds = new Set((res.sent || []).map((row) => row.id));
      setResults({
        sent: res.sent || [],
        failed: (res.failed || []).map((row) => ({
          id: row.id,
          inviteeEmail:
            invitations.find((inv) => inv.id === row.id)?.inviteeEmail || row.id,
          error: row.error || "Failed to send",
        })),
      });
      setInvitations((prev) => prev.filter((inv) => !sentIds.has(inv.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of sentIds) next.delete(id);
        return next;
      });
    } catch (err) {
      setResults({
        sent: [],
        failed: [
          {
            id: null,
            inviteeEmail: null,
            error: getApiErrorMessage(err) || "Failed to send invitations",
          },
        ],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showResults = results !== null;

  return (
    <ModalBlank
      id="send-pending-invitations-modal"
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-3xl min-w-[24rem] max-h-[90vh] flex flex-col"
    >
      <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
        {showResults ? (
          <div className="p-6 flex flex-col items-center gap-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                results.failed.length === 0
                  ? "bg-[#456564]/20 dark:bg-[#5a7a78]/30"
                  : "bg-amber-100 dark:bg-amber-500/20"
              }`}
            >
              {results.failed.length === 0 ? (
                <Check className="w-8 h-8 text-[#456564] dark:text-[#5a7a78]" />
              ) : (
                <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="text-center">
              {results.sent.length > 0 && (
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  Sent {results.sent.length} invitation
                  {results.sent.length === 1 ? "" : "s"}
                </p>
              )}
              {results.failed.length > 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {results.failed.length} failed
                </p>
              )}
            </div>
            {results.failed.length > 0 && (
              <ul className="w-full max-h-40 overflow-y-auto text-sm text-left space-y-1 border border-amber-200 dark:border-amber-800 rounded-lg p-3 bg-amber-50/50 dark:bg-amber-900/10">
                {results.failed.map((row, idx) => (
                  <li key={row.id || idx} className="text-amber-800 dark:text-amber-200">
                    {row.inviteeEmail ? (
                      <>
                        <span className="font-medium">{row.inviteeEmail}</span>
                        {": "}
                      </>
                    ) : null}
                    {row.error}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-3 mt-2">
              {invitations.length > 0 ? (
                <button
                  type="button"
                  className="btn border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  onClick={() => setResults(null)}
                >
                  Back to list
                </button>
              ) : null}
              <button
                type="button"
                className="btn bg-[#456564] hover:bg-[#3d5857] text-white"
                onClick={() => setModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 pb-3 shrink-0">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#456564]/15 dark:bg-[#5a7a78]/25 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-[#456564] dark:text-[#7aa3a2]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Send pending invitations
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Select invitations that were created without an email and send
                    them now.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 flex-1 min-h-0 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading pending invitations…
                </div>
              ) : loadError ? (
                <div className="py-10 text-center text-sm text-red-600 dark:text-red-400">
                  {loadError}
                </div>
              ) : invitations.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  No pending invitations waiting to be emailed.
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
                  <table className="table-auto w-full text-sm">
                    <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="px-3 py-2 text-left w-10">
                          <input
                            type="checkbox"
                            className="form-checkbox"
                            checked={allSelected}
                            onChange={toggleAll}
                            aria-label="Select all"
                          />
                        </th>
                        <th className="px-3 py-2 text-left">Invitee</th>
                        <th className="px-3 py-2 text-left">Property</th>
                        <th className="px-3 py-2 text-left">Role</th>
                        <th className="px-3 py-2 text-left">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {invitations.map((inv) => (
                        <tr
                          key={inv.id}
                          className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              className="form-checkbox"
                              checked={selectedIds.has(inv.id)}
                              onChange={() => toggleOne(inv.id)}
                              aria-label={`Select ${inv.inviteeEmail}`}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-gray-800 dark:text-gray-100">
                            {inv.inviteeEmail}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                            {inv.propertyAddress || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300 capitalize">
                            {formatRole(inv)}
                          </td>
                          <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            {formatDate(inv.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
                className="btn border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!someSelected || isSubmitting || loading || !!loadError}
                className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    Sending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Send selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
                    <Send className="w-4 h-4" />
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalBlank>
  );
}

export default SendPendingInvitationsModal;
