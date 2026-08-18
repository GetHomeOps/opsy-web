import React, {useEffect, useState} from "react";
import {Navigate, useLocation} from "react-router-dom";
import {Loader2} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import FloatingFeedbackWidget from "../../components/FloatingFeedbackWidget";
import AppChromeFallback from "../../partials/AppChromeFallback";
import {
  getBillingGateCache,
  setBillingGateCache,
} from "../../utils/billingGateCache";

function billingGateKey(userId, accountId, requiresPaid) {
  return `${userId ?? ""}:${accountId ?? ""}:${requiresPaid ? "1" : "0"}`;
}

/**
 * Wraps content that requires authentication.
 * - Redirects to /signin when user is not logged in.
 * - Passes current location as state.from for redirect-after-login (best practice).
 * - Does not render sidebar/navbar; AuthenticatedLayout owns chrome for nested routes.
 */
function ProtectedRoute({children}) {
  const {currentUser, isLoading, impersonation} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const location = useLocation();
  const accountId = currentAccount?.id || currentUser?.accounts?.[0]?.id || null;

  const path = location.pathname || "";
  const isBillingExceptionPath =
    path.includes("/billing/success") ||
    path.includes("/settings/upgrade") ||
    path.includes("/settings/billing") ||
    path === "/onboarding";

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
      if (!currentUser || !requiresPaidSubscription || isBillingExceptionPath) {
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
  }, [
    currentUser,
    requiresPaidSubscription,
    isBillingExceptionPath,
    accountId,
    gateKey,
  ]);

  if (isLoading) {
    // Auth still resolving: keep chrome if we already know the user (e.g. refresh).
    if (currentUser) return <AppChromeFallback />;
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{from: location.pathname + location.search}}
      />
    );
  }

  // Real users who haven't completed onboarding must finish first. Staff
  // impersonating them skip this gate so they can open Home and set up the
  // workspace before the invitee logs in.
  if (currentUser.onboardingCompleted === false && !impersonation?.active) {
    if (path.includes("/billing/success")) return children;
    return <Navigate to="/onboarding" replace />;
  }

  if (requiresPaidSubscription && !isBillingExceptionPath) {
    const gateReady =
      billingGate.checked &&
      !billingGate.checking &&
      billingGate.forKey === gateKey;
    if (!gateReady) {
      return <AppChromeFallback />;
    }
    if (!billingGate.active) {
      return <Navigate to="/settings/upgrade?billing_required=1" replace />;
    }
  }

  return (
    <>
      {children}
      <FloatingFeedbackWidget />
    </>
  );
}

export default ProtectedRoute;
