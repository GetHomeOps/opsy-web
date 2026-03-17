import React, {useState, useMemo} from "react";
import {X, Search} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";

/**
 * Modal to search and select from all contacts and agents.
 * Used when the quick dropdown limit is reached ("Search more").
 */
function ContactSearchModal({
  modalOpen,
  setModalOpen,
  contacts = [],
  agents = [],
  onSelect,
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const term = searchTerm.trim().toLowerCase();
  const agentEmails = new Set(
    (agents || []).map((a) => (a.email || "").trim().toLowerCase()).filter(Boolean)
  );
  const dedupedContacts = (contacts || []).filter(
    (c) => !agentEmails.has((c.email || "").trim().toLowerCase())
  );

  const filteredAgents = useMemo(() => {
    if (!term) return agents || [];
    return (agents || []).filter((a) => {
      const name = (a.name || "").toLowerCase();
      const email = (a.email || "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [agents, term]);

  const filteredContacts = useMemo(() => {
    if (!term) return dedupedContacts;
    return dedupedContacts.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [dedupedContacts, term]);

  const handleSelect = (item) => {
    const email = item.email?.trim() || item.email;
    if (email && onSelect) onSelect(email);
    setModalOpen(false);
    setSearchTerm("");
  };

  return (
    <ModalBlank
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-md"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Search contacts & agents
          </h2>
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email…"
            className="form-input w-full pl-9"
            autoFocus
            autoComplete="off"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto space-y-4">
          {filteredAgents.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Agents
              </p>
              <ul className="space-y-1">
                {filteredAgents.map((a) => (
                  <li key={`agent-${a.id}-${a.email}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(a)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#456564] dark:bg-[#5a7a78] flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {(a.name || a.email)?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {a.name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {a.email?.trim()}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filteredContacts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                My Contacts
              </p>
              <ul className="space-y-1">
                {filteredContacts.map((c, idx) => (
                  <li key={`contact-${c.id}-${(c.email || "").toLowerCase()}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => handleSelect(c)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-semibold shrink-0">
                        {(c.name || c.email)?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {c.name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {c.email?.trim()}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {filteredAgents.length === 0 && filteredContacts.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {searchTerm.trim()
                ? "No matches found."
                : "Start typing to search."}
            </p>
          )}
        </div>
      </div>
    </ModalBlank>
  );
}

export default ContactSearchModal;
