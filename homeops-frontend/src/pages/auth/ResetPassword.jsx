import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import AppApi from "../../api/api";
import Logo from "../../images/logo-no-bg.png";
import MountRainier from "../../images/MountRainier.png";
import "../../i18n";

const MIN_PASSWORD_LENGTH = 4;

function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setFormErrors([t("resetPassword.invalidLink", "Invalid or missing reset link. Please request a new one.")]);
    }
  }, [token, t]);

  const errorMessage = formErrors.length
    ? formErrors.map((e) => (typeof e === "string" ? e : e?.message || String(e))).join(" ")
    : null;

  function validate() {
    const errors = {};
    if (!newPassword) {
      errors.newPassword = t("resetPassword.passwordRequired", "Password is required");
    } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = t("resetPassword.passwordMinLength", {
        min: MIN_PASSWORD_LENGTH,
        defaultValue: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = t("resetPassword.passwordsMustMatch", "Passwords must match");
    }
    return errors;
  }

  async function handleSubmit(evt) {
    evt.preventDefault();
    setFormErrors([]);
    setFieldErrors({});

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (!token) return;

    setIsSubmitting(true);
    try {
      await AppApi.resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate("/signin", { replace: true }), 2000);
    } catch (err) {
      const raw =
        err?.messages ??
        (Array.isArray(err) ? err : [err?.message || err?.toString?.() || String(err)]);
      const messages = raw.map((e) =>
        typeof e === "string" ? e : e?.message || String(e)
      );
      setFormErrors(messages);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${MountRainier})` }}
        />
        <div className="absolute inset-0 bg-white/30 dark:bg-gray-900/30" />

        <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            <div className="flex justify-center mb-8">
              <Link className="block" to="/">
                <img src={Logo} alt="Logo" className="w-15 h-15" />
              </Link>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm px-6 py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-xl text-gray-800 dark:text-gray-100 font-semibold mb-2">
                {t("resetPassword.successTitle", "Password reset!")}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                {t(
                  "resetPassword.successMessage",
                  "Your password has been updated. Redirecting you to sign in..."
                )}
              </p>
              <Link
                to="/signin"
                className="text-sm font-medium text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7]"
              >
                {t("signIn", "Sign In")}
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${MountRainier})` }}
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
            <h1 className="text-2xl text-gray-800 dark:text-gray-100 font-semibold text-center mb-2">
              {t("resetPassword.title", "Set new password")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6">
              {t(
                "resetPassword.subtitle",
                "Enter your new password below."
              )}
            </p>

            {errorMessage && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-red-800 dark:text-red-200 text-sm">
                  {errorMessage}
                </span>
              </div>
            )}

            {token ? (
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      htmlFor="newPassword"
                    >
                      {t("resetPassword.newPassword", "New password")}
                    </label>
                    <input
                      id="newPassword"
                      className="form-input w-full"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {fieldErrors.newPassword && (
                      <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                        {fieldErrors.newPassword}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      htmlFor="confirmPassword"
                    >
                      {t("resetPassword.confirmPassword", "Confirm password")}
                    </label>
                    <input
                      id="confirmPassword"
                      className="form-input w-full"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    {fieldErrors.confirmPassword && (
                      <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                        {fieldErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-6">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn w-full bg-[#456564] hover:bg-[#34514f] text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting && (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                    )}
                    {isSubmitting
                      ? t("resetPassword.resetting", "Resetting...")
                      : t("resetPassword.submit", "Reset password")}
                  </button>
                  <Link
                    to="/signin"
                    className="text-sm text-center text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7]"
                  >
                    {t("backToSignIn", "Back to Sign In")}
                  </Link>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-400 text-sm text-center">
                  {t("resetPassword.noToken", "Please use the link from your email, or request a new one.")}
                </p>
                <Link
                  to="/forgot-password"
                  className="block text-center btn w-full bg-[#456564] hover:bg-[#34514f] text-white"
                >
                  {t("forgotPassword.sendLink", "Request reset link")}
                </Link>
                <Link
                  to="/signin"
                  className="block text-sm text-center text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7]"
                >
                  {t("backToSignIn", "Back to Sign In")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default ResetPassword;
