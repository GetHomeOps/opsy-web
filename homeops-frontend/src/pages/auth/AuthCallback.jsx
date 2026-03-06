import {useEffect, useState, useRef} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {useAuth} from "../../context/AuthContext";
import {AlertCircle, Loader2} from "lucide-react";

const ERROR_MESSAGES = {
  account_exists: "An account with this email already exists. Please sign in instead.",
  no_account: "No account found with this Google account. Please sign up first.",
  invalid_state: "Invalid or expired request. Please try again.",
  missing_params: "Invalid callback. Please try again.",
  no_email: "Google did not provide an email. Please try another account.",
  oauth_failed: "Authentication failed. Please try again.",
  inactive: "Your account is inactive. Please contact support.",
};

function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {handleOAuthCallback} = useAuth();
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    // HashRouter: token in hash (#/auth/callback?token=... or #token=...)
    const queryParams = Object.fromEntries(searchParams);
    const hashRaw = window.location.hash?.slice(1) || "";
    const hashQuery = hashRaw.includes("?") ? hashRaw.split("?")[1] : hashRaw;
    const hashParams = Object.fromEntries(new URLSearchParams(hashQuery));
    const params = {...hashParams, ...queryParams};

    if (params.token) {
      handleOAuthCallback(params.token, params.refreshToken || null)
        .then((userWithAccounts) => {
          setStatus("success");
          if (userWithAccounts?.onboardingCompleted === false) {
            navigate("/onboarding", {replace: true});
            return;
          }
          const from = sessionStorage.getItem("oauth_return_to");
          sessionStorage.removeItem("oauth_return_to");
          const isInternalPath = from && from.startsWith("/") && !from.startsWith("//");
          if (isInternalPath && from !== "/signin" && from !== "/signup") {
            navigate(from, {replace: true});
          } else if (userWithAccounts?.accounts?.length > 0) {
            const accountUrl =
              userWithAccounts.accounts[0].url?.replace(/^\/+/, "") ||
              userWithAccounts.accounts[0].name;
            navigate(`/${accountUrl}/home`, {replace: true});
          } else {
            navigate("/", {replace: true});
          }
        })
        .catch((err) => {
          setStatus("error");
          setErrorMessage(err?.message || "Failed to complete sign in.");
        });
    } else if (params.error) {
      setStatus("error");
      setErrorMessage(ERROR_MESSAGES[params.error] || params.error);
    } else {
      setStatus("error");
      setErrorMessage("Invalid callback. No token or error received.");
    }
  }, [handleOAuthCallback, navigate, searchParams]);

  if (status === "loading") {
    return (
      <main className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
        <Loader2 className="w-10 h-10 animate-spin text-violet-600 dark:text-violet-400" aria-hidden />
        <p className="mt-4 text-gray-600 dark:text-gray-400">Completing sign in...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm px-6 py-8">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-4">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <h1 className="text-lg font-semibold">Sign in failed</h1>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-6">{errorMessage}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/signin", {replace: true})}
              className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate("/signup", {replace: true})}
              className="btn border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Sign up
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}

export default AuthCallback;
