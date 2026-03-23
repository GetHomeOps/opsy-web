import React, {useState, useEffect, useCallback, useMemo} from "react";
import {useTranslation} from "react-i18next";
import confetti from "canvas-confetti";
import {Sparkles, Check, ChevronRight} from "lucide-react";
import ModalBlank from "./ModalBlank";
import {useAuth} from "../context/AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import useOnboardingProgress from "../hooks/useOnboardingProgress";
import AppApi from "../api/api";
import OpsyMascot from "../images/opsy2.png";

/**
 * Default `canvas-confetti` uses a worker + OffscreenCanvas; some browsers fail silently.
 * A main-thread instance is more reliable for the welcome modal overlay.
 */
let welcomeConfettiFire = null;
function getWelcomeConfettiFire() {
  if (typeof window === "undefined") return null;
  if (!welcomeConfettiFire) {
    welcomeConfettiFire = confetti.create(null, {
      resize: true,
      useWorker: false,
    });
  }
  return welcomeConfettiFire;
}

/** Stacking: backdrop z-[200] (ModalBlank default) → confetti → dialog (particles visible around the card). */
const WELCOME_CONFETTI_Z_INDEX = 210;

/** Roles that should see the welcome modal (agents and homeowners only). */
const WELCOME_MODAL_ROLES = new Set(["agent", "homeowner"]);

/** Custom action handlers keyed by customActionId. Opens URLs in a new tab. */
function useCustomActionHandlers({onClose, accountUrl}) {
  return useCallback(
    (step) => {
      if (step.customActionId === "addProperty") {
        const url = accountUrl
          ? `/${accountUrl}/properties/new`
          : "/settings/accounts";
        window.open(url, "_blank", "noopener,noreferrer");
      } else if (step.customActionId === "connectCalendar") {
        const url = accountUrl
          ? `/${accountUrl}/settings/configuration#calendar-integrations`
          : "/settings/configuration#calendar-integrations";
        window.open(url, "_blank", "noopener,noreferrer");
      } else if (step.actionPath) {
        window.open(step.actionPath, "_blank", "noopener,noreferrer");
      }
      onClose();
    },
    [onClose, accountUrl],
  );
}

function WelcomeModal() {
  const {currentUser, refreshCurrentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const {t} = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  /** Hide for this session only (Skip for now); modal can show again after reload or next visit. */
  const [sessionSkipped, setSessionSkipped] = useState(false);

  const userId = currentUser?.id ?? currentUser?.userId;
  const role = (currentUser?.role ?? "").toLowerCase();
  const showForRole = WELCOME_MODAL_ROLES.has(role);
  const welcomeDismissedPermanently = Boolean(currentUser?.welcomeModalDismissed);

  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  useEffect(() => {
    setSessionSkipped(false);
  }, [userId]);

  const handleSkipForNow = useCallback(() => {
    setSessionSkipped(true);
    setModalOpen(false);
  }, []);

  const handleDismissPermanently = useCallback(async () => {
    if (!userId) {
      setModalOpen(false);
      return;
    }
    try {
      await AppApi.dismissWelcomeModal(userId);
      refreshCurrentUser?.();
    } catch {
      // Still close locally so UX isn't blocked
    }
    setModalOpen(false);
  }, [userId, refreshCurrentUser]);

  const [calendarIntegrations, setCalendarIntegrations] = useState([]);
  const [calendarIntegrationsLoaded, setCalendarIntegrationsLoaded] = useState(false);
  useEffect(() => {
    if (!currentUser?.id || !showForRole) return;
    setCalendarIntegrationsLoaded(false);
    AppApi.getCalendarIntegrations()
      .then((data) => setCalendarIntegrations(data || []))
      .catch(() => setCalendarIntegrations([]))
      .finally(() => setCalendarIntegrationsLoaded(true));
  }, [currentUser?.id, showForRole]);

  const extraContext = useMemo(
    () => ({calendarIntegrations}),
    [calendarIntegrations],
  );
  const {steps, completedCount, allComplete} = useOnboardingProgress({
    extraContext,
  });
  const totalSteps = steps.length;
  const handleClose = useCallback(() => setModalOpen(false), []);

  const runCustomAction = useCustomActionHandlers({
    onClose: handleClose,
    accountUrl,
  });

  useEffect(() => {
    if (!userId || !showForRole) return;
    if (!calendarIntegrationsLoaded) return;
    if (welcomeDismissedPermanently || sessionSkipped) {
      setModalOpen(false);
      return;
    }
    if (allComplete) {
      setModalOpen(false);
      return;
    }
    setModalOpen(true);
  }, [
    userId,
    showForRole,
    allComplete,
    calendarIntegrationsLoaded,
    welcomeDismissedPermanently,
    sessionSkipped,
  ]);

  // v2: earlier builds set localStorage before drawing; invisible confetti still blocked retries.
  const confettiShownKey = userId ? `opsy_welcome_confetti_v2_${userId}` : null;

  // Confetti when modal opens — only once per user (localStorage).
  // Persist only after firing so a failed/invisible run can retry; delay survives Strict Mode cleanup.
  useEffect(() => {
    if (!modalOpen || !userId || !confettiShownKey) return;
    if (typeof localStorage !== "undefined" && localStorage.getItem(confettiShownKey)) return;
    const timeout = setTimeout(() => {
      const fireConfetti = getWelcomeConfettiFire();
      if (!fireConfetti) return;
      const count = 700;
      const defaults = {
        origin: {y: 0.6},
        colors: ["#456564", "#5a8180", "#7aa3a2", "#fbbf24", "#34d399"],
        zIndex: WELCOME_CONFETTI_Z_INDEX,
      };
      try {
        const fire = (particleRatio, opts) =>
          fireConfetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
          });
        fire(0.25, {spread: 70, startVelocity: 65});
        fire(0.2, {spread: 120});
        fire(0.35, {spread: 180, scalar: 0.9, decay: 0.9});
        fire(0.1, {spread: 220, startVelocity: 45, decay: 0.92, scalar: 1.2});
        fire(0.1, {origin: {x: 0.2, y: 0.5}, spread: 100, angle: 60, startVelocity: 50});
        fire(0.1, {origin: {x: 0.8, y: 0.5}, spread: 100, angle: 120, startVelocity: 50});
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(confettiShownKey, "1");
        }
      } catch {
        // Don't persist — allow retry on next open
      }
    }, 320);
    return () => clearTimeout(timeout);
  }, [modalOpen, userId, confettiShownKey]);

  const firstName =
    currentUser?.fullName?.split(" ")[0] || currentUser?.name?.split(" ")[0] || "";

  if (!modalOpen) {
    return null;
  }

  return (
    <>
      <ModalBlank
        id="welcome-modal"
        modalOpen={modalOpen}
        setModalOpen={(open) => {
          if (!open) handleSkipForNow();
        }}
        closeOnClickOutside={false}
        contentClassName="max-w-lg"
        dialogZClassName="z-[220]"
      >
        <div className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-[#456564] via-[#5a8180] to-[#3a5554] opacity-[0.07] dark:opacity-[0.15]" />
          <div className="absolute -top-6 -right-6 w-28 h-28 bg-[#456564]/5 dark:bg-[#456564]/10 rounded-full blur-3xl" />

          <div className="relative px-6 pt-8 pb-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center mb-4">
                <img
                  src={OpsyMascot}
                  alt="Opsy"
                  className="w-28 h-28 object-contain drop-shadow-md"
                />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#456564] dark:text-[#7aa3a2]">
                  {t("onboarding.badge")}
                </span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {firstName
                  ? t("onboarding.titleWithName", {name: firstName})
                  : t("onboarding.title")}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                {t("onboarding.subtitle")}
              </p>
            </div>

            {allComplete ? (
              /* Success state */
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mb-4">
                  <Check className="w-8 h-8" strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {t("onboarding.successTitle")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {t("onboarding.successMessage")}
                </p>
                <button
                  type="button"
                  onClick={handleDismissPermanently}
                  className="w-full py-3 px-6 bg-[#456564] hover:bg-[#3a5554] text-white rounded-xl font-semibold text-sm transition-colors shadow-sm hover:shadow-md"
                >
                  {t("onboarding.explore")}
                </button>
              </div>
            ) : (
              <>
                {/* Progress indicator */}
                <div className="flex items-center justify-between mb-4 px-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("onboarding.progress", {
                      completed: completedCount,
                      total: totalSteps,
                    })}
                  </span>
                  <div className="h-1.5 flex-1 max-w-[120px] mx-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-[#456564] dark:bg-[#7aa3a2] rounded-full transition-all duration-500 ease-out"
                      style={{width: `${(completedCount / totalSteps) * 100}%`}}
                    />
                  </div>
                </div>

                {/* Checklist */}
                <div className="space-y-3 mb-6">
                  {steps.map((step) => {
                    const Icon = step.icon;
                    const completed = step.completed;
                    const hasAction = !completed && (step.actionPath || step.customActionId);

                    return (
                      <div
                        key={step.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                          completed
                            ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60"
                        }`}
                      >
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                            completed
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                              : "bg-gray-100 dark:bg-gray-700/80 text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {completed ? (
                            <Check className="w-5 h-5" strokeWidth={2.5} />
                          ) : (
                            <Icon className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-semibold ${
                              completed
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {t(step.titleKey)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t(step.descriptionKey)}
                          </p>
                        </div>
                        {hasAction && (
                          <button
                            type="button"
                            onClick={() => runCustomAction(step)}
                            className="shrink-0 py-2 px-4 bg-[#456564] hover:bg-[#3a5554] disabled:opacity-60 text-white rounded-lg font-medium text-xs transition-colors flex items-center gap-1"
                          >
                            {t(step.actionLabelKey)}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Skip vs permanent dismiss */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center">
                  <button
                    type="button"
                    onClick={handleSkipForNow}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2"
                  >
                    {t("onboarding.skip")}
                  </button>
                  <span
                    className="hidden sm:inline text-gray-300 dark:text-gray-600"
                    aria-hidden
                  >
                    |
                  </span>
                  <button
                    type="button"
                    onClick={handleDismissPermanently}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline underline-offset-2"
                  >
                    {t("onboarding.doNotShowAgain")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalBlank>
    </>
  );
}

export default WelcomeModal;
