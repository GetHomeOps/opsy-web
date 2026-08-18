import React, {useContext} from "react";
import UserContext from "../../auth/UserContext";

import SettingsSidebar from "../../partials/acountSettings/SettingsSidebar";
import AccountPanel from "../../partials/settings/AccountPanel";

import {useTranslation} from "react-i18next";
import "../../i18n/index";

function Main() {
  const {currentUser} = useContext(UserContext);
  const {t} = useTranslation();

  console.log("currentUser", currentUser);
  return (
    <main className="grow">
      <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            {t("accountSettings")}
          </h1>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-xs rounded-xl mb-8">
          <div className="flex flex-col md:flex-row md:-mr-px">
            <SettingsSidebar />
            <AccountPanel />
          </div>
        </div>
      </div>
    </main>
  );
}

export default Main;
