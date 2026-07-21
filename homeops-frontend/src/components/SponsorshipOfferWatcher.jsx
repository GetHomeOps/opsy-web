import React, {useCallback, useEffect, useRef, useState} from "react";
import {ShieldCheck, X} from "lucide-react";
import AppApi from "../api/api";
import {useAuth} from "../context/AuthContext";
import {useAccountBranding} from "../context/AccountBrandingContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import SponsorshipOfferModal from "../pages/settings/partials/SponsorshipOfferModal";

/**
 * Global watcher that proactively prompts a homeowner to let their agent cover
 * their property the moment they become eligible (e.g. right after an agent joins
 * the team). Eligibility flips to true once a qualifying agent is on the property,
 * so this listens for team changes and account switches in addition to first load.
 *
 * When an agent is present but cannot cover the property (no capacity / no plan),
 * a one-off informational toast is shown right after the team change so the
 * homeowner understands why the offer didn't appear.
 */

const SNOOZE_PREFIX = "opsy-sponsorship-offer-dismissed:";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const NOTICE_AUTO_DISMISS_MS = 9000;

function snoozeKeyFor(accountId) {
  return accountId ? `${SNOOZE_PREFIX}${accountId}` : null;
}

export function isSponsorshipOfferSnoozed(accountId) {
  const key = snoozeKeyFor(accountId);
  if (!key) return false;
  try {
    return Number(localStorage.getItem(key) || 0) > Date.now();
  } catch {
    return false;
  }
}

export function snoozeSponsorshipOffer(accountId) {
  const key = snoozeKeyFor(accountId);
  if (!key) return;
  try {
    localStorage.setItem(key, String(Date.now() + SNOOZE_MS));
    window.dispatchEvent(
      new CustomEvent("opsy:sponsorship-offer-snoozed", {
        detail: {accountId},
      }),
    );
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Persistent dismissal for the passive hero "agent can cover this" icon, scoped to the
 * current eligibility episode. Unlike the time-based snooze (which suppresses the
 * auto-popup), this persists across navigation but is cleared the moment the homeowner
 * stops being eligible — so when a new (or re-confirmed) agent makes them eligible
 * again, the icon resurfaces fresh.
 */
const ICON_DISMISS_PREFIX = "opsy-sponsorship-icon-dismissed:";

function iconDismissKeyFor(accountId) {
  return accountId ? `${ICON_DISMISS_PREFIX}${accountId}` : null;
}

export function isSponsorshipIconDismissed(accountId) {
  const key = iconDismissKeyFor(accountId);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function dismissSponsorshipIcon(accountId) {
  const key = iconDismissKeyFor(accountId);
  if (!key) return;
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore storage errors */
  }
}

export function clearSponsorshipIconDismissal(accountId) {
  const key = iconDismissKeyFor(accountId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore storage errors */
  }
}

export default function SponsorshipOfferWatcher() {
  const {currentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const {refreshBranding} = useAccountBranding();
  const accountId = currentAccount?.id;
  const role = (currentUser?.role || "").toLowerCase();
  const isHomeowner = role === "homeowner";

  const [eligibility, setEligibility] = useState(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const noticeTimerRef = useRef(null);
  const checkedAccountRef = useRef(null);

  const clearNoticeTimer = useCallback(() => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  const showNotice = useCallback(
    (text) => {
      setNoticeText(text);
      clearNoticeTimer();
      noticeTimerRef.current = setTimeout(() => setNoticeText(""), NOTICE_AUTO_DISMISS_MS);
    },
    [clearNoticeTimer],
  );

  const check = useCallback(
    async ({fromTeamChange = false} = {}) => {
      if (!accountId || !isHomeowner) return;
      try {
        const res = await AppApi.getSponsorshipEligibility(accountId);
        const elig = res?.eligibility || null;
        const beneficiary = res?.asBeneficiary || null;
        setEligibility(elig);

        // Already covered or scheduled — nothing to prompt.
        if (beneficiary) return;

        if (elig?.eligible) {
          if (!isSponsorshipOfferSnoozed(accountId)) setOfferOpen(true);
          return;
        }

        // Contextual heads-up only when the homeowner just changed the team and
        // the reason relates to the agent's capacity.
        if (fromTeamChange && elig?.reason) {
          if (elig.reason === "agent_limit_reached") {
            showNotice(
              "Your agent doesn't have room on their plan to cover this property right now. You can ask them to upgrade, or keep your current plan.",
            );
          } else if (elig.reason === "agent_no_plan") {
            showNotice(
              "Your agent doesn't have an active plan to cover this property yet. You can ask them to subscribe, or keep your current plan.",
            );
          }
        }
      } catch {
        /* eligibility is best-effort; ignore failures */
      }
    },
    [accountId, isHomeowner, showNotice],
  );

  // First load and whenever the active account changes.
  useEffect(() => {
    if (!accountId || !isHomeowner) return;
    if (checkedAccountRef.current === accountId) return;
    checkedAccountRef.current = accountId;
    check();
  }, [accountId, isHomeowner, check]);

  // Re-check after a property team change (e.g. an agent was just added).
  useEffect(() => {
    if (!isHomeowner) return undefined;
    const onTeamChange = () => check({fromTeamChange: true});
    window.addEventListener("opsy:property-team-changed", onTeamChange);
    return () => window.removeEventListener("opsy:property-team-changed", onTeamChange);
  }, [isHomeowner, check]);

  useEffect(() => () => clearNoticeTimer(), [clearNoticeTimer]);

  const handleConfirm = useCallback(async () => {
    const result = await AppApi.acceptSponsorship({accountId});
    setOfferOpen(false);
    window.dispatchEvent(new CustomEvent("plans-updated"));
    if (result?.activated) {
      await refreshBranding();
    }
  }, [accountId, refreshBranding]);

  const handleClose = useCallback(() => {
    setOfferOpen(false);
  }, []);

  const handleDismiss = useCallback(() => {
    setOfferOpen(false);
    snoozeSponsorshipOffer(accountId);
  }, [accountId]);

  if (!isHomeowner) return null;

  return (
    <>
      <SponsorshipOfferModal
        open={offerOpen}
        eligibility={eligibility}
        onConfirm={handleConfirm}
        onClose={handleClose}
        onDismiss={handleDismiss}
      />

      {noticeText && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] w-full max-w-lg px-4">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-gray-900/90 dark:bg-black/85 backdrop-blur-md shadow-2xl px-4 py-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Agent coverage</p>
              <p className="text-xs text-gray-300 mt-0.5 leading-relaxed">
                {noticeText}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearNoticeTimer();
                setNoticeText("");
              }}
              className="text-gray-500 hover:text-gray-300 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
