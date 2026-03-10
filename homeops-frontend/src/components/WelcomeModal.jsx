import React, {useState, useEffect, useCallback} from "react";
import {useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Home, Calendar, Search, ArrowRight, Sparkles} from "lucide-react";
import ModalBlank from "./ModalBlank";
import {useAuth} from "../context/AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import OpsyMascot from "../images/opsy2.png";

const STORAGE_KEY_PREFIX = "opsy-welcome-dismissed";

function getStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}-${userId}`;
}

function WelcomeModal() {
  const {currentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    const dismissed = localStorage.getItem(getStorageKey(currentUser.id));
    if (!dismissed) {
      setModalOpen(true);
    }
  }, [currentUser?.id]);

  const handleDismiss = useCallback(() => {
    if (currentUser?.id) {
      localStorage.setItem(getStorageKey(currentUser.id), "true");
    }
    setModalOpen(false);
  }, [currentUser?.id]);

  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const handleNavigate = useCallback(
    (path) => {
      handleDismiss();
      navigate(path);
    },
    [handleDismiss, navigate],
  );

  const features = [
    {
      icon: Home,
      title: t("welcome.feature1Title"),
      description: t("welcome.feature1Description"),
      cta: t("welcome.feature1Cta"),
      onClick: () => handleNavigate(`/${accountUrl}/properties/new`),
      gradient: "from-emerald-500 to-teal-600",
      bgLight: "bg-emerald-50 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: Calendar,
      title: t("welcome.feature2Title"),
      description: t("welcome.feature2Description"),
      cta: t("welcome.feature2Cta"),
      onClick: () => handleNavigate(`/${accountUrl}/calendar`),
      gradient: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-50 dark:bg-blue-900/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      icon: Search,
      title: t("welcome.feature3Title"),
      description: t("welcome.feature3Description"),
      cta: t("welcome.feature3Cta"),
      onClick: () => handleNavigate(`/${accountUrl}/professionals`),
      gradient: "from-violet-500 to-purple-600",
      bgLight: "bg-violet-50 dark:bg-violet-900/20",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
  ];

  if (!modalOpen) return null;

  const firstName =
    currentUser?.fullName?.split(" ")[0] ||
    currentUser?.name?.split(" ")[0] ||
    "";

  return (
    <ModalBlank
      id="welcome-modal"
      modalOpen={modalOpen}
      setModalOpen={(open) => {
        if (!open) handleDismiss();
      }}
      closeOnClickOutside={false}
      contentClassName="max-w-lg"
    >
      <div className="relative overflow-hidden">
        {/* Decorative gradient background */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-[#456564] via-[#5a8180] to-[#3a5554] opacity-[0.07] dark:opacity-[0.15]" />
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-[#456564]/5 dark:bg-[#456564]/10 rounded-full blur-3xl" />

        <div className="relative px-6 pt-8 pb-6">
          {/* Mascot + Welcome */}
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
                {t("welcome.badge")}
              </span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {firstName
                ? t("welcome.titleWithName", {name: firstName})
                : t("welcome.title")}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              {t("welcome.subtitle")}
            </p>
          </div>

          {/* Feature Cards */}
          <div className="space-y-3 mb-6">
            {features.map((feature, idx) => (
              <button
                key={idx}
                type="button"
                onClick={feature.onClick}
                className="w-full group flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 hover:border-[#456564]/40 dark:hover:border-[#456564]/40 hover:shadow-md transition-all text-left"
              >
                <div
                  className={`w-11 h-11 rounded-xl ${feature.bgLight} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {feature.description}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-[#456564] dark:group-hover:text-[#7aa3a2] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </button>
            ))}
          </div>

          {/* Get Started Button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="w-full py-3 px-6 bg-[#456564] hover:bg-[#3a5554] text-white rounded-xl font-semibold text-sm transition-colors shadow-sm hover:shadow-md"
          >
            {t("welcome.getStarted")}
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}

export default WelcomeModal;
