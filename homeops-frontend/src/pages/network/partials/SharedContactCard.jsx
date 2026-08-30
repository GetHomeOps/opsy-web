import React, {useState, useEffect, useContext, useMemo} from "react";
import {User, Phone, Mail, UserPlus, Check, Loader2} from "lucide-react";
import AppApi, {getApiErrorMessage} from "../../../api/api";
import ContactContext from "../../../context/ContactContext";
import useCurrentAccount from "../../../hooks/useCurrentAccount";

function snapshotFromPayload(payload) {
  if (!payload || payload.name == null) return null;
  return {
    name: payload.name,
    phone: payload.phone || null,
    email: payload.email || null,
    role: payload.role || null,
  };
}

function SharedContactCard({contactId, payload, isOwn}) {
  const {contacts = [], refreshContacts} = useContext(ContactContext);
  const {currentAccount} = useCurrentAccount();
  const [contact, setContact] = useState(() => snapshotFromPayload(payload));
  const [loading, setLoading] = useState(() => !snapshotFromPayload(payload));
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const snap = snapshotFromPayload(payload);
    if (snap) {
      setContact(snap);
      setLoading(false);
      return undefined;
    }
    if (!contactId) {
      setContact(null);
      setLoading(false);
      return undefined;
    }
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
    return () => {
      cancelled = true;
    };
  }, [contactId, payload?.name, payload?.phone, payload?.email, payload?.role]);

  const alreadyInContacts = useMemo(() => {
    const email = (contact?.email || "").trim().toLowerCase();
    if (!email) return false;
    return contacts.some(
      (c) => (c.email || "").trim().toLowerCase() === email,
    );
  }, [contacts, contact?.email]);

  const handleAdd = async (e) => {
    e.stopPropagation();
    if (adding || added || alreadyInContacts || !contact) return;
    if (!currentAccount?.id) {
      setError("No account available");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await AppApi.createContact({
        name: contact.name || "Unnamed",
        phone: contact.phone || "",
        email: contact.email || "",
        role: contact.role || null,
        accountId: currentAccount.id,
        source: "contact_share",
      });
      setAdded(true);
      refreshContacts?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not add contact"));
    } finally {
      setAdding(false);
    }
  };

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

  const isSaved = added || alreadyInContacts;

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

      {!isOwn && (
        <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || isSaved}
            className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-[#456564] text-white hover:bg-[#3a5554] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isSaved ? (
              <Check className="w-3 h-3" />
            ) : (
              <UserPlus className="w-3 h-3" />
            )}
            {alreadyInContacts
              ? "Already in contacts"
              : added
                ? "Added"
                : "Add to Contact List"}
          </button>
          {error && (
            <p className="text-[11px] text-red-500 mt-1.5">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default SharedContactCard;
