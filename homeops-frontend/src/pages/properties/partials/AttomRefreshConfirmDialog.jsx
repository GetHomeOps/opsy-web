import React from "react";
import {createPortal} from "react-dom";
import {AlertCircle, CheckCircle2, Loader2} from "lucide-react";

/**
 * Confirm dialog for the "Pull property data" action.
 *
 * The ATTOM worker is non-destructive (it only writes into columns that are
 * currently NULL/empty), so we reassure the user that their edits are safe.
 */
function AttomRefreshConfirmDialog({
  modalView = "confirm",
  jobStatus,
  jobError,
  populatedKeys = [],
  onCancel,
  onConfirm,
}) {
  const portalContainer =
    typeof document !== "undefined" ? document.body : null;
  if (!portalContainer) return null;

  const isActive = jobStatus === "queued" || jobStatus === "processing";
  const isResult =
    modalView === "result" || jobStatus === "completed" || !!jobError;

  let title = "Fill missing property details from ATTOM?";
  let body = (
    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
      We'll look up public records and fill in any currently empty Identity
      fields (owner, tax ID, specs, schools, etc.). Fields you've already edited
      will not be overwritten.
    </p>
  );
  let actions = (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="btn-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="btn-sm bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
      >
        Fill details
      </button>
    </div>
  );

  if (modalView === "progress" || isActive) {
    title = "Filling missing property details from ATTOM";
    body = (
      <div className="mb-4">
        <div className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 dark:border-violet-800/70 dark:bg-violet-950/30">
          <Loader2 className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-300" />
          <div>
            <p className="text-sm font-medium text-violet-900 dark:text-violet-100">
              {jobStatus === "queued" ? "Queued with ATTOM" : "Looking up public records"}
            </p>
            <p className="text-xs text-violet-700 dark:text-violet-300">
              This usually takes a few seconds. You can close this modal and keep working.
            </p>
          </div>
        </div>
      </div>
    );
    actions = (
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          Hide
        </button>
      </div>
    );
  } else if (isResult && !jobError && jobStatus === "completed") {
    title = "Property details updated";
    body = (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 dark:border-emerald-800/70 dark:bg-emerald-950/30">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
        <div>
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            {populatedKeys.length > 0
              ? `Updated ${populatedKeys.length} field${populatedKeys.length === 1 ? "" : "s"}`
              : "ATTOM lookup completed"}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Empty Identity fields were filled from public records. Existing edits were preserved.
          </p>
        </div>
      </div>
    );
    actions = (
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-sm bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          Close
        </button>
      </div>
    );
  } else if (isResult && jobError) {
    title = "Couldn't fill property details";
    body = (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 dark:border-red-800/70 dark:bg-red-950/30">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
        <div>
          <p className="text-sm font-medium text-red-900 dark:text-red-100">
            We couldn't fill in this property's missing details from ATTOM.
          </p>
          <p className="text-xs text-red-700 dark:text-red-300">
            {jobError}
          </p>
        </div>
      </div>
    );
    actions = (
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="btn-sm bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          Try again
        </button>
      </div>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>
        {body}
        {actions}
      </div>
    </div>,
    portalContainer,
  );
}

export default AttomRefreshConfirmDialog;
