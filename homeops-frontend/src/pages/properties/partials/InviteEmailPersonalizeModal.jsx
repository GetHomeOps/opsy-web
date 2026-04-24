import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {createPortal} from "react-dom";
import {Mail, Send, AlertCircle, Link2, ChevronDown, X} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import AppApi from "../../../api/api";
import useSuppressBrowserAddressAutofill from "../../../hooks/useSuppressBrowserAddressAutofill";

const MAIN_MAX = 10000;

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function parseCcPills(value) {
  const s = value ?? "";
  const endsWithSep = /[,;]\s*$/.test(s);
  const parts = s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
  if (parts.length === 0) {
    return {chips: [], draft: ""};
  }
  const last = parts[parts.length - 1];
  const leading = parts.slice(0, -1);

  if (!endsWithSep) {
    if (!EMAIL_REGEX.test(last)) {
      return {chips: leading, draft: last};
    }
    return {chips: parts, draft: ""};
  }
  return {chips: parts, draft: ""};
}

function serializeCcPills(chips, draft) {
  const c = chips.map((x) => x.trim()).filter(Boolean);
  const d = (draft ?? "").trim();
  if (c.length === 0) return d;
  if (!d) return c.join(", ");
  return `${c.join(", ")}, ${d}`;
}

function ccLabelForEmail(email, options) {
  const lower = (email || "").trim().toLowerCase();
  const o = (options || []).find(
    (x) => (x.value || "").trim().toLowerCase() === lower,
  );
  const lab = (o?.label || "").trim();
  return lab || email;
}

/** Google Docs–style CC: removable pills + inline draft; optional team picker. */
function CcPillsField({
  id,
  value,
  onChange,
  options = [],
  disabled,
  placeholder,
  anchorOpen = true,
  listBoxRef = null,
}) {
  const bindCcInput = useSuppressBrowserAddressAutofill("invite-email-cc-pills");
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const dropdownRef = useRef(null);

  const {chips, draft} = useMemo(() => parseCcPills(value), [value]);
  const hasPicker = options.length > 0;

  const filterTerm = useMemo(() => {
    const d = draft.trim();
    if (!d || EMAIL_REGEX.test(d)) return "";
    return d.toLowerCase();
  }, [draft]);

  const selectedEmails = useMemo(() => {
    const set = new Set();
    for (const c of chips) {
      const t = c.trim().toLowerCase();
      if (t) set.add(t);
    }
    return set;
  }, [chips]);

  const filteredOptions = useMemo(() => {
    if (!hasPicker) return [];
    const available = options.filter(
      (opt) => !selectedEmails.has((opt.value || "").trim().toLowerCase()),
    );
    if (!filterTerm) return available;
    return available.filter((opt) => {
      const em = (opt.value || "").toLowerCase();
      const lab = (opt.label || "").toLowerCase();
      return em.includes(filterTerm) || lab.includes(filterTerm);
    });
  }, [options, filterTerm, selectedEmails, hasPicker]);

  const pushChip = useCallback(
    (emailRaw) => {
      const email = (emailRaw || "").trim();
      if (!email || !EMAIL_REGEX.test(email)) return;
      const lower = email.toLowerCase();
      if (chips.some((c) => c.toLowerCase() === lower)) return;
      onChange(serializeCcPills([...chips, email], ""));
    },
    [chips, onChange],
  );

  const handleSelect = useCallback(
    (opt) => {
      const email = opt?.value?.trim();
      if (!email) return;
      pushChip(email);
      setIsOpen(true);
      setHighlightIndex(-1);
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [pushChip],
  );

  const removeChip = useCallback(
    (idx) => {
      const next = chips.filter((_, i) => i !== idx);
      onChange(serializeCcPills(next, draft));
    },
    [chips, draft, onChange],
  );

  const onDraftChange = useCallback(
    (text) => {
      if (text.includes(",") || text.includes(";")) {
        const segs = text.split(/[,;]+/).map((x) => x.trim());
        const nextChips = [...chips];
        let remainder = "";
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          if (i < segs.length - 1) {
            if (EMAIL_REGEX.test(seg)) {
              const lo = seg.toLowerCase();
              if (!nextChips.some((c) => c.toLowerCase() === lo)) {
                nextChips.push(seg);
              }
            }
          } else {
            remainder = seg;
          }
        }
        onChange(serializeCcPills(nextChips, remainder));
        return;
      }
      onChange(serializeCcPills(chips, text));
    },
    [chips, onChange],
  );

  useEffect(() => {
    setHighlightIndex(-1);
  }, [filterTerm, draft]);

  useEffect(() => {
    if (!anchorOpen) setIsOpen(false);
  }, [anchorOpen]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target))
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen, chips.length, draft]);

  const handleInputKeyDown = (e) => {
    if (disabled) return;

    if (e.key === "Backspace" && draft === "" && chips.length > 0) {
      onChange(serializeCcPills(chips.slice(0, -1), ""));
      e.preventDefault();
      return;
    }

    if (
      !isOpen &&
      e.key === "Enter" &&
      EMAIL_REGEX.test(draft.trim()) &&
      !chips.some((c) => c.toLowerCase() === draft.trim().toLowerCase())
    ) {
      pushChip(draft);
      e.preventDefault();
      return;
    }

    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      if (hasPicker && filteredOptions.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (!isOpen) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightIndex(-1);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      setHighlightIndex((i) =>
        i < filteredOptions.length - 1 ? i + 1 : i,
      );
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      setHighlightIndex((i) => (i > 0 ? i - 1 : -1));
      e.preventDefault();
      return;
    }
    if (
      e.key === "Enter" &&
      highlightIndex >= 0 &&
      filteredOptions[highlightIndex]
    ) {
      handleSelect(filteredOptions[highlightIndex]);
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[role='option']");
      items[highlightIndex]?.scrollIntoView({block: "nearest"});
    }
  }, [highlightIndex]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={`flex min-h-[2.625rem] w-full flex-wrap items-center gap-1.5 py-1.5 pl-2 pr-8 ${
          disabled ? "cursor-not-allowed" : "cursor-text"
        }`}
        onMouseDown={(e) => {
          if (disabled) return;
          const clickedPillControl =
            e.target instanceof HTMLElement && e.target.closest("button");
          if (clickedPillControl) return;
          if (e.target !== inputRef.current) {
            e.preventDefault();
            inputRef.current?.focus();
          }
          if (hasPicker) setIsOpen(true);
        }}
        role="presentation"
      >
        {chips.map((email, idx) => {
          const label = ccLabelForEmail(email, options);
          const initial = (label || email).charAt(0).toUpperCase();
          return (
            <span
              key={`${email}-${idx}`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-100 py-0.5 pl-0.5 pr-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700/90 dark:text-gray-100"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#456564] text-[11px] font-semibold text-white dark:bg-[#5a7a78]"
                aria-hidden
              >
                {initial}
              </span>
              <span className="min-w-0 max-w-[200px] truncate px-0.5" title={email}>
                {label}
              </span>
              <button
                type="button"
                disabled={disabled}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                aria-label={`Remove ${email}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => removeChip(idx)}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          {...bindCcInput({
            id,
            type: "text",
            value: draft,
            onChange: (e) => {
              onDraftChange(e.target.value);
              if (hasPicker) setIsOpen(true);
            },
            onKeyDown: handleInputKeyDown,
            onFocus: () => {
              if (!disabled && hasPicker) setIsOpen(true);
            },
            onClick: () => {
              if (!disabled && hasPicker) setIsOpen(true);
            },
            placeholder: chips.length ? "" : placeholder,
            disabled,
            "aria-label": "Add CC recipients",
            className:
              "min-w-[12rem] flex-1 border-0 bg-transparent py-1 pl-1 pr-0 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100",
          })}
        />
      </div>
      {hasPicker ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={isOpen ? "Close team list" : "Open team list"}
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            if (disabled) return;
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none dark:text-gray-500 dark:hover:text-gray-300"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>
      ) : null}
      {isOpen &&
        anchorOpen &&
        !disabled &&
        dropdownPosition &&
        hasPicker &&
        createPortal(
          <ul
            ref={(el) => {
              listRef.current = el;
              dropdownRef.current = el;
              if (listBoxRef) listBoxRef.current = el;
            }}
            className="fixed z-[250] max-h-64 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            role="listbox"
            aria-label="Property team for CC"
            style={{
              top: dropdownPosition.top + 4,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {filteredOptions.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {options.length > 0 &&
                options.every((opt) =>
                  selectedEmails.has((opt.value || "").trim().toLowerCase()),
                )
                  ? "Everyone on this property is already on CC."
                  : "No matching team members."}
              </li>
            ) : (
              filteredOptions.map((opt, flatIdx) => {
                const isHighlighted = highlightIndex === flatIdx;
                const imgUrl =
                  opt.image_url || opt.avatarUrl || opt.avatar_url || null;
                const initial = (
                  (opt.label || opt.value || "?").charAt(0) || "?"
                ).toUpperCase();
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isHighlighted}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 ${
                      isHighlighted
                        ? "bg-[#456564]/10 dark:bg-[#5a7a78]/20"
                        : "text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700/50"
                    }`}
                    onMouseEnter={() => setHighlightIndex(flatIdx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt);
                    }}
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#456564] text-xs font-semibold text-white dark:bg-[#5a7a78]"
                        aria-hidden
                      >
                        {initial}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          isHighlighted
                            ? "text-[#456564] dark:text-[#5a7a78]"
                            : "text-gray-900 dark:text-gray-100"
                        }`}
                      >
                        {opt.label || opt.value}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {opt.value}
                      </p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}

/**
 * Modal to edit the main text of the property invitation email (and optional CC when allowed).
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
  const [loadingDefault, setLoadingDefault] = useState(false);
  const [loadError, setLoadError] = useState("");
  const ccDropdownListRef = useRef(null);

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
      ignoreClickRefs={[ccDropdownListRef]}
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
          <p className="flex items-start gap-2 text-[11px] sm:text-xs text-[#456564] dark:text-[#5a7a78] leading-relaxed mb-3">
            <Link2 className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-90" aria-hidden />
            <span>
              Don&apos;t add links here. The invitation URL is inserted as a
              button after this text.
            </span>
          </p>
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
            <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
              Carbon copy
              <span className="font-normal text-gray-500 dark:text-gray-400">
                {" "}
                · optional
              </span>
            </label>

            <div
              className={`w-full min-h-[2.625rem] rounded-xl border bg-white dark:bg-gray-800 overflow-visible transition-shadow ${
                busy
                  ? "border-gray-200 dark:border-gray-600 opacity-60 pointer-events-none"
                  : "border-gray-200 dark:border-gray-600 focus-within:ring-2 focus-within:ring-[#456564]/30 focus-within:border-[#456564] dark:focus-within:border-[#5a7a78]"
              }`}
            >
              <CcPillsField
                id="invite-email-cc"
                value={ccInput}
                onChange={setCcInput}
                options={ccTeamPickOptions}
                disabled={busy}
                anchorOpen={modalOpen}
                listBoxRef={ccDropdownListRef}
                placeholder={
                  ccTeamPickOptions.length > 0
                    ? "Add email or search team…"
                    : "Type an email, then comma or Enter to add…"
                }
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              Each address appears as a pill—use × to remove. The primary
              recipient is never duplicated on CC.
              {ccTeamPickOptions.length > 0
                ? " Focus the field to search people on this property."
                : " Press Enter after a full email, or separate with commas."}
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
