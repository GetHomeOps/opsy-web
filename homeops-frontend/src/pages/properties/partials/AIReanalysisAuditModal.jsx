import React, { useState, useEffect } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import AppApi from "../../../api/api";

/**
 * Modal showing AI reanalysis audit trail: before vs after for each reanalysis event.
 */
function AIReanalysisAuditModal({ isOpen, onClose, propertyId }) {
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !propertyId) return;
    setLoading(true);
    setError(null);
    AppApi.getPropertyAiAudit(propertyId, 20)
      .then((items) => setAudit(items ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load audit"))
      .finally(() => setLoading(false));
  }, [isOpen, propertyId]);

  if (!isOpen) return null;

  const triggerLabels = {
    document: "Document upload",
    maintenance: "Maintenance record",
    inspection: "Inspection analysis",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            AI Reanalysis History
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {loading && (
            <p className="text-sm text-neutral-500">Loading audit trail…</p>
          )}
          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}
          {!loading && !error && audit.length === 0 && (
            <p className="text-sm text-neutral-500">
              No reanalysis events yet. Updates happen when you add documents or
              maintenance records.
            </p>
          )}
          {!loading && !error &&
            audit.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const prev = entry.previous_state || {};
              const next = entry.new_state || {};
              const prevSystems = prev.updatedSystems || [];
              const nextSystems = next.updatedSystems || [];
              const prevMap = new Map(prevSystems.map((s) => [s.name, s]));
              const nextMap = new Map(nextSystems.map((s) => [s.name, s]));
              const allNames = new Set([...prevMap.keys(), ...nextMap.keys()]);
              const changed = Array.from(allNames).filter(
                (n) =>
                  (prevMap.get(n)?.condition ?? "") !==
                  (nextMap.get(n)?.condition ?? "")
              );

              return (
                <div
                  key={entry.id}
                  className="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : entry.id)
                    }
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-neutral-900 dark:text-white">
                        {triggerLabels[entry.trigger_source] ?? entry.trigger_source}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {changed.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                          {changed.length} system{changed.length !== 1 ? "s" : ""} changed
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-neutral-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                      {changed.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                            Before vs after
                          </p>
                          {changed.map((name) => (
                            <div
                              key={name}
                              className="flex items-center gap-3 text-sm"
                            >
                              <span className="w-24 font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                                {name}
                              </span>
                              <span
                                className={
                                  (prevMap.get(name)?.condition ?? "—") === "—"
                                    ? "text-neutral-400"
                                    : "text-neutral-600 dark:text-neutral-400"
                                }
                              >
                                {prevMap.get(name)?.condition ?? "—"}
                              </span>
                              <span className="text-neutral-400">→</span>
                              <span className="font-medium text-[#456564] dark:text-[#5a7a78] capitalize">
                                {nextMap.get(name)?.condition ?? "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {next.summaryDelta && (
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 italic">
                          {next.summaryDelta}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-[#456564] dark:text-[#5a7a78] hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIReanalysisAuditModal;
