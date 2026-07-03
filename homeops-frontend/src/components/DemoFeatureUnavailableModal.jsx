import React from "react";
import {createPortal} from "react-dom";
import {AlertTriangle, X} from "lucide-react";
import ModalBlank from "./ModalBlank";

/**
 * Info modal for features disabled on demo.heyopsy.com (no upgrade CTA).
 */
export default function DemoFeatureUnavailableModal({
  open,
  onClose,
  title = "Not available on demo",
  message = "",
  ignoreClickRef,
  renderInPortal = false,
}) {
  const modalContent = (
    <ModalBlank
      id="demo-feature-unavailable"
      modalOpen={open}
      setModalOpen={onClose}
      ignoreClickRef={ignoreClickRef}
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">{message}</p>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </ModalBlank>
  );

  return renderInPortal && typeof createPortal === "function"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
