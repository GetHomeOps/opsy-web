import React, {useState, useContext} from "react";
import UserContext from "../../auth/UserContext";

import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import SettingsSidebar from "../../partials/acountSettings/SettingsSidebar";
import AccountPanel from "../../partials/settings/AccountPanel";

import {useTranslation} from "react-i18next";
import "../../i18n/index";

function Main() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {currentUser} = useContext(UserContext);

  const {t, i18n} = useTranslation();

  console.log("currentUser", currentUser);
  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      {/* <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> */}

      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {/* Page header */}
            <div className="mb-8">
              {/* Title */}
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                {t("accountSettings")}
              </h1>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-gray-800 shadow-xs rounded-xl mb-8">
              <div className="flex flex-col md:flex-row md:-mr-px">
                <SettingsSidebar />
                <AccountPanel />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Main;
