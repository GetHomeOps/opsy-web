import React, {useState} from "react";
import {Loader2, ShieldCheck, X} from "lucide-react";

/**
 * Confirmation modal for a homeowner transferring billing of their single
 * agent-managed property to the agent's plan. They keep paid access until the end
 * of the current period, then the agent's plan covers the property at no charge.
 */
function SponsorshipOfferModal({open, eligibility, onConfirm, onClose, onDismiss}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const handleDismiss = onDismiss ?? onClose;

  if (!open) return null;

  const agentName = eligibility?.agent?.name || "your agent";
  const propertyLabel = eligibility?.property?.label || "your property";
  const planName = eligibility?.agent?.planName || null;
  const entitlements = eligibility?.agent?.entitlements || null;
  const accessUntil = eligibility?.accessUntil
    ? new Date(eligibility.accessUntil).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const formatLimit = (value) =>
    value == null ? "Unlimited" : Number(value).toLocaleString();

  const entitlementRows = entitlements
    ? [
        {label: "Properties", value: formatLimit(entitlements.maxProperties)},
        {label: "Contacts", value: formatLimit(entitlements.maxContacts)},
        {
          label: "AI tokens / month",
          value: entitlements.aiFeaturesEnabled
            ? formatLimit(entitlements.aiTokenMonthlyQuota)
            : "Not included",
        },
        {
          label: "Documents / system",
          value: formatLimit(entitlements.maxDocumentsPerSystem),
        },
      ]
    : [];

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err?.message || "Could not transfer billing. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/50"
        onClick={submitting ? undefined : onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Let your agent cover this property
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <p>
            <strong className="text-gray-900 dark:text-white">{agentName}</strong>{" "}
            is your agent for <strong>{propertyLabel}</strong> and can include it in
            their plan. If you transfer billing:
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">•</span>
              You keep full paid access
              {accessUntil ? (
                <>
                  {" "}until <strong>{accessUntil}</strong>
                </>
              ) : (
                " until the end of your current billing period"
              )}
              .
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">•</span>
              After that you stop paying — your agent's plan subsidizes this
              property for as long as they remain your agent.
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600 dark:text-emerald-400">•</span>
              Want more than one property? Subscribe again anytime to take back
              control and add properties.
            </li>
          </ul>
          {entitlementRows.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                What your agent's plan includes
                {planName ? (
                  <>
                    {" — "}
                    <span className="text-gray-700 dark:text-gray-200 normal-case">
                      {planName}
                    </span>
                  </>
                ) : null}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                {entitlementRows.map((row) => (
                  <div key={row.label} className="flex flex-col">
                    <dt className="text-xs text-gray-500 dark:text-gray-400">
                      {row.label}
                    </dt>
                    <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            If your agent later leaves or drops their plan, we'll let you know and
            give you a 30-day grace period to resume your own plan before access
            changes.
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700/60">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={submitting}
            className="btn border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="btn bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Have my agent cover it
          </button>
        </div>
      </div>
    </div>
  );
}

export default SponsorshipOfferModal;
