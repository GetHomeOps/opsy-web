import React, {useContext} from "react";

import DatabasesPanel from "../../partials/acountSettings/DatabasesPanel";
import {useTranslation} from "react-i18next";
import AuthContext from "../../context/AuthContext";

function Databases() {
  const {currentUser} = useContext(AuthContext);
  const {t} = useTranslation();

  return (
    <main className="grow">
      <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
            {t("databases")}
          </h1>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow-xs rounded-xl mb-8">
          <div className="flex flex-col md:flex-row md:-mr-px">
            <DatabasesPanel currentUser={currentUser} />
          </div>
        </div>
      </div>
    </main>
  );
}

export default Databases;
