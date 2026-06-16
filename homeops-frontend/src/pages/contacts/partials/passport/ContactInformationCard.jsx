import React from "react";
import {User} from "lucide-react";
import SectionCard from "../../../properties/partials/passport/SectionCard";
import LabelValue from "../../../properties/partials/passport/LabelValue";

/**
 * Read-only display of the contact's core information, split into Personal and
 * Professional sections. When `isEditing` is true the parent renders the form
 * controls as children instead.
 */
function ContactInformationCard({
  isEditing = false,
  name,
  email,
  phone,
  website,
  company,
  jobTitle,
  typeLabel,
  children,
}) {
  return (
    <SectionCard flat title="Contact Information" icon={User}>
      {isEditing ? (
        children
      ) : (
        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.08em] mb-3">
              Personal
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <LabelValue label="Name" value={name} />
              <LabelValue label="Email" value={email} />
              <LabelValue label="Phone" value={phone} />
              <LabelValue label="Website" value={website} />
            </div>
          </div>
          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5">
            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-[0.08em] mb-3">
              Professional
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <LabelValue label="Company" value={company} />
              <LabelValue label="Job Title" value={jobTitle} />
              <LabelValue label="Contact Type" value={typeLabel} />
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export default ContactInformationCard;
