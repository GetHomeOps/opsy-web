import React from "react";
import {Mail, Send, X, User} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";

function SendToContractorModal({
  modalOpen,
  setModalOpen,
  contractorEmail,
  contractorName,
  systemName,
  propertyAddress,
  senderName,
  origin,
  inspectionDate,
  inspectionFinding,
  isSending,
  onSend,
}) {
  const displaySenderName = senderName
    ? senderName.replace(/\bHomeOps\b/g, "Opsy")
    : "";
  const subject = `Opsy: Maintenance report request${propertyAddress ? ` – ${propertyAddress}` : systemName ? ` – ${systemName}` : ""}`;

  return (
    <ModalBlank
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-2xl"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#456564] dark:text-[#6b9a7a]" />
            Send Report to Contractor
          </h2>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          An email will be sent to the contractor with a secure link to fill out
          the maintenance report. The link expires in 7 days.
        </p>

        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              To
            </label>
            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {contractorName || "Contractor"}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  &lt;{contractorEmail}&gt;
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Subject
            </label>
            <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-900 dark:text-white">{subject}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Message Preview
            </label>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2.5">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Hi {contractorName || "there"},
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {displaySenderName || "A homeowner"} has requested that you fill out a
                maintenance/inspection report
                {propertyAddress ? (
                  <>
                    {" "}
                    for the property at <strong>{propertyAddress}</strong>
                  </>
                ) : (
                  ""
                )}
                {systemName ? (
                  <>
                    {" "}
                    regarding <strong>{systemName}</strong>
                  </>
                ) : (
                  ""
                )}
                .
              </p>
              {(origin ||
                propertyAddress ||
                displaySenderName ||
                inspectionDate ||
                inspectionFinding) && (
                <div className="mt-3 py-2 px-3 bg-gray-100 dark:bg-gray-800 rounded-md text-xs space-y-1.5">
                  {origin && (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-500 dark:text-gray-500">
                        Origin:
                      </span>{" "}
                      <a
                        href={origin}
                        className="text-[#456564] hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {origin}
                      </a>
                    </p>
                  )}
                  {propertyAddress && (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-500 dark:text-gray-500">
                        Property:
                      </span>{" "}
                      {propertyAddress}
                    </p>
                  )}
                  {displaySenderName && (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-500 dark:text-gray-500">
                        Requested by:
                      </span>{" "}
                      {displaySenderName}
                    </p>
                  )}
                  {inspectionDate && (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-500 dark:text-gray-500">
                        Date of inspection:
                      </span>{" "}
                      {inspectionDate}
                    </p>
                  )}
                  {inspectionFinding && (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-500 dark:text-gray-500">
                        Inspection finding:
                      </span>{" "}
                      {inspectionFinding}
                    </p>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Please click the button below to open the report form and
                provide your findings.
              </p>
              <div className="pt-1">
                <span className="inline-block px-4 py-2 bg-[#456564] text-white text-xs font-medium rounded-md">
                  Fill Out Report
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                This link expires in 7 days.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={isSending}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{backgroundColor: "#456654"}}
            onMouseEnter={(e) => {
              if (!isSending) e.target.style.backgroundColor = "#3a5548";
            }}
            onMouseLeave={(e) => {
              if (!isSending) e.target.style.backgroundColor = "#456654";
            }}
          >
            <Send className="w-4 h-4" />
            {isSending ? "Sending…" : "Send Email"}
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}

export default SendToContractorModal;
