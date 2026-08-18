import React from "react";
import {Navigate, useLocation} from "react-router-dom";
import {Loader2} from "lucide-react";
import {useAuth} from "../../context/AuthContext";

const DEFAULT_ALLOWED_ROLES = ["super_admin", "admin"];

/**
 * Role gate for nested authenticated routes. Chrome lives in AuthenticatedLayout.
 */
function AdminRoute({children, allowedRoles = DEFAULT_ALLOWED_ROLES}) {
  const {currentUser, isLoading, impersonation} = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[40vh]">
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

  if (currentUser.onboardingCompleted === false && !impersonation?.active) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
