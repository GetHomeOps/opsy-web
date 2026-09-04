import React, {useEffect, useState} from "react";
import {X, Upload} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import CurrencyInput, {parseCurrencyInput} from "../../../../components/CurrencyInput";
import DatePickerInput from "../../../../components/DatePickerInput";

function toInputNumber(value) {
  if (value == null) return "";
  return String(value);
}

function AddInsuranceModal({
  isOpen,
  onClose,
  initial = {},
  saving = false,
  onSave,
  onUploadInstead,
}) {
  const [provider, setProvider] = useState("");
  const [annualPremium, setAnnualPremium] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [escrowIncluded, setEscrowIncluded] = useState(null);
  const [policyNumber, setPolicyNumber] = useState("");
  const [deductible, setDeductible] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setProvider(initial.provider || "");
    setAnnualPremium(toInputNumber(initial.annualPremium?.value ?? initial.annualPremium));
    setRenewalDate(initial.renewalDate || "");
    setEscrowIncluded(
      typeof initial.escrowIncluded === "boolean" ? initial.escrowIncluded : null,
    );
    setPolicyNumber(initial.policyNumber || "");
    setDeductible(toInputNumber(initial.deductible));
    setError(null);
  }, [isOpen, initial]);

  const handleSave = async (e) => {
    e.preventDefault();
    const premium = parseCurrencyInput(annualPremium);
    if (premium == null) {
      setError("Enter the annual premium.");
      return;
    }
    setError(null);
    await onSave({
      provider: provider.trim() || null,
      annualPremium: premium,
      renewalDate: renewalDate || null,
      escrowIncluded,
      policyNumber: policyNumber.trim() || null,
      deductible: parseCurrencyInput(deductible),
    });
  };

  return (
    <ModalBlank
      id="add-insurance-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName="max-w-md"
    >
      <form onSubmit={handleSave}>
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {initial.provider || initial.annualPremium ? "Edit insurance" : "Add homeowners insurance"}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Used for monthly cost estimates and renewal reminders.
            </p>
          </div>
          <button type="button" onClick={() => onClose(false)} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Provider</span>
            <input
              className="form-input w-full"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. State Farm"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Annual premium
            </span>
            <CurrencyInput
              name="annualPremium"
              value={annualPremium}
              onChange={(e) => setAnnualPremium(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Renewal date
            </span>
            <DatePickerInput
              name="renewalDate"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
              popoverClassName="z-[250]"
            />
          </label>
          <fieldset>
            <legend className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Monthly escrow included?
            </legend>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <label key={String(val)} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="insurance-escrow"
                    checked={escrowIncluded === val}
                    onChange={() => setEscrowIncluded(val)}
                    className="text-[#456564] focus:ring-[#456564]"
                  />
                  {val ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Policy number <span className="text-neutral-400 font-normal">Optional</span>
            </span>
            <input
              className="form-input w-full"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Deductible <span className="text-neutral-400 font-normal">Optional</span>
            </span>
            <CurrencyInput
              name="insuranceDeductible"
              value={deductible}
              onChange={(e) => setDeductible(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center justify-between gap-2">
          {onUploadInstead ? (
            <button
              type="button"
              onClick={onUploadInstead}
              className="inline-flex items-center gap-1.5 text-sm text-[#456564] hover:underline"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload insurance document instead
            </button>
          ) : (
            <span />
          )}
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

export default AddInsuranceModal;
