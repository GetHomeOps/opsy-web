import React, {useState, useEffect} from "react";
import {useTranslation} from "react-i18next";
import {Calendar, CheckCircle2, Loader2} from "lucide-react";
import ModalBlank from "./ModalBlank";
import AppApi from "../api/api";
import useCurrentAccount from "../hooks/useCurrentAccount";

/**
 * Modal showing calendar integration options (Google Calendar, Microsoft Outlook).
 * Used when clicking "Connect your Calendar" from the events dropdown, calendar page, or welcome modal.
 */
function CalendarIntegrationsModal({isOpen, onClose}) {
  const {t} = useTranslation();
  const {currentAccount} = useCurrentAccount();
  const [calendarIntegrations, setCalendarIntegrations] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarDisconnecting, setCalendarDisconnecting] = useState(null);
  const [calendarConnecting, setCalendarConnecting] = useState(null);

  const accountUrl = currentAccount?.url || "";
  const returnTo = typeof window !== "undefined"
    ? window.location.pathname.replace(/^\//, "")
    : accountUrl
      ? `${accountUrl}/calendar`
      : "calendar";

  useEffect(() => {
    if (!isOpen) return;
    setCalendarLoading(true);
    AppApi.getCalendarIntegrations()
      .then((data) => setCalendarIntegrations(data || []))
      .catch(() => setCalendarIntegrations([]))
      .finally(() => setCalendarLoading(false));
  }, [isOpen]);

  return (
    <ModalBlank
      id="calendar-integrations-modal"
      modalOpen={isOpen}
      setModalOpen={(open) => !open && onClose?.()}
      contentClassName="max-w-md"
      ignoreOutsideClickForMs={150}
    >
      <div className="px-6 py-5">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("settings.calendarIntegrations") || "Calendar Integrations"}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t("settings.calendarIntegrationsDescription") ||
            "Connect Google Calendar or Microsoft Outlook to sync maintenance events with your calendar."}
        </p>

        {calendarLoading ? (
          <div className="flex items-center gap-2 py-8 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t("loading") || "Loading..."}
          </div>
        ) : (
          <div className="space-y-3">
            {[
              {provider: "google", label: "Google Calendar"},
              {provider: "outlook", label: "Microsoft Outlook"},
            ].map(({provider, label}) => {
              const integration = calendarIntegrations.find(
                (i) => i.provider === provider,
              );
              const isConnecting = calendarConnecting === provider;
              return (
                <div
                  key={provider}
                  className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    {integration ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                    )}
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {integration
                        ? t("settings.connected") || "Connected"
                        : t("settings.notConnected") || "Not connected"}
                    </span>
                  </div>
                  <div>
                    {integration ? (
                      <button
                        type="button"
                        onClick={async () => {
                          setCalendarDisconnecting(integration.id);
                          try {
                            await AppApi.deleteCalendarIntegration(
                              integration.id,
                            );
                            setCalendarIntegrations((prev) =>
                              prev.filter((i) => i.id !== integration.id),
                            );
                          } catch {
                            // ignore
                          } finally {
                            setCalendarDisconnecting(null);
                          }
                        }}
                        disabled={calendarDisconnecting === integration.id}
                        className="btn border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm"
                      >
                        {calendarDisconnecting === integration.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t("settings.disconnect") || "Disconnect"
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          setCalendarConnecting(provider);
                          try {
                            const {url} = await AppApi.getCalendarConnectUrl(
                              provider,
                              returnTo,
                            );
                            window.location.href = url;
                          } catch {
                            setCalendarConnecting(null);
                          }
                        }}
                        disabled={isConnecting}
                        className="btn bg-[#456564] hover:bg-[#34514f] text-white text-sm disabled:opacity-70"
                      >
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          t("settings.connect") || "Connect"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ModalBlank>
  );
}

export default CalendarIntegrationsModal;
