import React, {useState, useEffect} from "react";
import {useSearchParams, useLocation} from "react-router-dom";
import {useTranslation} from "react-i18next";
import AppApi from "../../api/api";
import {Check, Mail, Lock, User, AlertCircle, Building2} from "lucide-react";
import Logo from "../../images/logo-no-bg.png";

function UserConfirmationEmail() {
  const {t} = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const userEmail = searchParams.get("email")
    ? decodeURIComponent(searchParams.get("email"))
    : location.state?.email || "";
  const initialName = searchParams.get("name")
    ? decodeURIComponent(searchParams.get("name"))
    : location.state?.name || "";
  const token = searchParams.get("token") || "";

  useEffect(() => {
    if (initialName) {
      setFormData((prev) => ({...prev, name: initialName}));
    }
  }, [initialName]);

  useEffect(() => {
    async function fetchUserByEmail() {
      if (userEmail && !initialName && AppApi.getToken()) {
        try {
          const user = await AppApi.getCurrentUser(userEmail);
          if (user?.name) {
            setFormData((prev) => ({
              ...prev,
              name: user.name || "",
            }));
          }
        } catch (error) {
          console.log("Could not fetch user data:", error);
        }
      }
    }
    fetchUserByEmail();
  }, [userEmail, initialName]);

  const handleChange = (event) => {
    const {id, value} = event.target;
    setFormData((prev) => ({...prev, [id]: value}));
    if (errors[id]) {
      setErrors((prev) => ({...prev, [id]: null}));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name || formData.name.trim() === "") {
      newErrors.name = t("nameValidationErrorMessage") || "Name is required";
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password =
        t("passwordValidationErrorMessage") || "Password must be at least 8 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword =
        t("passwordMatchErrorMessage") || "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors((prev) => ({...prev, submit: null}));
    try {
      const res = await AppApi.confirmInvitation({
        token,
        password: formData.password,
        name: formData.name,
      });
      if (res?.success === true) {
        setSuccess(true);
        return;
      }
      setErrors((prev) => ({
        ...prev,
        submit: "We couldn't confirm your invitation. Please try again.",
      }));
    } catch (error) {
      console.error("Error confirming user invitation:", error);
      setErrors((prev) => ({
        ...prev,
        submit: error?.message || "We couldn't confirm your invitation. Please try again.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f4f8f8] via-white to-[#f3f7f6] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-center">
              <h2 className="mb-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {t("confirmationSuccessTitle") || "Confirmation Successful!"}
              </h2>
              <p className="mb-8 text-sm text-slate-600 dark:text-slate-300">
                {t("confirmationSuccessMessage") ||
                  "Your account has been confirmed and your password has been set. You can now log in to your account."}
              </p>
              <button
                onClick={() => (window.location.href = "/signin")}
                className="btn inline-flex items-center justify-center rounded-lg bg-[#456564] px-7 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#34514f]"
              >
                {t("goToSignIn") || "Go to Sign In"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f8f8] via-white to-[#f3f7f6] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="email-template-content mx-auto grid max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800 md:grid-cols-5">
          <div className="relative bg-gradient-to-b from-[#456564] to-[#34514f] p-6 text-white md:col-span-2">
            <div className="mb-8 flex items-center gap-3">
              <img
                src={Logo}
                alt="HomeOps"
                className="h-10 w-auto"
                onError={(event) => {
                  event.target.style.display = "none";
                }}
              />
              <div>
                <h1 className="text-xl font-semibold">HomeOps</h1>
                <p className="text-xs text-white/80">
                  {t("propertyManagementPlatform") || "Property Management Platform"}
                </p>
              </div>
            </div>
            <h2 className="text-2xl font-semibold leading-tight">
              {t("welcomeToHomeOps") || "Welcome to HomeOps!"}
            </h2>
            <p className="mt-3 text-sm text-white/85">
              {t("invitationMessage") ||
                "You've been invited to join HomeOps. Please confirm your information and set up your password to get started."}
            </p>
            <div className="mt-8 rounded-lg border border-white/20 bg-white/10 p-3 text-xs text-white/90">
              {t("passwordMinLength") || "Password must be at least 8 characters"}
            </div>
          </div>

          <div className="p-6 sm:p-7 md:col-span-3">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="mb-1.5 flex items-center text-sm font-medium text-slate-700 dark:text-slate-300"
                  htmlFor="email"
                >
                  <Mail className="mr-1.5 h-4 w-4 text-[#456564]" />
                  {t("email") || "Email"}
                </label>
                <input
                  id="email"
                  type="email"
                  value={userEmail}
                  readOnly
                  className="form-input w-full cursor-not-allowed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  {t("emailCannotBeChanged") || "Email cannot be changed"}
                </p>
              </div>

              <div>
                <label
                  className="mb-1.5 flex items-center text-sm font-medium text-slate-700 dark:text-slate-300"
                  htmlFor="name"
                >
                  <User className="mr-1.5 h-4 w-4 text-[#456564]" />
                  {t("name") || "Name"}
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={t("enterYourName") || "Enter your name"}
                  className={`form-input w-full border text-sm transition ${
                    errors.name
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-slate-300 focus:border-[#456564] focus:ring-[#456564] dark:border-slate-600"
                  }`}
                />
                {errors.name && (
                  <p className="mt-1.5 flex items-center text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="mr-1 h-3.5 w-3.5" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-1.5 flex items-center text-sm font-medium text-slate-700 dark:text-slate-300"
                  htmlFor="password"
                >
                  <Lock className="mr-1.5 h-4 w-4 text-[#456564]" />
                  {t("password") || "Password"}
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={t("enterPassword") || "Enter your password"}
                  className={`form-input w-full border text-sm transition ${
                    errors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-slate-300 focus:border-[#456564] focus:ring-[#456564] dark:border-slate-600"
                  }`}
                />
                {errors.password && (
                  <p className="mt-1.5 flex items-center text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="mr-1 h-3.5 w-3.5" />
                    {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-1.5 flex items-center text-sm font-medium text-slate-700 dark:text-slate-300"
                  htmlFor="confirmPassword"
                >
                  <Lock className="mr-1.5 h-4 w-4 text-[#456564]" />
                  {t("confirmPassword") || "Confirm Password"}
                  <span className="ml-1 text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder={t("confirmPasswordPlaceholder") || "Confirm your password"}
                  className={`form-input w-full border text-sm transition ${
                    errors.confirmPassword
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-slate-300 focus:border-[#456564] focus:ring-[#456564] dark:border-slate-600"
                  }`}
                />
                {errors.confirmPassword && (
                  <p className="mt-1.5 flex items-center text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="mr-1 h-3.5 w-3.5" />
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {errors.submit && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {errors.submit}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#456564] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#34514f] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                    {t("confirming") || "Confirming..."}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {t("confirmInvitation") || "Confirm Invitation"}
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <Building2 className="h-3.5 w-3.5 text-[#456564]" />
              <span>{t("homeOpsFooter") || "© HomeOps. All rights reserved."}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserConfirmationEmail;
