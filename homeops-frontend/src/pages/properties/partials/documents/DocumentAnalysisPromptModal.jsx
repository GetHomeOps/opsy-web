import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, Loader2, Receipt, ScanText } from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import {
  DOCUMENT_ANALYSIS_MODAL_INNER,
  DOCUMENT_ANALYSIS_PROMPT_MODAL_SHELL,
  DocumentAnalysisPromptContent,
  OpsyModalIcon,
} from "./documentAnalysisModalShared";
import {
  ANALYSIS_PROMPT_TYPES,
  guessAnalysisCategory,
} from "../../helpers/documentAnalysisUi";

const TYPE_ICONS = {
  bid: ClipboardList,
  installation_invoice: Receipt,
  other: FileText,
};

const TYPE_HINTS = {
  bid: [
    { icon: ClipboardList, text: "Contractor, pricing, line items, and terms" },
    { icon: ScanText, text: "Saved for comparison — not written onto the system" },
    { icon: FileText, text: "Open Quotes & bids from this system's Overview anytime" },
  ],
  installation_invoice: [
    { icon: Receipt, text: "Installer, cost, equipment, and warranty details" },
    { icon: ScanText, text: "Property identity fields when they appear on the invoice" },
    { icon: FileText, text: "Nothing is applied until you review it" },
  ],
  other: [
    { icon: ScanText, text: "Dates, specs, pricing, and findings" },
    { icon: FileText, text: "Details organized for your property system" },
    { icon: FileText, text: "Nothing is applied until you review it" },
  ],
};

function DocumentAnalysisPromptModal({
  open,
  document,
  systemLabel,
  onAnalyze,
  onSkip,
  busy = false,
}) {
  const guessedCategory = useMemo(
    () => guessAnalysisCategory(document || {}),
    [document],
  );
  const [category, setCategory] = useState(guessedCategory);

  useEffect(() => {
    if (open) setCategory(guessedCategory);
  }, [open, guessedCategory, document?.id]);

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
              Analyze this document with AI?
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {documentName}
              {systemLabel ? ` · ${systemLabel}` : ""}
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          <DocumentAnalysisPromptContent
            documentName={documentName}
            systemLabel={systemLabel}
            hints={TYPE_HINTS[category] || TYPE_HINTS.other}
          />

          <fieldset className="pb-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              What is this document?
            </legend>
            <div className="space-y-2" role="radiogroup" aria-label="Document type">
              {ANALYSIS_PROMPT_TYPES.map((option) => {
                const Icon = TYPE_ICONS[option.id] || FileText;
                const selected = category === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                      selected
                        ? "border-[#456564]/50 bg-[#456564]/5"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="document-analysis-category"
                      value={option.id}
                      checked={selected}
                      onChange={() => setCategory(option.id)}
                      className="mt-1 text-[#456564] focus:ring-[#456564]"
                    />
                    <Icon className="w-4 h-4 mt-0.5 shrink-0 text-[#456564]" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {option.label}
                      </span>
                      <span className="block text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
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
            disabled={busy || !category}
            onClick={() => onAnalyze?.(category)}
            className="btn btn-primary text-sm px-4 py-2 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <ScanText className="w-4 h-4" />
                Analyze now
              </>
            )}
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}

export default DocumentAnalysisPromptModal;
