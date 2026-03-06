import {t} from "i18next";
import React from "react";
import {NavLink, useLocation} from "react-router-dom";

function SettingsSidebar() {
  const location = useLocation();
  const {pathname} = location;

  return (
    <div className="flex flex-nowrap overflow-x-scroll no-scrollbar md:block md:overflow-auto px-3 py-6 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700/60 min-w-[15rem] md:space-y-3">
      {/* Group 1 */}
      <div>
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-3">
          {t("accountSettings")}
        </div>
        <ul className="flex flex-nowrap md:block mr-3 md:mr-0">
          {/* ---- My Account ---- */}
          <li className="mr-0.5 md:mr-0 md:mb-0.5">
            <NavLink
              end
              to="/settings/account"
              className={`flex items-center px-2.5 py-2 rounded-lg whitespace-nowrap ${
                pathname.includes("/settings/account")
                  ? "bg-gradient-to-r from-violet-500/[0.12] to-violet-500/[0.04] dark:from-violet-500/[0.24]"
                  : ""
              }`}
            >
              <svg
                className={`shrink-0 fill-current mr-2 ${
                  pathname.includes("/settings/account")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
              >
                <path d="M8 9a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-5.143 7.91a1 1 0 1 1-1.714-1.033A7.996 7.996 0 0 1 8 10a7.996 7.996 0 0 1 6.857 3.877 1 1 0 1 1-1.714 1.032A5.996 5.996 0 0 0 8 12a5.996 5.996 0 0 0-5.143 2.91Z" />
              </svg>
              <span
                className={`text-sm font-medium ${
                  pathname.includes("/settings/account")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {t("myAccount")}
              </span>
            </NavLink>
          </li>

          {/* ---- My Orders ---- */}
          <li className="mr-0.5 md:mr-0 md:mb-0.5">
            <NavLink
              end
              to="/settings/orders"
              className={`flex items-center px-2.5 py-2 rounded-lg whitespace-nowrap ${
                pathname.includes("/settings/orders")
                  ? "bg-gradient-to-r from-violet-500/[0.12] to-violet-500/[0.04] dark:from-violet-500/[0.24]"
                  : ""
              }`}
            >
              <svg
                className={`shrink-0 fill-current mr-2 ${
                  pathname.includes("/settings/orders")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
              >
                <path d="M8 3.414V6a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1h5a1 1 0 0 1 0 2H9.414l6.293 6.293a1 1 0 1 1-1.414 1.414L8 3.414Zm0 9.172V10a1 1 0 1 1 2 0v5a1 1 0 0 1-1 1H4a1 1 0 0 1 0-2h2.586L.293 7.707a1 1 0 0 1 1.414-1.414L8 12.586Z" />
              </svg>
              <span
                className={`text-sm font-medium ${
                  pathname.includes("/settings/orders")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {t("myOrders")}
              </span>
            </NavLink>
          </li>

          {/* ---- Documents---- */}
          <li className="mr-0.5 md:mr-0 md:mb-0.5">
            <NavLink
              end
              to="/settings/documents"
              className={`flex items-center px-2.5 py-2 rounded-lg whitespace-nowrap ${
                pathname.includes("/settings/documents") &&
                "bg-[linear-gradient(135deg,var(--tw-gradient-stops))] from-violet-500/[0.12] dark:from-violet-500/[0.24] to-violet-500/[0.04]"
              }`}
            >
              <svg
                className={`shrink-0 fill-current mr-2 ${
                  pathname.includes("/settings/documents")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
              >
                <path d="M5 9a1 1 0 1 1 0-2h6a1 1 0 0 1 0 2H5ZM1 4a1 1 0 1 1 0-2h14a1 1 0 0 1 0 2H1Zm0 10a1 1 0 0 1 0-2h14a1 1 0 0 1 0 2H1Z" />
              </svg>
              <span
                className={`text-sm font-medium ${
                  pathname.includes("/settings/documents")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {t("myDocuments")}
              </span>
            </NavLink>
          </li>
          <li className="mr-0.5 md:mr-0 md:mb-0.5">
            <NavLink
              end
              to="/settings/billing"
              className={`flex items-center px-2.5 py-2 rounded-lg whitespace-nowrap ${
                pathname.includes("/settings/billing") &&
                "bg-[linear-gradient(135deg,var(--tw-gradient-stops))] from-violet-500/[0.12] dark:from-violet-500/[0.24] to-violet-500/[0.04]"
              }`}
            >
              <svg
                className={`shrink-0 fill-current mr-2 ${
                  pathname.includes("/settings/billing")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
              >
                <path d="M0 4a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4Zm2 0v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Zm9 1a1 1 0 0 1 0 2H5a1 1 0 1 1 0-2h6Zm0 4a1 1 0 0 1 0 2H5a1 1 0 1 1 0-2h6Z" />
              </svg>
              <span
                className={`text-sm font-medium ${
                  pathname.includes("/settings/billing")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                Billing & Invoices
              </span>
            </NavLink>
          </li>
        </ul>
      </div>

      {/* Group 2 */}
      <div>
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-3">
          Experience
        </div>
        <ul className="flex flex-nowrap md:block mr-3 md:mr-0">
          {/* ---- Feedback ---- */}
          <li className="mr-0.5 md:mr-0 md:mb-0.5">
            <NavLink
              end
              to="/settings/feedback"
              className={`flex items-center px-2.5 py-2 rounded-lg whitespace-nowrap ${
                pathname.includes("/settings/feedback") &&
                "bg-[linear-gradient(135deg,var(--tw-gradient-stops))] from-violet-500/[0.12] dark:from-violet-500/[0.24] to-violet-500/[0.04]"
              }`}
            >
              <svg
                className={`shrink-0 fill-current mr-2 ${
                  pathname.includes("/settings/feedback")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-400 dark:text-gray-500"
                }`}
                width="16"
                height="16"
                viewBox="0 0 16 16"
              >
                <path d="M14.3.3c.4-.4 1-.4 1.4 0 .4.4.4 1 0 1.4l-8 8c-.2.2-.4.3-.7.3-.3 0-.5-.1-.7-.3-.4-.4-.4-1 0-1.4l8-8zM15 7c.6 0 1 .4 1 1 0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8c.6 0 1 .4 1 1s-.4 1-1 1C4.7 2 2 4.7 2 8s2.7 6 6 6 6-2.7 6-6c0-.6.4-1 1-1z" />
              </svg>
              <span
                className={`text-sm font-medium ${
                  pathname.includes("/settings/feedback")
                    ? "text-violet-500 dark:text-violet-400"
                    : "text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                Give Feedback
              </span>
            </NavLink>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default SettingsSidebar;
