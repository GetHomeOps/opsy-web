import React from "react";
import {Navigate} from "react-router-dom";
import {useAuth} from "../../context/AuthContext";

/**
 * Wraps the onboarding wizard. Requires authentication.
 * - If not logged in: redirect to signin
 * - If logged in and onboardingCompleted: redirect to dashboard
 * - Otherwise: render children (OnboardingWizard)
 */
function OnboardingRoute({children}) {
  const {currentUser, isLoading} = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  if (currentUser.onboardingCompleted !== false) {
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
