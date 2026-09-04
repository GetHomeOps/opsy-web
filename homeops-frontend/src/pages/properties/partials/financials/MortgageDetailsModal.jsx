import React, {useEffect, useState} from "react";
import {X, Upload} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import CurrencyInput, {parseCurrencyInput} from "../../../../components/CurrencyInput";

function MortgageDetailsModal({
  isOpen,
  onClose,
  mortgage = {},
  saving = false,
  onSave,
  onUploadInstead,
}) {
  const [currentBalance, setCurrentBalance] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [paymentDueDay, setPaymentDueDay] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [escrowIncluded, setEscrowIncluded] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentBalance(
      mortgage.remainingBalance?.value != null ? String(mortgage.remainingBalance.value) : "",
    );
    setMonthlyPayment(
      mortgage.monthlyPayment?.value != null ? String(mortgage.monthlyPayment.value) : "",
    );
    setPaymentDueDay(mortgage.paymentDueDay != null ? String(mortgage.paymentDueDay) : "");
    setInterestRate(
      mortgage.interestRate?.value != null ? String(mortgage.interestRate.value) : "",
    );
    setEscrowIncluded(
      typeof mortgage.escrowIncluded === "boolean" ? mortgage.escrowIncluded : null,
    );
    setError(null);
  }, [isOpen, mortgage]);

  const handleSave = async (e) => {
    e.preventDefault();
    const balance = parseCurrencyInput(currentBalance);
    const payment = parseCurrencyInput(monthlyPayment);
    const day = paymentDueDay === "" ? null : Number(paymentDueDay);
    const rate = interestRate === "" ? null : Number(interestRate);
    if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      setError("Payment due day must be between 1 and 31.");
      return;
    }
    if (rate != null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) {
      setError("Enter a valid interest rate.");
      return;
    }
    setError(null);
    await onSave({
      currentBalance: balance,
      monthlyPayment: payment,
      paymentDueDay: day,
      interestRate: rate,
      escrowIncluded,
    });
  };

  return (
    <ModalBlank
      id="mortgage-details-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      contentClassName="max-w-md"
    >
      <form onSubmit={handleSave}>
        <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Complete mortgage details
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Public-record loan terms stay as recorded. These fields verify your current loan.
            </p>
          </div>
          <button type="button" onClick={() => onClose(false)} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {(mortgage.lender || mortgage.originalAmount) && (
            <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-800/40 px-3 py-2.5 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
              {mortgage.lender && (
                <p>
                  Lender: <span className="font-medium text-neutral-800 dark:text-neutral-100">{mortgage.lender}</span>
                </p>
              )}
              {mortgage.originalAmount?.value != null && (
                <p>
                  Original amount:{" "}
                  <span className="font-medium text-neutral-800 dark:text-neutral-100">
                    {new Intl.NumberFormat("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}).format(
                      mortgage.originalAmount.value,
                    )}
                  </span>
                  <span className="text-neutral-400 ml-1">Public record</span>
                </p>
              )}
            </div>
          )}
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Current balance
            </span>
            <CurrencyInput
              name="currentBalance"
              value={currentBalance}
              onChange={(e) => setCurrentBalance(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Monthly payment
            </span>
            <CurrencyInput
              name="monthlyPayment"
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Payment due day
            </span>
            <input
              type="number"
              min={1}
              max={31}
              className="form-input w-full"
              value={paymentDueDay}
              onChange={(e) => setPaymentDueDay(e.target.value)}
              placeholder="e.g. 1"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Current interest rate (%)
            </span>
            <input
              type="number"
              step="0.01"
              min={0}
              max={100}
              className="form-input w-full"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              placeholder="e.g. 5.25"
            />
          </label>
          <fieldset>
            <legend className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Does payment include escrow?
            </legend>
            <div className="flex gap-3">
              {[true, false].map((val) => (
                <label key={String(val)} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="mortgage-escrow"
                    checked={escrowIncluded === val}
                    onChange={() => setEscrowIncluded(val)}
                    className="text-[#456564] focus:ring-[#456564]"
                  />
                  {val ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </fieldset>
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
              Upload mortgage statement instead
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

export default MortgageDetailsModal;
