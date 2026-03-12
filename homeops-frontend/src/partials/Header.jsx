import React, {useState, useRef} from "react";
import {Link, useSearchParams} from "react-router-dom";
import {HelpCircle, Sparkles} from "lucide-react";

import NavbarSearch from "../components/NavbarSearch";
import Notifications from "../components/DropdownNotifications";
import Reminders from "../components/DropdownReminders";
import UserMenu from "../components/DropdownProfile";
import GlobalAIAssistantPanel from "../components/GlobalAIAssistantPanel";
import UpgradePrompt from "../components/UpgradePrompt";
import useCurrentAccount from "../hooks/useCurrentAccount";
import useBillingStatus from "../hooks/useBillingStatus";

const FREE_PLAN_CODES = ["homeowner_free", "agent_free", "free"];

function Header({sidebarOpen, setSidebarOpen, variant = "default"}) {
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiUpgradeModalOpen, setAiUpgradeModalOpen] = useState(false);
  const aiAssistantButtonRef = useRef(null);
  const {currentAccount} = useCurrentAccount();
  const {plan, loading: billingLoading, isAdmin} = useBillingStatus();

  const accountUrl = currentAccount?.url || "";
  const supportPath = accountUrl
    ? `/${accountUrl}/settings/support`
    : "/settings/support";
  // Only treat as paid when we have a plan code that's explicitly not free. Admins bypass. When loading or plan unknown, treat as free.
  const isPaidUser =
    isAdmin || (plan?.code && !FREE_PLAN_CODES.includes(plan.code));

  const handleAiAssistantClick = () => {
    // Free users: show upgrade modal instead of opening the AI panel
    if (!isPaidUser) {
      requestAnimationFrame(() => setAiUpgradeModalOpen(true));
      return;
    }
    setAiPanelOpen(true);
  };

  return (
    <header
      className={`sticky top-0 before:absolute before:inset-0 before:backdrop-blur-md max-lg:before:bg-white/90 dark:max-lg:before:bg-gray-800/90 before:-z-10 z-30 ${
        variant === "v2" || variant === "v3"
          ? "before:bg-white after:absolute after:h-px after:inset-x-0 after:top-full after:bg-gray-200 dark:after:bg-gray-700/60 after:-z-10"
          : "max-lg:shadow-xs lg:before:bg-[var(--color-gray-50)]/90 dark:lg:before:bg-gray-900/90"
      } ${variant === "v2" ? "dark:before:bg-gray-800" : ""} ${
        variant === "v3" ? "dark:before:bg-gray-900" : ""
      }`}
    >
      <div className="px-0 sm:px-4 lg:px-5 xxl:px-12">
        <div
          className={`flex items-center justify-between h-16 gap-4 ${
            variant === "v2" || variant === "v3"
              ? ""
              : aiPanelOpen
                ? "lg:border-b border-gray-400 dark:border-gray-600"
                : "lg:border-b border-gray-200 dark:border-gray-700/60"
          }`}
        >
          {/* Header: Left side */}
          <div className="flex shrink-0">
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

          {/* Header: Center — Search bar */}
          <div className="flex-1 flex justify-center min-w-0 max-w-2xl mx-auto">
            <NavbarSearch disabled={aiPanelOpen} />
          </div>

          {/* Header: Right side — AI Assistant, Help, Reminders, Notifications, User */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              ref={aiAssistantButtonRef}
              onClick={handleAiAssistantClick}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="AI Assistant"
              title="AI Assistant"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <Link
              to={supportPath}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              aria-label="Support"
              title="Support"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
            <hr className="w-px h-6 bg-gray-200 dark:bg-gray-700/60 border-none" />
            <Reminders align="right" />
            <Notifications align="right" />
            <hr className="w-px h-6 bg-gray-200 dark:bg-gray-700/60 border-none" />
            <UserMenu align="right" />
          </div>
        </div>
      </div>

      <GlobalAIAssistantPanel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
      />
      <UpgradePrompt
        open={aiUpgradeModalOpen}
        onClose={() => setAiUpgradeModalOpen(false)}
        title="AI Assistant not included"
        message="Your plan does not include AI assistance. Upgrade to get AI-powered maintenance and property insights."
        upgradeUrl={accountUrl ? `/${accountUrl}/settings/upgrade` : undefined}
        ignoreClickRef={aiAssistantButtonRef}
      />
    </header>
  );
}

export default Header;
