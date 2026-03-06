import React, {useState, useEffect} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {Sparkles, Loader2, CreditCard, FileText, ExternalLink} from "lucide-react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";

/**
 * Billing page — current plan, usage vs limits, Stripe Customer Portal.
 * Uses /billing/status and /billing/portal-session.
 */
function BillingPage() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const accountId = currentAccount?.id;
  const userRole = (currentUser?.role || "homeowner").toLowerCase();
  const targetRole = ["agent", "admin"].includes(userRole)
    ? "agent"
    : "homeowner";

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    async function fetch() {
      try {
        setError(null);
        const [statusRes, plansRes, pmRes, invoicesRes] = await Promise.all([
          AppApi.getBillingStatus(accountId).then((r) => r).catch(() => null),
          AppApi.getBillingPlans(targetRole).then((r) => r.plans || []).catch(() => []),
          AppApi.getBillingPaymentMethod(accountId).then((r) => r?.paymentMethod).catch(() => null),
          AppApi.getBillingInvoices(accountId).then((r) => r?.invoices || []).catch(() => []),
        ]);
        setBilling(statusRes);
        setPlans(plansRes);
        setPaymentMethod(pmRes);
        setInvoices(invoicesRes);
      } catch (err) {
        setError(err?.message || "Failed to load billing data");
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [accountId, targetRole]);

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

  if (!accountId) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 overflow-y-auto">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className={`grow ${PAGE_LAYOUT.settings}`}>
            <p className="text-gray-600 dark:text-gray-400">
              Select an account to view billing.
            </p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
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
                      {(sub?.status === "active" ||
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
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <p className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
                            {plan?.name || "Maintain"}
                          </p>
                          {sub?.currentPeriodEnd && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                              {t("settings.renewsOn") || "Renews on"}{" "}
                              <strong>
                                {formatDate(sub.currentPeriodEnd)}
                              </strong>
                              {sub.cancelAtPeriodEnd && (
                                <span className="ml-2 text-amber-600 dark:text-amber-400">
                                  (cancels at period end)
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 font-medium text-emerald-800 dark:text-emerald-300">
                          {sub?.status || "Active"}
                        </span>
                      </div>
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
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700/60 flex flex-wrap items-center justify-between gap-4">
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {t("settings.paymentMethod") || "Payment Method"}
                      </h2>
                      <button
                        type="button"
                        onClick={handleManageBilling}
                        disabled={portalLoading}
                        className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
                      >
                        {paymentMethod
                          ? (t("settings.updatePaymentMethod") || "Update")
                          : (t("settings.addPaymentMethod") || "Add payment method")}
                      </button>
                    </div>
                    <div className="p-6">
                      {paymentMethod ? (
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                          <span className="text-gray-800 dark:text-gray-100 capitalize">
                            {paymentMethod.brand} •••• {paymentMethod.last4}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t("settings.noPaymentMethod") ||
                            "No payment method on file. Use Manage billing to add one."}
                        </p>
                      )}
                    </div>
                  </section>
                )}

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
                                <th className="pb-3 font-medium">{t("settings.invoiceDate") || "Date"}</th>
                                <th className="pb-3 font-medium">{t("settings.invoiceAmount") || "Amount"}</th>
                                <th className="pb-3 font-medium text-right">{t("settings.invoiceActions") || "Actions"}</th>
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
                            {t("settings.properties") || "Properties"}
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

                {plans.length > 0 && (
                  <section className="rounded-xl bg-white dark:bg-gray-800 shadow-xs overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700/60">
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        {t("settings.availablePlans") || "Available Plans"}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {t("settings.upgradeDescription") ||
                          "Upgrade via Manage billing above."}
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
      </div>
    </div>
  );
}

export default BillingPage;
