import React from "react";
import {MapPin} from "lucide-react";
import SectionCard from "../../../properties/partials/passport/SectionCard";

/**
 * Compact address card. Displays a formatted address in view mode; the parent
 * renders the address form controls as children when editing.
 */
function ContactAddressCard({isEditing = false, addressLines = [], children}) {
  const hasAddress = addressLines.some((line) => line && line.trim() !== "");

  return (
    <SectionCard flat title="Address" icon={MapPin}>
      {isEditing ? (
        children
      ) : hasAddress ? (
        <address className="not-italic text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {addressLines
            .filter((line) => line && line.trim() !== "")
            .map((line, index) => (
              <div key={index} className="truncate">
                {line}
              </div>
            ))}
        </address>
      ) : (
        <p className="text-sm text-neutral-400 dark:text-neutral-600">
          No address on file
        </p>
      )}
    </SectionCard>
  );
}

export default ContactAddressCard;
