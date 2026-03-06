import React, {useState, useEffect, useRef} from "react";
import {Link, useLocation, useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {AlertCircle, Loader2, ShieldCheck} from "lucide-react";
import {useAuth} from "../../context/AuthContext";
import {API_BASE_URL} from "../../api/api";
import "../../i18n";

import Logo from "../../images/logo-no-bg.png";
import MountRainier from "../../images/MountRainier.png";

function Signin() {
  const navigate = useNavigate();
  const location = useLocation();
  const {login, completeMfaLogin, currentUser} = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [formErrors, setFormErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mfaTicket, setMfaTicket] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [mfaSubmitting, setMfaSubmitting] = useState(false);
  const justLoggedIn = useRef(false);

  const {t, i18n} = useTranslation();

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

  // Navigate after successful login when currentUser is available (redirect-after-login from ProtectedRoute)
  useEffect(() => {
    if (justLoggedIn.current && currentUser) {
      const from = location.state?.from;
      const isInternalPath =
        typeof from === "string" &&
        from.startsWith("/") &&
        !from.startsWith("//");
      if (isInternalPath && from !== "/signin" && from !== "/signup") {
        navigate(from, {replace: true});
      } else if (currentUser.accounts && currentUser.accounts.length > 0) {
        const accountUrl =
          currentUser.accounts[0].url?.replace(/^\/+/, "") ||
          currentUser.accounts[0].name;
        navigate(`/${accountUrl}/home`, {replace: true});
      } else {
        navigate("/signin", {replace: true});
      }
      justLoggedIn.current = false;
    }
  }, [currentUser, navigate, location.state?.from]);

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
        const raw =
          err?.messages ??
          (Array.isArray(err)
            ? err
            : [err?.message || err?.toString?.() || String(err)]);
        const messages = raw.map((e) =>
          typeof e === "string" ? e : e?.message || String(e),
        );
        setFormErrors(messages);
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
  }

  return (
    <main className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      {/* Blurred backdrop */}
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
            <h1 className="text-2xl text-gray-800 dark:text-gray-100 font-semibold text-center mb-6">
              {t("welcome")}
            </h1>

            {errorMessage && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-red-800 dark:text-red-200 text-sm">
                  {errorMessage}
                </span>
              </div>
            )}

            {mfaTicket ? (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-4">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-sm">
                    {t("mfa.enterCode") || "Enter the 6-digit code from your authenticator app."}
                  </span>
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    htmlFor="mfa-code"
                  >
                    {useBackupCode
                      ? (t("mfa.backupCode") || "Backup code")
                      : (t("mfa.code") || "Verification code")}
                  </label>
                  <input
                    id="mfa-code"
                    type="text"
                    inputMode={useBackupCode ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    className="form-input w-full text-center text-lg tracking-widest"
                    placeholder={useBackupCode ? "XXXXXXXX" : "000000"}
                    maxLength={useBackupCode ? 12 : 6}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setUseBackupCode((b) => !b)}
                  className="text-sm text-[#6E8276] hover:text-[#456564] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7] hover:underline"
                >
                  {useBackupCode
                    ? (t("mfa.useAuthenticator") || "Use authenticator code")
                    : (t("mfa.useBackupCode") || "Use a backup code")}
                </button>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMfaTicket(null);
                      setMfaCode("");
                      setUseBackupCode(false);
                    }}
                    className="btn border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    {t("back") || "Back"}
                  </button>
                  <button
                    type="submit"
                    disabled={mfaSubmitting || !mfaCode.trim()}
                    className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white shrink-0 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {mfaSubmitting && (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                    )}
                    {mfaSubmitting ? (t("verifying") || "Verifying...") : (t("verify") || "Verify")}
                  </button>
                </div>
              </form>
            ) : (
              <>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
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
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    htmlFor="password"
                  >
                    {t("password")}
                  </label>
                  <input
                    id="password"
                    className="form-input w-full"
                    type="password"
                    autoComplete="on"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-6 gap-3">
                <Link
                  className="text-sm text-[#6E8276] hover:text-[#456564] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7] hover:underline"
                  to="/forgot-password"
                >
                  {t("forgotPassword")}
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white shrink-0 flex items-center justify-center gap-2"
                >
                  {isSubmitting && (
                    <Loader2
                      className="w-4 h-4 animate-spin shrink-0"
                      aria-hidden
                    />
                  )}
                  {isSubmitting ? t("signingIn") : t("signIn")}
                </button>
              </div>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">{t("or")}</span>
              </div>
            </div>

            <a
              href={`${API_BASE_URL}/auth/google/signin`}
              className="btn w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t("signInWithGoogle")}
            </a>

            <div className="pt-5 mt-6 border-t border-gray-200 dark:border-gray-600 text-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t("noAccount")}{" "}
              </span>
              <Link
                className="text-sm font-medium text-[#6E8276] hover:text-[#456564] dark:text-[#7aa3a2] dark:hover:text-[#9cb8b7]"
                to="/signup"
              >
                {t("signUp")}
              </Link>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default Signin;
