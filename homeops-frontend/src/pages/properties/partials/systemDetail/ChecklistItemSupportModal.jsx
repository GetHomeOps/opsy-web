import React, {useEffect, useMemo, useState} from "react";
import {
  ArrowLeft,
  FileText,
  Link2,
  Loader2,
  Plus,
  Wrench,
  X,
} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import {formatOverviewDate} from "../passport/SystemsOverviewPanel";
import {todayDateString} from "../../helpers/actionItemFormatters";
import {matchesSystemForAnalysis} from "../../helpers/inspectionAnalysisHelpers";

function formatRecordLabel(record) {
  const date = record.date
    ? (formatOverviewDate(record.date) ?? String(record.date).slice(0, 10))
    : null;
  const desc = String(record.description ?? "").trim();
  const type = String(record.recordType ?? "").trim();
  const parts = [type, desc, date].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : `Record #${record.id}`;
}

function formatDocumentLabel(doc) {
  const date = doc.document_date
    ? (formatOverviewDate(doc.document_date) ??
      String(doc.document_date).slice(0, 10))
    : null;
  const name = doc.document_name || "Document";
  return date ? `${name} · ${date}` : name;
}

/**
 * Second step after "Add record" — create new, link record, or link document.
 */
export function ChecklistItemSupportModal({
  isOpen,
  item,
  systemLabel,
  maintenanceRecords = [],
  propertyDocuments = [],
  systemId,
  lastPerformedDate: initialLastPerformedDate = null,
  onClose,
  onCreateRecord,
  onLinkRecord,
  onLinkDocument,
  linking = false,
}) {
  const [linkError, setLinkError] = useState(null);
  const [lastPerformedDate, setLastPerformedDate] = useState(
    initialLastPerformedDate || todayDateString(),
  );

  useEffect(() => {
    if (isOpen) {
      setLastPerformedDate(initialLastPerformedDate || todayDateString());
    }
  }, [isOpen, item?.id, initialLastPerformedDate]);

  const systemRecords = useMemo(() => {
    return (maintenanceRecords ?? []).filter(
      (r) =>
        String(r.systemId ?? r.system_key ?? "") === String(systemId) &&
        !String(r.id ?? "").startsWith("MT-"),
    );
  }, [maintenanceRecords, systemId]);

  const systemDocuments = useMemo(() => {
    return (propertyDocuments ?? []).filter((doc) => {
      const rawKey = doc.system_key ?? doc.systemKey;
      const docKey =
        rawKey === "general" ? "inspectionReport" : rawKey || "inspectionReport";
      return matchesSystemForAnalysis(systemId, docKey);
    });
  }, [propertyDocuments, systemId]);

  const availableRecords = useMemo(
    () =>
      systemRecords.filter((record) => {
        const linkedId = record.checklist_item_id ?? record.checklistItemId;
        return linkedId == null || String(linkedId) === String(item?.id);
      }),
    [systemRecords, item?.id],
  );

  if (!isOpen || !item) return null;

  const handleLinkRecord = async (record) => {
    setLinkError(null);
    try {
      await onLinkRecord?.(item, record, lastPerformedDate);
    } catch (err) {
      setLinkError(err?.message || "Failed to link record");
    }
  };

  const handleLinkDocument = async (doc) => {
    setLinkError(null);
    try {
      await onLinkDocument?.(item, doc, lastPerformedDate);
    } catch (err) {
      setLinkError(err?.message || "Failed to link document");
    }
  };

  return (
    <ModalBlank
      id="checklist-item-support-modal"
      modalOpen={isOpen}
      setModalOpen={(open) => !open && !linking && onClose?.()}
      backdropZClassName="z-[175]"
      dialogZClassName="z-[175]"
      contentClassName="max-w-lg"
      closeOnEscape={!linking}
      closeOnClickOutside={!linking}
    >
      <div className="p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#456564]/10 dark:bg-[#456564]/25">
              <Link2 className="w-5 h-5 text-[#456564] dark:text-[#7aa3a2]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Document this action
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {systemLabel || "System"}
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-2">
                {item.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={linking}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {linkError && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {linkError}
          </div>
        )}

        <div className="mb-5">
          <label
            htmlFor="checklist-support-last-performed"
            className="block text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1"
          >
            Last performed
          </label>
          <input
            id="checklist-support-last-performed"
            type="date"
            className="form-input w-full text-sm py-2 dark:bg-gray-700/50 dark:border-gray-600"
            value={lastPerformedDate}
            onChange={(e) => setLastPerformedDate(e.target.value)}
            disabled={linking}
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            When was this work done? Used for the linked record and Next Due.
          </p>
        </div>

        <div className="space-y-5">
          {onCreateRecord && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
                Create new
              </p>
              <button
                type="button"
                disabled={linking || !lastPerformedDate}
                onClick={() => onCreateRecord?.(item, lastPerformedDate)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#456564]/30 dark:border-[#5a7a78]/40 hover:bg-[#456564]/5 dark:hover:bg-[#456564]/10 transition-colors text-left disabled:opacity-50"
              >
                <span className="w-8 h-8 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/25 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-[#456564] dark:text-[#7aa3a2]" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-neutral-900 dark:text-white">
                    New maintenance or inspection record
                  </span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Log the work and link it to this action item
                  </span>
                </span>
              </button>
            </div>
          )}

          {onLinkRecord && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
                Link existing record
              </p>
              {availableRecords.length > 0 ? (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                  {availableRecords.map((record) => (
                    <li key={record.id}>
                      <button
                        type="button"
                        disabled={linking}
                        onClick={() => handleLinkRecord(record)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors disabled:opacity-50"
                      >
                        <Wrench className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate flex-1">
                          {formatRecordLabel(record)}
                        </span>
                        {linking ? (
                          <Loader2 className="w-4 h-4 animate-spin text-neutral-400 shrink-0" />
                        ) : (
                          <Link2 className="w-3.5 h-3.5 text-[#456564] dark:text-[#7aa3a2] shrink-0" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 px-1">
                  No unlinked records for this system yet.
                </p>
              )}
            </div>
          )}

          {onLinkDocument && (
            <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
              Link existing document
            </p>
            {systemDocuments.length > 0 ? (
              <ul className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden max-h-48 overflow-y-auto">
                {systemDocuments.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      disabled={linking}
                      onClick={() => handleLinkDocument(doc)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                      <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate flex-1">
                        {formatDocumentLabel(doc)}
                      </span>
                      {doc.maintenance_record_id && (
                        <span className="text-[10px] text-neutral-400 shrink-0">
                          Has record
                        </span>
                      )}
                      {linking ? (
                        <Loader2 className="w-4 h-4 animate-spin text-neutral-400 shrink-0" />
                      ) : (
                        <Link2 className="w-3.5 h-3.5 text-[#456564] dark:text-[#7aa3a2] shrink-0" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 px-1">
                No documents filed for this system yet.
              </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-start mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            disabled={linking}
            onClick={onClose}
            className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}
