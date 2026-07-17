import React, {useState} from "react";
import {Navigate} from "react-router-dom";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import {PAGE_LAYOUT} from "../../constants/layout";
import useBillingStatus from "../../hooks/useBillingStatus";
import useCurrentAccount from "../../hooks/useCurrentAccount";

/**
 * Shared shell matching list-page spacing (Properties, Users, etc.).
 * Redirects agents without the Pre-Purchase plan entitlement.
 */
export default function PrePurchaseShell({children}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {currentAccount} = useCurrentAccount();
  const {limits, loading, isAdmin} = useBillingStatus();
  const accountUrl = currentAccount?.url || "";

  const allowed = isAdmin || limits?.prePurchaseEnabled === true;

  if (!isAdmin && loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to={accountUrl ? `/${accountUrl}` : "/"} replace />;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className={PAGE_LAYOUT.list}>{children}</div>
        </main>
      </div>
    </div>
  );
}
