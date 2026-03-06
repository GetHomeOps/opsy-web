import React from "react";

function DashboardOverview() {
  return (
    <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-9xl mx-auto">
      <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold mb-8">
        Dashboard Overview
      </h1>
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Platform overview with KPIs, cost analytics, and growth metrics coming soon.
        </p>
      </div>
    </div>
  );
}

export default DashboardOverview;
