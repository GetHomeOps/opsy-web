import React from "react";
import {NavLink} from "react-router-dom";
import {Building2} from "lucide-react";
import {PAGE_LAYOUT} from "../../constants/layout";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AffiliationRequestsList from "./AffiliationRequestsList";
import AgenciesManage from "./AgenciesManage";
import AgentsList from "./AgentsList";

function AgenciesAdminHub({activeTab = "manage"}) {
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const base = accountUrl ? `/${accountUrl}/agencies` : "/agencies";

  const tabs = [
    {id: "manage", label: "Manage agencies", path: `${base}/manage`},
    {id: "agents", label: "Agents", path: `${base}/agents`},
    {id: "requests", label: "Pending requests", path: `${base}/requests`},
  ];

  return (
            <main className="grow">
          <div className={PAGE_LAYOUT.list}>
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-[#456564]" />
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                  Agencies
                </h1>
              </div>
            </div>

            <nav className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.id}
                  to={tab.path}
                  className={({isActive}) =>
                    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      isActive
                        ? "border-[#456564] text-[#456564] dark:text-[#7aa3a2]"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>

            {activeTab === "manage" ? (
              <AgenciesManage />
            ) : activeTab === "agents" ? (
              <AgentsList embedded />
            ) : (
              <AffiliationRequestsList embedded />
            )}
          </div>
        </main>
      
  );
}

export default AgenciesAdminHub;
