import React, {useEffect, useState} from "react";
import {Mail, Send, AlertCircle, Link2, ChevronDown} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import AppApi from "../../../api/api";

const MAIN_MAX = 10000;

function appendCcEmail(existingInput, addEmail) {
  const add = (addEmail || "").trim();
  if (!add) return existingInput || "";
  const parts = existingInput
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lower = add.toLowerCase();
  if (parts.some((p) => p.toLowerCase() === lower)) return existingInput;
  return parts.length ? `${parts.join(", ")}, ${add}` : add;
}

/**
 * Modal to edit the main text of the property invitation email (and optional CC for super admins).
 * Default copy is loaded from the API so it matches the real template.
 */
function InviteEmailPersonalizeModal({
  modalOpen,
  setModalOpen,
  inviteeEmail = "",
  inviteeName = "",
  propertyLine = "",
  propertyId = null,
  accountId = null,
  showCcField = false,
  suggestedCcEmail = "",
  /** { value: email, label: display }[] — property team except current invitee */
  ccTeamPickOptions = [],
  onConfirm,
  busy = false,
}) {
  const [mainText, setMainText] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [ccSelectNonce, setCcSelectNonce] = useState(0);
  const [loadingDefault, setLoadingDefault] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!modalOpen) return;
    setCcInput(suggestedCcEmail?.trim() ? suggestedCcEmail.trim() : "");
    setLoadError("");

    const emailOk = (inviteeEmail || "").trim();
    const pid = propertyId != null ? Number(propertyId) : NaN;
    const aid = accountId != null ? Number(accountId) : NaN;
    const canFetch =
      emailOk &&
      Number.isInteger(pid) &&
      pid > 0 &&
      Number.isInteger(aid) &&
      aid > 0;

    if (!canFetch) {
      setMainText("");
      setLoadingDefault(false);
      return;
    }

    let cancelled = false;
    setLoadingDefault(true);
    setMainText("");

    AppApi.getPropertyInviteDefaultMain({
      inviteeEmail: emailOk,
      propertyId: pid,
      accountId: aid,
      inviteeName: (inviteeName || "").trim() || undefined,
    })
      .then((r) => {
        if (!cancelled) {
          setMainText(r?.defaultMainPlain ?? "");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMainText("");
          setLoadError(
            err?.message ||
              "Could not load default email text. You can still type your own.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDefault(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modalOpen, inviteeEmail, inviteeName, propertyId, accountId, suggestedCcEmail]);

  const mainLen = mainText.length;
  const mainOver = mainLen > MAIN_MAX;

  const handleSend = async () => {
    if (mainOver || busy || loadingDefault) return;
    const ccList = showCcField
      ? ccInput
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    await onConfirm?.({
      invitationEmailMainPlain: mainText.trim() || undefined,
      invitationEmailCc:
        showCcField && ccList.length > 0 ? ccList : undefined,
    });
  };

  return (
    <ModalBlank
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-3xl w-full max-h-[min(92vh,800px)] flex flex-col shadow-xl border border-gray-200/80 dark:border-gray-700/80 rounded-xl overflow-hidden"
      backdropZClassName="z-[220]"
      dialogZClassName="z-[221]"
      closeOnClickOutside={!busy && !loadingDefault}
      closeOnBackdropClick={!busy && !loadingDefault}
    >
      {/* Header */}
      <div className="shrink-0 px-6 sm:px-8 pt-6 sm:pt-7 pb-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-[#456564]/12 dark:bg-[#5a7a78]/20 flex items-center justify-center ring-1 ring-[#456564]/20 dark:ring-[#5a7a78]/30">
            <Mail className="w-6 h-6 text-[#456564] dark:text-[#5a7a78]" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              Customize invitation email
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed max-w-2xl">
              Plain-text body only—we append the accept button, secure link, and
              email footer automatically.
              {showCcField
                ? " You may add CC recipients (super admin)."
                : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-5 sm:py-6 bg-gray-50/70 dark:bg-gray-900/25">
        {/* Recipient */}
        <div className="rounded-xl border border-gray-200/90 dark:border-gray-600/80 bg-white dark:bg-gray-800 shadow-sm px-4 py-3.5 mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Delivery
          </p>
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 gap-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0 w-12 sm:w-14">
              To
            </span>
            <span className="text-sm text-gray-900 dark:text-gray-100 font-medium break-all">
              {inviteeEmail || "—"}
            </span>
          </div>
          {inviteeName?.trim() ? (
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/80">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0 w-12 sm:w-14">
                Name
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {inviteeName.trim()}
              </span>
            </div>
          ) : null}
          {propertyLine ? (
            <div className="flex flex-col sm:flex-row sm:items-start sm:gap-3 gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/80">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0 w-12 sm:w-14 pt-0.5">
                Property
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
                {propertyLine}
              </span>
            </div>
          ) : null}
        </div>

        {loadError ? (
          <div
            className="flex gap-3 rounded-xl border border-amber-200/90 dark:border-amber-800/50 bg-amber-50/90 dark:bg-amber-950/30 px-4 py-3 mb-5"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
              {loadError}
            </p>
          </div>
        ) : null}

        {/* Compose */}
        <div className="rounded-xl border border-gray-200/90 dark:border-gray-600/80 bg-white dark:bg-gray-800 shadow-sm p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5">
                Message
              </p>
              <label
                htmlFor="invite-email-main-text"
                className="text-sm font-medium text-gray-900 dark:text-gray-100"
              >
                Email body
              </label>
            </div>
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums ${
                mainOver
                  ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700/80 dark:text-gray-300"
              }`}
            >
              {mainLen.toLocaleString()} / {MAIN_MAX.toLocaleString()}
            </span>
          </div>
          <div className="rounded-lg bg-[#456564]/5 dark:bg-[#5a7a78]/10 border border-[#456564]/15 dark:border-[#5a7a78]/25 px-3 py-2 mb-3">
            <p className="flex items-start gap-2 text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <Link2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#456564] dark:text-[#5a7a78] opacity-80" />
              <span>
                Don&apos;t add links here. The invitation URL is inserted as a
                button after this text.
              </span>
            </p>
          </div>
          {loadingDefault ? (
            <div className="flex flex-col items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400 py-10 px-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/20">
              <span className="animate-spin rounded-full h-7 w-7 border-2 border-[#456564]/30 border-t-[#456564]" />
              <span>Loading default message…</span>
            </div>
          ) : (
            <textarea
              id="invite-email-main-text"
              value={mainText}
              onChange={(e) => setMainText(e.target.value)}
              rows={7}
              className={`w-full min-h-[132px] max-h-[min(42vh,340px)] resize-y rounded-lg border bg-gray-50/80 dark:bg-gray-900/30 px-3.5 py-3 text-[13px] sm:text-sm leading-[1.58] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] dark:focus:border-[#5a7a78] focus:bg-white dark:focus:bg-gray-800 transition-colors ${
                mainOver
                  ? "border-red-300 dark:border-red-600"
                  : "border-gray-200 dark:border-gray-600"
              }`}
              maxLength={MAIN_MAX}
              disabled={busy}
              spellCheck
            />
          )}
        </div>

        {showCcField ? (
          <div className="mt-5 pt-5 border-t border-gray-200/80 dark:border-gray-700/80">
            <label
              htmlFor="invite-email-cc"
              className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5"
            >
              Carbon copy
              <span className="font-normal text-gray-500 dark:text-gray-400">
                {" "}
                · optional · super admin
              </span>
            </label>

            <div
              className={`flex w-full min-h-[2.625rem] rounded-xl border bg-white dark:bg-gray-800 overflow-hidden transition-shadow ${
                busy
                  ? "border-gray-200 dark:border-gray-600 opacity-60 pointer-events-none"
                  : "border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-[#456564]/30 focus-within:border-[#456564] dark:focus-within:border-[#5a7a78]"
              }`}
            >
              <input
                id="invite-email-cc"
                type="text"
                value={ccInput}
                onChange={(e) => setCcInput(e.target.value)}
                placeholder={
                  ccTeamPickOptions.length > 0
                    ? "Type addresses or pick someone on the team →"
                    : "agent@example.com, colleague@example.com"
                }
                className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pl-3 pr-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                disabled={busy}
                autoComplete="off"
              />
              {ccTeamPickOptions.length > 0 ? (
                <div className="relative flex shrink-0 items-stretch self-stretch border-l border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/35">
                  <select
                    key={ccSelectNonce}
                    aria-label="Add recipient from property team"
                    defaultValue=""
                    disabled={busy}
                    onChange={(e) => {
                      const v = e.target.value?.trim();
                      if (!v) return;
                      setCcInput((prev) => appendCcEmail(prev, v));
                      setCcSelectNonce((n) => n + 1);
                    }}
                    className="h-full max-w-[7.5rem] sm:max-w-[9.5rem] cursor-pointer appearance-none border-0 bg-transparent py-2 pl-2.5 pr-7 text-xs font-medium text-[#456564] dark:text-[#5a7a78] focus:outline-none focus:ring-0"
                  >
                    <option value="">Team…</option>
                    {ccTeamPickOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.value}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                    aria-hidden
                  />
                </div>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              Separate addresses with commas. The primary recipient is never
              duplicated on CC.
              {ccTeamPickOptions.length > 0
                ? " Use the team menu to insert someone already on this property."
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex flex-wrap items-center justify-end gap-3 px-6 sm:px-8 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <button
          type="button"
          onClick={() => setModalOpen(false)}
          disabled={busy}
          className="btn border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg px-4"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={
            busy || loadingDefault || mainOver || !inviteeEmail.trim()
          }
          className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white rounded-lg px-5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              Sending…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Send invitation
              <Send className="w-4 h-4" />
            </span>
          )}
        </button>
      </div>
    </ModalBlank>
  );
}

export default InviteEmailPersonalizeModal;
