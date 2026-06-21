import React, {useState, useEffect, useRef} from "react";
import {Link, useLocation, useNavigate} from "react-router-dom";
import {
  AlertCircle,
  ChevronLeft,
  ExternalLink,
  Loader2,
  Mail,
} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import {markPostLoginWelcomeGreeting} from "../../utils/authNavigation";
import {isDemoSite} from "../../utils/demoSite";
import {useTranslation} from "react-i18next";
import AppApi, {API_BASE_URL} from "../../api/api";
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

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /\S+@\S+\.\S+/;

function isValidEmail(email) {
  return email.trim().length > 0 && EMAIL_REGEX.test(email.trim());
}

function isValidPassword(password) {
  return password && password.length >= MIN_PASSWORD_LENGTH;
}

function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const {signup, currentUser} = useAuth();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(null);
  const justSignedUp = useRef(false);
  const passwordRef = useRef(null);
  const oauthNoAccountMessage = location.state?.oauthNoAccount
    ? location.state?.oauthNoAccountMessage ||
      "No account found with this Google account. Please sign up first."
    : null;

  useEffect(() => {
    if (step === 2 && passwordRef.current) {
      const timer = setTimeout(() => passwordRef.current?.focus(), 310);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const {t} = useTranslation();

  useEffect(() => {
    if (isDemoSite()) {
      navigate("/signin", {replace: true, state: {demoSignupDisabled: true}});
    }
  }, [navigate]);

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

  useEffect(() => {
    if (justSignedUp.current && currentUser) {
      if (currentUser.accounts && currentUser.accounts.length > 0) {
        markPostLoginWelcomeGreeting();
        const accountUrl =
          currentUser.accounts[0].url?.replace(/^\/+/, "") ||
          currentUser.accounts[0].name;
        navigate(`/${accountUrl}/home`, {replace: true});
      } else {
        navigate("/signup", {replace: true});
      }
      justSignedUp.current = false;
    }
  }, [currentUser, navigate]);

  /** Detect if error indicates email already exists → redirect to sign-in */
  function isEmailExistsError(err) {
    const raw =
      err?.messages ??
      (Array.isArray(err)
        ? err
        : [err?.message || err?.toString?.() || String(err)]);
    const text = raw
      .map((e) => (typeof e === "string" ? e : e?.message || String(e)))
      .join(" ")
      .toLowerCase();
    return (
      text.includes("duplicate") ||
      text.includes("already exists") ||
      text.includes("account already")
    );
  }

  function validateEmail() {
    const err = {};
    if (!formData.email.trim()) {
      err.email = t("signup.emailRequired");
    } else if (!EMAIL_REGEX.test(formData.email.trim())) {
      err.email = t("signup.emailInvalid");
    }
    return err;
  }

  function validatePassword() {
    const err = {...validateEmail()};
    if (!formData.password) {
      err.password = t("signup.passwordRequired");
    } else if (formData.password.length < MIN_PASSWORD_LENGTH) {
      err.password = t("signup.passwordMinLength", {min: MIN_PASSWORD_LENGTH});
    }
    return err;
  }

  function validateName() {
    const err = {...validateEmail(), ...validatePassword()};
    if (!formData.name.trim()) {
      err.name = t("signup.nameRequired");
    }
    return err;
  }

  async function handleContinueEmail(evt) {
    evt?.preventDefault?.();
    setFormErrors([]);
    const err = validateEmail();
    setFieldErrors(err);
    if (Object.keys(err).length > 0) return;

    setCheckingEmail(true);
    try {
      const {exists} = await AppApi.checkEmailExists(formData.email.trim());
      if (exists) {
        navigate("/signin", {
          replace: true,
          state: {fromSignup: true, email: formData.email.trim()},
        });
        return;
      }
      setStep(2);
    } catch {
      setFormErrors([
        t(
          "signup.checkEmailError",
          "Could not verify email. Please try again.",
        ),
      ]);
    } finally {
      setCheckingEmail(false);
    }
  }

  function handleContinuePassword(evt) {
    evt?.preventDefault?.();
    setFormErrors([]);
    const err = validatePassword();
    setFieldErrors(err);
    if (Object.keys(err).length > 0) return;
    setStep(3);
  }

  async function handleSubmit(evt) {
    evt.preventDefault();
    setFormErrors([]);

    const errors = validateName();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      const signupResult = await signup(formData);
      if (signupResult?.verificationRequired) {
        setPendingVerification({
          email: signupResult.email,
          message: signupResult.message,
        });
        return;
      }
      justSignedUp.current = true;
    } catch (err) {
      if (isEmailExistsError(err)) {
        navigate("/signin", {
          replace: true,
          state: {fromSignup: true, email: formData.email},
        });
        return;
      }
      const raw =
        err?.messages ??
        (Array.isArray(err)
          ? err
          : [err?.message || err?.toString?.() || String(err)]);
      const messages = raw.map((e) =>
        typeof e === "string" ? e : e?.message || String(e),
      );
      setFormErrors(messages);
      justSignedUp.current = false;
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleChange(evt) {
    const {name, value} = evt.target;
    setFormData((data) => ({...data, [name]: value}));
    if (formErrors.length) setFormErrors([]);
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = {...prev};
        delete next[name];
        return next;
      });
    }
  }

  function handleBack() {
    setStep((s) => Math.max(1, s - 1));
    setFormErrors([]);
    setFieldErrors({});
  }

  function handleKeyDown(evt, action) {
    if (evt.key === "Enter") {
      evt.preventDefault();
      action();
    }
  }

  const errorMessage =
    formErrors.length === 0
      ? null
      : formErrors
          .map((e) => (typeof e === "string" ? e : e?.message || String(e)))
          .join(" ");

  const inputClass = (field) =>
    `${authInputClass} ${fieldErrors[field] ? "!ring-red-400" : ""}`;

  const emailValid = isValidEmail(formData.email);
  const passwordValid = emailValid && isValidPassword(formData.password);
  const nameValid = passwordValid && formData.name.trim().length > 0;

  const GoogleButton = () => (
    <a
      href={`${API_BASE_URL}/auth/google/signup`}
      onClick={(e) => {
        if (oauthLoading) {
          e.preventDefault();
          return;
        }
        setOauthLoading(true);
      }}
      className={`${authGoogleButtonClass} ${oauthLoading ? "opacity-70 pointer-events-none" : ""}`}
      aria-busy={oauthLoading}
    >
      {oauthLoading ? (
        <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden />
      ) : (
        <GoogleIcon />
      )}
      {oauthLoading
        ? t("redirecting") || "Redirecting…"
        : t("signup.signUpWithGoogle")}
    </a>
  );

  const signupTitle = pendingVerification
    ? null
    : step === 3
      ? t("signup.almostThere", "Almost there.")
      : t("signup.welcomeHome", "Welcome home.");

  const signupFooter = !pendingVerification ? (
    <div className="text-center space-y-4">
      <p className="font-auth-serif text-sm text-gray-500">
        {t("signup.haveAccount")}
      </p>
      <Link to="/signin" className={authSecondaryButtonClass}>
        {t("signIn")}
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
  ) : null;

  return (
    <AuthLayout>
      <AuthCardShell title={signupTitle} footer={signupFooter}>
        {pendingVerification ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-[#2D4A44]/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-[#2D4A44]" aria-hidden />
            </div>
            <h2 className="font-auth-serif text-xl text-[#2D4A44] mb-2">
              {t("signup.checkEmailTitle", "Check your email")}
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              {pendingVerification.message ||
                t(
                  "signup.checkEmailBody",
                  "We sent a verification link. Open it to activate your account, then sign in.",
                )}
            </p>
            {pendingVerification.email ? (
              <p className="text-xs text-gray-500 mb-6 break-all">
                {pendingVerification.email}
              </p>
            ) : (
              <div className="mb-6" />
            )}
            <Link
              to="/signin"
              state={{email: pendingVerification.email}}
              className={authPrimaryButtonClass}
            >
              {t("signup.goToSignIn", "Go to sign in")}
            </Link>
          </div>
        ) : (
          <>
            {oauthNoAccountMessage && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
                <p className="text-sm text-amber-900">{oauthNoAccountMessage}</p>
              </div>
            )}

            {step > 1 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-sm text-[#C5A87F] hover:text-[#2D4A44]"
                  aria-label={t("back")}
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t("back")}
                </button>
              </div>
            )}

            {errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 mb-5">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span className="text-red-800 text-sm">{errorMessage}</span>
              </div>
            )}

            {step <= 2 && (
              <form
                onSubmit={
                  step === 1 ? handleContinueEmail : handleContinuePassword
                }
                noValidate
              >
                <div className="space-y-4">
                  <GoogleButton />

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-3 bg-white text-gray-400 font-auth-serif">
                        {t("or")}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className={authLabelClass} htmlFor="email">
                      {t("emailAddress")}
                    </label>
                    <input
                      id="email"
                      className={`${inputClass("email")} ${step === 2 ? "opacity-70 cursor-not-allowed" : ""}`}
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={step === 1 ? handleChange : undefined}
                      readOnly={step === 2}
                      tabIndex={step === 2 ? -1 : undefined}
                      onKeyDown={
                        step === 1
                          ? (e) =>
                              handleKeyDown(e, () => handleContinueEmail(e))
                          : undefined
                      }
                      placeholder="you@example.com"
                      autoFocus={step === 1}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className="overflow-hidden transition-all duration-300 ease-out"
                  style={{
                    display: "grid",
                    gridTemplateRows: step >= 2 ? "1fr" : "0fr",
                    opacity: step >= 2 ? 1 : 0,
                  }}
                >
                  <div className="overflow-hidden">
                    <div className="pt-4">
                      <label className={authLabelClass} htmlFor="password">
                        {t("password")}
                      </label>
                      <input
                        ref={passwordRef}
                        id="password"
                        className={inputClass("password")}
                        type="password"
                        autoComplete="new-password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        onKeyDown={(e) =>
                          handleKeyDown(e, () => handleContinuePassword(e))
                        }
                        placeholder="••••••••"
                      />
                      {fieldErrors.password ? (
                        <p className="mt-1 text-xs text-red-600">
                          {fieldErrors.password}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">
                          {t(
                            "signup.passwordPlaceholder",
                            "At least 8 characters",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={
                      step === 1
                        ? !emailValid || checkingEmail
                        : !passwordValid
                    }
                    className={authPrimaryButtonClass}
                  >
                    {checkingEmail && (
                      <Loader2
                        className="w-4 h-4 animate-spin shrink-0"
                        aria-hidden
                      />
                    )}
                    {checkingEmail ? t("checking") : t("continue")}
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={handleSubmit} noValidate>
                <div className="space-y-4">
                  <div>
                    <p className={authLabelClass}>{t("emailAddress")}</p>
                    <p className="text-base text-[#2D4A44] font-medium">
                      {formData.email}
                    </p>
                  </div>

                  <div>
                    <label className={authLabelClass} htmlFor="name">
                      {t("name")}
                    </label>
                    <input
                      id="name"
                      className={inputClass("name")}
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      onKeyDown={(e) =>
                        e.key === "Enter" && e.target.form?.requestSubmit()
                      }
                      placeholder={t("enterYourName")}
                      autoFocus
                    />
                    {fieldErrors.name && (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !nameValid}
                    className={authPrimaryButtonClass}
                  >
                    {isSubmitting && (
                      <Loader2
                        className="w-4 h-4 animate-spin shrink-0"
                        aria-hidden
                      />
                    )}
                    {isSubmitting ? t("signingUp") : t("signUp")}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </AuthCardShell>
    </AuthLayout>
  );
}

export default Signup;
