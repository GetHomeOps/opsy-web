import React, {useState, useEffect, useRef, useMemo} from "react";
import {User, Briefcase, Search, X} from "lucide-react";
import AppApi from "../../../api/api";

const TABS = [
  {id: "contacts", label: "Contacts", Icon: User},
  {id: "professionals", label: "Professionals", Icon: Briefcase},
];

function SharePicker({accountId, onShareContact, onShareProfessional, onClose}) {
  const [activeTab, setActiveTab] = useState("contacts");
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingProfessionals, setLoadingProfessionals] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Fetch contacts
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setLoadingContacts(true);
    AppApi.getContactsByAccountId(accountId)
      .then((list) => {
        if (!cancelled) setContacts(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingContacts(false);
      });
    return () => { cancelled = true; };
  }, [accountId]);

  // Fetch professionals
  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setLoadingProfessionals(true);
    AppApi.getAllProfessionals({account_id: accountId})
      .then((list) => {
        if (!cancelled) setProfessionals(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setProfessionals([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfessionals(false);
      });
    return () => { cancelled = true; };
  }, [accountId]);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q),
    );
  }, [contacts, search]);

  const filteredProfessionals = useMemo(() => {
    if (!search.trim()) return professionals;
    const q = search.toLowerCase();
    return professionals.filter(
      (p) =>
        (p.company_name || p.companyName || "").toLowerCase().includes(q) ||
        (p.contact_name || p.contactName || "").toLowerCase().includes(q) ||
        (p.category_name || p.categoryName || "").toLowerCase().includes(q),
    );
  }, [professionals, search]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-30"
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setSearch("");
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors relative ${
                isActive
                  ? "text-[#456564] dark:text-[#6fb5b4]"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <tab.Icon className="w-3.5 h-3.5" />
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#456564] dark:bg-[#6fb5b4] rounded-full" />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === "contacts" ? "Search contacts…" : "Search professionals…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#456564]/30"
            autoFocus
          />
        </div>
      </div>

      {/* List */}
      <div className="max-h-52 overflow-y-auto px-1 pb-2">
        {activeTab === "contacts" && (
          <>
            {loadingContacts ? (
              <p className="text-xs text-gray-500 text-center py-4">Loading…</p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No contacts found</p>
            ) : (
              filteredContacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onShareContact(c.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {c.name || c.email || "Unnamed"}
                    </p>
                    {c.phone && (
                      <p className="text-[11px] text-gray-500 truncate">{c.phone}</p>
                    )}
                  </div>
                </button>
              ))
            )}
          </>
        )}

        {activeTab === "professionals" && (
          <>
            {loadingProfessionals ? (
              <p className="text-xs text-gray-500 text-center py-4">Loading…</p>
            ) : filteredProfessionals.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">No professionals found</p>
            ) : (
              filteredProfessionals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onShareProfessional(p.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      {p.company_name || p.companyName || p.contact_name || p.contactName || "Unnamed"}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {p.category_name || p.categoryName || "Professional"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SharePicker;
