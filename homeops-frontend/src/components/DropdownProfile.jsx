import React, {useState, useRef, useEffect, useContext} from "react";
import {Link} from "react-router-dom";
import {CreditCard, Settings, HelpCircle, RefreshCw, LogOut} from "lucide-react";
import Transition from "../utils/Transition";
import AuthContext from "../context/AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";

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

function DropdownProfile({align}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const {currentUser, logout} = useContext(AuthContext);
  const {currentAccount} = useCurrentAccount();
  const {t} = useTranslation();

  const trigger = useRef(null);
  const dropdown = useRef(null);

  const photoUrl = currentUser?.avatarUrl || currentUser?.image_url;
  const initials = getInitials(currentUser?.name);

  const accountUrl = currentAccount?.url || "";
  const settingsBase = accountUrl ? `/${accountUrl}/settings` : "/settings";

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

  const hasMultipleAccounts = (currentUser?.accounts?.length || 0) > 1;

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
        className={`origin-top-right z-10 absolute top-full min-w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 py-1.5 rounded-lg shadow-lg overflow-hidden mt-1 ${
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
          <div className="pt-0.5 pb-2 px-3 mb-1 border-b border-gray-200 dark:border-gray-700/60">
            <div className="font-medium text-gray-700 dark:text-gray-100">
              {currentUser?.name}
            </div>
            {currentUser?.email && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {currentUser.email}
              </div>
            )}
            <div className="text-xs text-gray-500 dark:text-gray-400 italic capitalize">
              {currentUser?.role}
            </div>
          </div>
          <div>
            <ul>
              {accountUrl && (
                <>
                  <li>
                    <Link
                      className="font-medium text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white flex items-center gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      to={`${settingsBase}/billing`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      <CreditCard className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                      {(t("billing") || "Billing").replace(/^\w/, (c) => c.toUpperCase())}
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="font-medium text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white flex items-center gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      to={`${settingsBase}/configuration`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      <Settings className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                      {(t("configuration") || "Configuration").replace(/^\w/, (c) => c.toUpperCase())}
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="font-medium text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white flex items-center gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      to={`${settingsBase}/support`}
                      onClick={() => setDropdownOpen(false)}
                    >
                      <HelpCircle className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                      {(t("support") || "Support").replace(/^\w/, (c) => c.toUpperCase())}
                    </Link>
                  </li>
                </>
              )}
              {hasMultipleAccounts && (
                <li>
                  <Link
                    className="font-medium text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white flex items-center gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    to="/settings/accounts"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <RefreshCw className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    {(t("switchAccount") || "Switch Account").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Link>
                </li>
              )}
            </ul>
            <div className="border-t border-gray-200 dark:border-gray-700/60 mt-1 pt-1">
              <ul>
                <li>
                  <Link
                    className="font-medium text-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-white flex items-center gap-2 py-1 px-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    to="/signin"
                    onClick={logout}
                  >
                    <LogOut className="w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500" />
                    {(t("signOut") || "Sign Out").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  );
}

export default DropdownProfile;
