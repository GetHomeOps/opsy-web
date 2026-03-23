import React, {useEffect, useState, useRef} from "react";
import {Link, useNavigate, useSearchParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {AlertCircle, Loader2} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import {
  canRedirectToPathForUser,
  consumePostLogoutRedirectReset,
} from "../../utils/authNavigation";
import Logo from "../../images/logo-no-bg.png";
import MountRainier from "../../images/MountRainier.webp";
import "../../i18n";

function VerifyEmail() {
  const {t} = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {completeEmailVerification} = useAuth();
  const token = searchParams.get("token");
  const [formErrors, setFormErrors] = useState([]);
  const [status, setStatus] = useState("idle");
  const processed = useRef(false);

  useEffect(() => {
    if (!token) {
      setFormErrors([
        t(
          "verifyEmail.missingToken",
          "Invalid or missing verification link. Request a new one from the sign-in page.",
        ),
      ]);
      setStatus("error");
      return;
    }
    if (processed.current) return;
    processed.current = true;

    async function run() {
      setStatus("loading");
      try {
        const userWithAccounts = await completeEmailVerification(token);
        const ignoreReturnTo = consumePostLogoutRedirectReset();
        const from = ignoreReturnTo
          ? null
          : sessionStorage.getItem("oauth_return_to");
        sessionStorage.removeItem("oauth_return_to");

        if (userWithAccounts?.onboardingCompleted === false) {
          navigate("/onboarding", {replace: true});
          return;
        }
        if (canRedirectToPathForUser(userWithAccounts, from)) {
          navigate(from, {replace: true});
        } else if (userWithAccounts?.accounts?.length > 0) {
          const accountUrl =
            userWithAccounts.accounts[0].url?.replace(/^\/+/, "") ||
            userWithAccounts.accounts[0].name;
          navigate(`/${accountUrl}/home`, {replace: true});
        } else {
          navigate("/", {replace: true});
        }
      } catch (err) {
        setStatus("error");
        const raw =
          err?.messages ??
          (Array.isArray(err)
            ? err
            : [err?.message || err?.toString?.() || String(err)]);
        setFormErrors(
          raw.map((e) => (typeof e === "string" ? e : e?.message || String(e))),
        );
      }
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot verify on token from URL
  }, [token]);

  const errorMessage = formErrors.length
    ? formErrors
        .map((e) => (typeof e === "string" ? e : e?.message || String(e)))
        .join(" ")
    : null;

  if (status === "loading") {
    return (
      <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{backgroundImage: `url(${MountRainier})`}}
        />
        <div className="absolute inset-0 bg-white/30 dark:bg-gray-900/30" />
        <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8">
          <Loader2 className="w-10 h-10 text-[#456564] animate-spin mb-4" />
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            {t("verifyEmail.verifying", "Verifying your email…")}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{backgroundImage: `url(${MountRainier})`}}
      />
      <div className="absolute inset-0 bg-white/30 dark:bg-gray-900/30" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <Link className="block" to="/">
              <img src={Logo} alt="Logo" className="w-15 h-15" />
            </Link>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm px-6 py-8">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">
              {t("verifyEmail.title", "Verify your email")}
            </h1>
            {errorMessage ? (
              <div
                className="flex gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-200 mb-4"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            ) : null}
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
              {t(
                "verifyEmail.tryAgainHint",
                "You can request a new verification email from the sign-in page.",
              )}
            </p>
            <Link
              to="/signin"
              className="block w-full text-center rounded-lg bg-[#456564] text-white py-2.5 text-sm font-medium hover:opacity-95"
            >
              {t("verifyEmail.backToSignIn", "Back to sign in")}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default VerifyEmail;
