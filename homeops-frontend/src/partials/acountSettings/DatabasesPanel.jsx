import React, {useContext, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import AuthContext from "../../context/AuthContext";

function DatabasesPanel() {
  const {currentUser} = useContext(AuthContext);
  const [comments, setComments] = useState(true);
  const [messages, setMessages] = useState(true);
  const [mentions, setMentions] = useState(false);

  const navigate = useNavigate();

  const {t, i18n} = useTranslation();

  const {setSelectedAccount} = useCurrentAccount();

  function handleConnect(db) {
    setSelectedAccount(db.id);
    navigate(`/${db.name}`);
  }

  return (
    <div className="grow">
      {/* Panel body */}
      <div className="p-6 space-y-6">
        {/* <h2 className="text-2xl text-gray-800 dark:text-gray-100 font-bold mb-5">
          My Notifications
        </h2> */}

        {/* Shares */}
        <section>
          <div className="flex items-center ml-1 mb-4">
            <h3 className="text-xl leading-snug text-gray-800 dark:text-gray-100 font-bold">
              My Accounts
            </h3>
            <button className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white ml-3 cursor-pointer">
              {t("create")}
            </button>
          </div>
          <ul>
            {currentUser.accounts.map((db, index) => (
              <li
                key={db.id}
                className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700/60"
              >
                {/* Left */}
                <div>
                  <div className="text-gray-800 dark:text-gray-100 font-semibold">
                    {db.name}
                  </div>
                  <div className="text-sm">Description...</div>
                </div>
                {/* Right */}
                <div className="flex items-center ml-4">
                  <button
                    className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-violet-500 cursor-pointer"
                    onClick={() => handleConnect(db)}
                  >
                    Connect
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default DatabasesPanel;
