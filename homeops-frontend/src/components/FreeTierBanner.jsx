import React, {useEffect, useState} from "react";
import {Link} from "react-router-dom";
import {Info, X} from "lucide-react";
import useBillingStatus from "../hooks/useBillingStatus";
import useCurrentAccount from "../hooks/useCurrentAccount";
import {useAuth} from "../context/AuthContext";

export const FREE_TIER_BANNER_DISMISS_PREFIX = "opsy-free-tier-banner-dismissed:";

const FREE_PLAN_CODES = ["homeowner_free", "agent_free", "free"];

function dismissKey(accountId) {
  return `${FREE_TIER_BANNER_DISMISS_PREFIX}${accountId || "default"}`;
}

function readDismissed(accountId) {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(dismissKey(accountId)) === "1";
  } catch {
    return false;
  }
}

/** Clear free-tier banner dismiss flags so the banner shows again after login. */
export function clearFreeTierBannerDismissals() {
  if (typeof sessionStorage === "undefined") return;
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(FREE_TIER_BANNER_DISMISS_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Full-width free-tier notice under the header stack.
 * Dismissible until next login (sessionStorage, scoped by account).
 */
export default function FreeTierBanner() {
  const {currentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const {plan, loading, isAdmin} = useBillingStatus();
  const accountId = currentAccount?.id;
  const accountUrl = currentAccount?.url || "";

  const [dismissed, setDismissed] = useState(() => readDismissed(accountId));

  useEffect(() => {
    setDismissed(readDismissed(accountId));
  }, [accountId]);

  const isFreeByPlanCode = !!plan?.code && FREE_PLAN_CODES.includes(plan.code);
  const isFreeByTier = currentUser?.subscriptionTier === "free";
  /* Tier can show immediately; plan.code waits for billing/status. */
  const isFreePlan =
    !isAdmin && (isFreeByTier || (!loading && isFreeByPlanCode));

  if (!isFreePlan || dismissed) return null;

  const upgradePath = accountUrl
    ? `/${accountUrl}/settings/upgrade`
    : "/settings/upgrade";

  const handleDismiss = () => {
    setDismissed(true);
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(dismissKey(accountId), "1");
      }
    } catch {
      /* ignore quota / private mode */
    }
  };

  return (
    <div
      role="status"
      className="relative bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800/60 px-10 sm:px-12 py-2 text-sm text-sky-950 dark:text-sky-100"
    >
      <div className="flex items-center justify-center gap-2 flex-wrap text-center">
        <Info className="w-4 h-4 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden />
        <span>
          You are on the Free tier.{" "}
          <Link
            to={upgradePath}
            className="font-semibold text-sky-800 dark:text-sky-200 underline underline-offset-2 hover:text-sky-950 dark:hover:text-white"
          >
            Upgrade your plan
          </Link>{" "}
          to unlock AI-powered features and Opsy Scout.
        </span>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1 rounded text-sky-700/80 hover:text-sky-950 dark:text-sky-300 dark:hover:text-white hover:bg-sky-100/80 dark:hover:bg-sky-900/50"
        aria-label="Dismiss free tier notice"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
