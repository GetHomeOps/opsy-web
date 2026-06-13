import React, {useState} from "react";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import PropertyFormContainer from "./PropertyFormContainer";

function Property() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-2 sm:px-3 py-3 w-full">
            <PropertyFormContainer />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Property;
