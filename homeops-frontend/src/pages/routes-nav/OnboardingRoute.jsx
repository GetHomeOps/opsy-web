import React, {useEffect, useState} from "react";
import {Navigate} from "react-router-dom";
import {Loader2} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {
  getBillingGateCache,
  setBillingGateCache,
} from "../../utils/billingGateCache";

function billingGateKey(userId, accountId, requiresPaid) {
  return `${userId ?? ""}:${accountId ?? ""}:${requiresPaid ? "1" : "0"}`;
}

/**
 * Wraps the onboarding wizard. Requires authentication.
 * - If not logged in: redirect to signin
 * - If logged in and onboardingCompleted: redirect to dashboard
 * - Otherwise: render children (OnboardingWizard)
 */
function OnboardingRoute({children}) {
  const {currentUser, isLoading} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const accountId = currentAccount?.id || currentUser?.accounts?.[0]?.id || null;

  const requiresPaidSubscription =
    !!currentUser &&
    currentUser.onboardingCompleted !== false &&
    !["super_admin", "admin"].includes(currentUser.role) &&
    ((currentUser.role === "agent" &&
      !["free", "agent_beta"].includes(currentUser.subscriptionTier || "")) ||
      (currentUser.role === "homeowner" &&
        currentUser.subscriptionTier &&
        !["free", "homeowner_beta", "beta_homeowner"].includes(
          currentUser.subscriptionTier,
        )));

  const gateKey = billingGateKey(
    currentUser?.id,
    accountId,
    requiresPaidSubscription,
  );

  const [billingGate, setBillingGate] = useState(() => {
    const cached = getBillingGateCache(accountId, currentUser?.id);
    if (cached) {
      return {
        checking: false,
        checked: true,
        active: cached.active,
        forKey: gateKey,
      };
    }
    return {checking: false, checked: false, active: true, forKey: null};
  });

  useEffect(() => {
    let cancelled = false;
    async function checkBillingGate() {
      if (!requiresPaidSubscription) {
        if (!cancelled) {
          setBillingGate({
            checking: false,
            checked: true,
            active: true,
            forKey: gateKey,
          });
        }
        return;
      }

      const cached = getBillingGateCache(accountId, currentUser?.id);
      if (cached) {
        if (!cancelled) {
          setBillingGate({
            checking: false,
            checked: true,
            active: cached.active,
            forKey: gateKey,
          });
        }
        return;
      }

      if (!cancelled) {
        setBillingGate({
          checking: true,
          checked: false,
          active: false,
          forKey: null,
        });
      }
      try {
        const res = await AppApi.getBillingStatus(accountId);
        const status = res?.subscription?.status;
        const active = status === "active" || status === "trialing";
        setBillingGateCache(accountId, active, currentUser?.id);
        if (!cancelled) {
          setBillingGate({
            checking: false,
            checked: true,
            active,
            forKey: gateKey,
          });
        }
      } catch {
        setBillingGateCache(accountId, false, currentUser?.id);
        if (!cancelled) {
          setBillingGate({
            checking: false,
            checked: true,
            active: false,
            forKey: gateKey,
          });
        }
      }
    }
    checkBillingGate();
    return () => {
      cancelled = true;
    };
  }, [requiresPaidSubscription, accountId, gateKey, currentUser?.id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  if (currentUser.onboardingCompleted !== false) {
    if (requiresPaidSubscription) {
      const gateReady =
        billingGate.checked &&
        !billingGate.checking &&
        billingGate.forKey === gateKey;
      if (!gateReady) {
        return (
          <div className="flex justify-center items-center h-screen">
            <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
          </div>
        );
      }
      if (!billingGate.active) {
        return <Navigate to="/settings/upgrade?billing_required=1" replace />;
      }
    }

    const accountUrl =
      currentUser?.accounts?.[0]?.url?.replace(/^\/+/, "") ||
      currentUser?.accounts?.[0]?.name;
    if (accountUrl) {
      return <Navigate to={`/${accountUrl}/home`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

export default OnboardingRoute;
