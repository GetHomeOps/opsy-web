import React from "react";
import {Share, Plus, Check} from "lucide-react";
import {useTranslation} from "react-i18next";
import ModalBlank from "./ModalBlank";

function InstallAppModal({open, setOpen, inAppBrowser = false}) {
  const {t} = useTranslation();

  const steps = [
    {
      icon: Share,
      text: t("installAppStep1"),
    },
    {
      icon: Plus,
      text: t("installAppStep2"),
    },
    {
      icon: Check,
      text: t("installAppStep3"),
    },
  ];

  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={setOpen}
      contentClassName="max-w-sm"
    >
      <div className="p-5">
        <div className="flex flex-col items-center text-center mb-5">
          <img
            src="/pwa-192.png"
            alt=""
            width={64}
            height={64}
            className="rounded-2xl shadow-sm mb-3"
          />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {t("installAppTitle")}
          </h2>
          {inAppBrowser && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
              {t("installAppOpenInSafari")}
            </p>
          )}
        </div>

        <ol className="space-y-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={index} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0">
                  {index + 1}
                </span>
                <div className="flex items-start gap-2 pt-0.5">
                  <Icon
                    className="w-4 h-4 text-gray-500 dark:text-gray-400 shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <p className="text-sm text-gray-600 dark:text-gray-300 text-left">
                    {step.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          className="btn btn-primary mt-6 w-full py-2 px-4 text-sm font-medium transition-colors"
          onClick={() => setOpen(false)}
        >
          {t("installAppGotIt") || "Got it"}
        </button>
      </div>
    </ModalBlank>
  );
}

export default InstallAppModal;
