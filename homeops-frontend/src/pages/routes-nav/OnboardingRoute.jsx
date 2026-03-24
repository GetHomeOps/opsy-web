import React, {useEffect, useState} from "react";
import {Navigate} from "react-router-dom";
import {Loader2} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";

/**
 * Wraps the onboarding wizard. Requires authentication.
 * - If not logged in: redirect to signin
 * - If logged in and onboardingCompleted: redirect to dashboard
 * - Otherwise: render children (OnboardingWizard)
 */
function OnboardingRoute({children}) {
  const {currentUser, isLoading} = useAuth();
  const [billingGate, setBillingGate] = useState({checking: false, checked: false, active: true});

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
      if (!requiresPaidSubscription) {
        if (!cancelled) {
          setBillingGate({checking: false, checked: true, active: true});
        }
        return;
      }
      if (!cancelled) {
        setBillingGate({checking: true, checked: false, active: false});
      }
      try {
        const res = await AppApi.getBillingStatus();
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
  }, [requiresPaidSubscription]);

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
