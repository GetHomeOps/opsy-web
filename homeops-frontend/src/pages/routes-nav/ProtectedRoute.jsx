import React, {useEffect, useState} from "react";
import {Navigate, useLocation} from "react-router-dom";
import {Loader2} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import FloatingFeedbackWidget from "../../components/FloatingFeedbackWidget";

/**
 * Wraps content that requires authentication.
 * - Redirects to /signin when user is not logged in.
 * - Passes current location as state.from for redirect-after-login (best practice).
 * - Does not render sidebar/navbar; those are rendered by each page only when mounted (authenticated).
 */
function ProtectedRoute({children}) {
  const {currentUser, isLoading} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const location = useLocation();
  const [billingGate, setBillingGate] = useState({checking: false, checked: false, active: true});
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
    (currentUser.role === "agent" ||
      (currentUser.role === "homeowner" &&
        currentUser.subscriptionTier &&
        currentUser.subscriptionTier !== "free"));

  useEffect(() => {
    let cancelled = false;

    async function checkBillingGate() {
      if (!currentUser || !requiresPaidSubscription || isBillingExceptionPath) {
        if (!cancelled) {
          setBillingGate({checking: false, checked: true, active: true});
        }
        return;
      }

      if (!cancelled) {
        setBillingGate({checking: true, checked: false, active: false});
      }

      try {
        const res = await AppApi.getBillingStatus(accountId);
        const status = res?.subscription?.status;
        const active = status === "active" || status === "trialing";
        if (!cancelled) {
          setBillingGate({checking: false, checked: true, active});
        }
      } catch {
        if (!cancelled) {
          setBillingGate({checking: false, checked: true, active: false});
        }
      }
    }

    checkBillingGate();
    return () => {
      cancelled = true;
    };
  }, [currentUser, requiresPaidSubscription, isBillingExceptionPath, accountId]);

  if (isLoading) {
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

  // Users who haven't completed onboarding must finish first (except billing/success - return from Stripe)
  if (currentUser.onboardingCompleted === false) {
    const path = location.pathname || "";
    if (path.includes("/billing/success")) return children;
    return <Navigate to="/onboarding" replace />;
  }

  if (requiresPaidSubscription && !isBillingExceptionPath) {
    if (!billingGate.checked || billingGate.checking) {
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

  return (
    <>
      {children}
      <FloatingFeedbackWidget />
    </>
  );
}

export default ProtectedRoute;
