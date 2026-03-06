import React from "react";

function CostAnalytics() {
  return (
    <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-9xl mx-auto">
      <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold mb-8">
        Cost Analytics
      </h1>
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Cost breakdown by category, per-account and per-user unit costs, and trends coming soon.
        </p>
      </div>
    </div>
  );
}

export default CostAnalytics;
