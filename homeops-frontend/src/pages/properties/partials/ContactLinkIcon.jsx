import React from "react";
import {useParams} from "react-router-dom";
import {ExternalLink} from "lucide-react";
import {openContactInNewTab} from "../helpers/contactNavigation";

/**
 * Compact icon that opens a contact in a new browser tab.
 * Renders nothing when contactId or accountUrl is missing.
 */
function ContactLinkIcon({contactId, className = ""}) {
  const {accountUrl} = useParams();
  if (contactId == null || String(contactId).trim() === "" || !accountUrl) {
    return null;
  }

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openContactInNewTab({accountUrl, contactId});
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Open contact"
      aria-label="Open contact"
      className={`inline-flex items-center justify-center shrink-0 text-[#456564] hover:text-[#3a5554] dark:text-[#7fa3a1] dark:hover:text-[#9bbdbb] ${className}`}
    >
      <ExternalLink className="w-3.5 h-3.5" />
    </button>
  );
}

export default ContactLinkIcon;
