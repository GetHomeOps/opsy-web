import React from "react";
import {Navigate} from "react-router-dom";
import {Loader2} from "lucide-react";
import {PAGE_LAYOUT} from "../../constants/layout";
import useBillingStatus from "../../hooks/useBillingStatus";
import useCurrentAccount from "../../hooks/useCurrentAccount";

/**
 * Shared shell matching list-page spacing (Properties, Users, etc.).
 * Redirects agents without the Pre-Purchase plan entitlement.
 */
export default function PrePurchaseShell({children}) {
  const {currentAccount} = useCurrentAccount();
  const {limits, loading, isAdmin} = useBillingStatus();
  const accountUrl = currentAccount?.url || "";

  const allowed = isAdmin || limits?.prePurchaseEnabled === true;

  if (!isAdmin && !loading && !allowed) {
    return <Navigate to={accountUrl ? `/${accountUrl}` : "/"} replace />;
  }

  return (
            <main className="grow">
          {!isAdmin && loading ? (
            <div className="flex justify-center items-center min-h-[40vh]">
              <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
            </div>
          ) : (
            <div className={PAGE_LAYOUT.list}>{children}</div>
          )}
        </main>
      
  );
}
