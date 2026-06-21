import React, {useState, useEffect, useRef} from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import AppApi, {API_BASE_URL} from "../../api/api";
import {
  canRedirectToPathForUser,
  consumePostLogoutRedirectReset,
  isPostLogoutRedirectResetPending,
  markPostLoginWelcomeGreeting,
} from "../../utils/authNavigation";
import {isDemoSite} from "../../utils/demoSite";
import "../../i18n";

import AuthLayout from "./AuthLayout";
import AuthCardShell from "./AuthCardShell";
import {
  authGoogleButtonClass,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
  authSecondaryButtonClass,
  GoogleIcon,
} from "./authStyles";

function Signin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const {login, completeMfaLogin, currentUser} = useAuth();
  const fromSignup = location.state?.fromSignup;
  const signupEmail = location.state?.email;
  const demoSignupDisabled = location.state?.demoSignupDisabled;
  const oauthNoAccountMessage = location.state?.oauthNoAccountMessage;
  const [formData, setFormData] = useState({
    email: signupEmail ?? "",
    password: "",
  });
  const [formErrors, setFormErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaTicket, setMfaTicket] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resendVerifyState, setResendVerifyState] = useState("idle");
  const [showPassword, setShowPassword] = useState(false);
  const justLoggedIn = useRef(false);

  const {t, i18n} = useTranslation();

  /** Reset OAuth loading when page is restored from back-forward cache or when
   *  tab regains focus (e.g. user started OAuth, cancelled at Google, then hit Back). */
  useEffect(() => {
    function onPageShow(ev) {
      if (ev.persisted) setOauthLoading(false);
    }
    function onVisibilityChange() {
      if (document.visibilityState === "visible") setOauthLoading(false);
    }
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  /** Prefill email from query (e.g. property invitation for an existing user). */
  useEffect(() => {
    const qEmail = searchParams.get("email");
    if (!qEmail?.trim()) return;
    let decoded = qEmail.trim();
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      /* use raw */
    }
    setFormData((prev) =>
      prev.email.trim() ? prev : {...prev, email: decoded},
    );
  }, [searchParams]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  /** Normalize API error to a single display string */
  const errorMessage =
    formErrors.length === 0
      ? null
      : formErrors
          .map((e) => (typeof e === "string" ? e : e?.message || String(e)))
          .join(" ");

  // Navigate after successful login when currentUser is available (redirect-after-login from ProtectedRoute or returnTo param)
  useEffect(() => {
    if (justLoggedIn.current && currentUser) {
      const ignoreReturnTo = consumePostLogoutRedirectReset();
      const from = ignoreReturnTo
        ? null
        : location.state?.from || searchParams.get("returnTo");
      if (canRedirectToPathForUser(currentUser, from)) {
        markPostLoginWelcomeGreeting();
        navigate(from, {replace: true});
      } else if (currentUser.accounts && currentUser.accounts.length > 0) {
        markPostLoginWelcomeGreeting();
        const accountUrl =
          currentUser.accounts[0].url?.replace(/^\/+/, "") ||
          currentUser.accounts[0].name;
        navigate(`/${accountUrl}/home`, {replace: true});
      } else {
        navigate("/signin", {replace: true});
      }
      justLoggedIn.current = false;
    }
  }, [currentUser, navigate, location.state?.from, searchParams]);

  /** Handle form submit */
  async function handleSubmit(evt) {
    evt.preventDefault();
    setFormErrors([]);
    setIsSubmitting(true);
    try {
      await login(formData);
      justLoggedIn.current = true;
    } catch (err) {
      if (err?.mfaRequired && err?.mfaTicket) {
        setMfaTicket(err.mfaTicket);
        setFormErrors([]);
      } else {
        let raw =
          err?.messages ??
          (Array.isArray(err)
            ? err
            : [err?.message || err?.toString?.() || String(err)]);
        let messages = Array.isArray(raw)
          ? raw.map((e) =>
              typeof e === "string" ? e : e?.message || String(e),
            )
          : [typeof raw === "string" ? raw : String(raw)];

        if (err?.status === 500 || (err?.status >= 502 && err?.status < 600)) {
          messages = ["Something went wrong. Please try again"];
        } else if (
          err?.status === 0 ||
          err?.message?.includes?.("fetch") ||
          err?.name === "TypeError"
        ) {
          messages = ["Unable to sign in right now. Please try again"];
        } else if (
          err?.status === 401 &&
          messages.some((m) =>
            /invalid|username|password|email|credential/i.test(String(m)),
          ) &&
          !messages.some((m) => /verify your email/i.test(String(m)))
        ) {
          messages = ["Invalid email or password"];
        }
        setFormErrors(messages);
        if (!messages.some((m) => /verify your email/i.test(String(m)))) {
          setResendVerifyState("idle");
        }
      }
      justLoggedIn.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }

  /** Handle MFA code submit */
  async function handleMfaSubmit(evt) {
    evt.preventDefault();
    setFormErrors([]);
    setMfaSubmitting(true);
    try {
      await completeMfaLogin(mfaTicket, mfaCode.trim());
      justLoggedIn.current = true;
    } catch (err) {
      const msg = err?.messages?.[0] ?? err?.message ?? "Invalid code";
      setFormErrors([typeof msg === "string" ? msg : String(msg)]);
    } finally {
      setMfaSubmitting(false);
    }
  }

  /** Update form data field */
  function handleChange(evt) {
    const {name, value} = evt.target;
    setFormData((data) => ({
      ...data,
      [name]: value,
    }));
    if (formErrors.length) setFormErrors([]);
    setResendVerifyState("idle");
  }

  const showVerifyResendHint = /verify your email/i.test(errorMessage || "");

  async function handleResendVerification() {
    const email = formData.email.trim();
    if (!email) {
      setFormErrors([
        t(
          "signin.emailRequiredForResend",
          "Enter your email above, then try again.",
        ),
      ]);
      return;
    }
    setResendVerifyState("sending");
    try {
      await AppApi.resendVerificationEmail(email);
      setResendVerifyState("sent");
    } catch {
      setResendVerifyState("error");
    }
  }

  const signInFooter = !mfaTicket ? (
    isDemoSite() ? (
      <div className="text-center space-y-4">
        <p className="font-auth-serif text-sm text-gray-500">
          {t(
            "signin.demoSignInOnly",
            "Demo site — sign in with an existing account. New accounts are not available here.",
          )}
        </p>
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#C5A87F] hover:text-[#2D4A44] hover:underline inline-flex items-center justify-center gap-1"
        >
          {t("privacyPolicy.link") || "Privacy Policy"}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>
    ) : (
      <div className="text-center space-y-4">
        <p className="font-auth-serif text-sm text-gray-500">
          {t("noAccount")}
        </p>
        <Link to="/signup" className={authSecondaryButtonClass}>
          {t("signin.createAccount", "Create an account")}
        </Link>
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[#C5A87F] hover:text-[#2D4A44] hover:underline inline-flex items-center justify-center gap-1"
        >
          {t("privacyPolicy.link") || "Privacy Policy"}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>
    )
  ) : null;

  return (
    <AuthLayout>
      <AuthCardShell
        title={t("signin.welcomeHome", "Welcome home.")}
        footer={signInFooter}
      >
        {fromSignup && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 mb-5">
            <p className="text-sm text-emerald-800">
              {t(
                "signup.emailExistsSignIn",
                "An account with this email already exists. Sign in below.",
              )}
            </p>
          </div>
        )}

        {(demoSignupDisabled || oauthNoAccountMessage) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
            <p className="text-sm text-amber-900">
              {oauthNoAccountMessage ||
                t(
                  "signin.demoSignupDisabled",
                  "New account registration is disabled on the demo site. Sign in with an existing demo account.",
                )}
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex flex-col gap-3 mb-5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-red-800 text-sm">{errorMessage}</span>
            </div>
            {showVerifyResendHint ? (
              <div className="pl-7 space-y-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendVerifyState === "sending"}
                  className="text-sm font-medium text-[#2D4A44] hover:underline disabled:opacity-50"
                >
                  {resendVerifyState === "sending"
                    ? t("signin.resending", "Sending…")
                    : t(
                        "signin.resendVerification",
                        "Resend verification email",
                      )}
                </button>
                {resendVerifyState === "sent" ? (
                  <p className="text-xs text-emerald-700">
                    {t(
                      "signin.resendVerificationSent",
                      "If an account needs verification, we sent a new link.",
                    )}
                  </p>
                ) : null}
                {resendVerifyState === "error" ? (
                  <p className="text-xs text-red-700">
                    {t(
                      "signin.resendVerificationFailed",
                      "Could not send email. Try again later.",
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        {mfaTicket ? (
          <form onSubmit={handleMfaSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-gray-600 mb-4">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm">
                {t("mfa.enterCode") ||
                  "Enter the 6-digit code from your authenticator app."}
              </span>
            </div>
            <div>
              <label className={authLabelClass} htmlFor="mfa-code">
                {useBackupCode
                  ? t("mfa.backupCode") || "Backup code"
                  : t("mfa.code") || "Verification code"}
              </label>
              <input
                id="mfa-code"
                type="text"
                inputMode={useBackupCode ? "text" : "numeric"}
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className={`${authInputClass} text-center text-lg tracking-widest`}
                placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
                maxLength={useBackupCode ? 12 : 6}
              />
            </div>
            <button
              type="button"
              onClick={() => setUseBackupCode((b) => !b)}
              className="text-sm text-[#C5A87F] hover:text-[#2D4A44] hover:underline"
            >
              {useBackupCode
                ? t("mfa.useAuthenticator") || "Use authenticator code"
                : t("mfa.useBackupCode") || "Use a backup code"}
            </button>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMfaTicket(null);
                  setMfaCode("");
                  setUseBackupCode(false);
                }}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                {t("back") || "Back"}
              </button>
              <button
                type="submit"
                disabled={mfaSubmitting || !mfaCode.trim()}
                className={`${authPrimaryButtonClass} flex-1`}
              >
                {mfaSubmitting && (
                  <Loader2
                    className="w-4 h-4 animate-spin shrink-0"
                    aria-hidden
                  />
                )}
                {mfaSubmitting
                  ? t("verifying") || "Verifying..."
                  : t("verify") || "Verify"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className={authLabelClass} htmlFor="email">
                    {t("emailAddress")}
                  </label>
                  <input
                    id="email"
                    className={authInputClass}
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className={authLabelClass} htmlFor="password">
                    {t("password")}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      className={`${authInputClass} pr-11`}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      name="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center justify-center px-3 rounded-md text-gray-400 hover:text-[#2D4A44] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D4A44]/25"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-pressed={showPassword}
                      aria-controls="password"
                      aria-label={
                        showPassword
                          ? t("hidePassword", "Hide password")
                          : t("showPassword", "Show password")
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5 shrink-0" aria-hidden />
                      ) : (
                        <Eye className="w-5 h-5 shrink-0" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    !formData.email.trim() ||
                    !formData.password
                  }
                  className={authPrimaryButtonClass}
                >
                  {isSubmitting && (
                    <Loader2
                      className="w-4 h-4 animate-spin shrink-0"
                      aria-hidden
                    />
                  )}
                  {isSubmitting ? t("continuing") : t("continue")}
                </button>
                <div className="text-center">
                  <Link
                    className="text-sm text-[#C5A87F] hover:text-[#2D4A44] hover:underline"
                    to="/forgot-password"
                  >
                    {t("cantLogIn")}
                  </Link>
                </div>
              </div>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-gray-400 font-auth-serif">
                  {t("or")}
                </span>
              </div>
            </div>

            <a
              href={`${API_BASE_URL}/auth/google/signin`}
              onClick={(e) => {
                if (oauthLoading) {
                  e.preventDefault();
                  return;
                }
                setOauthLoading(true);
                if (isPostLogoutRedirectResetPending()) {
                  sessionStorage.removeItem("oauth_return_to");
                  return;
                }
                const from =
                  location.state?.from || searchParams.get("returnTo");
                if (
                  from &&
                  typeof from === "string" &&
                  from.startsWith("/") &&
                  from !== "/signin" &&
                  from !== "/signup"
                ) {
                  sessionStorage.setItem("oauth_return_to", from);
                }
              }}
              className={`${authGoogleButtonClass} ${oauthLoading ? "opacity-70 pointer-events-none" : ""}`}
              aria-busy={oauthLoading}
            >
              {oauthLoading ? (
                <Loader2
                  className="w-5 h-5 animate-spin shrink-0"
                  aria-hidden
                />
              ) : (
                <GoogleIcon />
              )}
              {oauthLoading
                ? t("redirecting") || "Redirecting…"
                : t("signInWithGoogle")}
            </a>
          </>
        )}
      </AuthCardShell>
    </AuthLayout>
  );
}

export default Signin;
