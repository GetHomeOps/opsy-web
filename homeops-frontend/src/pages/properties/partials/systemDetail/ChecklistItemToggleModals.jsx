import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  FileText,
  X,
} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";

/** Prompt to add a supporting record before marking an action item complete. */
export function ChecklistItemCompleteModal({
  isOpen,
  item,
  onClose,
  onAddRecord,
  onMarkComplete,
  submitting = false,
}) {
  if (!isOpen || !item) return null;

  return (
    <ModalBlank
      id="checklist-item-complete-modal"
      modalOpen={isOpen}
      setModalOpen={(open) => !open && !submitting && onClose?.()}
      backdropZClassName="z-[170]"
      dialogZClassName="z-[170]"
      contentClassName="max-w-lg"
      closeOnEscape={!submitting}
      closeOnClickOutside={!submitting}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-100 dark:bg-emerald-900/40">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Mark this action item complete?
            </h3>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-2">
              {item.title}
            </p>
            {item.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {item.description}
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
              Document the work with a new record, link an existing record or
              document, or mark complete without documentation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-6 justify-end">
          <button
            type="button"
            className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-sm border border-[#456564] text-[#456564] dark:border-[#5a7a78] dark:text-[#5a7a78] hover:bg-[#456564]/10 flex items-center justify-center gap-1.5"
            onClick={onMarkComplete}
            disabled={submitting}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {submitting ? "Saving…" : "Mark complete"}
          </button>
          {onAddRecord && (
            <button
              type="button"
              className="btn-sm bg-[#456564] hover:bg-[#34514f] text-white flex items-center justify-center gap-1.5"
              onClick={onAddRecord}
              disabled={submitting}
            >
              <FileText className="w-3.5 h-3.5" />
              Add / link record
            </button>
          )}
        </div>
      </div>
    </ModalBlank>
  );
}

/** Confirm reverting a completed action item and updating system condition. */
export function ChecklistItemUncheckModal({
  isOpen,
  item,
  onClose,
  onConfirm,
  submitting = false,
}) {
  if (!isOpen || !item) return null;

  return (
    <ModalBlank
      id="checklist-item-uncheck-modal"
      modalOpen={isOpen}
      setModalOpen={(open) => !open && !submitting && onClose?.()}
      backdropZClassName="z-[170]"
      dialogZClassName="z-[170]"
      contentClassName="max-w-lg"
      closeOnEscape={!submitting}
      closeOnClickOutside={!submitting}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              Mark this item incomplete?
            </h3>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-2">
              {item.title}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
              This will reopen the action item. If all items are no longer
              complete, the system condition may be adjusted to reflect open
              follow-ups.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap justify-end gap-2 mt-6">
          <button
            type="button"
            className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-sm bg-amber-600 hover:bg-amber-700 text-white"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? "Updating…" : "Mark incomplete"}
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}
