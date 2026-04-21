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
import {markPostLoginWelcomeGreeting} from "../../utils/authNavigation";
import AppApi from "../../api/api";
import opsyImg from "../../images/opsy1.png";
import OpsyHeader from "../../images/OpsyHeader.png";
import {
  HOMEOWNER_PLANS,
  AGENT_PLANS,
  PLAN_LIMITS,
  PLAN_CODE_TO_SUBSCRIPTION_TIER,
} from "./onboardingPlans";
import CouponCodeInput from "../../components/billing/CouponCodeInput";

/** At most one "Most popular" badge per list (API order). */
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
          maxDocumentsPerSystem: product.limits.maxDocumentsPerSystem,
          aiFeaturesEnabled: product.limits.aiFeaturesEnabled,
        };
      }
    }
    const planLimits = PLAN_LIMITS[role]?.[code] || {};
    const limits = {
      maxProperties: limitsFromProduct?.maxProperties ?? planLimits.properties,
      maxContacts: limitsFromProduct?.maxContacts ?? planLimits.contacts,
      aiTokenMonthlyQuota: limitsFromProduct?.aiTokenMonthlyQuota,
      maxDocumentsPerSystem:
        limitsFromProduct?.maxDocumentsPerSystem ??
        planLimits.maxDocumentsPerSystem ??
        5,
      aiFeaturesEnabled:
        limitsFromProduct?.aiFeaturesEnabled ??
        planLimits.aiFeaturesEnabled ??
        true,
    };
    const productFeatures = Array.isArray(product?.features)
      ? product.features
          .map((f, i) => ({
            id: f?.id || `${code}_pf${i}`,
            label: String(f?.label || "").trim(),
            included: f?.included !== false,
          }))
          .filter((f) => f.label)
      : [];
    const fallbackFeatures = p.features
      ? [...(p.features.core || []), ...(p.features.advanced || [])].map(
          (f, i) => ({
            id: `${code}_f${i}`,
            label: `${f.label}: ${f.value}`,
            included: f.value !== "None",
          }),
        )
      : [];
    return {
      ...p,
      name: product?.name || p.name,
      description: product?.description ?? p.description,
      popular:
        typeof product?.popular === "boolean" ? product.popular : p.popular,
      code,
      price: p.price === 0 ? 0 : null,
      stripePrices: stripePricesFromApi,
      features: productFeatures.length > 0 ? productFeatures : fallbackFeatures,
      limits,
    };
  });
}

/**
 * Build the final display features for a plan card.
 * Prefer features configured on the subscription product.
 * If none exist, fall back to generated limit-based rows.
 */
function getDisplayFeatures(plan) {
  const features = plan.features || [];
  const limits = plan.limits || {};
  const maxProps = limits.maxProperties ?? limits.properties;
  const maxContacts = limits.maxContacts ?? limits.contacts;
  const tokens = limits.aiTokenMonthlyQuota;

  const productFeatures = features
    .filter((f) => f.included !== false)
    .map((f, i) => ({
      id: f.id || `feature_${i}`,
      label: String(f.label || "").trim(),
      included: true,
    }))
    .filter((f) => f.label);

  if (productFeatures.length > 0) {
    return productFeatures;
  }

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

  return limitFeatures;
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
  apiPlansLoaded,
  subscriptionProducts = [],
  apiLoading,
  onCouponApplied,
}) {
  /* When the API call succeeded (apiPlansLoaded), trust its result — even if empty —
     so that admin deactivations are honored. Only render hardcoded fallback plans when
     the API call actually errored. */
  const plans = withSinglePopularFlag(
    apiPlansLoaded
      ? apiPlans || []
      : buildFallbackPlans(role, subscriptionProducts),
  );
  const hasPaidPlans = plans.some(
    (p) =>
      p.stripePrices?.month?.unitAmount > 0 ||
      p.stripePrices?.year?.unitAmount > 0 ||
      (p.price != null && p.price > 0),
  );
  const hasMonthly = plans.some((p) => p.stripePrices?.month);
  const hasYearly = plans.some(
    (p) => p.stripePrices?.year || p.stripePrices?.annual,
  );
  const showIntervalToggle = hasPaidPlans && hasMonthly && hasYearly;
  const colCount = Math.min(Math.max(plans.length, 1), 5);
  const gridColsMap = {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
  };
  const gridCols = gridColsMap[colCount] || "md:grid-cols-3";

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

      {showIntervalToggle && (
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

      {/* Coupon Code */}
      <div className="flex justify-center mt-4">
        <CouponCodeInput planCode={null} onCouponApplied={onCouponApplied} />
      </div>

      {apiLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : plans.length === 0 ? (
        <div className="mt-10 mx-auto max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            No plans available right now
          </h3>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            All subscription plans for your account type are currently inactive.
            Please check back soon.
          </p>
        </div>
      ) : (
        <div
          className={`mt-10 flex flex-col gap-5 md:grid md:grid-rows-[auto_auto_1fr_auto_auto] md:gap-5 ${gridCols}`}
        >
          {plans.map((p, index) => {
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
            const monthUnit = p.stripePrices?.month?.unitAmount;
            const yearUnit = p.stripePrices?.year?.unitAmount;
            if (isEnterprise) {
              displayPrice = "Contact Sales";
            } else if (isYearly && typeof yearUnit === "number") {
              if (yearUnit === 0) {
                displayPrice = "Free";
              } else {
                const monthlyEquiv = yearUnit / 100 / 12;
                displayPrice = `$${monthlyEquiv.toFixed(2)}`;
                yearlyTotal = (yearUnit / 100).toFixed(2);
              }
            } else if (typeof monthUnit === "number") {
              displayPrice =
                monthUnit === 0 ? "Free" : `$${(monthUnit / 100).toFixed(2)}`;
            } else if (p.price === 0 || !isPaidPlan) {
              displayPrice = "Free";
            } else {
              displayPrice = "—";
            }
            const showPerMonth = displayPrice.startsWith("$");

            return (
              <div
                key={planId}
                className={`relative rounded-2xl max-md:flex max-md:flex-col md:grid md:grid-rows-subgrid md:row-span-5 md:row-start-1 transition-all duration-200 backdrop-blur-sm border bg-white/80 dark:bg-gray-800/80 ${
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

                <h3 className="px-6 pt-6 text-lg font-bold text-gray-900 dark:text-gray-100">
                  {p.name}
                </h3>
                <div className="px-6 mt-3">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`font-extrabold tracking-tight text-gray-900 dark:text-gray-100 ${isEnterprise ? "text-2xl" : "text-4xl"}`}
                    >
                      {displayPrice}
                    </span>
                    {showPerMonth && (
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
                <p className="px-6 mt-2 min-h-0 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {p.description}
                </p>
                <div className="px-6 pt-5">
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

                <div className="mx-6 mt-5 border-t border-gray-100 dark:border-gray-700/60 pt-5 pb-6 space-y-2">
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

function Step3Confirmation({role, plan, selectedPlan}) {
  const roleLabel = role === "homeowner" ? "Homeowner" : "Agent";

  const planLabel = selectedPlan?.name ?? plan;
  const fallbackLim = PLAN_LIMITS[role]?.[plan] || {};
  const rawLim =
    selectedPlan?.limits && typeof selectedPlan.limits === "object"
      ? selectedPlan.limits
      : {};
  const lim = {...fallbackLim, ...rawLim};
  const propsVal = lim.maxProperties ?? lim.properties ?? "—";
  const contactsVal = lim.maxContacts ?? lim.contacts ?? "—";
  const docsVal = lim.maxDocumentsPerSystem;
  const docsDisplay =
    docsVal != null && docsVal !== ""
      ? typeof docsVal === "number"
        ? docsVal.toLocaleString()
        : String(docsVal)
      : "—";
  const aiAssistance =
    lim.aiFeaturesEnabled === false ? "No AI Assistance" : "AI Assistance";

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
            <li>• Properties: {propsVal}</li>
            <li>• Contacts: {contactsVal}</li>
            <li>• Documents per System: {docsDisplay}</li>
            <li>• {aiAssistance}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const {currentUser, refreshCurrentUser, logout} = useAuth();

  /* When admins create users, the user record is flagged role_locked=true.
     In that case we skip step 1 (role picker) entirely and force the wizard
     to only show plans for the role the admin chose — an agent can't see
     or select homeowner plans, and vice versa. Self-signup users keep the
     existing behavior of picking their role in step 1. */
  const lockedRole =
    currentUser?.roleLocked === true &&
    (currentUser?.role === "homeowner" || currentUser?.role === "agent")
      ? currentUser.role
      : null;
  const initialStep = lockedRole ? 2 : 1;
  const totalSteps = lockedRole ? 2 : 3;

  const [step, setStep] = useState(initialStep);
  const [role, setRole] = useState(lockedRole);
  const [plan, setPlan] = useState(null);
  const [billingInterval, setBillingInterval] = useState("month");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [apiPlans, setApiPlans] = useState([]);
  /* True once we successfully fetched the plan list (even if it came back empty).
     Used to decide whether to render hardcoded fallback plans — we should only fall back
     when the network/API genuinely failed, otherwise admin deactivations get masked. */
  const [apiPlansLoaded, setApiPlansLoaded] = useState(false);
  const [subscriptionProducts, setSubscriptionProducts] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadPlans = useCallback(async () => {
    if (!role) return;
    setApiLoading(true);
    try {
      let plans = [];
      let plansApiOk = true;
      try {
        const r = await AppApi.getBillingPlans(role);
        plans = r?.plans || [];
      } catch {
        plansApiOk = false;
      }
      const products = await AppApi.getSubscriptionProductsByRole(role).catch(
        () => [],
      );
      setApiPlans(withSinglePopularFlag(plans));
      setApiPlansLoaded(plansApiOk);
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

  const availablePlans = role
    ? withSinglePopularFlag(
        apiPlansLoaded
          ? apiPlans
          : buildFallbackPlans(role, subscriptionProducts),
      )
    : [];
  const selectedPlan = availablePlans.find((p) => (p.code || p.id) === plan);
  const isFreePlan =
    Boolean(plan) && isZeroCostPlan(selectedPlan, billingInterval);

  const canContinue =
    (step === 1 && role) || (step === 2 && plan) || step === 3;
  /* Display step (1-based) reflects what the user actually sees in the
     indicator. When the role picker is skipped, the Plan screen is "Step 1
     of 2" instead of "Step 2 of 3". */
  const displayStep = lockedRole ? Math.max(1, step - 1) : step;
  const minStep = lockedRole ? 2 : 1;

  async function handleComplete() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (isFreePlan) {
        const tier = PLAN_CODE_TO_SUBSCRIPTION_TIER[plan] || plan;
        await AppApi.completeOnboarding({
          role,
          subscriptionTier: tier,
          planCode: plan,
          billingInterval,
        });
        await refreshCurrentUser();
        const accounts = await AppApi.getUserAccounts(currentUser?.id);
        const accountUrl =
          accounts?.[0]?.url?.replace(/^\/+/, "") || accounts?.[0]?.name;
        markPostLoginWelcomeGreeting();
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
          couponCode: appliedCoupon?.code || undefined,
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
        <StepIndicator currentStep={displayStep} totalSteps={totalSteps} />

        <div className={`w-full ${step === 2 ? "max-w-7xl" : "max-w-2xl"}`}>
          {step === 1 && !lockedRole && (
            <Step1Role role={role} onSelect={setRole} />
          )}
          {step === 2 && (
            <Step2Plan
              role={role}
              plan={plan}
              onSelect={setPlan}
              billingInterval={billingInterval}
              onBillingIntervalChange={setBillingInterval}
              apiPlans={apiPlans}
              apiPlansLoaded={apiPlansLoaded}
              subscriptionProducts={subscriptionProducts}
              apiLoading={apiLoading}
              onCouponApplied={setAppliedCoupon}
            />
          )}
          {step === 3 && (
            <Step3Confirmation
              role={role}
              plan={plan}
              selectedPlan={selectedPlan}
            />
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">
            {error}
          </p>
        )}

        <div
          className={`flex items-center justify-between w-full mt-10 ${step === 2 ? "max-w-7xl" : "max-w-2xl"}`}
        >
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (step > minStep) {
                  setStep((s) => s - 1);
                } else {
                  logout();
                  navigate("/signin", {replace: true});
                }
              }}
              className={
                step > minStep
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
