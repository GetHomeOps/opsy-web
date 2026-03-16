import React, {useState, useRef, useEffect} from "react";
import {Link} from "react-router-dom";
import Transition from "../utils/Transition";
import {useAuth} from "../context/AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import useBillingStatus from "../hooks/useBillingStatus";

import {useTranslation} from "react-i18next";
import "../i18n/index";

function getInitials(name) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatRole(role) {
  if (!role) return "";
  return String(role)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function DropdownProfile({align}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const {currentUser, logout} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const {plan} = useBillingStatus();
  const {t} = useTranslation();

  const trigger = useRef(null);
  const dropdown = useRef(null);

  const photoUrl = currentUser?.avatarUrl || currentUser?.image_url;
  const initials = getInitials(currentUser?.name);

  const accountUrl = currentAccount?.url || "";

  // close on click outside
  useEffect(() => {
    const clickHandler = ({target}) => {
      if (!dropdown.current) return;
      if (
        !dropdownOpen ||
        dropdown.current.contains(target) ||
        trigger.current.contains(target)
      )
        return;
      setDropdownOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  });

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({keyCode}) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  });

  const hideBilling = ["super_admin", "admin"].includes(currentUser?.role);

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        className="inline-flex justify-center items-center group"
        aria-haspopup="true"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        {photoUrl ? (
          <img
            key={photoUrl}
            className="w-8 h-8 rounded-full object-cover"
            src={photoUrl}
            width="32"
            height="32"
            alt={currentUser?.name || "User"}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600"
            aria-hidden
          >
            {initials}
          </div>
        )}
        <div className="flex items-center truncate">
          <span className="truncate ml-2 text-sm font-medium text-gray-600 dark:text-gray-100 group-hover:text-gray-800 dark:group-hover:text-white">
            {currentUser?.name}
          </span>
          <svg
            className="w-3 h-3 shrink-0 ml-1 fill-current text-gray-400 dark:text-gray-500"
            viewBox="0 0 12 12"
          >
            <path d="M5.9 11.4L.5 6l1.4-1.4 4 4 4-4L11.3 6z" />
          </svg>
        </div>
      </button>

      <Transition
        className={`origin-top-right z-10 absolute top-full w-52 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 py-1.5 rounded-lg shadow-lg overflow-hidden mt-1 ${
          align === "right" ? "right-0" : "left-0"
        }`}
        show={dropdownOpen}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-200"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <div
          ref={dropdown}
          onFocus={() => setDropdownOpen(true)}
          onBlur={() => setDropdownOpen(false)}
        >
          {/* 1. User section: image, name, email, link to configuration */}
          <div className="px-2.5 pb-2 mb-1.5 border-b border-gray-200 dark:border-gray-700/60">
            <div className="flex items-start gap-2.5">
              {photoUrl ? (
                <img
                  key={photoUrl}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                  src={photoUrl}
                  width="36"
                  height="36"
                  alt={currentUser?.name || "User"}
                />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 shrink-0"
                  aria-hidden
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">
                <div
                  className="text-sm font-medium text-gray-700 dark:text-gray-100 truncate"
                  title={currentUser?.name}
                >
                  {currentUser?.name}
                </div>
                {currentUser?.email && (
                  <div
                    className="text-xs text-gray-500 dark:text-gray-400 overflow-hidden text-ellipsis whitespace-nowrap"
                    title={currentUser.email}
                  >
                    {currentUser.email}
                  </div>
                )}
                <Link
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5 inline-block"
                  to={
                    accountUrl
                      ? `/${accountUrl}/settings/configuration`
                      : "/settings/account"
                  }
                  onClick={() => setDropdownOpen(false)}
                >
                  {t("profileAndPreferences") || "Profile & Preferences"}
                </Link>
              </div>
            </div>
          </div>

          {/* 2. Account section: name and role */}
          {currentAccount && (
            <div className="px-2.5 pb-2 mb-1.5 border-b border-gray-200 dark:border-gray-700/60">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                {t("account") || "Account"}
              </div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-100">
                {currentAccount.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 capitalize italic">
                {formatRole(currentUser?.role)}
              </div>
              {plan?.name && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {plan.name}
                </div>
              )}
            </div>
          )}

          {/* 3. Pricing & Account & Billing */}
          {accountUrl && (
            <ul className="pb-1.5 border-b border-gray-200 dark:border-gray-700/60">
              <li>
                <Link
                  className="text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white flex items-center py-1 px-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  to={`/${accountUrl}/settings/upgrade`}
                  onClick={() => setDropdownOpen(false)}
                >
                  {(t("pricing") || "Pricing").replace(/^\w/, (c) =>
                    c.toUpperCase(),
                  )}
                </Link>
              </li>
              {!hideBilling && (
                <li>
                  <Link
                    className="text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white flex items-center py-1 px-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    to={`/${accountUrl}/settings/billing`}
                    onClick={() => setDropdownOpen(false)}
                  >
                    {t("accountAndBilling") || "Account & Billing"}
                  </Link>
                </li>
              )}
            </ul>
          )}

          {/* 4. Sign Out */}
          <div className="pt-0.5">
            <Link
              className="text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white block py-1 px-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              to="/signin"
              onClick={logout}
            >
              {(t("signOut") || "Sign Out").replace(/\b\w/g, (c) =>
                c.toUpperCase(),
              )}
            </Link>
          </div>
        </div>
      </Transition>
    </div>
  );
}

export default DropdownProfile;
