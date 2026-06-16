import React from "react";
import {
  Activity,
  Plus,
  StickyNote,
  UserPlus,
  Pencil,
  FileText,
  Home,
  Send,
} from "lucide-react";
import SectionCard from "../../../properties/partials/passport/SectionCard";
import EmptyStateCard from "../../../properties/partials/passport/EmptyStateCard";

const TYPE_ICONS = {
  note: StickyNote,
  created: UserPlus,
  updated: Pencil,
  document: FileText,
  property: Home,
  invite: Send,
};

function formatActivityDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Activity timeline for a contact. Mirrors the Property Passport timeline
 * treatment. Activities are derived and passed in by the container. In edit
 * mode the parent renders the notes form control as children.
 */
function ContactActivityCard({
  isEditing = false,
  activities = [],
  onAddNote,
  onViewAll,
  children,
}) {
  return (
    <SectionCard
      flat
      title={isEditing ? "Notes" : "Recent Activity"}
      icon={isEditing ? StickyNote : Activity}
      action={
        !isEditing && activities.length > 0 && onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-[#456564] dark:text-[#7fa3a1] hover:underline"
          >
            View All Activity
          </button>
        ) : null
      }
    >
      {isEditing ? (
        children
      ) : activities.length > 0 ? (
        <>
          <ul className="relative">
            {activities.map((item, index) => {
              const Icon = TYPE_ICONS[item.type] || Activity;
              const isLast = index === activities.length - 1;
              return (
                <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {!isLast && (
                    <span className="absolute left-[15px] top-8 bottom-0 w-px bg-neutral-200 dark:bg-neutral-700" />
                  )}
                  <div className="relative z-10 w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 break-words">
                        {item.description}
                      </p>
                    )}
                    {formatActivityDate(item.date) && (
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {formatActivityDate(item.date)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {onAddNote && (
            <button
              type="button"
              onClick={onAddNote}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Note
            </button>
          )}
        </>
      ) : (
        <EmptyStateCard
          icon={Activity}
          title="No activity yet"
          description="Notes, property assignments, invitations, and updates will show up here."
          actionLabel={onAddNote ? "Add Note" : undefined}
          onAction={onAddNote}
        />
      )}
    </SectionCard>
  );
}

export default ContactActivityCard;
