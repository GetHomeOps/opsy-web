import React, {useState, useEffect, useRef} from "react";
import {Link, useNavigate} from "react-router-dom";
import {AlertCircle, ChevronLeft, ExternalLink, Loader2, Mail} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import {useTranslation} from "react-i18next";
import AppApi, {API_BASE_URL} from "../../api/api";
import "../../i18n";

import OpsyHeader from "../../images/OpsyHeader.png";
import MountRainier from "../../images/MountRainier.webp";

const MIN_PASSWORD_LENGTH = 7;
const EMAIL_REGEX = /\S+@\S+\.\S+/;

function isValidEmail(email) {
  return email.trim().length > 0 && EMAIL_REGEX.test(email.trim());
}

function isValidPassword(password) {
  return password && password.length >= MIN_PASSWORD_LENGTH;
}

function Signup() {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (step === 2 && passwordRef.current) {
      const timer = setTimeout(() => passwordRef.current?.focus(), 310);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const {t} = useTranslation();

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
    `form-input w-full ${fieldErrors[field] ? "!border-red-400 dark:!border-red-500" : ""}`;

  const emailValid = isValidEmail(formData.email);
  const passwordValid = emailValid && isValidPassword(formData.password);
  const nameValid = passwordValid && formData.name.trim().length > 0;

  const GoogleSvg = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );

  const GoogleButton = () => (
    <a
      href={`${API_BASE_URL}/auth/google/signup`}
      onClick={() => setOauthLoading(true)}
      className="btn w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-70 disabled:cursor-not-allowed"
      aria-busy={oauthLoading}
    >
      {oauthLoading ? (
        <Loader2 className="w-5 h-5 animate-spin shrink-0" aria-hidden />
      ) : (
        <GoogleSvg />
      )}
      {oauthLoading
        ? t("redirecting") || "Redirecting…"
        : t("signup.signUpWithGoogle")}
    </a>
  );

  return (
    <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{backgroundImage: `url(${MountRainier})`}}
      />
      <div className="absolute inset-0 bg-white/30 dark:bg-gray-900/30" />

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm px-6 py-8">
            <div className="flex justify-center mb-4 bg-white dark:bg-gray-800 rounded-lg p-4">
              <img src={OpsyHeader} alt="Opsy" className="max-w-full h-auto" />
            </div>

            {pendingVerification ? (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#456564]/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-6 h-6 text-[#456564]" aria-hidden />
                </div>
                <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  {t("signup.checkEmailTitle", "Check your email")}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {pendingVerification.message ||
                    t(
                      "signup.checkEmailBody",
                      "We sent a verification link. Open it to activate your account, then sign in.",
                    )}
                </p>
                {pendingVerification.email ? (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-6 break-all">
                    {pendingVerification.email}
                  </p>
                ) : (
                  <div className="mb-6" />
                )}
                <Link
                  to="/signin"
                  state={{email: pendingVerification.email}}
                  className="btn w-full bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white inline-flex items-center justify-center"
                >
                  {t("signup.goToSignIn", "Go to sign in")}
                </Link>
              </div>
            ) : null}

            {!pendingVerification && (
            <>
            <div className="flex items-center gap-2 mb-6">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1 -ml-1 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label={t("back")}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-2xl text-gray-800 dark:text-gray-100 font-semibold text-center flex-1">
                {t("signup.title")}
              </h1>
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-red-800 dark:text-red-200 text-sm">
                  {errorMessage}
                </span>
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
                      <div className="w-full border-t border-gray-200 dark:border-gray-600" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                        {t("or")}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      htmlFor="email"
                    >
                      {t("emailAddress")}
                    </label>
                    <input
                      id="email"
                      className={`${inputClass("email")} ${step === 2 ? "bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed" : ""}`}
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
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
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
                      <label
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                        htmlFor="password"
                      >
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
                      />
                      {fieldErrors.password ? (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {fieldErrors.password}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t(
                            "signup.passwordPlaceholder",
                            "At least 6 characters",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="submit"
                    disabled={
                      step === 1 ? !emailValid || checkingEmail : !passwordValid
                    }
                    className="btn w-full bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">
                      {t("emailAddress")}
                    </p>
                    <p className="text-base text-gray-800 dark:text-gray-200 font-medium">
                      {formData.email}
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      htmlFor="name"
                    >
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
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !nameValid}
                    className="btn w-full bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

            <div className="pt-5 mt-6 border-t border-gray-200 dark:border-gray-600 text-center space-y-2">
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {t("signup.haveAccount")}{" "}
                </span>
                <Link
                  className="text-sm font-medium text-[#6E8276] hover:text-[#456564] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7]"
                  to="/signin"
                >
                  {t("signIn")}
                </Link>
              </div>
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#6E8276] hover:text-[#456564] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7] hover:underline flex items-center justify-center gap-1.5"
              >
                {t("privacyPolicy.link") || "Privacy Policy"}
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Signup;
