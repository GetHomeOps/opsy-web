import React, {useEffect, useState} from "react";
import {X, Upload} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import CurrencyInput, {parseCurrencyInput} from "../../../../components/CurrencyInput";
import DatePickerInput from "../../../../components/DatePickerInput";

const FREQUENCIES = [
  {id: "monthly", label: "Monthly"},
  {id: "quarterly", label: "Quarterly"},
  {id: "annually", label: "Annually"},
];

function AddHoaModal({isOpen, onClose, initial = {}, saving = false, onSave, onMarkNone, onUploadInstead}) {
  const [associationName, setAssociationName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [specialAssessment, setSpecialAssessment] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setAssociationName(initial.associationName || "");
    setAmount(
      initial.amount?.value != null ? String(initial.amount.value) : initial.amount != null ? String(initial.amount) : "",
    );
    setFrequency(initial.frequency || "monthly");
    setNextDueDate(initial.nextDueDate || "");
    setSpecialAssessment(
      initial.specialAssessment != null ? String(initial.specialAssessment) : "",
    );
    setError(null);
  }, [isOpen, initial]);

  const handleSave = async (e) => {
    e.preventDefault();
    const fee = parseCurrencyInput(amount);
    if (fee == null) {
      setError("Enter the HOA fee amount.");
      return;
    }
    setError(null);
    await onSave({
      notApplicable: false,
      associationName: associationName.trim() || null,
      amount: fee,
      frequency,
      nextDueDate: nextDueDate || null,
      specialAssessment: parseCurrencyInput(specialAssessment),
    });
  };

  return (
    <ModalBlank
      id="add-hoa-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName="max-w-md"
    >
      <form onSubmit={handleSave}>
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Add HOA</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Association dues for this property.
            </p>
          </div>
          <button type="button" onClick={() => onClose(false)} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Association name
            </span>
            <input
              className="form-input w-full"
              value={associationName}
              onChange={(e) => setAssociationName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Fee amount
            </span>
            <CurrencyInput name="hoaAmount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <fieldset>
            <legend className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Frequency
            </legend>
            <div className="flex gap-2">
              {FREQUENCIES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFrequency(opt.id)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                    frequency === opt.id
                      ? "border-[#456564]/50 bg-[#456564]/5"
                      : "border-neutral-200 dark:border-neutral-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Next due date
            </span>
            <DatePickerInput
              name="hoaNextDue"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              popoverClassName="z-[250]"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Special assessment <span className="text-neutral-400 font-normal">Optional</span>
            </span>
            <CurrencyInput
              name="specialAssessment"
              value={specialAssessment}
              onChange={(e) => setSpecialAssessment(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col items-start gap-1.5">
            {onMarkNone ? (
              <button
                type="button"
                onClick={onMarkNone}
                className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                This property has no HOA
              </button>
            ) : null}
            {onUploadInstead ? (
              <button
                type="button"
                onClick={onUploadInstead}
                className="inline-flex items-center gap-1.5 text-sm text-[#456564] hover:underline"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload HOA document instead
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onClose(false)} className="btn border-gray-200 dark:border-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">
              {saving ? "Saving…" : "Save details"}
            </button>
          </div>
        </div>
      </form>
    </ModalBlank>
  );
}

export default AddHoaModal;
