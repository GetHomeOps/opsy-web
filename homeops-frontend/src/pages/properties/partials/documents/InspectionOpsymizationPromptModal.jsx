import React from "react";
import { FileSearch, Loader2 } from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import {
  DOCUMENT_ANALYSIS_MODAL_INNER,
  DOCUMENT_ANALYSIS_PROMPT_MODAL_SHELL,
  InspectionOpsymizationPromptContent,
  OpsyModalIcon,
} from "./documentAnalysisModalShared";

function InspectionOpsymizationPromptModal({
  open,
  document,
  onAccept,
  onSkip,
  busy = false,
}) {
  if (!document) return null;

  const documentName = document.document_name || "Document";

  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={(isOpen) => !isOpen && !busy && onSkip?.()}
      contentClassName={DOCUMENT_ANALYSIS_PROMPT_MODAL_SHELL}
    >
      <div className={DOCUMENT_ANALYSIS_MODAL_INNER}>
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <OpsyModalIcon />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Run Opsymization analysis?
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {documentName}
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 px-5">
          <InspectionOpsymizationPromptContent documentName={documentName} />
        </div>

        <div className="flex-shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm px-4 py-2 disabled:opacity-50"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            className="btn btn-primary text-sm px-4 py-2 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening…
              </>
            ) : (
              <>
                <FileSearch className="w-4 h-4" />
                Run Opsymization
              </>
            )}
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}

export default InspectionOpsymizationPromptModal;
