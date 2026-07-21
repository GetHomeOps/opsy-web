import React from "react";
import {X} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";
import {formatCurrency} from "../../prePurchaseUtils";

/**
 * Shows negotiation summary for a condition-adjusted offer.
 * Does not mutate the saved offer price.
 */
export default function ConditionAdjustedOfferModal({
  open,
  onClose,
  offerPrice,
  immediateRepairTotal,
  conditionAdjustedOffer,
}) {
  const credit = immediateRepairTotal;

  return (
    <ModalBlank
      id="condition-adjusted-offer-modal"
      modalOpen={open}
      setModalOpen={(v) => {
        if (!v) onClose?.();
      }}
      contentClassName="max-w-lg"
    >
      <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-700 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            Condition-adjusted offer
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Negotiation view only — your saved offer price is unchanged.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 py-5 space-y-4">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Current offer</dt>
            <dd className="font-semibold tabular-nums text-neutral-900 dark:text-white">
              {formatCurrency(offerPrice)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Immediate repair total</dt>
            <dd className="font-semibold tabular-nums text-red-600">
              −{formatCurrency(immediateRepairTotal)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <dt className="font-medium text-neutral-800 dark:text-neutral-200">
              Suggested adjusted offer
            </dt>
            <dd className="font-bold tabular-nums text-[#456564] text-lg">
              {formatCurrency(conditionAdjustedOffer)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Seller-credit alternative</dt>
            <dd className="font-semibold tabular-nums text-neutral-900 dark:text-white">
              {formatCurrency(credit)} credit at close
            </dd>
          </div>
        </dl>

        <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700 px-4 py-3 text-sm text-neutral-600 dark:text-neutral-300">
          <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">
            Negotiation summary
          </p>
          <p>
            Selected must-fix repairs total {formatCurrency(immediateRepairTotal)}.
            You can request a price reduction to {formatCurrency(conditionAdjustedOffer)}{" "}
            or keep your offer at {formatCurrency(offerPrice)} and ask for a{" "}
            {formatCurrency(credit)} seller credit toward repairs.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="btn bg-[#456564] text-white hover:bg-[#3a5554]"
        >
          Done
        </button>
      </div>
    </ModalBlank>
  );
}
