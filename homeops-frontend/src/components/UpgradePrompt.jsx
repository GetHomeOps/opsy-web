import React from "react";
import {useNavigate} from "react-router-dom";
import {ArrowUpCircle, X} from "lucide-react";
import ModalBlank from "./ModalBlank";

/**
 * Reusable upgrade prompt modal shown when a user hits a tier limit.
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   title: string
 *   message: string
 *   currentUsage: number (optional)
 *   limit: number (optional)
 *   upgradeUrl: string (optional, defaults to settings/upgrade)
 */
export default function UpgradePrompt({
  open,
  onClose,
  title = "Upgrade your plan",
  message = "You've reached the limit for your current plan. Upgrade to unlock more.",
  currentUsage,
  limit,
  upgradeUrl,
}) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onClose();
    if (upgradeUrl) {
      navigate(upgradeUrl);
    } else {
      navigate("settings/upgrade");
    }
  };

  return (
    <ModalBlank id="upgrade-prompt" modalOpen={open} setModalOpen={onClose}>
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ArrowUpCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {message}
        </p>

        {currentUsage != null && limit != null && (
          <div className="mb-5">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Usage</span>
              <span>{currentUsage} / {limit}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-amber-500 dark:bg-amber-400 h-2 rounded-full transition-all"
                style={{width: `${Math.min((currentUsage / limit) * 100, 100)}%`}}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            className="rounded-full px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Upgrade plan
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}
