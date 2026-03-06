import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/**
 * Stat card for dashboard KPIs. Supports optional trend badge and loading skeleton.
 * Used by both Agent and SuperAdmin home dashboards.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  color,
  trend,
  trendDirection,
  loading,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        {!loading && trend && (
          <div
            className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-md ${
              trendDirection === "up"
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            }`}
          >
            {trendDirection === "up" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {trend}
          </div>
        )}
      </div>
      {loading ? (
        <>
          <div
            className="h-8 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"
            aria-hidden
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {label}
          </p>
          <div
            className="h-4 w-24 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mt-1"
            aria-hidden
          />
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {label}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {subtitle}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default StatCard;
