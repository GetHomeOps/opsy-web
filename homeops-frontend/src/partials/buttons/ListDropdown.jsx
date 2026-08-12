import React, {useState, useRef, useEffect} from "react";
import Transition from "../../utils/Transition";
import {useTranslation} from "react-i18next";
import {Settings, UserPlus, Building2, UserMinus, RefreshCw, Users, Mail} from "lucide-react";

function ListDropdown({
  align,
  onImport,
  onBulkOnboard,
  onSendPendingInvitations,
  onExport,
  onDelete,
  onDuplicate,
  onInviteUser,
  onAssignToAgency,
  onRemoveFromAgency,
  onRefreshFromStripe,
  isRefreshingFromStripe = false,
  hasSelection,
  disabled = false,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const trigger = useRef(null);
  const dropdown = useRef(null);

  const {t, i18n} = useTranslation();

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
  }, [dropdownOpen]);

  /* close if the esc key is pressed */
  useEffect(() => {
    const keyHandler = ({keyCode}) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [dropdownOpen]);

  useEffect(() => {
    if (disabled) setDropdownOpen(false);
  }, [disabled]);

  /* handle import */
  function handleImport(e) {
    e.stopPropagation();
    if (disabled) return;
    onImport?.();
    setDropdownOpen(false);
  }

  function handleBulkOnboard(e) {
    e.stopPropagation();
    if (disabled) return;
    onBulkOnboard?.();
    setDropdownOpen(false);
  }

  function handleSendPendingInvitations(e) {
    e.stopPropagation();
    if (disabled) return;
    onSendPendingInvitations?.();
    setDropdownOpen(false);
  }

  function handleExport(e) {
    e.stopPropagation();
    if (disabled) return;
    onExport?.();
    setDropdownOpen(false);
  }

  /* handle delete */
  function handleDelete(e) {
    e.stopPropagation();
    onDelete?.();
    setDropdownOpen(false);
  }

  /* handle duplicate */
  function handleDuplicate(e) {
    e.stopPropagation();
    onDuplicate?.();
    setDropdownOpen(false);
  }

  /* handle invite user */
  function handleInviteUser(e) {
    e.stopPropagation();
    onInviteUser?.();
    setDropdownOpen(false);
  }

  function handleAssignToAgency(e) {
    e.stopPropagation();
    onAssignToAgency?.();
    setDropdownOpen(false);
  }

  function handleRemoveFromAgency(e) {
    e.stopPropagation();
    onRemoveFromAgency?.();
    setDropdownOpen(false);
  }

  function handleRefreshFromStripe(e) {
    e.stopPropagation();
    if (disabled || isRefreshingFromStripe) return;
    onRefreshFromStripe?.();
    setDropdownOpen(false);
  }

  return (
    <div className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        className={`btn px-2.5 bg-white dark:bg-gray-800 border-gray-200 hover:border-gray-300 dark:border-gray-700/60 dark:hover:border-gray-600 text-gray-400 dark:text-gray-500 ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        aria-haspopup="true"
        disabled={disabled}
        onClick={() => !disabled && setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
      >
        <span className="sr-only">Actions</span>
        <wbr />
        <Settings className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" />
      </button>
      <Transition
        show={dropdownOpen}
        tag="div"
        className={`origin-top-right z-10 absolute top-full left-0 right-auto min-w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 pt-1.5 rounded-lg shadow-xl overflow-hidden mt-1 ${
          align === "right"
            ? "md:left-auto md:right-0"
            : "md:left-0 md:right-auto"
        }`}
        enter="transition ease-out duration-200 transform"
        enterStart="opacity-0 -translate-y-2"
        enterEnd="opacity-100 translate-y-0"
        leave="transition ease-out duration-200"
        leaveStart="opacity-100"
        leaveEnd="opacity-0"
      >
        <div ref={dropdown}>
          <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase pt-1.5 pb-2 px-3">
            {t("actions")}
          </div>
          <ul className="mb-1">
            {onRefreshFromStripe && (
              <li>
                <button
                  type="button"
                  className={`w-full flex items-center px-3 py-2 ${
                    isRefreshingFromStripe
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={handleRefreshFromStripe}
                  disabled={isRefreshingFromStripe}
                >
                  <RefreshCw
                    className={`w-5 h-5 ${isRefreshingFromStripe ? "animate-spin" : ""}`}
                    strokeWidth={1.5}
                  />
                  <span className="text-sm font-medium ml-2">
                    {isRefreshingFromStripe
                      ? t("subscriptions.refreshingFromStripe", {
                          defaultValue: "Refreshing...",
                        })
                      : t("subscriptions.refreshFromStripe", {
                          defaultValue: "Refresh from Stripe",
                        })}
                  </span>
                </button>
              </li>
            )}
            {onExport && (
              <li>
                <button
                  type="button"
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2"
                  onClick={handleExport}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span className="text-sm font-medium ml-2">{t("export", {defaultValue: "Export"})}</span>
                </button>
              </li>
            )}
            {onImport && (
              <li>
                <button
                  type="button"
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2"
                  onClick={handleImport}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="text-sm font-medium ml-2">{t("import")}</span>
                </button>
              </li>
            )}
            {onBulkOnboard && (
              <li>
                <button
                  type="button"
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2"
                  onClick={handleBulkOnboard}
                >
                  <Users className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-sm font-medium ml-2">
                    {t("bulkOnboard", {defaultValue: "Bulk onboard"})}
                  </span>
                </button>
              </li>
            )}
            {onSendPendingInvitations && (
              <li>
                <button
                  type="button"
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2"
                  onClick={handleSendPendingInvitations}
                >
                  <Mail className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-sm font-medium ml-2">
                    {t("sendPendingInvitations", {
                      defaultValue: "Send pending invitations",
                    })}
                  </span>
                </button>
              </li>
            )}
            {hasSelection && onInviteUser && (
              <li>
                <button
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2"
                  onClick={handleInviteUser}
                >
                  <UserPlus className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-sm font-medium ml-2">
                    {t("inviteUser", {defaultValue: "Invite User"})}
                  </span>
                </button>
              </li>
            )}
            {hasSelection && onAssignToAgency && (
              <li>
                <button
                  type="button"
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2"
                  onClick={handleAssignToAgency}
                >
                  <Building2 className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-sm font-medium ml-2">
                    {t("addToAgency", {defaultValue: "Add to agency"})}
                  </span>
                </button>
              </li>
            )}
            {hasSelection && onRemoveFromAgency && (
              <li>
                <button
                  type="button"
                  className="w-full flex items-center cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 text-red-600 dark:text-red-400"
                  onClick={handleRemoveFromAgency}
                >
                  <UserMinus className="w-5 h-5" strokeWidth={1.5} />
                  <span className="text-sm font-medium ml-2">
                    {t("removeFromAgency", {defaultValue: "Remove from agency"})}
                  </span>
                </button>
              </li>
            )}
            {hasSelection && onDuplicate && (
              <li>
                <button
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2"
                  onClick={handleDuplicate}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="icon icon-tabler icons-tabler-outline icon-tabler-copy"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z" />
                    <path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1" />
                  </svg>
                  <span className="text-sm font-medium ml-2">
                    {t("duplicate")}
                  </span>
                </button>
              </li>
            )}
            {hasSelection && onDelete && (
              <li>
                <button
                  className="w-full flex items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-2"
                  onClick={handleDelete}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="icon icon-tabler icons-tabler-outline icon-tabler-trash"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M4 7l16 0" />
                    <path d="M10 11l0 6" />
                    <path d="M14 11l0 6" />
                    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                  </svg>
                  <span className="text-sm font-medium ml-2">{t("delete")}</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      </Transition>
    </div>
  );
}

export default ListDropdown;
