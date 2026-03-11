import React from "react";
import AdminRoute from "./AdminRoute";

/**
 * Wraps routes that require super_admin role only.
 * Blocks agent, homeowner, and admin users — redirects to home.
 */
function SuperAdminRoute({ children }) {
  return <AdminRoute allowedRoles={["super_admin"]}>{children}</AdminRoute>;
}

export default SuperAdminRoute;
