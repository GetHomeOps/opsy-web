import React, {useState, useEffect} from "react";
import {User, Phone, Mail} from "lucide-react";
import AppApi from "../../../api/api";

function SharedContactCard({contactId, isOwn}) {
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    AppApi.getContact(contactId)
      .then((c) => {
        if (!cancelled) setContact(c);
      })
      .catch(() => {
        if (!cancelled) setContact(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [contactId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 w-56">
        <p className="text-xs text-gray-500">Loading contact…</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 w-56">
        <p className="text-xs text-gray-500">Contact not found</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 w-64 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {contact.name || "Unnamed"}
          </p>
          {contact.role && (
            <p className="text-[11px] text-gray-500 truncate">{contact.role}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-[#456564] dark:hover:text-[#6fb5b4]"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="w-3 h-3 shrink-0" />
            <span className="truncate">{contact.phone}</span>
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-[#456564] dark:hover:text-[#6fb5b4]"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
      </div>
    </div>
  );
}

export default SharedContactCard;
