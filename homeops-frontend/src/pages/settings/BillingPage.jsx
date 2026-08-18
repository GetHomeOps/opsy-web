import React, {useState, useEffect, useCallback} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useLocation} from "react-router-dom";
import {
  Sparkles,
  Loader2,
  FileText,
  ExternalLink,
  ShieldCheck,
  Home,
} from "lucide-react";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAuth} from "../../context/AuthContext";
import {useAccountBranding} from "../../context/AccountBrandingContext";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";
import SponsorshipOfferModal from "./partials/SponsorshipOfferModal";
import {
  isSponsorshipOfferSnoozed,
  snoozeSponsorshipOffer,
} from "../../components/SponsorshipOfferWatcher";
import {isAssistantRole} from "../../utils/roles";

/**
 * Billing page — current plan, usage vs limits, Stripe Customer Portal.
 * Uses /billing/status and /billing/portal-session.
 */
function BillingPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [successMsg, setSuccessMsg] = useState(
    location.state?.planChanged || null,
  );
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const {refreshBranding} = useAccountBranding();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  useEffect(() => {
    if (isAssistantRole(currentUser?.role) && accountUrl) {
      navigate(`/${accountUrl}/home`, {replace: true});
    }
  }, [currentUser?.role, accountUrl, navigate]);
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [sponsorshipLoading, setSponsorshipLoading] = useState(false);
  const [sponsoredProperties, setSponsoredProperties] = useState([]);
  const [offerDismissed, setOfferDismissed] = useState(false);
  const [stopCoverageConfirm, setStopCoverageConfirm] = useState(false);

  const accountId = currentAccount?.id;
  const userRole = (currentUser?.role || "homeowner").toLowerCase();
  const targetRole = ["agent", "admin"].includes(userRole)
    ? "agent"
    : "homeowner";

  const fetchBilling = React.useCallback(async () => {
    if (!accountId) return;
    try {
      setError(null);
      const [statusRes, plansRes, invoicesRes] = await Promise.all([
        AppApi.getBillingStatus(accountId)
          .then((r) => r)
          .catch(() => null),
        AppApi.getBillingPlans(targetRole)
          .then((r) => r.plans || [])
          .catch(() => []),
        AppApi.getBillingInvoices(accountId)
          .then((r) => r?.invoices || [])
          .catch(() => []),
      ]);
      setBilling(statusRes);
      setPlans(plansRes);
      setInvoices(invoicesRes);
      if (targetRole === "agent") {
        const sponsored = await AppApi.getSponsoredProperties(accountId)
          .then((r) => r?.properties || [])
          .catch(() => []);
        setSponsoredProperties(sponsored);
      } else {
        setSponsoredProperties([]);
      }
    } catch (err) {
      setError(err?.message || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }, [accountId, targetRole]);

  useEffect(() => {
    if (location.state?.planChanged) {
      window.history.replaceState({}, "");
    }
  }, [location.state?.planChanged]);

  useEffect(() => {
    setOfferDismissed(isSponsorshipOfferSnoozed(accountId));
  }, [accountId]);

  useEffect(() => {
    const onSnoozed = (event) => {
      if (event.detail?.accountId === accountId) {
        setOfferDismissed(true);
        setOfferModalOpen(false);
      }
    };
    window.addEventListener("opsy:sponsorship-offer-snoozed", onSnoozed);
    return () =>
      window.removeEventListener("opsy:sponsorship-offer-snoozed", onSnoozed);
  }, [accountId]);

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchBilling();
  }, [accountId, fetchBilling]);

  useEffect(() => {
    const onPlansUpdated = () => {
      if (accountId) fetchBilling();
    };
    window.addEventListener("plans-updated", onPlansUpdated);
    return () => window.removeEventListener("plans-updated", onPlansUpdated);
  }, [accountId, fetchBilling]);

  async function handleReactivate() {
    if (!accountId) return;
    setReactivateLoading(true);
    setError(null);
    try {
      await AppApi.reactivateSubscription({accountId});
      fetchBilling();
    } catch (err) {
      setError(err?.message || "Failed to reactivate subscription.");
    } finally {
      setReactivateLoading(false);
    }
  }

  async function handleAcceptSponsorship() {
    const result = await AppApi.acceptSponsorship({accountId});
    setOfferModalOpen(false);
    window.dispatchEvent(new CustomEvent("plans-updated"));
    if (result?.activated) {
      await refreshBranding();
    }
    await fetchBilling();
  }

  async function handleCancelSponsorship() {
    if (!accountId) return;
    setSponsorshipLoading(true);
    setError(null);
    try {
      await AppApi.cancelSponsorship({accountId});
      await fetchBilling();
    } catch (err) {
      setError(err?.message || "Could not cancel the agent-coverage offer.");
    } finally {
      setSponsorshipLoading(false);
    }
  }

  async function handleEndSponsorship(sponsorshipId) {
    if (!accountId || !sponsorshipId) return;
    setSponsorshipLoading(true);
    setError(null);
    try {
      await AppApi.endSponsorship({sponsorshipId, accountId});
      await fetchBilling();
    } catch (err) {
      setError(err?.message || "Could not end coverage.");
    } finally {
      setSponsorshipLoading(false);
    }
  }

  async function handleManageBilling() {
    if (!accountId) return;
    setPortalLoading(true);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const returnUrl = `${origin}/${currentAccount?.url || ""}/settings/billing`;
      const {url} = await AppApi.createPortalSession({accountId, returnUrl});
      if (url) window.location.href = url;
      else setError("Could not open billing portal.");
    } catch (err) {
      setError(err?.message || "Failed to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  const formatDate = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const sub = billing?.subscription;
  const plan = billing?.plan;
  const limits = billing?.limits;
  const usage = billing?.usage || {};
  const hasStripeBilling = Boolean(billing?.hasStripeBilling || billing?.mockMode);

  const sponsorship = billing?.sponsorship || {};
  const sponsorshipEligible = Boolean(sponsorship.eligibility?.eligible);
  const sponsorBeneficiary = sponsorship.asBeneficiary || null;
  const sponsorPending = sponsorBeneficiary?.status === "pending";
  const sponsorActive = sponsorBeneficiary?.status === "active";
  const sponsorGrace = sponsorBeneficiary?.status === "grace";

  if (!accountId) {
    return (
                <main className={`grow ${PAGE_LAYOUT.settings}`}>
            <p className="text-gray-600 dark:text-gray-400">
              Select an account to view billing.
            </p>
          </main>
        
    );
  }

  return (
            <main className="grow">
          <div className={PAGE_LAYOUT.settings}>
            <div className="mb-8">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                {t("settings.billing") || "Billing"}
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t("settings.billingDescription") ||
                  "Manage your subscription plan and billing information."}
              </p>
            </div>

            {successMsg && (
              <div className="mb-6 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <span>{successMsg}</span>
                <button
                  type="button"
                  onClick={() => setSuccessMsg(null)}
                  className="ml-3 text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200 text-lg leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {!loading && sponsorshipEligible && !sponsorBeneficiary && !offerDismissed && (
              <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Your agent can cover this property
                  </p>
                  <p className="mt-0.5 text-sm text-emerald-800/90 dark:text-emerald-300/90">
                    {sponsorship.eligibility?.agent?.name || "Your agent"} is your
                    agent for{" "}
                    {sponsorship.eligibility?.property?.label || "this property"} and
                    can include it in their plan — so you stop paying while keeping
                    full access.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOfferModalOpen(true)}
                  className="shrink-0 btn bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                >
                  Learn more
                </button>
                <button
                  type="button"
                  onClick={() => {
                    snoozeSponsorshipOffer(accountId);
                    setOfferDismissed(true);
                  }}
                  className="shrink-0 text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300"
                  aria-label="Dismiss"
                >
                  &times;
                </button>
              </div>
            )}

            {!loading && sponsorPending && (
              <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Agent coverage scheduled
                  </p>
                  <p className="mt-0.5 text-sm text-amber-800/90 dark:text-amber-300/90">
                    {sponsorBeneficiary.sponsorName}'s plan will cover{" "}
                    {sponsorBeneficiary.propertyLabel}
                    {sponsorBeneficiary.effectiveAt
                      ? ` on ${formatDate(sponsorBeneficiary.effectiveAt)}`
                      : " at the end of your billing period"}
                    . You keep full access until then.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelSponsorship}
                  disabled={sponsorshipLoading}
                  className="shrink-0 btn border border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-sm font-semibold disabled:opacity-50"
                >
                  {sponsorshipLoading ? "Working…" : "Keep paying instead"}
                </button>
              </div>
            )}

            {!loading && sponsorActive && (
              <div className="mb-6 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                      Covered by {sponsorBeneficiary.sponsorName}
                    </p>
                    <p className="mt-0.5 text-sm text-emerald-800/90 dark:text-emerald-300/90">
                      {sponsorBeneficiary.propertyLabel} is included in your
                      agent's plan — there's no charge to you. Subscribe anytime to
                      take back control.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/${accountUrl}/settings/upgrade`)}
                      className="btn bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"
                    >
                      Subscribe
                    </button>
                    <button
                      type="button"
                      onClick={() => setStopCoverageConfirm(true)}
                      className="btn border border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-sm font-semibold"
                    >
                      Stop coverage
                    </button>
                  </div>
                </div>
                {stopCoverageConfirm && (
                  <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Stop agent coverage now? This property will drop to the free
                      plan (reduced limits and AI turned off) unless you subscribe.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setStopCoverageConfirm(false);
                          await handleEndSponsorship(sponsorBeneficiary.id);
                        }}
                        disabled={sponsorshipLoading}
                        className="btn-sm bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {sponsorshipLoading ? "Working…" : "Yes, stop coverage"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStopCoverageConfirm(false)}
                        disabled={sponsorshipLoading}
                        className="btn-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm disabled:opacity-50"
                      >
                        Keep coverage
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loading && sponsorGrace && (
              <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Agent coverage is ending
                  </p>
                  <p className="mt-0.5 text-sm text-amber-800/90 dark:text-amber-300/90">
                    {sponsorBeneficiary.sponsorName} is no longer covering{" "}
                    {sponsorBeneficiary.propertyLabel}. You have until{" "}
                    <strong>
                      {sponsorBeneficiary.graceUntil
                        ? formatDate(sponsorBeneficiary.graceUntil)
                        : "the end of your grace period"}
                    </strong>{" "}
                    to subscribe before this property moves to the free plan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/${accountUrl}/settings/upgrade`)}
                  className="shrink-0 btn bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"
                >
                  Resume my plan
                </button>
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-xs p-8 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
              </div>
            ) : (
              <div className="space-y-8">
                <section className="rounded-xl bg-white dark:bg-gray-800 shadow-xs overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-4">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {t("settings.currentPlan") || "Current Plan"}
                    </h2>
                    <div className="flex items-center gap-3">
                      {sponsorshipEligible && !sponsorBeneficiary && (
                        <button
                          type="button"
                          onClick={() => setOfferModalOpen(true)}
                          className="btn bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          Let my agent cover it
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          navigate(`/${accountUrl}/settings/upgrade`)
                        }
                        className="btn bg-violet-600 text-white hover:bg-violet-700 inline-flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Upgrade plan
                      </button>
                      {hasStripeBilling &&
                        (sub?.status === "active" ||
                          sub?.status === "trialing" ||
                          billing?.mockMode) && (
                        <button
                          type="button"
                          onClick={handleManageBilling}
                          disabled={portalLoading}
                          className="flex items-center gap-2 btn bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50"
                        >
                          {portalLoading && (
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          )}
                          Manage billing
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-6">
                    {sub || billing?.mockMode ? (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div>
                            <p className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
                              {plan?.name || "Maintain"}
                            </p>
                            {sub?.currentPeriodEnd && (
                              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                {sub.cancelAtPeriodEnd
                                  ? "Access until"
                                  : t("settings.renewsOn") || "Renews on"}{" "}
                                <strong>
                                  {formatDate(sub.currentPeriodEnd)}
                                </strong>
                              </p>
                            )}
                          </div>
                          <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 font-medium text-emerald-800 dark:text-emerald-300">
                            {sub?.status || "Active"}
                          </span>
                        </div>
                        {sub?.cancelAtPeriodEnd && (
                          <div className="mt-4 flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 px-4 py-3">
                            <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                              Your subscription will be canceled on{" "}
                              <strong>{formatDate(sub.currentPeriodEnd)}</strong>.
                              You keep full access until then.
                            </p>
                            <button
                              type="button"
                              onClick={handleReactivate}
                              disabled={reactivateLoading}
                              className="shrink-0 btn bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50"
                            >
                              {reactivateLoading ? (
                                <span className="inline-flex items-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Reactivating…
                                </span>
                              ) : (
                                "Keep my plan"
                              )}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400">
                        {t("settings.noActivePlan") ||
                          "No active subscription."}
                      </p>
                    )}
                  </div>
                </section>

                {(sub || billing?.mockMode) && (
                  <section className="rounded-xl bg-white dark:bg-gray-800 shadow-xs overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700/60">
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {t("settings.invoiceHistory") || "Invoice History"}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {t("settings.invoiceHistoryDescription") ||
                          "View and download your past invoices."}
                      </p>
                    </div>
                    <div className="p-6">
                      {invoices.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                                <th className="pb-3 font-medium">
                                  {t("settings.invoiceDate") || "Date"}
                                </th>
                                <th className="pb-3 font-medium">
                                  {t("settings.invoiceAmount") || "Amount"}
                                </th>
                                <th className="pb-3 font-medium text-right">
                                  {t("settings.invoiceActions") || "Actions"}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoices.map((inv) => (
                                <tr
                                  key={inv.id}
                                  className="border-b border-gray-100 dark:border-gray-700/60"
                                >
                                  <td className="py-3 text-gray-800 dark:text-gray-200">
                                    {inv.created
                                      ? formatDate(inv.created)
                                      : "—"}
                                  </td>
                                  <td className="py-3 text-gray-800 dark:text-gray-200">
                                    {inv.currency?.toUpperCase() === "USD"
                                      ? `$${((inv.amountDue || 0) / 100).toFixed(2)}`
                                      : `${(inv.amountDue || 0) / 100} ${(inv.currency || "").toUpperCase()}`}
                                  </td>
                                  <td className="py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                      {inv.hostedInvoiceUrl && (
                                        <a
                                          href={inv.hostedInvoiceUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          {t("settings.viewInvoice") || "View"}
                                        </a>
                                      )}
                                      {inv.invoicePdf && (
                                        <a
                                          href={inv.invoicePdf}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline"
                                        >
                                          <FileText className="w-4 h-4" />
                                          PDF
                                        </a>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t("settings.noInvoices") ||
                            "No invoices yet. Invoices appear here after your first payment."}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {limits && (
                  <section className="rounded-xl bg-white dark:bg-gray-800 shadow-xs overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700/60">
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {t("settings.planLimits") || "Usage & Limits"}
                      </h2>
                    </div>
                    <div className="p-6">
                      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {targetRole === "agent"
                              ? t("settings.propertiesManaged") || "Properties managed"
                              : t("settings.properties") || "Properties"}
                          </dt>
                          <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {usage.propertiesCount ?? 0} /{" "}
                            {limits.maxProperties ?? "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {t("settings.contacts") || "Contacts"}
                          </dt>
                          <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {usage.contactsCount ?? 0} /{" "}
                            {limits.maxContacts ?? "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            AI tokens (this month)
                          </dt>
                          <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {(usage.aiTokensUsed ?? 0).toLocaleString()} /{" "}
                            {(limits.aiTokenMonthlyQuota ?? 0).toLocaleString()}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </section>
                )}

                {targetRole === "agent" && sponsoredProperties.length > 0 && (
                  <section className="rounded-xl bg-white dark:bg-gray-800 shadow-xs overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700/60">
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        Properties you cover
                      </h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        These clients' properties are billed under your plan at no
                        extra charge.
                        {limits?.maxProperties != null && (
                          <>
                            {" "}
                            You're using{" "}
                            <strong>
                              {usage.propertiesCount ?? 0}/{limits.maxProperties}
                            </strong>{" "}
                            of your plan's property capacity.
                          </>
                        )}
                      </p>
                      {limits?.maxProperties != null &&
                        (usage.propertiesCount ?? 0) >= limits.maxProperties && (
                          <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                            You've reached your plan's property limit. Upgrade to
                            cover more client properties.
                          </p>
                        )}
                    </div>
                    <div className="p-6 space-y-3">
                      {sponsoredProperties.map((sp) => (
                        <div
                          key={sp.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-[#456564]/15 flex items-center justify-center shrink-0">
                              <Home className="w-4 h-4 text-[#456564]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {sp.propertyLabel}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {sp.beneficiaryName}
                                {sp.status === "pending"
                                  ? ` • starts ${formatDate(sp.effectiveAt)}`
                                  : " • active"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleEndSponsorship(sp.id)}
                            disabled={sponsorshipLoading}
                            className="shrink-0 btn-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-sm disabled:opacity-50"
                          >
                            End coverage
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {plans.length > 0 && (
                  <section className="rounded-xl bg-white dark:bg-gray-800 shadow-xs overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700/60">
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {t("settings.availablePlans") || "Available Plans"}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {hasStripeBilling
                          ? t("settings.upgradeDescriptionWithPortal") ||
                            "Upgrade your plan or use Manage billing above for payment methods and invoices."
                          : t("settings.upgradeDescription") ||
                            "Upgrade to unlock more features."}
                      </p>
                    </div>
                    <div className="p-6">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {plans.map((p) => {
                          const isCurrent = plan?.code === p.code;
                          const lim = p.limits || {};
                          return (
                            <div
                              key={p.code}
                              className={`rounded-lg border-2 p-4 ${
                                isCurrent
                                  ? "border-emerald-500 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10"
                                  : "border-gray-200 dark:border-gray-700"
                              }`}
                            >
                              <p className="font-semibold text-gray-900 dark:text-white capitalize">
                                {p.name}
                              </p>
                              <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                <li>
                                  • {lim.maxProperties ?? "—"}{" "}
                                  {t("settings.properties") || "properties"}
                                </li>
                                <li>
                                  • {lim.maxContacts ?? "—"}{" "}
                                  {t("settings.contacts") || "contacts"}
                                </li>
                                <li>
                                  •{" "}
                                  {(
                                    lim.aiTokenMonthlyQuota ?? 0
                                  ).toLocaleString()}{" "}
                                  AI tokens/mo
                                </li>
                              </ul>
                              {isCurrent && (
                                <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                  {t("settings.currentPlan") || "Current Plan"}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </main>
      
  );
}

export default BillingPage;
