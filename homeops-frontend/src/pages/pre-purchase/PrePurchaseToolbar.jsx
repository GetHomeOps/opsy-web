import React, {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import {
  Download,
  Home,
  Loader2,
  MonitorPlay,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";
import Transition from "../../utils/Transition";

/**
 * Properties-style top bar for a pre-purchase analysis:
 * Back | Actions gear | New | prev/next pager
 */
export default function PrePurchaseToolbar({
  accountUrl,
  analysisIds = [],
  currentId,
  propertyId,
  viewPropertyPath,
  hasAddress,
  hasDocuments,
  canStartAnalysis,
  converting = false,
  starting = false,
  downloadingReport = false,
  onConvertToProperty,
  onStartOrRefreshAnalysis,
  onPresentationMode,
  onDownloadReport,
  analysisStatus,
}) {
  const navigate = useNavigate();
  const [actionsOpen, setActionsOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!actionsOpen) return undefined;
    function onDocClick(e) {
      if (
        dropdownRef.current?.contains(e.target) ||
        triggerRef.current?.contains(e.target)
      ) {
        return;
      }
      setActionsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [actionsOpen]);

  const ids = analysisIds.map(String);
  const current = String(currentId);
  const index = ids.indexOf(current);
  const total = ids.length || 1;
  const displayIndex = index >= 0 ? index + 1 : 1;
  const prevId = index > 0 ? ids[index - 1] : null;
  const nextId = index >= 0 && index < ids.length - 1 ? ids[index + 1] : null;

  const startLabel =
    analysisStatus === "completed" ? "Refresh analysis" : "Start analysis";
  const resultsReady = analysisStatus === "completed";

  return (
    <div className="flex justify-between items-center gap-3 mb-3">
      <button
        type="button"
        className="btn text-neutral-500 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100 mb-2 pl-0 focus:outline-none shadow-none"
        onClick={() => navigate(`/${accountUrl}/pre-purchase`)}
      >
        <svg
          className="fill-current shrink-0 mr-1"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          aria-hidden
        >
          <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z" />
        </svg>
        <span className="text-lg">Opsy Scout</span>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative inline-flex">
          <button
            ref={triggerRef}
            type="button"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-500 dark:text-neutral-400 transition-colors"
            aria-haspopup="true"
            aria-expanded={actionsOpen}
            onClick={() => setActionsOpen((o) => !o)}
          >
            <span className="sr-only">Actions</span>
            <Settings className="w-4 h-4" />
          </button>
          <Transition
            show={actionsOpen}
            tag="div"
            className="origin-top-right z-10 absolute top-full left-0 right-auto min-w-56 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/50 pt-1.5 rounded-xl overflow-hidden mt-1 md:left-auto md:right-0"
            style={{
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            }}
            enter="transition ease-out duration-200 transform"
            enterStart="opacity-0 -translate-y-2"
            enterEnd="opacity-100 translate-y-0"
            leave="transition ease-out duration-200"
            leaveStart="opacity-100"
            leaveEnd="opacity-0"
          >
            <div ref={dropdownRef}>
              <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider pt-1.5 pb-2 px-3">
                Actions
              </div>
              <ul className="mb-1">
                <li>
                  {propertyId ? (
                    <button
                      type="button"
                      disabled={converting}
                      className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        setActionsOpen(false);
                        // Re-hit convert (idempotent) so missing inspection docs can be migrated.
                        onConvertToProperty?.();
                      }}
                    >
                      {converting ? (
                        <Loader2 className="w-5 h-5 shrink-0 animate-spin text-neutral-500" />
                      ) : (
                        <Home className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                      )}
                      <span className="text-sm font-medium ml-2">
                        {converting ? "Opening…" : "View property"}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!hasAddress || converting}
                      className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => {
                        setActionsOpen(false);
                        onConvertToProperty?.();
                      }}
                    >
                      {converting ? (
                        <Loader2 className="w-5 h-5 shrink-0 animate-spin text-neutral-500" />
                      ) : (
                        <Home className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                      )}
                      <span className="text-sm font-medium ml-2">
                        {converting ? "Converting…" : "Convert to property"}
                      </span>
                    </button>
                  )}
                </li>
                <li>
                  <button
                    type="button"
                    disabled={!hasDocuments || starting || !canStartAnalysis}
                    className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      setActionsOpen(false);
                      onStartOrRefreshAnalysis?.();
                    }}
                  >
                    {starting ? (
                      <Loader2 className="w-5 h-5 shrink-0 animate-spin text-neutral-500" />
                    ) : (
                      <RefreshCw className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                    )}
                    <span className="text-sm font-medium ml-2">{startLabel}</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    disabled={!resultsReady}
                    className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      resultsReady
                        ? "Open presentation mode"
                        : "Available when analysis is completed"
                    }
                    onClick={() => {
                      setActionsOpen(false);
                      onPresentationMode?.();
                    }}
                  >
                    <MonitorPlay className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                    <span className="text-sm font-medium ml-2">
                      Presentation mode
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    disabled={!resultsReady || downloadingReport}
                    className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      resultsReady
                        ? "Download PDF report"
                        : "Available when analysis is completed"
                    }
                    onClick={() => {
                      setActionsOpen(false);
                      onDownloadReport?.();
                    }}
                  >
                    {downloadingReport ? (
                      <Loader2 className="w-5 h-5 shrink-0 animate-spin text-neutral-500" />
                    ) : (
                      <Download className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                    )}
                    <span className="text-sm font-medium ml-2">
                      {downloadingReport ? "Downloading…" : "Download Report"}
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </Transition>
        </div>

        <button
          type="button"
          className="btn btn-primary transition-colors duration-200 shadow-sm inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium"
          onClick={() => navigate(`/${accountUrl}/pre-purchase/new`)}
        >
          <Plus className="w-4 h-4" />
          New
        </button>

        {currentId && (
          <div className="flex items-center gap-0.5 ml-1 pl-3 border-l border-neutral-200 dark:border-neutral-700">
            <span className="text-sm text-neutral-500 dark:text-neutral-400 mr-1.5 tabular-nums">
              {displayIndex} / {total}
            </span>
            <button
              type="button"
              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              title="Previous"
              disabled={!prevId}
              onClick={() =>
                prevId && navigate(`/${accountUrl}/pre-purchase/${prevId}`)
              }
            >
              <svg
                className="fill-current"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                aria-hidden
              >
                <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" />
              </svg>
            </button>
            <button
              type="button"
              className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              title="Next"
              disabled={!nextId}
              onClick={() =>
                nextId && navigate(`/${accountUrl}/pre-purchase/${nextId}`)
              }
            >
              <svg
                className="fill-current"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                aria-hidden
              >
                <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
