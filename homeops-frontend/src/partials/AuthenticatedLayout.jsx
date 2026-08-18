import React, {Suspense, useState} from "react";
import {Outlet, useLocation} from "react-router-dom";
import {Loader2} from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";

function ContentFallback() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[40vh]">
      <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
    </div>
  );
}

/**
 * Persistent authenticated chrome. Sidebar and header stay mounted across
 * route changes so nav scroll and drawer state are not reset.
 */
export default function AuthenticatedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {pathname} = useLocation();
  const variant = pathname.includes("/homeowner-messages") ? "v2" : "default";

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        variant={variant}
      />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          variant={variant === "v2" ? "v2" : "default"}
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <Suspense fallback={<ContentFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
