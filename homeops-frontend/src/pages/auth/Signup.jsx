import React, {useState, useEffect, useRef} from "react";
import {Link, useNavigate} from "react-router-dom";
import {AlertCircle, Loader2} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import {useTranslation} from "react-i18next";
import {API_BASE_URL} from "../../api/api";

import AuthImage from "../../images/signup-house.png";
import Logo from "../../images/logo-no-bg.png";

const MIN_PASSWORD_LENGTH = 4;

function Signup() {
  const navigate = useNavigate();
  const {signup, currentUser} = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const justSignedUp = useRef(false);

  const {t} = useTranslation();

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

  function validate() {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = t("signup.nameRequired");
    }
    if (!formData.email.trim()) {
      errors.email = t("signup.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = t("signup.emailInvalid");
    }
    if (!formData.password) {
      errors.password = t("signup.passwordRequired");
    } else if (formData.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = t("signup.passwordMinLength", {min: MIN_PASSWORD_LENGTH});
    }
    return errors;
  }

  async function handleSubmit(evt) {
    evt.preventDefault();
    setFormErrors([]);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await signup(formData);
      justSignedUp.current = true;
    } catch (err) {
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

  const errorMessage =
    formErrors.length === 0
      ? null
      : formErrors
          .map((e) => (typeof e === "string" ? e : e?.message || String(e)))
          .join(" ");

  const inputClass = (field) =>
    `form-input w-full ${fieldErrors[field] ? "!border-red-400 dark:!border-red-500" : ""}`;

  return (
    <main className="bg-white dark:bg-gray-900">
      <div className="relative md:flex">
        <div className="md:w-1/2">
          <div className="min-h-[100dvh] h-full flex flex-col after:flex-1">
            <div className="flex-1">
              <div className="flex items-center justify-between h-16 px-0 sm:px-4 lg:px-5 xxl:px-12">
                <Link className="block" to="/">
                  <img src={Logo} alt="Logo" className="w-15 h-15" />
                </Link>
              </div>
            </div>

            <div className="max-w-sm mx-auto w-full px-4 py-8">
              <h1 className="text-3xl text-gray-800 dark:text-gray-100 font-bold mb-6">
                {t("signup.title")}
              </h1>

              {errorMessage && (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-start gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-800 dark:text-red-200 text-sm">
                    {errorMessage}
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      htmlFor="name"
                    >
                      {t("name")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="name"
                      className={inputClass("name")}
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      autoFocus
                    />
                    {fieldErrors.name && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      htmlFor="email"
                    >
                      {t("emailAddress")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="email"
                      className={inputClass("email")}
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      htmlFor="password"
                    >
                      {t("password")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="password"
                      className={inputClass("password")}
                      type="password"
                      autoComplete="new-password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    {fieldErrors.password && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fieldErrors.password}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end mt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white whitespace-nowrap flex items-center justify-center gap-2"
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

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-600" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">{t("or")}</span>
                </div>
              </div>

              <a
                href={`${API_BASE_URL}/auth/google/signup`}
                className="btn w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {t("signup.signUpWithGoogle")}
              </a>

              <div className="pt-5 mt-6 border-t border-gray-100 dark:border-gray-700/60">
                <div className="text-sm">
                  {t("signup.haveAccount")}{" "}
                  <Link
                    className="font-medium text-violet-500 hover:text-violet-600 dark:hover:text-violet-400"
                    to="/signin"
                  >
                    {t("signIn")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="hidden md:block absolute top-0 bottom-0 right-0 md:w-1/2"
          aria-hidden="true"
        >
          <img
            className="object-cover object-center w-full h-full"
            src={AuthImage}
            width="760"
            height="1024"
            alt="Authentication"
          />
        </div>
      </div>
    </main>
  );
}

export default Signup;
