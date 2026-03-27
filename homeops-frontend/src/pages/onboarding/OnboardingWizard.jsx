import {useState, useEffect, useCallback} from "react";
import {useNavigate} from "react-router-dom";
import {
  Home,
  Briefcase,
  ArrowLeft,
  ChevronRight,
  Check,
  X as XIcon,
  Loader2,
} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import opsyImg from "../../images/opsy1.png";
import OpsyHeader from "../../images/OpsyHeader.png";
import {
  HOMEOWNER_PLANS,
  AGENT_PLANS,
  PLAN_LIMITS,
  PLAN_CODE_TO_SUBSCRIPTION_TIER,
} from "./onboardingPlans";

const ROLE_OPTIONS = [
  {
    id: "homeowner",
    title: "Homeowner",
    description: "I own or manage my own properties",
    icon: Home,
  },
  {
    id: "agent",
    title: "Agent",
    description: "I help clients manage their properties",
    icon: Briefcase,
  },
];

function StepIndicator({currentStep, totalSteps}) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
        Step {currentStep} of {totalSteps}
      </span>
      <div className="flex gap-1.5">
        {Array.from({length: totalSteps}).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i + 1 <= currentStep
                ? "w-6 bg-emerald-600 dark:bg-emerald-500"
                : "w-1.5 bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Step1Role({role, onSelect}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center">
        Are you a Homeowner or an Agent?
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {ROLE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = role === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={`relative flex flex-col items-center p-6 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? "border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50"
              }`}
            >
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              )}
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${
                  isSelected
                    ? "bg-emerald-100 dark:bg-emerald-900/50"
                    : "bg-gray-100 dark:bg-gray-700"
                }`}
              >
                <Icon
                  className={`w-6 h-6 ${isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-gray-500 dark:text-gray-400"}`}
                />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {opt.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Build fallback plans using structure from onboardingPlans, prices and limits from subscription products API. */
function buildFallbackPlans(role, subscriptionProducts = []) {
  const hardcoded = role === "homeowner" ? HOMEOWNER_PLANS : AGENT_PLANS;
  return hardcoded.map((p) => {
    const code = p.code || p.id;
    const product = subscriptionProducts.find(
      (sp) => (sp.code || sp.id) === code,
    );
    let stripePricesFromApi = null;
    let limitsFromProduct = null;
    if (product) {
      const monthPrice = product.prices?.find(
        (pr) => pr.billingInterval === "month",
      );
      const yearPrice = product.prices?.find(
        (pr) => pr.billingInterval === "year",
      );
      if (monthPrice?.unitAmount != null || yearPrice?.unitAmount != null) {
        stripePricesFromApi = {};
        if (monthPrice?.unitAmount != null) {
          stripePricesFromApi.month = {
            unitAmount: monthPrice.unitAmount,
            currency: monthPrice.currency || "usd",
          };
        }
        if (yearPrice?.unitAmount != null) {
          stripePricesFromApi.year = {
            unitAmount: yearPrice.unitAmount,
            currency: yearPrice.currency || "usd",
          };
        }
      }
      if (product.limits) {
        limitsFromProduct = {
          maxProperties: product.limits.maxProperties,
          maxContacts: product.limits.maxContacts,
          aiTokenMonthlyQuota: product.limits.aiTokenMonthlyQuota,
        };
      }
    }
    const planLimits = PLAN_LIMITS[role]?.[code] || {};
    const limits = {
      maxProperties: limitsFromProduct?.maxProperties ?? planLimits.properties,
      maxContacts: limitsFromProduct?.maxContacts ?? planLimits.contacts,
      aiTokenMonthlyQuota: limitsFromProduct?.aiTokenMonthlyQuota,
    };
    return {
      ...p,
      code,
      price: p.price === 0 ? 0 : null,
      stripePrices: stripePricesFromApi,
      features: p.features
        ? [...(p.features.core || []), ...(p.features.advanced || [])].map(
            (f, i) => ({
              id: `${code}_f${i}`,
              label: `${f.label}: ${f.value}`,
              included: f.value !== "None",
            }),
          )
        : [],
      limits,
    };
  });
}

const LIMIT_KEYWORDS = {
  properties: /propert/i,
  contacts: /contact/i,
  tokens: /token|data ingestion/i,
};

/**
 * Build the final display features for a plan card.
 * Generates limit items directly from plan_limits, then appends
 * stored features (skipping any that duplicate the limit items).
 */
function getDisplayFeatures(plan) {
  const features = plan.features || [];
  const limits = plan.limits || {};
  const maxProps = limits.maxProperties ?? limits.properties;
  const maxContacts = limits.maxContacts ?? limits.contacts;
  const tokens = limits.aiTokenMonthlyQuota;

  const limitFeatures = [];
  if (maxProps != null) {
    const label =
      typeof maxProps === "number"
        ? maxProps === 1
          ? "1 property"
          : `Up to ${maxProps} properties`
        : String(maxProps);
    limitFeatures.push({
      id: "_lim_props",
      label,
      included: true,
      _limitKey: "properties",
    });
  }
  if (maxContacts != null) {
    const label =
      typeof maxContacts === "number"
        ? `Up to ${maxContacts.toLocaleString()} contacts`
        : String(maxContacts);
    limitFeatures.push({
      id: "_lim_contacts",
      label,
      included: true,
      _limitKey: "contacts",
    });
  }
  if (tokens != null && tokens > 0) {
    limitFeatures.push({
      id: "_lim_tokens",
      label: `${tokens.toLocaleString()} tokens/month`,
      included: true,
      _limitKey: "tokens",
    });
  }

  const coveredKeys = new Set(limitFeatures.map((l) => l._limitKey));
  // Only list features marked included in Super Admin > Billing Plans (omit unchecked rows).
  const productFeatures = features.filter((f) => f.included !== false);
  const filtered = productFeatures.filter((f) => {
    const lower = (f.label || "").toLowerCase();
    for (const [key, re] of Object.entries(LIMIT_KEYWORDS)) {
      if (coveredKeys.has(key) && re.test(lower)) return false;
    }
    return true;
  });

  return [...limitFeatures, ...filtered];
}

function isZeroCostPlan(plan, billingInterval = "month") {
  if (!plan) return false;
  const intervalPrice = plan?.stripePrices?.[billingInterval];
  if (typeof intervalPrice?.unitAmount === "number") {
    return intervalPrice.unitAmount <= 0;
  }
  const normalizedPrice =
    plan?.price != null && plan?.price !== "" ? Number(plan.price) : Number.NaN;
  return Number.isFinite(normalizedPrice) && normalizedPrice <= 0;
}

function Step2Plan({
  role,
  plan,
  onSelect,
  billingInterval,
  onBillingIntervalChange,
  apiPlans,
  subscriptionProducts = [],
  apiLoading,
}) {
  const plans =
    apiPlans && apiPlans.length > 0
      ? apiPlans
      : buildFallbackPlans(role, subscriptionProducts);
  const hasPaidPlans = plans.some(
    (p) =>
      p.stripePrices?.month?.unitAmount > 0 ||
      p.stripePrices?.year?.unitAmount > 0 ||
      (p.price != null && p.price > 0),
  );
  const gridCols = plans.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3";

  return (
    <div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Choose your plan
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          Select the plan that best fits your needs
        </p>
      </div>

      {hasPaidPlans && (
        <div className="flex justify-center mt-6">
          <div className="relative inline-flex rounded-full p-1 bg-white/80 dark:bg-gray-800 shadow-sm border border-gray-200/60 dark:border-gray-700">
            <button
              type="button"
              onClick={() => onBillingIntervalChange?.("month")}
              className={`relative z-10 w-32 py-2.5 rounded-full text-sm font-medium transition-colors duration-300 flex flex-col items-center leading-tight ${
                billingInterval === "month"
                  ? "text-white"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <span>Pay Monthly</span>
              <span
                className={`text-xs transition-colors duration-300 ${billingInterval === "month" ? "text-white/90" : "text-gray-500 dark:text-gray-500"}`}
              >
                Commit monthly
              </span>
            </button>
            <button
              type="button"
              onClick={() => onBillingIntervalChange?.("year")}
              className={`relative z-10 w-32 py-2.5 rounded-full text-sm font-medium transition-colors duration-300 flex flex-col items-center leading-tight ${
                billingInterval === "year"
                  ? "text-white"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
            >
              <span>Pay Annually</span>
              <span
                className={`text-xs transition-colors duration-300 ${billingInterval === "year" ? "text-white/90" : "text-gray-500 dark:text-gray-500"}`}
              >
                Best Value
              </span>
            </button>
            <div
              className={`absolute top-1 left-1 z-0 h-[calc(100%-8px)] w-32 rounded-full bg-emerald-600 dark:bg-emerald-500 transition-transform duration-300 ease-out ${
                billingInterval === "month" ? "translate-x-0" : "translate-x-32"
              }`}
            />
          </div>
        </div>
      )}

      {apiLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${gridCols} gap-5 mt-10`}>
          {plans.map((p) => {
            const planId = p.code || p.id;
            const isSelected = plan === planId;
            const isPopular = p.popular;

            const features = getDisplayFeatures(p);

            const isEnterprise =
              /enterprise/i.test(planId) || /enterprise/i.test(p.name || "");
            const isPaidPlan =
              p.stripePrices?.month?.unitAmount > 0 ||
              p.stripePrices?.year?.unitAmount > 0 ||
              (p.price != null && p.price > 0);
            const isYearly =
              hasPaidPlans && billingInterval === "year" && isPaidPlan;

            let displayPrice;
            let yearlyTotal = null;
            if (isEnterprise) {
              displayPrice = "Contact Sales";
              yearlyTotal = null;
            } else if (p.price === 0 && !isPaidPlan) {
              displayPrice = "Free";
            } else if (isYearly && p.stripePrices?.year?.unitAmount) {
              const monthlyEquiv = p.stripePrices.year.unitAmount / 100 / 12;
              displayPrice = `$${monthlyEquiv.toFixed(2)}`;
              yearlyTotal = (p.stripePrices.year.unitAmount / 100).toFixed(2);
            } else if (p.stripePrices?.month?.unitAmount) {
              displayPrice = `$${(p.stripePrices.month.unitAmount / 100).toFixed(2)}`;
            } else if (!isPaidPlan) {
              displayPrice = "Free";
            } else {
              displayPrice = "—";
            }

            return (
              <div
                key={planId}
                className={`relative rounded-2xl flex flex-col transition-all duration-200 backdrop-blur-sm border bg-white/80 dark:bg-gray-800/80 ${
                  isPopular
                    ? "border-emerald-400/60 dark:border-emerald-600/40 shadow-md z-10"
                    : isSelected
                      ? "border-emerald-500 shadow-lg shadow-emerald-500/10"
                      : "border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md"
                } ${isSelected ? "ring-2 ring-emerald-500 dark:ring-emerald-400 ring-inset" : ""}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-block bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-3 py-0.5 rounded-full tracking-wide">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-6 pb-0 flex flex-col flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {p.name}
                  </h3>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`font-extrabold tracking-tight text-gray-900 dark:text-gray-100 ${isEnterprise ? "text-2xl" : "text-4xl"}`}
                      >
                        {displayPrice}
                      </span>
                      {!isEnterprise && p.price != null && p.price > 0 && (
                        <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                          /mo
                        </span>
                      )}
                    </div>
                    {yearlyTotal != null && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        ${yearlyTotal}/year billed annually
                      </p>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {p.description}
                  </p>
                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      onClick={() => onSelect(planId)}
                      className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                        isSelected
                          ? `bg-emerald-600 text-white shadow-sm ${
                              isPopular ? "border border-transparent" : ""
                            }`
                          : isPopular
                            ? "bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 border border-emerald-500/50 dark:border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                            : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                      }`}
                    >
                      {isSelected ? "Selected" : "Select Plan"}
                    </button>
                  </div>
                </div>

                <div className="mx-6 my-5 border-t border-gray-100 dark:border-gray-700/60" />

                <div className="px-6 pb-6 space-y-2">
                  {features.map((f) => (
                    <div key={f.id} className="flex items-center gap-2">
                      {f.included ? (
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <XIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm ${
                          f.included
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-400 dark:text-gray-500 line-through"
                        }`}
                      >
                        {f.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step3Confirmation({role, plan, apiPlans}) {
  const roleLabel = role === "homeowner" ? "Homeowner" : "Agent";

  const allPlans =
    apiPlans && apiPlans.length > 0
      ? apiPlans
      : role === "homeowner"
        ? HOMEOWNER_PLANS
        : AGENT_PLANS;
  const planData = allPlans.find((p) => (p.code || p.id) === plan);
  const planLabel = planData?.name ?? plan;
  const lim = planData?.limits || PLAN_LIMITS[role]?.[plan] || {};

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center">
        Confirm your selection
      </h2>
      <div className="max-w-md mx-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400">Role</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {roleLabel}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 dark:text-gray-400">Plan</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {planLabel}
          </span>
        </div>
        <hr className="border-gray-200 dark:border-gray-700" />
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">
            Summary of limits
          </p>
          <ul className="space-y-1">
            <li>• Properties: {lim.maxProperties ?? lim.properties ?? "—"}</li>
            <li>• Contacts: {lim.maxContacts ?? lim.contacts ?? "—"}</li>
            {lim.maxDocumentsPerSystem != null && (
              <li>• Documents per system: {lim.maxDocumentsPerSystem}</li>
            )}
            {lim.aiTokenMonthlyQuota != null && lim.aiTokenMonthlyQuota > 0 && (
              <li>
                • AI tokens/month: {lim.aiTokenMonthlyQuota.toLocaleString()}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const {currentUser, refreshCurrentUser, logout} = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [plan, setPlan] = useState(null);
  const [billingInterval, setBillingInterval] = useState("month");
  const [apiPlans, setApiPlans] = useState([]);
  const [subscriptionProducts, setSubscriptionProducts] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadPlans = useCallback(async () => {
    if (!role) return;
    setApiLoading(true);
    try {
      const [plans, products] = await Promise.all([
        AppApi.getBillingPlans(role)
          .then((r) => r.plans || [])
          .catch(() => []),
        AppApi.getSubscriptionProductsByRole(role).catch(() => []),
      ]);
      setApiPlans(plans);
      setSubscriptionProducts(Array.isArray(products) ? products : []);
    } finally {
      setApiLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (role) loadPlans();
  }, [role, loadPlans]);

  useEffect(() => {
    const onPlansUpdated = () => {
      if (role) loadPlans();
    };
    window.addEventListener("plans-updated", onPlansUpdated);
    return () => window.removeEventListener("plans-updated", onPlansUpdated);
  }, [role, loadPlans]);

  const availablePlans =
    apiPlans && apiPlans.length > 0
      ? apiPlans
      : role
        ? buildFallbackPlans(role, subscriptionProducts)
        : [];
  const selectedPlan = availablePlans.find((p) => (p.code || p.id) === plan);
  const isFreePlan = Boolean(plan) && isZeroCostPlan(selectedPlan, billingInterval);

  const canContinue =
    (step === 1 && role) || (step === 2 && plan) || step === 3;

  async function handleComplete() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (isFreePlan) {
        const tier = PLAN_CODE_TO_SUBSCRIPTION_TIER[plan] || plan;
        await AppApi.completeOnboarding({role, subscriptionTier: tier});
        await refreshCurrentUser();
        const accounts = await AppApi.getUserAccounts(currentUser?.id);
        const accountUrl =
          accounts?.[0]?.url?.replace(/^\/+/, "") || accounts?.[0]?.name;
        if (accountUrl) {
          navigate(`/${accountUrl}/home`, {replace: true});
        } else {
          navigate("/", {replace: true});
        }
      } else {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const tier = PLAN_CODE_TO_SUBSCRIPTION_TIER[plan] || plan;
        const successUrl = `${origin}/billing/success?role=${encodeURIComponent(role)}&plan=${encodeURIComponent(tier)}&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${origin}/onboarding`;
        const {url} = await AppApi.createCheckoutSession({
          planCode: plan,
          billingInterval,
          successUrl,
          cancelUrl,
        });
        if (url) window.location.href = url;
        else setError("Could not start checkout. Please try again.");
      }
    } catch (err) {
      setError(
        err?.message || "Failed to complete onboarding. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] flex flex-col transition-colors duration-500 bg-white dark:bg-gray-900">
      <img
        src={OpsyHeader}
        alt="Opsy"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 md:top-6 md:right-8 h-8 sm:h-10 md:h-12 w-auto object-contain object-right z-10"
      />
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <img
          src={opsyImg}
          alt="Opsy"
          className="w-36 h-auto mb-6 object-contain"
        />
        <StepIndicator currentStep={step} totalSteps={3} />

        <div className={`w-full ${step === 2 ? "max-w-6xl" : "max-w-2xl"}`}>
          {step === 1 && <Step1Role role={role} onSelect={setRole} />}
          {step === 2 && (
            <Step2Plan
              role={role}
              plan={plan}
              onSelect={setPlan}
              billingInterval={billingInterval}
              onBillingIntervalChange={setBillingInterval}
              apiPlans={apiPlans}
              subscriptionProducts={subscriptionProducts}
              apiLoading={apiLoading}
            />
          )}
          {step === 3 && (
            <Step3Confirmation role={role} plan={plan} apiPlans={apiPlans} />
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        )}

        <div
          className={`flex items-center justify-between w-full mt-10 ${step === 2 ? "max-w-6xl" : "max-w-2xl"}`}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (step > 1) {
                  setStep((s) => s - 1);
                } else {
                  logout();
                  navigate("/signin", {replace: true});
                }
              }}
              className={
                step > 1
                  ? "btn bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  : "flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              }
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
          <div>
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={isSubmitting}
                className="btn bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isFreePlan ? "Completing..." : "Redirecting to payment..."}
                  </>
                ) : isFreePlan ? (
                  "Confirm & Continue"
                ) : (
                  "Continue to payment"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
