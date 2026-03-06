import {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {
  Home,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Check,
  X as XIcon,
  Loader2,
} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import {HOMEOWNER_PLANS, AGENT_PLANS, PLAN_LIMITS} from "./onboardingPlans";

const PLAN_CODE_TO_TIER = {
  homeowner_free: "free",
  homeowner_maintain: "maintain",
  homeowner_win: "win",
  agent_basic: "basic",
  agent_pro: "pro",
  agent_premium: "premium",
  agent_enterprise: "enterprise",
};

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

function buildFallbackPlans(role) {
  const hardcoded = role === "homeowner" ? HOMEOWNER_PLANS : AGENT_PLANS;
  return hardcoded.map((p) => ({
    ...p,
    code: p.code || p.id,
    features: p.features
      ? [...(p.features.core || []), ...(p.features.advanced || [])].map((f, i) => ({
          id: `${p.code}_f${i}`,
          label: `${f.label}: ${f.value}`,
          included: f.value !== "None",
        }))
      : [],
    limits: PLAN_LIMITS[role]?.[p.code] || {},
  }));
}

function Step2Plan({
  role,
  plan,
  onSelect,
  billingInterval,
  onBillingIntervalChange,
  apiPlans,
  apiLoading,
}) {
  const plans = apiPlans && apiPlans.length > 0 ? apiPlans : buildFallbackPlans(role);
  const hasPaidPlans = plans.some((p) => p.price != null && p.price > 0);
  const gridCols = plans.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3";

  return (
    <div className="relative">
      <div className="absolute -top-40 -left-40 w-[28rem] h-[28rem] bg-emerald-300/15 dark:bg-emerald-700/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-teal-200/20 dark:bg-teal-800/8 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-1/3 w-96 h-96 bg-emerald-200/12 dark:bg-emerald-900/6 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative">
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
                className={`relative z-10 w-24 py-2 rounded-full text-sm font-medium transition-colors ${
                  billingInterval === "month"
                    ? "text-white"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => onBillingIntervalChange?.("year")}
                className={`relative z-10 w-28 py-2 rounded-full text-sm font-medium transition-colors ${
                  billingInterval === "year"
                    ? "text-white"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                Yearly <span className="text-emerald-400">Save</span>
              </button>
              <div
                className={`absolute top-1 z-0 h-[calc(100%-8px)] rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-200 ${
                  billingInterval === "month"
                    ? "left-1 w-24"
                    : "left-[100px] w-28"
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

              const features = p.features || [];

              const isYearly =
                hasPaidPlans &&
                billingInterval === "year" &&
                p.price != null &&
                p.price > 0;

              let displayPrice;
              let yearlyTotal = null;
              if (p.price === 0 || p.price == null) {
                displayPrice = "Free";
              } else if (isYearly && p.stripePrices?.year?.unitAmount) {
                const monthlyEquiv = p.stripePrices.year.unitAmount / 100 / 12;
                displayPrice = `$${monthlyEquiv.toFixed(2)}`;
                yearlyTotal = (p.stripePrices.year.unitAmount / 100).toFixed(2);
              } else if (isYearly) {
                displayPrice = `$${(p.price * 0.8).toFixed(2)}`;
                yearlyTotal = (p.price * 12 * 0.8).toFixed(2);
              } else if (p.stripePrices?.month?.unitAmount) {
                displayPrice = `$${(p.stripePrices.month.unitAmount / 100).toFixed(2)}`;
              } else {
                displayPrice = `$${Number(p.price).toFixed(2)}`;
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
                        <span className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                          {displayPrice}
                        </span>
                        {p.price != null && p.price > 0 && (
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
    </div>
  );
}

function Step3Confirmation({role, plan, apiPlans}) {
  const roleLabel = role === "homeowner" ? "Homeowner" : "Agent";

  const allPlans = apiPlans && apiPlans.length > 0
    ? apiPlans
    : (role === "homeowner" ? HOMEOWNER_PLANS : AGENT_PLANS);
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
              <li>• AI tokens/month: {lim.aiTokenMonthlyQuota.toLocaleString()}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

const FREE_PLANS = ["homeowner_free"];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const {currentUser, refreshCurrentUser} = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [plan, setPlan] = useState(null);
  const [billingInterval, setBillingInterval] = useState("month");
  const [apiPlans, setApiPlans] = useState([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (role) {
      setApiLoading(true);
      AppApi.getBillingPlans(role)
        .then((r) => setApiPlans(r.plans || []))
        .catch(() => setApiPlans([]))
        .finally(() => setApiLoading(false));
    }
  }, [role]);

  const selectedPlan = apiPlans.find((p) => p.code === plan);
  const isFreePlan = plan && (selectedPlan?.price === 0 || selectedPlan?.price === "0" || FREE_PLANS.includes(plan));

  const canContinue =
    (step === 1 && role) || (step === 2 && plan) || step === 3;

  async function handleComplete() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (isFreePlan) {
        const tier = PLAN_CODE_TO_TIER[plan] || plan;
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
        const tier = PLAN_CODE_TO_TIER[plan] || plan;
        const successUrl = `${origin}/#/billing/success?role=${encodeURIComponent(role)}&plan=${encodeURIComponent(tier)}`;
        const cancelUrl = `${origin}/#/onboarding`;
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
    <main
      className={`min-h-[100dvh] flex flex-col transition-colors duration-500 ${
        step === 2
          ? "bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(167,243,208,0.28),transparent),radial-gradient(ellipse_60%_50%_at_100%_50%,rgba(94,234,212,0.12),transparent),radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(167,243,208,0.15),transparent),#f9fafb] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,95,70,0.18),transparent),radial-gradient(ellipse_60%_50%_at_100%_50%,rgba(20,184,166,0.1),transparent),#111827]"
          : "bg-gray-50 dark:bg-gray-900"
      }`}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
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
          className={`flex items-center justify-between w-full mt-10 gap-4 ${step === 2 ? "max-w-6xl" : "max-w-2xl"}`}
        >
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
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
    </main>
  );
}
