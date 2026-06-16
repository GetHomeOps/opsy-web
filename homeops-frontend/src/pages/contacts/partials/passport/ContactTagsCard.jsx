import React from "react";
import {Tag} from "lucide-react";
import SectionCard from "../../../properties/partials/passport/SectionCard";

/**
 * Displays the contact's tags as chips. In edit mode the parent renders the
 * tag selector controls as children.
 */
function ContactTagsCard({isEditing = false, tags = [], onEdit, children}) {
  return (
    <SectionCard
      flat
      title="Tags"
      icon={Tag}
      action={
        !isEditing && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-semibold text-[#456564] dark:text-[#7fa3a1] hover:underline"
          >
            Edit Tags
          </button>
        ) : null
      }
    >
      {isEditing ? (
        children
      ) : tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                tag.color ||
                "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {tag.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-400 dark:text-neutral-600">
          No tags added
        </p>
      )}
    </SectionCard>
  );
}

export default ContactTagsCard;
