import React from "react";
import {useTranslation} from "react-i18next";
import {MessageSquare, Share2, Mail, UserPlus, Building2, ChevronRight} from "lucide-react";
import {DEFAULT_ACCENT} from "../../../context/AccountBrandingContext";

const DEFAULT_CARD_TEXT = "#ffffff";

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

/** Full-width footer strip at the bottom of the agent card. */
function AgentAgencyFooter({agency, onClick, companyLogoUrl, companyNameOverride}) {
  const {t} = useTranslation();
  const displayName = companyNameOverride || agency?.name;
  if (!displayName && !companyLogoUrl) return null;

  const logoUrl = companyLogoUrl || agency?.logoDisplayUrl;
  const initials = agencyInitials(displayName || "C");
  const ariaLabel =
    t("homeownerHome.agentAgencyAria", {name: displayName}) ||
    `Agent's brokerage: ${displayName}`;

  const content = (
    <>
      <span className="relative flex-shrink-0 w-8 h-8 rounded-lg overflow-hidden ring-1 ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_25%,transparent)] bg-white/10 shadow-sm flex items-center justify-center">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] font-bold text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_90%,transparent)] leading-none">
            {initials}
          </span>
        )}
        {!logoUrl && (
          <Building2
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_40%,transparent)]"
            aria-hidden
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_40%,transparent)] leading-none mb-0.5">
          {t("homeownerHome.agentBrokerage") || "Brokerage"}
        </p>
        <p className="text-xs font-medium text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_85%,transparent)] truncate leading-snug">
          {displayName}
        </p>
      </div>
    </>
  );

  if (onClick && agency) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative w-full flex items-center gap-2.5 pt-3 mt-3 border-t border-[color-mix(in_srgb,var(--agent-card-fg,#fff)_10%,transparent)] text-left rounded-lg -mx-1 pl-1 pr-7 transition-colors hover:bg-white/[.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)] cursor-pointer group/agency"
        title={displayName}
        aria-label={ariaLabel}
      >
        {content}
        <ChevronRight
          className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_30%,transparent)] group-hover/agency:text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_60%,transparent)] pointer-events-none transition-colors"
          aria-hidden
        />
      </button>
    );
  }

  return (
    <div
      className="relative w-full flex items-center gap-2.5 pt-3 mt-3 border-t border-[color-mix(in_srgb,var(--agent-card-fg,#fff)_10%,transparent)]"
      title={displayName}
      aria-label={ariaLabel}
    >
      {content}
    </div>
  );
}

function AgentAvatar({agent, size = "md", accentColor}) {
  const sizeClasses = {
    sm: "w-9 h-9",
    md: "w-[84px] h-[84px]",
    lg: "w-16 h-16",
  };
  const textSize =
    size === "md" ? "text-xl" : size === "lg" ? "text-lg" : "text-xs";

  const initials =
    agent.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "A";

  const accent = accentColor || DEFAULT_ACCENT;

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizeClasses[size]} rounded-full ring-[2.5px] ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_60%,transparent)] dark:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_20%,transparent)] shadow-lg overflow-hidden`}
      >
        {agent.image ? (
          <img
            src={agent.image}
            alt={agent.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center text-[var(--agent-card-fg,#fff)] ${textSize} font-semibold`}
            style={{
              background: `linear-gradient(to bottom right, ${accent}, ${accent}cc)`,
            }}
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.agent
 * @param {(tab: 'message' | 'refer' | 'request') => void} props.onOpenModal
 * @param {object} [props.branding] - Account branding overrides for the card
 */
function AgentCard({agent, onOpenModal, onOpenAgency, branding}) {
  if (!agent) return null;

  const agentLabel =
    branding?.agentCardAgentLabel ||
    "Your Agent";
  const companyName =
    branding?.agentCardCompanyName || agent.company || null;
  const companyLogoUrl =
    branding?.agentCardLogoUrl || branding?.sidebarIconUrl || null;
  const accentColor =
    branding?.agentCardAccentColor || branding?.accentColor || DEFAULT_ACCENT;
  const backgroundColor = branding?.agentCardBackgroundColor || null;
  const textColor = branding?.agentCardTextColor || DEFAULT_CARD_TEXT;

  const hasAgency = Boolean(agent.agency?.name) || Boolean(companyLogoUrl) || Boolean(branding?.agentCardCompanyName);

  const cardStyle = {
    "--agent-card-fg": textColor,
    ...(backgroundColor
      ? {
          background: `linear-gradient(to bottom right, ${backgroundColor}55, ${backgroundColor}33, ${backgroundColor}22)`,
          borderColor: `${accentColor}55`,
        }
      : {}),
  };

  const primaryBtnStyle = {
    backgroundColor: `${accentColor}99`,
    color: textColor,
  };

  return (
    <>
      {/* ── Mobile: pill, or stacked card when agency footer is shown ── */}
      <div
        className={`lg:hidden relative overflow-hidden bg-gradient-to-br from-white/20 via-white/[.13] to-white/[.08] backdrop-blur-2xl shadow-[0_4px_20px_rgba(0,0,0,.15)] border border-white/20 ${
          hasAgency
            ? "rounded-2xl px-3 py-2.5 min-w-[200px] max-w-[min(100%,320px)]"
            : "flex items-center gap-0.5 rounded-full pl-1.5 pr-1.5 py-1.5"
        }`}
        style={cardStyle}
      >
        <div className="flex items-center gap-0.5 w-full">
          <button
            type="button"
            onClick={() => onOpenModal("message")}
            className={`flex flex-1 min-w-0 items-center gap-2.5 text-left transition-colors hover:bg-white/[.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)] ${
              hasAgency ? "rounded-xl py-0.5 pr-1 pl-0" : "rounded-l-full py-0 pr-1 pl-0"
            }`}
            aria-label={`Contact ${agent.name}, your agent`}
          >
            <AgentAvatar agent={agent} size="sm" accentColor={accentColor} />
            <div className="min-w-0 text-left">
              <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_45%,transparent)] leading-none mb-0.5">
                {agentLabel}
              </p>
              <p className="text-sm font-semibold text-[var(--agent-card-fg,#fff)] truncate leading-tight max-w-[140px]">
                {agent.name}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onOpenModal("refer")}
            className="flex-shrink-0 p-2 rounded-full text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_65%,transparent)] hover:text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_95%,transparent)] hover:bg-white/[.08] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)]"
            aria-label="Refer agent"
          >
            <Share2 className="w-4 h-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onOpenModal("message")}
            className="flex-shrink-0 p-2 rounded-full text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_70%,transparent)] hover:text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_95%,transparent)] hover:bg-white/[.08] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)]"
            aria-label={`Message ${agent.name}`}
          >
            <MessageSquare className="w-4 h-4" aria-hidden />
          </button>
        </div>
        {hasAgency && (
          <AgentAgencyFooter
            agency={agent.agency}
            companyLogoUrl={companyLogoUrl}
            companyNameOverride={branding?.agentCardCompanyName}
            onClick={
              onOpenAgency && agent.agency
                ? () => onOpenAgency(agent.agency)
                : undefined
            }
          />
        )}
      </div>

      {/* ── Desktop: full card ── */}
      <div
        className="hidden lg:block group relative text-left overflow-hidden bg-gradient-to-br from-white/20 via-white/[.13] to-white/[.08] hover:from-white/25 hover:via-white/[.17] hover:to-white/[.12] backdrop-blur-2xl rounded-2xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,.18)] border border-white/20 hover:border-white/30 transition-all duration-200 lg:min-w-[340px] lg:max-w-[440px]"
        style={cardStyle}
      >
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/[.06] rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/[.04] rounded-full blur-xl pointer-events-none" />

        <div className="relative w-full flex items-start gap-4">
          <button
            type="button"
            onClick={() => onOpenModal("message")}
            className="flex-shrink-0 rounded-xl -m-1 p-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label={`Message ${agent.name}, your agent`}
          >
            <AgentAvatar agent={agent} size="md" accentColor={accentColor} />
          </button>

          <div className="min-w-0 flex-1 relative">
            <button
              type="button"
              onClick={() => onOpenModal("message")}
              className="w-full text-left rounded-xl -m-1 p-1 pr-11 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              aria-label={`Message ${agent.name}, your agent`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_45%,transparent)] mb-0.5">
                {agentLabel}
              </p>
              <p className="text-base font-semibold text-[var(--agent-card-fg,#fff)] truncate leading-snug">
                {agent.name}
              </p>
              {companyName && (
                <p className="text-[11px] text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)] truncate mt-0.5 leading-tight">
                  {companyName}
                </p>
              )}
              {agent.email && (
                <p className="flex items-center gap-1 text-[11px] text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_40%,transparent)] truncate mt-1 leading-tight">
                  <Mail className="w-3 h-3 flex-shrink-0 opacity-70" />
                  <span className="truncate">{agent.email}</span>
                </p>
              )}
            </button>
            <button
              type="button"
              onClick={() => onOpenModal("refer")}
              className="absolute top-0 right-0 p-1.5 rounded-lg text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_55%,transparent)] hover:text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_95%,transparent)] hover:bg-white/[.08] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)]"
              aria-label="Refer agent"
            >
              <Share2 className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="relative flex items-center gap-2 mt-3.5 pt-3 border-t border-[color-mix(in_srgb,var(--agent-card-fg,#fff)_10%,transparent)]">
          <button
            type="button"
            onClick={() => onOpenModal("message")}
            className="inline-flex items-center gap-1.5 text-xs font-medium hover:opacity-90 rounded-lg px-3.5 py-2 transition-colors flex-1 justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)]"
            style={primaryBtnStyle}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Contact Agent
          </button>
          <button
            type="button"
            onClick={() => onOpenModal("request")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[color-mix(in_srgb,var(--agent-card-fg,#fff)_70%,transparent)] bg-white/[.06] hover:bg-white/[.12] rounded-lg px-3.5 py-2 transition-colors flex-1 justify-center border border-[color-mix(in_srgb,var(--agent-card-fg,#fff)_10%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--agent-card-fg,#fff)_50%,transparent)]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Request Referral
          </button>
        </div>

        {hasAgency && (
          <AgentAgencyFooter
            agency={agent.agency}
            companyLogoUrl={companyLogoUrl}
            companyNameOverride={branding?.agentCardCompanyName}
            onClick={
              onOpenAgency && agent.agency
                ? () => onOpenAgency(agent.agency)
                : undefined
            }
          />
        )}
      </div>
    </>
  );
}

export {AgentAvatar};
export default AgentCard;
