import React, {useRef, useEffect} from "react";
import {UserPlus, Share2} from "lucide-react";
import SharedContactCard from "./SharedContactCard";
import SharedProfessionalCard from "./SharedProfessionalCard";

function formatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"});
}

function formatDateSeparator(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {weekday: "long", month: "long", day: "numeric"});
}

function shouldShowDateSeparator(messages, index) {
  if (index === messages.length - 1) return true;
  const current = new Date(messages[index].createdAt);
  const next = new Date(messages[index + 1].createdAt);
  return current.toDateString() !== next.toDateString();
}

function MessageBubble({msg, isOwn}) {
  const {kind, payload} = msg;

  if (kind === "share_contact" && payload?.contactId) {
    return (
      <div className={`max-w-xs sm:max-w-sm ${isOwn ? "ml-auto" : ""}`}>
        <SharedContactCard contactId={payload.contactId} isOwn={isOwn} />
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-xs text-gray-500 font-medium">{formatTime(msg.createdAt)}</span>
        </div>
      </div>
    );
  }

  if (kind === "share_professional" && payload?.professionalId) {
    return (
      <div className={`max-w-xs sm:max-w-sm ${isOwn ? "ml-auto" : ""}`}>
        <SharedProfessionalCard professionalId={payload.professionalId} isOwn={isOwn} />
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-xs text-gray-500 font-medium">{formatTime(msg.createdAt)}</span>
        </div>
      </div>
    );
  }

  if (kind === "referral_request") {
    return (
      <div>
        <div
          className={`text-sm p-3 rounded-lg mb-1 ${
            isOwn
              ? "bg-[#456564] text-white rounded-tr-none"
              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <UserPlus className="w-3.5 h-3.5 opacity-70" />
            <span className="text-xs font-semibold opacity-80">Referral Request</span>
          </div>
          <p className="font-medium">{payload?.referralType}</p>
          {payload?.notes && <p className="mt-1 text-xs opacity-80">{payload.notes}</p>}
        </div>
        <div className={`flex items-center gap-1 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-xs text-gray-500 font-medium">{formatTime(msg.createdAt)}</span>
        </div>
      </div>
    );
  }

  if (kind === "refer_agent") {
    return (
      <div>
        <div
          className={`text-sm p-3 rounded-lg mb-1 ${
            isOwn
              ? "bg-[#456564] text-white rounded-tr-none"
              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none"
          }`}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Share2 className="w-3.5 h-3.5 opacity-70" />
            <span className="text-xs font-semibold opacity-80">Agent Referral</span>
          </div>
          <p className="font-medium">{payload?.referName}</p>
          <p className="text-xs opacity-80">{payload?.referContact}</p>
          {payload?.note && <p className="mt-1 text-xs opacity-80">{payload.note}</p>}
        </div>
        <div className={`flex items-center gap-1 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-xs text-gray-500 font-medium">{formatTime(msg.createdAt)}</span>
        </div>
      </div>
    );
  }

  // Default: text message
  return (
    <div>
      <div
        className={`text-sm p-3 rounded-lg mb-1 ${
          isOwn
            ? "bg-[#456564] text-white rounded-tr-none"
            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none"
        }`}
      >
        {payload?.message || ""}
      </div>
      <div className={`flex items-center gap-1 ${isOwn ? "justify-end" : ""}`}>
        <span className="text-xs text-gray-500 font-medium">{formatTime(msg.createdAt)}</span>
      </div>
    </div>
  );
}

function ConversationBody({messages, loading, conversation, currentUserId}) {
  const bottomRef = useRef(null);

  // Messages come newest-first from the API; reverse for display
  const displayMessages = [...messages].reverse();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior: "smooth"});
  }, [displayMessages.length]);

  if (loading && messages.length === 0) {
    return (
      <div className="grow flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading messages…</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="grow flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No messages yet. Start the conversation below.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grow px-4 sm:px-6 md:px-5 py-6 overflow-y-auto">
      {displayMessages.map((msg, idx) => {
        const isOwn = Number(msg.senderUserId) === Number(currentUserId);
        const showDate = shouldShowDateSeparator(displayMessages, idx);

        return (
          <React.Fragment key={msg.id}>
            {showDate && (
              <div className="flex justify-center">
                <div className="inline-flex items-center justify-center text-xs text-gray-600 dark:text-gray-400 font-medium px-2.5 py-1 bg-white dark:bg-gray-700 shadow-xs rounded-full my-5">
                  {formatDateSeparator(msg.createdAt)}
                </div>
              </div>
            )}

            <div
              className={`flex items-start mb-4 last:mb-0 ${isOwn ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isOwn
                    ? "bg-[#456564] ml-3"
                    : "bg-gray-200 dark:bg-gray-700 mr-3"
                }`}
              >
                <span className="text-xs font-bold text-white">
                  {(msg.senderName || "?").charAt(0).toUpperCase()}
                </span>
              </div>

              <div className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                {!isOwn && (
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {msg.senderName}
                  </p>
                )}
                <MessageBubble msg={msg} isOwn={isOwn} />
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export default ConversationBody;
