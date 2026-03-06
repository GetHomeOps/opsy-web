import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import AppApi from "../../api/api";
import Logo from "../../images/logo-no-bg.png";
import MountRainier from "../../images/MountRainier.png";
import "../../i18n";

function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const errorMessage = formErrors.length
    ? formErrors.map((e) => (typeof e === "string" ? e : e?.message || String(e))).join(" ")
    : null;

  async function handleSubmit(evt) {
    evt.preventDefault();
    setFormErrors([]);
    if (!email.trim()) {
      setFormErrors([t("forgotPassword.emailRequired", "Email is required")]);
      return;
    }
    setIsSubmitting(true);
    try {
      await AppApi.requestPasswordReset(email.trim());
      setSuccess(true);
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
              <div className="w-12 h-12 rounded-full bg-[#456564]/10 dark:bg-[#7aa3a2]/20 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-[#456564] dark:text-[#7aa3a2]" />
              </div>
              <h1 className="text-xl text-gray-800 dark:text-gray-100 font-semibold mb-2">
                {t("forgotPassword.checkEmail", "Check your email")}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                {t(
                  "forgotPassword.checkEmailMessage",
                  "If an account exists for that email, we've sent you a link to reset your password."
                )}
              </p>
              <Link
                to="/signin"
                className="text-sm font-medium text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7]"
              >
                {t("backToSignIn", "Back to Sign In")}
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
              {t("forgotPassword.title", "Forgot your password?")}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm text-center mb-6">
              {t(
                "forgotPassword.subtitle",
                "Enter your email and we'll send you a link to reset your password."
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

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  htmlFor="email"
                >
                  {t("emailAddress")}
                </label>
                <input
                  id="email"
                  className="form-input w-full"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn w-full bg-[#456564] hover:bg-[#34514f] text-white flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                  )}
                  {isSubmitting
                    ? t("forgotPassword.sending", "Sending...")
                    : t("forgotPassword.sendLink", "Send reset link")}
                </button>
                <Link
                  to="/signin"
                  className="text-sm text-center text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7]"
                >
                  {t("backToSignIn", "Back to Sign In")}
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

export default ForgotPassword;
