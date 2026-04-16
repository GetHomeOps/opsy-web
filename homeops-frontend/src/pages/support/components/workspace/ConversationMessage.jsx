import React from "react";
import { format } from "date-fns";
import { User, Headphones, MessageSquare, Bot } from "lucide-react";
import MarkdownText from "../MarkdownText";

const ROLE_CONFIG = {
  user: {
    icon: User,
    bubbleBg: "bg-gray-50 dark:bg-gray-800/60",
    accent: "bg-gray-400",
    align: "items-start",
  },
  admin: {
    icon: Headphones,
    bubbleBg: "bg-[#456564]/[0.06] dark:bg-[#456564]/15",
    accent: "bg-[#456564] dark:bg-[#5a7a78]",
    align: "items-start",
  },
  initial: {
    icon: MessageSquare,
    bubbleBg: "bg-gray-50 dark:bg-gray-800/60",
    accent: "bg-gray-400",
    align: "items-start",
  },
};

function ConversationMessage({ item }) {
  const isAutomated = !!item.isAutomated;
  const config =
    item.type === "initial"
      ? ROLE_CONFIG.initial
      : ROLE_CONFIG[item.role] || ROLE_CONFIG.user;
  const Icon = isAutomated ? Bot : config.icon;
  const isAdmin = item.role === "admin" && item.type !== "initial";

  return (
    <div className={`flex gap-3 ${config.align}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${config.accent}`}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {item.actor}
          </span>
          {isAdmin && !isAutomated && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#456564] dark:text-[#7a9e9c] bg-[#456564]/10 dark:bg-[#456564]/20 px-1.5 py-0.5 rounded">
              Support
            </span>
          )}
          {isAutomated && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#456564] dark:text-[#7a9e9c] bg-[#456564]/10 dark:bg-[#456564]/20 px-1.5 py-0.5 rounded">
              Auto-reply
            </span>
          )}
          {item.type === "initial" && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              Original
            </span>
          )}
          {item.timestamp && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {format(new Date(item.timestamp), "MMM d, yyyy 'at' h:mm a")}
            </span>
          )}
        </div>

        <div
          className={`rounded-lg px-4 py-3 ${config.bubbleBg}`}
        >
          <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed break-words">
            <MarkdownText>{item.text || ""}</MarkdownText>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConversationMessage;
