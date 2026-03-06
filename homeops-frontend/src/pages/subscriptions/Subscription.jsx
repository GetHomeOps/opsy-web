import React, {useState} from "react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";

import SubscriptionFormContainer from "./SubscriptionFormContainer";

function Subscription() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Site header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-5xl mx-auto">
            {/* Form */}
            <SubscriptionFormContainer />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Subscription;
