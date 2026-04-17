import React, {useState, useEffect, useCallback} from "react";
import {useNavigate} from "react-router-dom";
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
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";
import {
  HOMEOWNER_PLANS,
  AGENT_PLANS,
  PLAN_CODE_TO_SUBSCRIPTION_TIER,
} from "../onboarding/onboardingPlans";
import CouponCodeInput from "../../components/billing/CouponCodeInput";

/**
 * Color variants for PricingSwitch — emerald (user type) + violet (billing).
 * Solid darker thumb + white active label; muted inactive labels on tinted track.
 */
const PRICING_SWITCH_VARIANTS = {
  /** User type (Homeowner / Agent): deeper forest green, solid thumb + white label */
  emerald: {
    track:
      "bg-emerald-100/90 dark:bg-emerald-950/55 ring-1 ring-emerald-300/90 dark:ring-emerald-800/80",
    thumb:
      "bg-emerald-700 dark:bg-emerald-600 shadow-md shadow-emerald-900/25 ring-1 ring-emerald-800/60 dark:ring-emerald-400/30",
    activeText: "text-white",
    inactiveText:
      "text-emerald-900/45 dark:text-emerald-400/55 hover:text-emerald-900 dark:hover:text-emerald-200",
  },
  /** Billing interval: deeper purple, solid thumb + white label (pairs with emerald user toggle) */
  violet: {
    track:
      "bg-violet-100/90 dark:bg-violet-950/55 ring-1 ring-violet-300/90 dark:ring-violet-800/80",
    thumb:
      "bg-violet-700 dark:bg-violet-600 shadow-md shadow-violet-900/25 ring-1 ring-violet-800/60 dark:ring-violet-400/30",
    activeText: "text-white",
    inactiveText:
      "text-violet-900/45 dark:text-violet-400/55 hover:text-violet-900 dark:hover:text-violet-200",
  },
};

/**
 * Compact two-option pill control with a smoothly sliding thumb.
 * Sizes: "sm" for tight contexts, "md" for primary toggles.
 */
function PricingSwitch({
  value,
  onChange,
  left,
  right,
  ariaLabel,
  variant = "violet",
  size = "sm",
}) {
  const isRight = value === right.value;
  const v = PRICING_SWITCH_VARIANTS[variant] || PRICING_SWITCH_VARIANTS.violet;
  const sizeClasses =
    size === "md"
      ? "h-9 min-w-[7rem] px-5 text-sm"
      : "h-7 min-w-[5.5rem] px-4 text-xs";

  return (
    <div
      className={`relative inline-flex items-center rounded-full p-0.5 ${v.track}`}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        className={`pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-2px)] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none will-change-transform ${v.thumb}`}
        style={{transform: isRight ? "translateX(100%)" : "translateX(0)"}}
        aria-hidden
      />
      <button
        type="button"
        role="radio"
        aria-checked={!isRight}
        onClick={() => onChange(left.value)}
        className={`relative z-10 rounded-full font-semibold transition-colors duration-200 ease-out motion-reduce:transition-none ${sizeClasses} ${
          !isRight ? v.activeText : v.inactiveText
        }`}
      >
        {left.label}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={isRight}
        onClick={() => onChange(right.value)}
        className={`relative z-10 rounded-full font-semibold transition-colors duration-200 ease-out motion-reduce:transition-none ${sizeClasses} ${
          isRight ? v.activeText : v.inactiveText
        }`}
      >
        {right.label}
      </button>
    </div>
  );
}

/** At most one "Most popular" badge; list order matches API (sort_order, then price). */
function withSinglePopularFlag(plans) {
  if (!Array.isArray(plans) || plans.length === 0) return plans;
  let seen = false;
  return plans.map((p) => {
    if (!p.popular) return p;
    if (seen) return {...p, popular: false};
    seen = true;
    return p;
  });
}

function UpgradePlanPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const [billing, setBilling] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [billingInterval, setBillingInterval] = useState("month");
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const accountId = currentAccount?.id;
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const userRole = (currentUser?.role || "homeowner").toLowerCase();
  const isSuperAdmin = userRole === "super_admin";
  const targetRole = ["agent", "admin"].includes(userRole)
    ? "agent"
    : "homeowner";
  /** Super admins can switch between homeowner and agent pricing (reference). */
  const [planAudience, setPlanAudience] = useState("homeowner");
  const audienceForFetch = isSuperAdmin ? planAudience : targetRole;
  const fallbackPlans =
    audienceForFetch === "agent" ? AGENT_PLANS : HOMEOWNER_PLANS;

  const loadPlans = React.useCallback(async () => {
    if (!accountId) return;
    try {
      setError(null);
      /* Track API success vs failure separately. An empty list from a successful API
         call means "the admin has nothing active" — don't mask that with hardcoded plans
         from onboardingPlans.js, otherwise deactivated plans appear to keep showing. */
      let plansRes = [];
      let plansApiOk = true;
      try {
        const r = await AppApi.getBillingPlans(audienceForFetch);
        plansRes = r?.plans || [];
      } catch {
        plansApiOk = false;
      }
      const statusRes = await AppApi.getBillingStatus(accountId).catch(
        () => null,
      );
      setBilling(statusRes);
      setPlans(withSinglePopularFlag(plansApiOk ? plansRes : fallbackPlans));
    } catch (err) {
      setError(err?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [accountId, audienceForFetch, fallbackPlans]);

  useEffect(() => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadPlans();
  }, [accountId, loadPlans]);

  useEffect(() => {
    const onPlansUpdated = () => {
      if (accountId) loadPlans();
    };
    window.addEventListener("plans-updated", onPlansUpdated);
    return () => window.removeEventListener("plans-updated", onPlansUpdated);
  }, [accountId, loadPlans]);

  const currentPlanCode = billing?.plan?.code;

  function isZeroCostPlan(plan) {
    const intervalPrice = plan?.stripePrices?.[billingInterval];
    if (typeof intervalPrice?.unitAmount === "number") {
      return intervalPrice.unitAmount <= 0;
    }
    const normalizedPrice =
      plan?.price != null && plan?.price !== ""
        ? Number(plan.price)
        : Number.NaN;
    return Number.isFinite(normalizedPrice) && normalizedPrice <= 0;
  }

  async function handleSelectPlan(plan) {
    if (plan.code === currentPlanCode) return;

    if (isSuperAdmin && planAudience === "agent") return;

    if (isSuperAdmin && planAudience === "homeowner" && !isZeroCostPlan(plan)) {
      setError(
        "Super admin accounts do not require a paid subscription. You can still move to a free plan when applicable.",
      );
      return;
    }

    if (isZeroCostPlan(plan)) {
      setCheckoutLoading(plan.code);
      setError(null);
      try {
        const result = await AppApi.downgradeToPlan({
          planCode: plan.code,
          accountId: accountId ?? undefined,
        });
        window.dispatchEvent(new Event("plans-updated"));

        if (result.scheduled) {
          const dateStr = result.accessUntil
            ? new Date(result.accessUntil).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "";
          navigate(`/${accountUrl}/settings/billing`, {
            state: {
              planChanged: `Downgrade scheduled${dateStr ? ` — you keep your current plan until ${dateStr}` : ""}`,
            },
          });
        } else {
          navigate(`/${accountUrl}/settings/billing`, {
            state: {planChanged: plan.name || plan.code},
          });
        }
      } catch (err) {
        setError(
          err?.message ||
            "Could not change plan. Try again or use Manage billing in settings.",
        );
      } finally {
        setCheckoutLoading(null);
      }
      return;
    }

    setCheckoutLoading(plan.code);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const subscriptionTier =
        PLAN_CODE_TO_SUBSCRIPTION_TIER[plan.code] || plan.code;
      const successUrl = `${origin}/billing/success?role=${encodeURIComponent(userRole)}&plan=${encodeURIComponent(subscriptionTier)}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/${accountUrl}/settings/upgrade`;
      const {url} = await AppApi.createCheckoutSession({
        planCode: plan.code,
        billingInterval,
        successUrl,
        cancelUrl,
        couponCode: appliedCoupon?.code || undefined,
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
    let priceObj = prices[billingInterval];
    if (priceObj?.unitAmount == null) {
      priceObj =
        prices.month || prices.year || prices.annual || prices.yr || null;
    }
    if (priceObj?.unitAmount != null) {
      const amount = priceObj.unitAmount / 100;
      if (amount <= 0) return "Free";
      return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
    }
    if (plan.price === 0) return "Free";
    const legacy =
      plan?.price != null && plan?.price !== "" ? Number(plan.price) : NaN;
    if (Number.isFinite(legacy) && legacy <= 0) return "Free";
    return "—";
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
      items.push(
        `${lim.maxProperties} ${lim.maxProperties === 1 ? "property" : "properties"}`,
      );
    if (lim.maxContacts != null) items.push(`${lim.maxContacts} contacts`);
    if (lim.aiTokenMonthlyQuota != null)
      items.push(`${lim.aiTokenMonthlyQuota.toLocaleString()} AI tokens/mo`);
    if (lim.maxDocumentsPerSystem != null)
      items.push(`${lim.maxDocumentsPerSystem} docs per system`);
    if (lim.maxViewers != null) items.push(`${lim.maxViewers} shared viewers`);
    if (lim.maxTeamMembers != null)
      items.push(`${lim.maxTeamMembers} home owners`);
    return items;
  }

  function getPlanTierIndex(planCode) {
    const allCodes = plans.map((p) => p.code);
    return allCodes.indexOf(planCode);
  }

  const isAgentPricingView = isSuperAdmin && planAudience === "agent";
  /** Agent pricing is reference-only; tier index is not tied to the account subscription. */
  const planCodeForTierIndex = isAgentPricingView ? null : currentPlanCode;
  const homeownerCurrentIdx = getPlanTierIndex(planCodeForTierIndex);
  const currentIdx = homeownerCurrentIdx;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className={PAGE_LAYOUT.settingsWide}>
            {/* Back button */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn text-neutral-500 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100 mb-6 pl-0 focus:outline-none shadow-none"
            >
              <ArrowLeft className="w-5 h-5 shrink-0 mr-1" />
              <span className="text-lg">Back</span>
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
                {currentPlanCode && !isAgentPricingView && !isSuperAdmin && (
                  <>
                    {" "}
                    You're currently on the{" "}
                    <strong className="text-gray-700 dark:text-gray-300 capitalize">
                      {billing?.plan?.name || currentPlanCode}
                    </strong>{" "}
                    plan.
                  </>
                )}
                {isAgentPricingView && (
                  <>
                    {" "}
                    <span className="block mt-2 text-gray-600 dark:text-gray-400">
                      Agent pricing is shown for reference only.
                    </span>
                  </>
                )}
                {isSuperAdmin && !isAgentPricingView && (
                  <span className="block mt-2 text-amber-700/90 dark:text-amber-400/90 text-xs">
                    Super admin accounts are not billed for paid homeowner
                    plans.
                  </span>
                )}
              </p>
            </div>

            {/* Super admin: homeowner vs agent pricing */}
            {isSuperAdmin && (
              <div className="flex justify-center mb-6">
                <PricingSwitch
                  value={planAudience}
                  onChange={setPlanAudience}
                  left={{value: "homeowner", label: "Homeowner"}}
                  right={{value: "agent", label: "Agent"}}
                  ariaLabel="Homeowner or agent pricing"
                  variant="emerald"
                  size="md"
                />
              </div>
            )}

            {/* Billing interval toggle - only if at least one plan has yearly pricing active */}
            {plans.some(
              (p) => p.stripePrices?.year || p.stripePrices?.annual,
            ) &&
              plans.some((p) => p.stripePrices?.month) && (
                <div className="flex flex-col items-center mb-8 gap-1.5">
                  <PricingSwitch
                    value={billingInterval}
                    onChange={setBillingInterval}
                    left={{value: "month", label: "Monthly"}}
                    right={{value: "year", label: "Yearly"}}
                    ariaLabel="Monthly or yearly billing"
                    variant="violet"
                    size="sm"
                  />
                  <span
                    className={`text-[10px] font-semibold tracking-wide uppercase transition-opacity duration-200 ${
                      billingInterval === "year"
                        ? "text-violet-800 dark:text-violet-300 opacity-100"
                        : "text-gray-400 dark:text-gray-500 opacity-70"
                    }`}
                  >
                    Save 20% yearly
                  </span>
                </div>
              )}

            {/* Coupon Code — super admins don't check out paid plans from this page */}
            {!isAgentPricingView &&
              !(isSuperAdmin && planAudience === "homeowner") && (
                <div className="flex justify-center mb-6">
                  <CouponCodeInput
                    planCode={null}
                    onCouponApplied={setAppliedCoupon}
                  />
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
            ) : plans.length === 0 ? (
              <div className="mx-auto max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-6 py-10 text-center">
                <AlertCircle className="w-6 h-6 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  No plans available right now
                </h3>
                <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                  All subscription plans for your account type are currently
                  inactive. Please check back soon or{" "}
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/${accountUrl}/settings/support/new`)
                    }
                    className="text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    contact support
                  </button>
                  .
                </p>
              </div>
            ) : (
              <div
                className={`grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 items-start mx-auto ${
                  plans.length === 1
                    ? "lg:grid-cols-1 max-w-sm"
                    : plans.length === 2
                      ? "lg:grid-cols-2 max-w-2xl"
                      : plans.length === 3
                        ? "lg:grid-cols-3 max-w-4xl"
                        : "lg:grid-cols-4 max-w-6xl"
                }`}
              >
                {plans.map((plan) => {
                  const isCurrent =
                    !isSuperAdmin &&
                    !isAgentPricingView &&
                    plan.code === currentPlanCode;
                  const planIdx = getPlanTierIndex(plan.code);
                  const isUpgrade = currentIdx >= 0 && planIdx > currentIdx;
                  const isDowngrade = currentIdx >= 0 && planIdx < currentIdx;
                  const features = getPlanFeatures(plan);
                  const price = formatPrice(plan);
                  const isPopular = plan.popular;
                  const isCheckingOut = checkoutLoading === plan.code;
                  /** Super admin: account may still have a subscription row, but we don’t imply a “subscriber” plan — show a muted control instead of an empty slot. */
                  const superAdminSameTierAsBilling =
                    isSuperAdmin &&
                    !isAgentPricingView &&
                    !!currentPlanCode &&
                    plan.code === currentPlanCode;
                  const superAdminCannotSelectPaid =
                    isSuperAdmin &&
                    planAudience === "homeowner" &&
                    !isZeroCostPlan(plan);
                  const ctaDisabled =
                    !!checkoutLoading || superAdminCannotSelectPaid;

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
                      {isAgentPricingView ? (
                        <button
                          type="button"
                          disabled
                          className="mb-6 w-full py-2.5 rounded-lg text-sm font-semibold cursor-not-allowed opacity-[0.58] transition-opacity bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-400"
                        >
                          {isUpgrade
                            ? "Upgrade"
                            : isDowngrade
                              ? "Downgrade"
                              : "Get started"}
                        </button>
                      ) : superAdminSameTierAsBilling ? (
                        <button
                          type="button"
                          disabled
                          className="mb-6 w-full py-2.5 rounded-lg text-sm font-semibold cursor-not-allowed opacity-[0.55] bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-400 border border-gray-200/80 dark:border-gray-700/80"
                        >
                          {isZeroCostPlan(plan) ? "Free" : "Included"}
                        </button>
                      ) : isCurrent ? (
                        <div className="mb-6 py-2.5 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                          Current plan
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectPlan(plan)}
                          disabled={ctaDisabled}
                          className={`mb-6 w-full py-2.5 rounded-lg text-sm font-semibold transition-[opacity,transform] duration-200 ease-out disabled:cursor-not-allowed motion-reduce:transition-none ${
                            superAdminCannotSelectPaid
                              ? isPopular || isUpgrade
                                ? "bg-violet-600 text-white shadow-sm opacity-[0.58]"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white opacity-[0.58]"
                              : isPopular || isUpgrade
                                ? "bg-violet-600 hover:bg-violet-700 text-white shadow-sm disabled:opacity-50"
                                : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white disabled:opacity-50"
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
                All plans include SSL encryption and secure data storage. Need
                help choosing?{" "}
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/${accountUrl}/settings/support/new`)
                  }
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
