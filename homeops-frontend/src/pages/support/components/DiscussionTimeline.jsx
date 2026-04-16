import React from "react";
import { format } from "date-fns";
import { MessageSquare, User, Headphones, Lock, Bot } from "lucide-react";
import MarkdownText from "./MarkdownText";

const MESSAGE_STYLES = {
  user: {
    border: "border-l-2 border-gray-300 dark:border-gray-600",
    dot: "bg-gray-500 dark:bg-gray-400",
    label: "User",
    icon: User,
    bg: "bg-gray-50/50 dark:bg-gray-800/30",
  },
  admin: {
    border: "border-l-2 border-[#456564]/50",
    dot: "bg-[#456564] dark:bg-[#5a7a78]",
    label: "Support",
    icon: Headphones,
    bg: "bg-[#456564]/5 dark:bg-[#456564]/10",
  },
  initial: {
    border: "border-l-2 border-gray-300 dark:border-gray-600",
    dot: "bg-gray-500 dark:bg-gray-400",
    label: "Initial submission",
    icon: MessageSquare,
    bg: "bg-gray-50/50 dark:bg-gray-800/30",
  },
};

/**
 * Timeline of messages with differentiated styling for user, support, and initial message.
 */
function DiscussionTimeline({ items, emptyMessage = "No messages yet." }) {
  if (!items?.length) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const style =
          item.type === "initial"
            ? MESSAGE_STYLES.initial
            : item.role === "admin"
              ? MESSAGE_STYLES.admin
              : MESSAGE_STYLES.user;
        const Icon = item.isAutomated ? Bot : style.icon;

        return (
          <div
            key={item.id}
            className={`flex gap-3 pl-3 ${style.border} ${style.bg} rounded-r-lg py-3 pr-4`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${style.dot}`}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Icon className="w-3.5 h-3.5" />
                  {item.label || style.label}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {item.actor}
                  {item.timestamp && (
                    <>
                      {" · "}
                      {format(new Date(item.timestamp), "MMM d, yyyy HH:mm")}
                    </>
                  )}
                </span>
              </div>
              <div className="text-sm text-gray-800 dark:text-gray-200 mt-1.5 break-words">
                <MarkdownText>{item.text || ""}</MarkdownText>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Internal notes block — separate from timeline, admin-only.
 */
export function InternalNotesBlock({
  notes,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  value,
  onChange,
  dirty,
  saving,
  saveLabel = "Save",
  cancelLabel = "Cancel",
}) {
  if (!notes?.trim() && !isEditing) return null;

  return (
    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-500" />
          <span className="text-xs font-medium text-amber-800 dark:text-amber-200 uppercase tracking-wider">
            Internal notes (not visible to user)
          </span>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
          >
            Edit
          </button>
        )}
      </div>
      {isEditing ? (
        <>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="form-input w-full min-h-[80px] text-sm mb-2"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              className="btn bg-[#456564] hover:bg-[#34514f] text-white text-sm disabled:opacity-50"
            >
              {saving ? "Saving..." : saveLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-300 text-sm"
            >
              {cancelLabel}
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {notes}
        </p>
      )}
    </div>
  );
}

export default DiscussionTimeline;
