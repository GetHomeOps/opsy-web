import React, {useState, useEffect} from "react";
import {useSearchParams, useLocation, useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import AppApi from "../../api/api";
import {useAuth} from "../../context/AuthContext";
import {isDemoSite} from "../../utils/demoSite";
import {Check, AlertCircle, Loader2} from "lucide-react";
import AuthLayout from "../auth/AuthLayout";
import AuthCardShell from "../auth/AuthCardShell";
import {
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "../auth/authStyles";

function UserConfirmationEmail() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {login} = useAuth();
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

  const inputClass = (field) =>
    `${authInputClass} ${errors[field] ? "!ring-red-400" : ""}`;

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name || formData.name.trim() === "") {
      newErrors.name = t("nameValidationErrorMessage") || "Name is required";
    }

    if (!formData.password || formData.password.length < 8) {
      newErrors.password =
        t("passwordValidationErrorMessage") ||
        "Password must be at least 8 characters";
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
        try {
          await login({email: userEmail, password: formData.password});
          /* Assistants skip onboarding and land in the tethered agent workspace.
             Other invitees must choose a plan via onboarding. */
          if (res?.role === "assistant" || res?.onboardingCompleted === true) {
            const accountUrl = res?.accountUrl || "home";
            navigate(`/${accountUrl}/home`, {replace: true});
            return;
          }
          navigate("/onboarding", {replace: true});
          return;
        } catch (loginErr) {
          setSuccess(true);
          return;
        }
      }
      setErrors((prev) => ({
        ...prev,
        submit: "We couldn't confirm your invitation. Please try again.",
      }));
    } catch (error) {
      console.error("Error confirming user invitation:", error);
      setErrors((prev) => ({
        ...prev,
        submit:
          error?.message ||
          "We couldn't confirm your invitation. Please try again.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <AuthLayout>
        <AuthCardShell title={t("confirmationSuccessTitle") || "Confirmation Successful!"}>
          <p className="text-center text-sm text-[#2D4A44]/70 mb-8">
            {t("confirmationSuccessMessage") ||
              "Your account has been confirmed and your password has been set. You can now log in to your account."}
          </p>
          <button
            type="button"
            onClick={() => (window.location.href = "/signin")}
            className={authPrimaryButtonClass}
          >
            {t("goToSignIn") || "Go to Sign In"}
          </button>
        </AuthCardShell>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCardShell title={t("welcomeToHomeOps") || "Welcome to Opsy!"}>
        <p className="text-center text-sm text-[#2D4A44]/70 mb-6 -mt-4">
          {t("invitationMessage") ||
            "You've been invited to join Opsy. Please confirm your information and set up your password to get started."}
        </p>

        {isDemoSite() ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
            <p className="text-sm text-amber-900">
              {t(
                "invitation.demoSignupDisabled",
                "New account registration is disabled on the demo site. Contact your administrator if you need access.",
              )}
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className={authLabelClass} htmlFor="email">
                {t("email") || "Email"}
              </label>
              <input
                id="email"
                type="email"
                value={userEmail}
                readOnly
                className={`${authInputClass} cursor-not-allowed opacity-70`}
              />
              <p className="mt-1.5 text-xs text-[#2D4A44]/50">
                {t("emailCannotBeChanged") || "Email cannot be changed"}
              </p>
            </div>

            <div>
              <label className={authLabelClass} htmlFor="name">
                {t("name") || "Name"}
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder={t("enterYourName") || "Enter your name"}
                className={inputClass("name")}
              />
              {errors.name && (
                <p className="mt-1.5 flex items-center text-xs text-red-600">
                  <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" />
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <label className={authLabelClass} htmlFor="password">
                {t("password") || "Password"}
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t("enterPassword") || "Enter your password"}
                className={inputClass("password")}
              />
              {errors.password ? (
                <p className="mt-1.5 flex items-center text-xs text-red-600">
                  <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" />
                  {errors.password}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-[#2D4A44]/50">
                  {t("passwordMinLength") ||
                    "Password must be at least 8 characters"}
                </p>
              )}
            </div>

            <div>
              <label className={authLabelClass} htmlFor="confirmPassword">
                {t("confirmPassword") || "Confirm Password"}
                <span className="ml-0.5 text-red-500">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder={
                  t("confirmPasswordPlaceholder") || "Confirm your password"
                }
                className={inputClass("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p className="mt-1.5 flex items-center text-xs text-red-600">
                  <AlertCircle className="mr-1 h-3.5 w-3.5 shrink-0" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          </div>

          {errors.submit && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errors.submit}
            </div>
          )}

          <div className="mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className={authPrimaryButtonClass}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  {t("confirming") || "Confirming..."}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 shrink-0" />
                  {t("confirmInvitation") || "Confirm Invitation"}
                </>
              )}
            </button>
          </div>
        </form>
      </AuthCardShell>
    </AuthLayout>
  );
}

export default UserConfirmationEmail;
