import {useState, useEffect} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {Loader2, CheckCircle, AlertCircle} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import {markPostLoginWelcomeGreeting} from "../../utils/authNavigation";
import AppApi from "../../api/api";
import {PLAN_CODE_TO_SUBSCRIPTION_TIER} from "../onboarding/onboardingPlans";

const INITIAL_DELAY_MS = 3000; // Let Stripe webhooks process before polling
const POLL_INTERVAL_MS = 3500; // Avoid rate limits (429) during activation
const POLL_TIMEOUT_MS = 60000;

export default function BillingSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {refreshCurrentUser} = useAuth();
  const [status, setStatus] = useState("activating");
  const [error, setError] = useState(null);

  const role = searchParams.get("role");
  const plan = searchParams.get("plan");
  const stripeSessionId = searchParams.get("session_id");

  useEffect(() => {
    let cancelled = false;
    let timeoutId;

    async function run() {
      if (!role || !plan) {
        setError("Missing role or plan. Redirecting...");
        setTimeout(() => navigate("/onboarding", {replace: true}), 2000);
        return;
      }

      const subscriptionTier = PLAN_CODE_TO_SUBSCRIPTION_TIER[plan] || plan;
      const FREE_TIERS = ["free", "beta_homeowner"];
      const isPaidTier = !FREE_TIERS.includes(subscriptionTier);

      if (isPaidTier && !stripeSessionId) {
        setError("Payment session not found. Please complete checkout again.");
        setTimeout(() => navigate("/onboarding", {replace: true}), 3000);
        return;
      }

      let accountId = null;
      let primaryAccount = null;
      try {
        const onboardingData = {role, subscriptionTier};
        if (stripeSessionId) onboardingData.stripeSessionId = stripeSessionId;

        // Retry on 429 (rate limit) - common when returning from Stripe; exponential backoff
        const delays = [2000, 4000, 8000];
        let lastErr;
        for (
          let attempt = 0;
          attempt <= delays.length && !cancelled;
          attempt++
        ) {
          try {
            await AppApi.completeOnboarding(onboardingData);
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            if (err?.status === 429 && attempt < delays.length) {
              await new Promise((r) => setTimeout(r, delays[attempt]));
            } else {
              throw err;
            }
          }
        }
        if (lastErr) throw lastErr;
        const user = await refreshCurrentUser();
        const accounts = await AppApi.getUserAccounts(user?.id).catch(() => []);
        primaryAccount = accounts?.[0] || null;
        accountId = primaryAccount?.id || null;
      } catch (err) {
        if (!cancelled) {
          const msg = err?.message || "Failed to complete setup.";
          const isAuthError =
            /refresh token|session expired|unauthorized|invalid token/i.test(
              msg,
            );
          if (isAuthError) {
            const returnTo = `/billing/success?role=${encodeURIComponent(role || "")}&plan=${encodeURIComponent(subscriptionTier || "")}${stripeSessionId ? `&session_id=${encodeURIComponent(stripeSessionId)}` : ""}`;
            window.location.href = `/signin?returnTo=${encodeURIComponent(returnTo)}`;
            return;
          }
          setError(msg);
        }
        return;
      }

      // Give Stripe webhooks time to process before polling
      await new Promise((r) => setTimeout(r, INITIAL_DELAY_MS));
      if (cancelled) return;

      const start = Date.now();
      const poll = async () => {
        if (cancelled) return;
        if (Date.now() - start > POLL_TIMEOUT_MS) {
          if (!cancelled) {
            setError(
              "Subscription activation is taking longer than expected. Your payment was received — please refresh the page or contact support if this persists.",
            );
          }
          return;
        }
        try {
          const res = await AppApi.getBillingStatus(accountId);
          const subStatus = res?.subscription?.status;
          if (
            subStatus === "active" ||
            subStatus === "trialing" ||
            res?.mockMode
          ) {
            setStatus("active");
            markPostLoginWelcomeGreeting();
            const accountUrl =
              primaryAccount?.url?.replace(/^\/+/, "") || primaryAccount?.name;
            if (accountUrl) {
              navigate(`/${accountUrl}/home`, {replace: true});
            } else {
              navigate("/", {replace: true});
            }
            return;
          }
        } catch {
          /* ignore — will retry on next poll */
        }
        timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
      };
      poll();
    }

    run();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [role, plan, stripeSessionId, navigate, refreshCurrentUser]);

  if (error) {
    return (
      <main className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-4">
          {error}
        </p>
        <button
          type="button"
          onClick={() =>
            navigate("/settings/upgrade?billing_required=1", {replace: true})
          }
          className="btn bg-violet-600 text-white"
        >
          Go to billing
        </button>
      </main>
    );
  }

  if (status === "active") {
    return (
      <main className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
        <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Redirecting...
        </h1>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
      <Loader2 className="w-12 h-12 text-violet-600 dark:text-violet-400 animate-spin mb-4" />
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Activating your subscription
      </h1>
      <p className="text-gray-600 dark:text-gray-400 text-center">
        This usually takes a few seconds. Please wait...
      </p>
    </main>
  );
}
