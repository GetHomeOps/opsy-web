import React, {useState} from "react";
import {Loader2} from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";

/**
 * Authenticated loading shell: keeps sidebar + header visible while route
 * chunks or gate checks resolve. Use instead of a full-viewport spinner when
 * the user is already signed in.
 */
export default function AppChromeFallback() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow flex justify-center items-center">
          <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
        </main>
      </div>
    </div>
  );
}
