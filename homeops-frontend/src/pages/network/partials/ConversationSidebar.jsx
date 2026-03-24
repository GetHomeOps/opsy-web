import React, {useState, useMemo} from "react";
import {MessageSquare, UserPlus, Share2, Search, X} from "lucide-react";

const KIND_ICONS = {
  text: MessageSquare,
  referral_request: UserPlus,
  refer_agent: Share2,
  share_contact: Share2,
  share_professional: Share2,
};

function lastMessagePreview(kind, payload) {
  if (!kind) return "No messages yet";
  if (kind === "text") return payload?.message?.slice(0, 60) || "Message";
  if (kind === "referral_request") return `Referral request: ${payload?.referralType || ""}`;
  if (kind === "refer_agent") return `Agent referral: ${payload?.referName || ""}`;
  if (kind === "share_contact") return "Shared a contact";
  if (kind === "share_professional") return "Shared a professional";
  return "Message";
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"});
  }
  if (diffDays < 7) {
    return d.toLocaleDateString("en-US", {weekday: "short"});
  }
  return d.toLocaleDateString("en-US", {month: "short", day: "numeric"});
}

function primaryParticipant(conv, forHomeowner) {
  if (forHomeowner) {
    return {
      name: conv.agentName || "Agent",
      initial: (conv.agentName || "?").charAt(0).toUpperCase(),
    };
  }
  return {
    name: conv.homeownerName || "Homeowner",
    initial: (conv.homeownerName || "?").charAt(0).toUpperCase(),
  };
}

function ConversationSidebar({
  conversations,
  loading,
  selectedConvId,
  onSelect,
  msgSidebarOpen,
  setMsgSidebarOpen,
  forHomeowner = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const q = searchTerm.toLowerCase();
    return conversations.filter(
      (c) =>
        (c.homeownerName || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q) ||
        (c.agentName || "").toLowerCase().includes(q),
    );
  }, [conversations, searchTerm]);

  return (
    <div
      id="messages-sidebar"
      className={`absolute z-20 top-0 bottom-0 w-full md:w-auto md:static md:top-auto md:bottom-auto -mr-px md:translate-x-0 transition-transform duration-200 ease-in-out ${
        msgSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="sticky top-16 bg-white dark:bg-[#151D2C] overflow-x-hidden overflow-y-auto no-scrollbar shrink-0 border-r border-gray-200 dark:border-gray-700/60 md:w-[18rem] lg:w-[20rem] h-[calc(100dvh-64px)]">
        {/* Header */}
        <div className="sticky top-0 z-10">
          <div className="flex items-center bg-white dark:bg-[#151D2C] border-b border-gray-200 dark:border-gray-700/60 px-5 h-16">
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#456564] dark:text-[#6fb5b4]" strokeWidth={1.75} />
                <span className="text-base font-semibold text-gray-900 dark:text-white">Messages</span>
                {conversations.length > 0 && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full font-medium">
                    {conversations.filter((c) => (c.unreadCount || 0) > 0).length || ""}
                  </span>
                )}
              </div>
              <button
                className="md:hidden text-gray-400 hover:text-gray-500"
                onClick={() => setMsgSidebarOpen(false)}
                aria-controls="messages-sidebar"
              >
                <span className="sr-only">Close sidebar</span>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#456564]/30 dark:focus:ring-[#6fb5b4]/30"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="px-3 pb-3">
          {loading ? (
            <div className="text-center py-8 text-sm text-gray-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              {searchTerm ? "No conversations match your search" : "No conversations yet"}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((conv) => {
                const selected = conv.id === selectedConvId;
                const unread = (conv.unreadCount || 0) > 0;
                const Icon = KIND_ICONS[conv.lastMessageKind] || MessageSquare;
                const primary = primaryParticipant(conv, forHomeowner);

                return (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(conv.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-3 transition-colors ${
                        selected
                          ? "bg-[#456564]/10 dark:bg-[#6fb5b4]/10"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      }`}
                    >
                      {/* Avatar placeholder */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#456564] to-[#6fb5b4] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-white">
                          {primary.initial}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-sm truncate ${
                              unread
                                ? "font-semibold text-gray-900 dark:text-white"
                                : "font-medium text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {primary.name}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">
                            {formatTime(conv.lastMessageCreatedAt || conv.createdAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Icon className="w-3 h-3 text-gray-400 shrink-0" strokeWidth={1.75} />
                          <p
                            className={`text-xs truncate ${
                              unread
                                ? "text-gray-700 dark:text-gray-300"
                                : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {lastMessagePreview(conv.lastMessageKind, conv.lastMessagePayload)}
                          </p>
                        </div>

                        {conv.address && (
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                            {conv.address}
                          </p>
                        )}
                      </div>

                      {unread && (
                        <span className="w-2 h-2 rounded-full bg-[#456564] dark:bg-[#6fb5b4] shrink-0 mt-2" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConversationSidebar;
