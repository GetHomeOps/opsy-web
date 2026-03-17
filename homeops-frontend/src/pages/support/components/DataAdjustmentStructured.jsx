import React from "react";
import { Database, ArrowRight } from "lucide-react";
import { RENTCAST_FIELD_LABELS } from "../../properties/constants/rentcastFields";
import MarkdownText from "./MarkdownText";

/**
 * Structured layout for data adjustment tickets.
 * Shows Entity, Data source, Field, Current value → Requested value, Reason.
 * Uses backend fields when available; falls back to parsing description for legacy tickets.
 */
function DataAdjustmentStructured({ ticket }) {
  const fieldKey = ticket?.dataAdjustmentField;
  const fieldLabel =
    (fieldKey && RENTCAST_FIELD_LABELS[fieldKey]) || fieldKey || "—";
  const dataSource = ticket?.dataSource || "RentCast";
  const propertyId = ticket?.propertyId;
  const currentVal = ticket?.dataAdjustmentCurrent ?? "—";
  const requestedVal = ticket?.dataAdjustmentRequested ?? "—";

  // Parse reason from description (format: **Reason:**\n...)
  let reason = "";
  const desc = ticket?.description || "";
  const reasonMatch = desc.match(/\*\*Reason:\*\*\s*\n?([\s\S]*?)(?:\n\n|$)/i);
  if (reasonMatch) reason = reasonMatch[1].trim();
  if (!reason && desc.includes("Reason:")) {
    const idx = desc.indexOf("Reason:");
    reason = desc.slice(idx + 7).trim();
  }

  const hasStructuredData =
    fieldKey || propertyId || currentVal !== "—" || requestedVal !== "—";

  const emptyVal = (v) =>
    v == null || v === "" || v === "—" || String(v).trim() === "";
  const displayCurrent = emptyVal(currentVal) ? "(empty)" : String(currentVal);
  const displayRequested = emptyVal(requestedVal) ? "—" : String(requestedVal);

  return (
    <div className="space-y-4">
      {hasStructuredData ? (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-700">
            <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Entity
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Property {propertyId || "—"}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Data Source
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-gray-400" />
                {dataSource}
              </div>
            </div>
            <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 sm:bg-transparent">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Field
              </div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {fieldLabel}
              </div>
            </div>
            <div className="p-4 sm:bg-gray-50/50 dark:sm:bg-gray-800/30">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Change
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400 line-through">
                  {displayCurrent}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {displayRequested}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {reason ? (
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Reason
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-200 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <MarkdownText>{reason}</MarkdownText>
          </div>
        </div>
      ) : null}

      {!hasStructuredData && !reason && desc ? (
        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
          <MarkdownText>{desc}</MarkdownText>
        </div>
      ) : null}
    </div>
  );
}

export default DataAdjustmentStructured;
