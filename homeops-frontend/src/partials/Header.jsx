import React, {useState, useRef} from "react";
import {Link, useSearchParams, useNavigate} from "react-router-dom";
import {HelpCircle} from "lucide-react";

import opsyAiIcon from "../images/opsy_ai2.webp";
import NavbarSearch from "../components/NavbarSearch";
import Notifications from "../components/DropdownNotifications";
import Reminders from "../components/DropdownReminders";
import UserMenu from "../components/DropdownProfile";
import GlobalAIAssistantPanel from "../components/GlobalAIAssistantPanel";
import UpgradePrompt from "../components/UpgradePrompt";
import DemoEnvironmentBanner from "../components/DemoEnvironmentBanner";
import DemoFeatureUnavailableModal from "../components/DemoFeatureUnavailableModal";
import useCurrentAccount from "../hooks/useCurrentAccount";
import useBillingStatus from "../hooks/useBillingStatus";
import useDemoFeatureGate from "../hooks/useDemoFeatureGate";
import {useAuth} from "../context/AuthContext";

const FREE_PLAN_CODES = ["homeowner_free", "agent_free", "free"];

function Header({sidebarOpen, setSidebarOpen, variant = "default"}) {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiUpgradeModalOpen, setAiUpgradeModalOpen] = useState(false);
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const aiAssistantButtonRef = useRef(null);
  const navigate = useNavigate();
  const {currentUser, impersonation, stopImpersonation} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const {plan, limits, loading: billingLoading, isAdmin} = useBillingStatus();
  const aiDemoGate = useDemoFeatureGate("ai");

  const accountUrl = currentAccount?.url || "";
  const supportPath = accountUrl
    ? `/${accountUrl}/settings/support`
    : "/settings/support";
  // Only treat as paid when we have a plan code that's explicitly not free. Admins bypass. When loading or plan unknown, treat as free.
  const isPaidUser =
    isAdmin || (plan?.code && !FREE_PLAN_CODES.includes(plan.code));
  const aiFeaturesOnPlan = isAdmin || limits?.aiFeaturesEnabled !== false;
  const showAiAssistantButton =
    isAdmin || !limits || limits.aiFeaturesEnabled !== false;

  const isImpersonating = !!impersonation?.active;

  const handleStopImpersonating = async () => {
    if (stoppingImpersonation) return;
    setStoppingImpersonation(true);
    try {
      const adminUser = await stopImpersonation();
      const accountUrl =
        adminUser?.accounts?.[0]?.url || currentAccount?.url || "";
      navigate(accountUrl ? `/${accountUrl}/users` : "/");
    } catch (err) {
      console.error("Failed to stop impersonation:", err);
    } finally {
      setStoppingImpersonation(false);
    }
  };

  const handleAiAssistantClick = () => {
    if (billingLoading) {
      return;
    }
    if (aiDemoGate.blocked) {
      aiDemoGate.showModal();
      return;
    }
    // Free users: show upgrade modal instead of opening the AI panel
    if (!isPaidUser) {
      requestAnimationFrame(() => setAiUpgradeModalOpen(true));
      return;
    }
    if (!aiFeaturesOnPlan) {
      requestAnimationFrame(() => setAiUpgradeModalOpen(true));
      return;
    }
    setAiPanelOpen(true);
  };

  return (
    <>
      <DemoEnvironmentBanner />
      <header
      className={`sticky top-0 z-30 relative ${
        isImpersonating
          ? "bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-700/60"
          : variant === "v2" || variant === "v3"
            ? `bg-white border-b border-gray-200 dark:border-gray-700/60 ${
                variant === "v2" ? "dark:bg-gray-800" : "dark:bg-gray-900"
              }`
            : "bg-white dark:bg-gray-800 lg:bg-[var(--color-gray-50)] dark:lg:bg-gray-900 max-lg:shadow-xs"
      }`}
    >
      {isImpersonating && (
        <div className="bg-amber-500 dark:bg-amber-600 text-white px-3 sm:px-4 lg:px-5 xxl:px-12">
          <div className="flex flex-wrap items-center justify-between gap-2 py-2 min-h-[2.5rem]">
            <p className="text-sm font-medium">
              Viewing as{" "}
              <span className="font-semibold">{currentUser?.name || "User"}</span>
              {currentUser?.email ? (
                <span className="font-normal opacity-90"> ({currentUser.email})</span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={handleStopImpersonating}
              disabled={stoppingImpersonation}
              className="btn-xs bg-white/95 hover:bg-white text-amber-800 font-semibold shrink-0 disabled:opacity-70"
            >
              {stoppingImpersonation ? "Returning..." : "Stop impersonating"}
            </button>
          </div>
        </div>
      )}
      <div className="px-3 sm:px-4 lg:px-5 xxl:px-12">
        <div
          className={`grid h-16 min-w-0 grid-cols-[auto_minmax(2.25rem,1fr)_auto] items-center gap-2 sm:gap-3 lg:gap-4 ${
            variant === "v2" || variant === "v3"
              ? ""
              : aiPanelOpen
                ? "lg:border-b border-gray-400 dark:border-gray-600"
                : "lg:border-b border-gray-200 dark:border-gray-700/60"
          }`}
        >
          {/* Header: Left side */}
          <div className="flex shrink-0 justify-self-start">
            <button
              className="text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 lg:hidden"
              aria-controls="sidebar"
              aria-expanded={sidebarOpen}
              onClick={(e) => {
                e.stopPropagation();
                setSidebarOpen(!sidebarOpen);
              }}
            >
              <span className="sr-only">Open sidebar</span>
              <svg
                className="w-6 h-6 fill-current"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect x="4" y="5" width="16" height="2" />
                <rect x="4" y="11" width="16" height="2" />
                <rect x="4" y="17" width="16" height="2" />
              </svg>
            </button>
          </div>

          {/* Header: Center — Search (min column width keeps icon from overlapping the AI control when the right cluster is wide) */}
          <div className="flex min-w-0 w-full justify-center justify-self-stretch">
            <NavbarSearch disabled={aiPanelOpen} />
          </div>

          {/* Header: Right side — AI Assistant, Help, Reminders, Notifications, User */}
          <div className="flex min-w-0 justify-self-end">
            <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 min-w-0 max-w-[58vw] sm:max-w-none shrink-0">
              <div
                className="flex items-center gap-1 sm:gap-2 lg:gap-3 min-w-0 flex-1 max-lg:overflow-x-auto max-lg:pr-1 max-lg:[&::-webkit-scrollbar]:hidden"
                style={{scrollbarWidth: "none", msOverflowStyle: "none"}}
              >
                {showAiAssistantButton && (
                  <button
                    ref={aiAssistantButtonRef}
                    onClick={handleAiAssistantClick}
                    className={`group relative w-9 h-9 flex items-center justify-center rounded-full transition-transform duration-200 shrink-0 ${
                      aiDemoGate.blocked
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:scale-[1.03]"
                    }`}
                    aria-label="Opsy Assistant"
                    aria-disabled={aiDemoGate.blocked}
                    title={aiDemoGate.blocked ? "Not available on demo" : "Opsy Assistant"}
                  >
                    <span className="absolute inset-0 rounded-full ai-glow" />
                    <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 ai-orbit-ring" />
                    <span className="absolute inset-[2px] rounded-full bg-white dark:bg-gray-800" />
                    <img
                      src={opsyAiIcon}
                      alt=""
                      className="relative z-10 w-7 h-7 object-contain rounded-full ai-icon-halo"
                    />
                  </button>
                )}
                <Link
                  to={supportPath}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 shrink-0"
                  aria-label="Support"
                  title="Support"
                >
                  <HelpCircle className="w-5 h-5" />
                </Link>
              </div>
              <hr className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700/60 border-none shrink-0" />
              <div className="shrink-0">
                <Reminders />
              </div>
              <div className="shrink-0">
                <Notifications />
              </div>
              <hr className="hidden sm:block w-px h-6 bg-gray-200 dark:bg-gray-700/60 border-none shrink-0" />
              <div className="shrink-0">
                <UserMenu />
              </div>
            </div>
          </div>
        </div>
      </div>

      </header>

      <GlobalAIAssistantPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
      />
      <UpgradePrompt
        open={aiUpgradeModalOpen}
        onClose={() => setAiUpgradeModalOpen(false)}
        title="Opsy Assistant not included"
        message="Your plan does not include the Opsy assistant. Upgrade to get AI-powered maintenance and property insights."
        upgradeUrl={accountUrl ? `/${accountUrl}/settings/upgrade` : undefined}
        ignoreClickRef={aiAssistantButtonRef}
      />
      <DemoFeatureUnavailableModal
        {...aiDemoGate.modalProps}
        ignoreClickRef={aiAssistantButtonRef}
      />
    </>
  );
}

export default Header;
