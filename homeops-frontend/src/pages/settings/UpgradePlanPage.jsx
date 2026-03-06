import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Sparkles,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Star,
} from "lucide-react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import { useAuth } from "../../context/AuthContext";
import AppApi from "../../api/api";
import { PAGE_LAYOUT } from "../../constants/layout";
import { HOMEOWNER_PLANS, AGENT_PLANS } from "../onboarding/onboardingPlans";

function UpgradePlanPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentAccount } = useCurrentAccount();
  const { currentUser } = useAuth();
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingInterval, setBillingInterval] = useState("month");
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  const accountId = currentAccount?.id;
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const userRole = (currentUser?.role || "homeowner").toLowerCase();
  const targetRole = ["agent", "admin"].includes(userRole) ? "agent" : "homeowner";
  const fallbackPlans = targetRole === "agent" ? AGENT_PLANS : HOMEOWNER_PLANS;

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        setError(null);
        const [statusRes, plansRes] = await Promise.all([
          AppApi.getBillingStatus(accountId).catch(() => null),
          AppApi.getBillingPlans(targetRole)
            .then((r) => r.plans || [])
            .catch(() => []),
        ]);
        if (cancelled) return;
        setBilling(statusRes);
        setPlans(plansRes.length > 0 ? plansRes : fallbackPlans);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load plans");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [accountId, targetRole]);

  const currentPlanCode = billing?.plan?.code;

  async function handleSelectPlan(plan) {
    if (plan.code === currentPlanCode) return;

    const freeCodes = ["homeowner_free", "agent_free"];
    if (freeCodes.includes(plan.code)) {
      navigate(`/${accountUrl}/settings/billing`);
      return;
    }

    setCheckoutLoading(plan.code);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const successUrl = `${origin}/#/billing/success?role=${encodeURIComponent(userRole)}&plan=${encodeURIComponent(plan.code)}`;
      const cancelUrl = `${origin}/#/${accountUrl}/settings/upgrade`;
      const { url } = await AppApi.createCheckoutSession({
        planCode: plan.code,
        billingInterval,
        successUrl,
        cancelUrl,
      });
      if (url) {
        window.location.href = url;
      } else {
        setError("Could not start checkout. Please try again.");
      }
    } catch (err) {
      setError(err?.message || "Failed to start checkout.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  function formatPrice(plan) {
    const prices = plan.stripePrices || {};
    const priceObj = prices[billingInterval];
    if (priceObj?.unitAmount != null) {
      const amount = priceObj.unitAmount / 100;
      return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
    }
    if (plan.price != null) {
      return plan.price === 0 ? "Free" : `$${plan.price}`;
    }
    return plan.priceLabel || "—";
  }

  function getPlanFeatures(plan) {
    if (Array.isArray(plan.features) && plan.features.length > 0) {
      if (plan.features[0]?.id) {
        return plan.features.filter((f) => f.included).map((f) => f.label);
      }
      if (plan.features.core) {
        return [
          ...plan.features.core.map((f) => `${f.label}: ${f.value}`),
          ...plan.features.advanced.map((f) => `${f.label}: ${f.value}`),
        ];
      }
    }
    const lim = plan.limits || {};
    const items = [];
    if (lim.maxProperties != null)
      items.push(`${lim.maxProperties} ${lim.maxProperties === 1 ? "property" : "properties"}`);
    if (lim.maxContacts != null) items.push(`${lim.maxContacts} contacts`);
    if (lim.aiTokenMonthlyQuota != null)
      items.push(`${(lim.aiTokenMonthlyQuota).toLocaleString()} AI tokens/mo`);
    if (lim.maxDocumentsPerSystem != null)
      items.push(`${lim.maxDocumentsPerSystem} docs per system`);
    if (lim.maxViewers != null)
      items.push(`${lim.maxViewers} shared viewers`);
    if (lim.maxTeamMembers != null)
      items.push(`${lim.maxTeamMembers} team members`);
    return items;
  }

  function getPlanTierIndex(planCode) {
    const allCodes = plans.map((p) => p.code);
    return allCodes.indexOf(planCode);
  }

  const currentIdx = getPlanTierIndex(currentPlanCode);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className={PAGE_LAYOUT.settings}>
            {/* Back link */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {/* Hero */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade your plan
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Choose the plan that's right for you
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Unlock more properties, contacts, AI features, and storage.
                {currentPlanCode && (
                  <> You're currently on the <strong className="text-gray-700 dark:text-gray-300 capitalize">{billing?.plan?.name || currentPlanCode}</strong> plan.</>
                )}
              </p>
            </div>

            {/* Billing interval toggle */}
            {plans.some((p) => p.stripePrices?.year || p.stripePrices?.annual) && (
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setBillingInterval("month")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                      billingInterval === "month"
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval("year")}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                      billingInterval === "year"
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    Yearly
                    <span className="ml-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Save 20%</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-start">
                {plans.map((plan) => {
                  const isCurrent = plan.code === currentPlanCode;
                  const planIdx = getPlanTierIndex(plan.code);
                  const isUpgrade = currentIdx >= 0 && planIdx > currentIdx;
                  const isDowngrade = currentIdx >= 0 && planIdx < currentIdx;
                  const features = getPlanFeatures(plan);
                  const price = formatPrice(plan);
                  const isPopular = plan.popular;
                  const isCheckingOut = checkoutLoading === plan.code;

                  return (
                    <div
                      key={plan.code || plan.id}
                      className={`relative flex flex-col rounded-2xl border-2 p-6 transition-shadow ${
                        isPopular
                          ? "border-violet-500 dark:border-violet-500 shadow-lg shadow-violet-500/10"
                          : isCurrent
                            ? "border-emerald-500 dark:border-emerald-500"
                            : "border-gray-200 dark:border-gray-700 hover:shadow-md"
                      }`}
                    >
                      {/* Popular badge */}
                      {isPopular && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-violet-600 text-white text-xs font-semibold shadow-sm">
                            <Star className="w-3 h-3 fill-current" />
                            Most popular
                          </span>
                        </div>
                      )}

                      {/* Plan name & description */}
                      <div className="mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
                          {plan.name}
                        </h3>
                        {plan.description && (
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {plan.description}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <div className="mb-6">
                        <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                          {price}
                        </span>
                        {price !== "Free" && (
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                            /{billingInterval === "year" ? "yr" : "mo"}
                          </span>
                        )}
                      </div>

                      {/* CTA */}
                      {isCurrent ? (
                        <div className="mb-6 py-2.5 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                          Current plan
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectPlan(plan)}
                          disabled={!!checkoutLoading}
                          className={`mb-6 w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            isPopular || isUpgrade
                              ? "bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                              : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                          }`}
                        >
                          {isCheckingOut ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Redirecting…
                            </span>
                          ) : isUpgrade ? (
                            "Upgrade"
                          ) : isDowngrade ? (
                            "Downgrade"
                          ) : (
                            "Get started"
                          )}
                        </button>
                      )}

                      {/* Features */}
                      <ul className="space-y-2.5 flex-1">
                        {features.map((feat, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                          >
                            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Trial info */}
                      {plan.trialDays > 0 && !isCurrent && (
                        <p className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 text-xs text-center text-gray-500 dark:text-gray-400">
                          {plan.trialDays}-day free trial included
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer note */}
            {!loading && (
              <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
                All plans include SSL encryption and secure data storage.
                Need help choosing?{" "}
                <button
                  type="button"
                  onClick={() => navigate(`/${accountUrl}/settings/support/new`)}
                  className="text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Contact support
                </button>
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default UpgradePlanPage;
