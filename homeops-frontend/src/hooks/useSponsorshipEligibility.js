import { useCallback, useEffect, useState } from "react";
import AppApi from "../api/api";
import { useAuth } from "../context/AuthContext";
import useCurrentAccount from "./useCurrentAccount";
import { clearSponsorshipIconDismissal } from "../components/SponsorshipOfferWatcher";

/**
 * Lightweight hook exposing whether the current homeowner is eligible to have their
 * agent cover their property's billing, and which property that is. Used to surface a
 * small "agent can cover this" marker on the property and entry points to the offer.
 *
 * Returns null eligibility unless the homeowner is genuinely eligible and not already
 * a beneficiary (so the marker only shows when the offer can actually be taken).
 */
export default function useSponsorshipEligibility() {
  const { currentUser } = useAuth();
  const { currentAccount } = useCurrentAccount();
  const accountId = currentAccount?.id;
  const isHomeowner = (currentUser?.role || "").toLowerCase() === "homeowner";
  const [eligibility, setEligibility] = useState(null);

  const refresh = useCallback(async () => {
    if (!accountId || !isHomeowner) {
      setEligibility(null);
      return;
    }
    try {
      const res = await AppApi.getSponsorshipEligibility(accountId);
      if (res?.eligibility?.eligible && !res?.asBeneficiary) {
        setEligibility(res.eligibility);
      } else {
        setEligibility(null);
        /* No active eligibility episode (no qualifying agent, already sponsored,
           etc.) — forget any persisted hero-icon dismissal so a future eligibility
           (e.g. a newly confirmed agent) surfaces the icon fresh. */
        clearSponsorshipIconDismissal(accountId);
      }
    } catch {
      setEligibility(null);
    }
  }, [accountId, isHomeowner]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("opsy:property-team-changed", handler);
    window.addEventListener("plans-updated", handler);
    return () => {
      window.removeEventListener("opsy:property-team-changed", handler);
      window.removeEventListener("plans-updated", handler);
    };
  }, [refresh]);

  const eligiblePropertyUid = eligibility?.property?.uid
    ? String(eligibility.property.uid)
    : null;

  return { eligibility, eligiblePropertyUid, refresh };
}
