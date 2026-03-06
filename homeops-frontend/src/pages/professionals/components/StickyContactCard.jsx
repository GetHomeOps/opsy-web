import React from "react";
import { MessageSquare, Send, CheckCircle2 } from "lucide-react";

function StickyContactCard({
  companyName,
  messageText,
  onMessageChange,
  onSend,
  messageSent,
}) {
  return (
    <div className="lg:sticky lg:top-[5rem] lg:self-start w-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 shadow-md p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#456564]/10 dark:bg-[#7aa3a2]/20 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4 h-4 text-[#456564] dark:text-[#7aa3a2]" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Contact / Request Quote
        </h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Describe your project — typical response within 24 hrs
      </p>
      <textarea
        value={messageText}
        onChange={(e) => onMessageChange(e.target.value)}
        rows={4}
        placeholder="Hi, I'm looking for help with a project..."
        className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] dark:focus:ring-[#7aa3a2]/30 dark:focus:border-[#7aa3a2] focus:bg-white dark:focus:bg-gray-800 transition-all resize-none"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!messageText.trim()}
        className="w-full mt-3 inline-flex items-center justify-center gap-2 h-10 px-4 text-sm font-semibold rounded-lg bg-[#456564] text-white hover:bg-[#34514f] dark:bg-[#7aa3a2] dark:hover:bg-[#5a8a88] dark:text-gray-900 shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-sm"
      >
        <Send className="w-4 h-4" />
        Send Message
      </button>
      {messageSent && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 mt-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Sent! You'll hear back soon.
        </div>
      )}
    </div>
  );
}

export default StickyContactCard;
