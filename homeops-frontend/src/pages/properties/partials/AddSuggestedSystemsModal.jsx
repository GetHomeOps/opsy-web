/**
 * AddSuggestedSystemsModal
 * Shows when an inspection report identifies systems not on the property.
 * Asks the user if they'd like to add them.
 */

import React, {useState} from "react";
import {Plus, X, Loader2} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import {getSystemLabelFromAiType} from "../helpers/aiSystemNormalization";

export default function AddSuggestedSystemsModal({
  isOpen,
  onClose,
  suggestedSystems,
  onAddSystems,
}) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!onAddSystems || suggestedSystems.length === 0) return;
    setAdding(true);
    try {
      await onAddSystems();
      onClose?.();
    } finally {
      setAdding(false);
    }
  };

  return (
    <ModalBlank
      modalOpen={isOpen}
      setModalOpen={(open) => !open && onClose?.()}
      contentClassName="max-w-md"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
              Add systems from inspection report?
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              The report identified these systems that aren&apos;t on your
              property. Would you like to add them?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ul className="space-y-2 mb-6 max-h-48 overflow-y-auto">
          {suggestedSystems.map((s, idx) => (
            <li
              key={idx}
              className="flex items-center gap-2 py-2 px-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700/50"
            >
              <Plus className="w-4 h-4 text-[#456564] dark:text-[#5a7a78] shrink-0" />
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {getSystemLabelFromAiType(
                  s.systemType ?? s.system_key ?? s.name,
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium disabled:opacity-60"
          >
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add to property
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}
