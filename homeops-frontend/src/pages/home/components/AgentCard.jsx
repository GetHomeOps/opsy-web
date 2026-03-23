import React from "react";
import {MessageSquare, Share2, Mail} from "lucide-react";

function AgentAvatar({agent, size = "md"}) {
  const sizeClasses = {
    sm: "w-9 h-9",
    md: "w-[84px] h-[84px]",
    lg: "w-16 h-16",
  };
  const textSize = size === "md" ? "text-xl" : size === "lg" ? "text-lg" : "text-xs";

  const initials =
    agent.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "A";

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizeClasses[size]} rounded-full ring-[2.5px] ring-white/60 dark:ring-white/20 shadow-lg overflow-hidden`}
      >
        {agent.image ? (
          <img
            src={agent.image}
            alt={agent.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br from-[#456564] to-[#2d4544] flex items-center justify-center text-white ${textSize} font-semibold`}
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
 * @param {(tab: 'message' | 'refer') => void} props.onOpenModal
 */
function AgentCard({agent, onOpenModal}) {
  if (!agent) return null;

  return (
    <>
      {/* ── Mobile: compact pill ── */}
      <button
        type="button"
        onClick={() => onOpenModal("message")}
        className="lg:hidden relative flex items-center gap-2.5 bg-gradient-to-br from-white/20 via-white/[.13] to-white/[.08] backdrop-blur-2xl rounded-full pl-1.5 pr-4 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,.15)] border border-white/20 hover:border-white/30 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        aria-label={`Contact ${agent.name}, your agent`}
      >
        <AgentAvatar agent={agent} size="sm" />
        <div className="min-w-0 text-left">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-white/45 leading-none mb-0.5">
            Your Agent
          </p>
          <p className="text-sm font-semibold text-white truncate leading-tight max-w-[140px]">
            {agent.name}
          </p>
        </div>
        <MessageSquare className="w-4 h-4 text-white/70 flex-shrink-0 ml-1" />
      </button>

      {/* ── Desktop: full card ── */}
      <div
        className="hidden lg:block group relative text-left overflow-hidden bg-gradient-to-br from-white/20 via-white/[.13] to-white/[.08] hover:from-white/25 hover:via-white/[.17] hover:to-white/[.12] backdrop-blur-2xl rounded-2xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,.18)] border border-white/20 hover:border-white/30 transition-all duration-200 lg:min-w-[340px] lg:max-w-[440px]"
      >
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/[.06] rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/[.04] rounded-full blur-xl pointer-events-none" />

        <button
          type="button"
          onClick={() => onOpenModal("message")}
          className="relative w-full flex items-center gap-4 text-left rounded-xl -m-1 p-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          aria-label={`Message ${agent.name}, your agent`}
        >
          <AgentAvatar agent={agent} size="md" />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45 mb-0.5">
              Your Agent
            </p>
            <p className="text-base font-semibold text-white truncate leading-snug">
              {agent.name}
            </p>
            {agent.company && (
              <p className="text-[11px] text-white/50 truncate mt-0.5 leading-tight">
                {agent.company}
              </p>
            )}
            {agent.email && (
              <p className="flex items-center gap-1 text-[11px] text-white/40 truncate mt-1 leading-tight">
                <Mail className="w-3 h-3 flex-shrink-0 opacity-70" />
                <span className="truncate">{agent.email}</span>
              </p>
            )}
          </div>
        </button>

        <div className="relative flex items-center gap-2 mt-3.5 pt-3 border-t border-white/[.1]">
          <button
            type="button"
            onClick={() => onOpenModal("message")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 bg-white/[.12] hover:bg-white/[.18] rounded-lg px-3.5 py-2 transition-colors flex-1 justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Contact Agent
          </button>
          <button
            type="button"
            onClick={() => onOpenModal("refer")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-white/70 bg-white/[.06] hover:bg-white/[.12] rounded-lg px-3.5 py-2 transition-colors flex-1 justify-center border border-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Share2 className="w-3.5 h-3.5" />
            Refer
          </button>
        </div>
      </div>
    </>
  );
}

export {AgentAvatar};
export default AgentCard;
