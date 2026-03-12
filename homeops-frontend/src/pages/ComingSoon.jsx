import React, {useState} from "react";

import Sidebar from "../partials/Sidebar";
import Header from "../partials/Header";
import {Sparkles} from "lucide-react";

function ComingSoon() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-16 h-16 rounded-full bg-[#456564]/10 flex items-center justify-center mb-6">
                <Sparkles
                  className="w-8 h-8 text-[#456564]"
                  strokeWidth={1.5}
                />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Coming Soon
              </h1>
              <p className="text-gray-600 dark:text-gray-400 max-w-md leading-relaxed">
                These features are currently under development and will be
                available soon.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ComingSoon;
