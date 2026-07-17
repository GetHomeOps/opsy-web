import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
  ExternalLink,
} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import {
  DOCUMENT_ANALYSIS_MODAL_BODY,
  DOCUMENT_ANALYSIS_MODAL_INNER,
  DOCUMENT_ANALYSIS_MODAL_SHELL,
  OpsyModalIcon,
  formatAnalysisDate,
  formatAnalysisValue,
  formatFieldLabel,
  formatSystemDataKeyLabel,
  groupSharedCurrentValues,
  isLineItemsField,
  LineItemsList,
} from "./documentAnalysisModalShared";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Extracted details" },
  { id: "source", label: "Source" },
];

function DocumentAnalysisResultsModal({
  open,
  onClose,
  result,
  status,
  progress,
  error,
  systemLabel,
  onApply,
  onReject,
  onOpenDocument,
  applying = false,
  backdropZClassName = "z-[200]",
  dialogZClassName = "z-[200]",
}) {
  const [activeTab, setActiveTab] = useState("details");
  const reviewFields = result?.reviewFields ?? [];
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (open && reviewFields.length) {
      setSelected(new Set(reviewFields.map((f) => f.fieldKey)));
      setActiveTab("details");
    }
  }, [open, result?.id, reviewFields.length]);

  const allSelected = useMemo(
    () => reviewFields.length > 0 && selected.size === reviewFields.length,
    [reviewFields.length, selected.size],
  );

  const sharedCurrentValues = useMemo(
    () => groupSharedCurrentValues(reviewFields),
    [reviewFields],
  );

  const sharedCurrentFieldKeys = useMemo(() => {
    const keys = new Set();
    for (const group of sharedCurrentValues) {
      if (group.fieldKeys.length > 1) {
        for (const fieldKey of group.fieldKeys) keys.add(fieldKey);
      }
    }
    return keys;
  }, [sharedCurrentValues]);

  const toggleField = (fieldKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(reviewFields.map((f) => f.fieldKey)));
  };

  const isLoading = status === "loading";
  const canApply = result?.id && selected.size > 0 && !isLoading && !applying;
  const showFooter = !isLoading && result;

  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={(isOpen) => !isOpen && !applying && onClose?.()}
      contentClassName={DOCUMENT_ANALYSIS_MODAL_SHELL}
      backdropZClassName={backdropZClassName}
      dialogZClassName={dialogZClassName}
    >
      <div className={DOCUMENT_ANALYSIS_MODAL_INNER}>
        <div className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <OpsyModalIcon />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                Review AI findings before applying
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {result?.documentName || "Document"}
                {systemLabel ? ` · ${systemLabel}` : ""}
                {result?.categoryLabel ? ` · ${result.categoryLabel}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading && (
          <div className={`${DOCUMENT_ANALYSIS_MODAL_BODY} flex flex-col items-center justify-center text-center`}>
            <Loader2 className="w-8 h-8 animate-spin text-[#456564] mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {progress || "Analyzing document…"}
            </p>
          </div>
        )}

        {!isLoading && error && !result && (
          <div className={`${DOCUMENT_ANALYSIS_MODAL_BODY} flex flex-col items-center justify-center text-center`}>
            <AlertCircle className="w-8 h-8 text-red-500 mb-3" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!isLoading && result && (
          <>
            <nav className="flex-shrink-0 flex border-b border-gray-200 dark:border-gray-700 px-5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-[#456564] text-[#456564]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className={DOCUMENT_ANALYSIS_MODAL_BODY}>
              {activeTab === "overview" && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Document type
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                      {result.categoryLabel || result.detectedCategory || "—"}
                    </p>
                  </div>
                  {result.findings?.find((f) => f.fieldKey === "summary") && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Summary
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-relaxed">
                        {formatAnalysisValue(
                          result.findings.find((f) => f.fieldKey === "summary")?.value,
                        )}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    Select the fields you want to apply to{" "}
                    {systemLabel || "this system"} on the Extracted details tab.
                  </p>
                </div>
              )}

              {activeTab === "details" && (
                <div className="space-y-2">
                  {sharedCurrentValues
                    .filter((group) => group.fieldKeys.length > 1)
                    .map((group) => (
                    <div
                      key={`${group.systemDataKey}-${group.formattedValue.slice(0, 40)}`}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 px-3 py-2.5 mb-3"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                        Current {formatSystemDataKeyLabel(group.systemDataKey)}
                        {group.fieldKeys.length > 1
                          ? ` · shared by ${group.fieldKeys.length} fields`
                          : ""}
                      </p>
                      <p
                        className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words leading-relaxed"
                        title={group.fullValue !== group.formattedValue ? group.fullValue : undefined}
                      >
                        {group.formattedValue}
                      </p>
                    </div>
                  ))}
                  {reviewFields.length > 1 && (
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="text-xs font-medium text-[#456564] hover:underline mb-2"
                    >
                      {allSelected ? "Deselect all" : "Select all"}
                    </button>
                  )}
                  {reviewFields.length === 0 ? (
                    <p className="text-sm text-gray-500">No extractable fields found.</p>
                  ) : (
                    reviewFields.map((field) => {
                      const checked = selected.has(field.fieldKey);
                      const Icon = checked ? CheckSquare : Square;
                      return (
                        <label
                          key={field.fieldKey}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? "border-[#456564]/40 bg-[#456564]/5"
                              : "border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleField(field.fieldKey)}
                            className="mt-0.5 shrink-0 text-[#456564]"
                            aria-pressed={checked}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {formatFieldLabel(field.fieldKey, field.label)}
                              </span>
                              {field.confidence != null && (
                                <span className="text-[10px] text-gray-400 shrink-0">
                                  {Math.round(field.confidence * 100)}% conf.
                                </span>
                              )}
                            </div>
                            {isLineItemsField(field.fieldKey) ? (
                              <LineItemsList items={field.proposedValue} />
                            ) : (
                              <p className="text-sm text-[#456564] dark:text-[#5a7a78] mt-0.5 break-words whitespace-pre-wrap">
                                {formatAnalysisValue(field.proposedValue, {
                                  fieldKey: field.fieldKey,
                                  label: field.label,
                                })}
                              </p>
                            )}
                            {field.currentValue != null &&
                              field.currentValue !== "" &&
                              !sharedCurrentFieldKeys.has(field.fieldKey) && (
                              <p
                                className="text-xs text-gray-500 mt-1 whitespace-pre-wrap break-words"
                                title={
                                  formatAnalysisValue(field.currentValue, {
                                    compact: true,
                                    fieldKey: field.fieldKey,
                                    label: field.label,
                                  }) !==
                                  formatAnalysisValue(field.currentValue, {
                                    fieldKey: field.fieldKey,
                                    label: field.label,
                                  })
                                    ? formatAnalysisValue(field.currentValue, {
                                        fieldKey: field.fieldKey,
                                        label: field.label,
                                      })
                                    : undefined
                                }
                              >
                                Current:{" "}
                                {formatAnalysisValue(field.currentValue, {
                                  compact: true,
                                  fieldKey: field.fieldKey,
                                  label: field.label,
                                })}
                              </p>
                            )}
                            {field.evidence && (
                              <p className="text-xs text-gray-400 mt-1 italic line-clamp-2">
                                "{field.evidence}"
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              )}

              {activeTab === "source" && (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">File</p>
                    <p className="text-gray-900 dark:text-gray-100 mt-0.5">
                      {result.documentName || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Date</p>
                    <p className="text-gray-900 dark:text-gray-100 mt-0.5">
                      {formatAnalysisDate(result.documentDate)}
                    </p>
                  </div>
                  {result.documentKey && onOpenDocument && (
                    <button
                      type="button"
                      onClick={() => onOpenDocument(result.documentKey)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#456564] hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open document
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {showFooter && (
          <div className="flex-shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button
              type="button"
              disabled={applying}
              onClick={() => onReject?.(result.id)}
              className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 text-sm px-4 py-2 disabled:opacity-50"
            >
              Reject all
            </button>
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onApply?.(result.id, Array.from(selected))}
              className="btn btn-primary text-sm px-4 py-2 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Applying…
                </>
              ) : (
                `Apply selected${systemLabel ? ` to ${systemLabel}` : ""}`
              )}
            </button>
          </div>
        )}
      </div>
    </ModalBlank>
  );
}

export default DocumentAnalysisResultsModal;
