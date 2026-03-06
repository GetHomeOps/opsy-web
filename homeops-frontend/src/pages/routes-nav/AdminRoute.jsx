import React from "react";
import {Navigate, useLocation} from "react-router-dom";
import {useAuth} from "../../context/AuthContext";

const DEFAULT_ALLOWED_ROLES = ["super_admin", "admin"];

/**
 * Wraps routes that require admin-level access.
 * - Redirects to /signin if not authenticated.
 * - Redirects to home if authenticated but lacking the required role.
 */
function AdminRoute({children, allowedRoles = DEFAULT_ALLOWED_ROLES}) {
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

  if (currentUser.onboardingCompleted === false) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
