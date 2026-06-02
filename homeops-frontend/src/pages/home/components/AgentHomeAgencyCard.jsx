import React, {useState, useEffect, useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Building2} from "lucide-react";
import AppApi from "../../../api/api";

function agencyInitials(name) {
  if (!name || typeof name !== "string") return "A";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Compact brokerage badge for the agent home header (logo + agency name when affiliated).
 */
function AgentHomeAgencyCard() {
  const {t} = useTranslation();
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await AppApi.getMyAffiliation();
      if (res?.status === "affiliated" && res?.affiliation?.agency?.name) {
        setAgency(res.affiliation.agency);
      } else {
        setAgency(null);
      }
    } catch {
      setAgency(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("opsy:affiliation-refresh", load);
    return () => window.removeEventListener("opsy:affiliation-refresh", load);
  }, [load]);

  if (loading || !agency) return null;

  const logoUrl = agency.logoDisplayUrl;
  const name = agency.name;
  const initials = agencyInitials(name);

  return (
    <div
      className="flex-shrink-0 w-full sm:w-auto sm:max-w-[280px] self-start"
      role="complementary"
      aria-label={t("agentHome.agencyCardAria", {name}) || `Affiliated with ${name}`}
    >
      <div className="group relative overflow-hidden rounded-2xl border border-gray-200/90 dark:border-gray-700/90 bg-gradient-to-br from-white via-white to-[#456564]/[0.06] dark:from-gray-800 dark:via-gray-800 dark:to-[#456564]/15 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#456564] to-[#5a7a78] opacity-90"
          aria-hidden
        />
        <div className="flex items-center gap-3 pl-4 pr-4 py-3">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-xl overflow-hidden ring-2 ring-white dark:ring-gray-700 shadow-md bg-white dark:bg-gray-900 flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#456564] to-[#2d4544] flex items-center justify-center text-white text-xs font-bold tracking-wide">
                  {initials}
                </div>
              )}
            </div>
            {!logoUrl && (
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm">
                <Building2
                  className="w-2.5 h-2.5 text-[#456564] dark:text-[#5a7a78]"
                  aria-hidden
                />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#456564]/80 dark:text-emerald-400/90 leading-none mb-1">
              {t("agentHome.yourBrokerage") || "Your brokerage"}
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-snug">
              {name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentHomeAgencyCard;
