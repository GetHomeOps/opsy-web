import React from "react";
import { X } from "lucide-react";
import ModalBlank from "../../../../../components/ModalBlank";
import {
  DOCUMENT_ANALYSIS_MODAL_BODY,
  DOCUMENT_ANALYSIS_MODAL_INNER,
  DOCUMENT_ANALYSIS_PROMPT_MODAL_SHELL,
  OpsyModalIcon,
} from "../../documents/documentAnalysisModalShared";
import ActionItemLinkFields from "./ActionItemLinkFields";

export default function LinkBidToActionItemPanel({
  open,
  onClose,
  propertyId,
  systemKey,
  systemLabel,
  documentId,
  documentName,
  onLinked,
  onSkip,
}) {
  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={(isOpen) => !isOpen && onClose?.()}
      contentClassName={DOCUMENT_ANALYSIS_PROMPT_MODAL_SHELL}
    >
      <div className={DOCUMENT_ANALYSIS_MODAL_INNER}>
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <OpsyModalIcon />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Which project is this for?
              </h2>
              <p className="text-xs text-gray-500 truncate">
                {documentName || "Saved document"}
                {systemLabel ? ` · ${systemLabel}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className={DOCUMENT_ANALYSIS_MODAL_BODY}>
          <ActionItemLinkFields
            active={open}
            variant="modal"
            propertyId={propertyId}
            systemKey={systemKey}
            documentId={documentId}
            onLinked={onLinked}
            onSkip={onSkip}
          />
        </div>
      </div>
    </ModalBlank>
  );
}
