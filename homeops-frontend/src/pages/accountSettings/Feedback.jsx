import React from "react";

import SettingsSidebar from "../../partials/settings/SettingsSidebar";
import FeedbackPanel from "../../partials/settings/FeedbackPanel";

function Feedback() {

  return (
            <main className="grow">
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {/* Page header */}
            <div className="mb-8">
              {/* Title */}
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                Account Settings
              </h1>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-gray-800 shadow-xs rounded-xl mb-8">
              <div className="flex flex-col md:flex-row md:-mr-px">
                <SettingsSidebar />
                <FeedbackPanel />
              </div>
            </div>
          </div>
        </main>
      
  );
}

export default Feedback;
