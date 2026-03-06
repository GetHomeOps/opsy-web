import React from "react";
import {Navigate, useLocation} from "react-router-dom";
import {useAuth} from "../../context/AuthContext";

/**
 * Wraps content that requires authentication.
 * - Redirects to /signin when user is not logged in.
 * - Passes current location as state.from for redirect-after-login (best practice).
 * - Does not render sidebar/navbar; those are rendered by each page only when mounted (authenticated).
 */
function ProtectedRoute({children}) {
  const {currentUser, isLoading} = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
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

  return children;
}

export default ProtectedRoute;
