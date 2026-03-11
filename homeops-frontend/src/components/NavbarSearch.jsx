import React, {useState, useRef, useEffect, useContext, useMemo} from "react";
import {useNavigate} from "react-router-dom";
import {Search, Building2, FileText, User} from "lucide-react";
import useCurrentAccount from "../hooks/useCurrentAccount";
import {useAuth} from "../context/AuthContext";
import PropertyContext from "../context/PropertyContext";
import ContactContext from "../context/ContactContext";
import {SIDEBAR_CONFIG, SETTINGS_CONFIG} from "../partials/sidebarConfig";

/** Flatten nav config to { label, path, roles } items, respecting section-level roles */
function flattenNavItems(config, parentRoles) {
  const items = [];

  function walk(arr, inheritedRoles) {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const itemRoles = item.roles || inheritedRoles;
      if (item.path) {
        items.push({
          label: item.label,
          path: item.path,
          roles: itemRoles,
          hideForPlatformAdmins: item.hideForPlatformAdmins,
        });
      }
      if (item.children) walk(item.children, itemRoles);
      if (item.items) walk(item.items, itemRoles);
    }
  }

  walk(Array.isArray(config) ? config : [config], parentRoles);
  return items;
}

const ALL_PAGES = [
  ...flattenNavItems(SIDEBAR_CONFIG),
  ...flattenNavItems(SETTINGS_CONFIG?.children || []),
];

function NavbarSearch({disabled = false}) {
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const {properties, refreshProperties} = useContext(PropertyContext);
  const {contacts = [], refreshContacts} = useContext(ContactContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({properties: [], contacts: [], pages: []});
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const accountUrl = currentAccount?.url || "";
  const role = currentUser?.role;
  const isSuperAdmin = role === "super_admin";
  const isAdmin = role === "admin";
  const isAgent = role === "agent";
  const canManageUsers = isSuperAdmin || isAdmin;

  const visiblePages = useMemo(() => {
    return ALL_PAGES.filter((p) => {
      if (p.roles === "superAdminOnly" && !isSuperAdmin) return false;
      if (p.roles === "adminOnly" && !canManageUsers) return false;
      if (p.roles === "adminOrAgent" && !(canManageUsers || isAgent)) return false;
      if (p.hideForPlatformAdmins && canManageUsers) return false;
      return true;
    });
  }, [isSuperAdmin, canManageUsers, isAgent]);

  useEffect(() => {
    if (open && currentUser && !["super_admin"].includes(role)) {
      if (properties?.length === 0) refreshProperties?.();
      if (contacts?.length === 0 && refreshContacts) refreshContacts();
    }
  }, [open, properties?.length, contacts?.length, currentUser, role, refreshProperties, refreshContacts]);

  useEffect(() => {
    if (!query.trim()) {
      setResults({properties: [], contacts: [], pages: []});
      return;
    }
    setLoading(true);
    const q = query.trim().toLowerCase();

    const propMatches = (properties || []).filter((p) => {
      const addr = (p.address || p.street_address || "").toLowerCase();
      const name = (
        p.property_name ||
        p.propertyName ||
        p.nickname ||
        p.name ||
        ""
      ).toLowerCase();
      const city = (p.city || "").toLowerCase();
      const state = (p.state || "").toLowerCase();
      return addr.includes(q) || name.includes(q) || city.includes(q) || state.includes(q);
    });

    const contactMatches = (contacts || []).filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const company = (c.company || "").toLowerCase();
      return name.includes(q) || email.includes(q) || company.includes(q);
    });

    const pageMatches = visiblePages.filter((p) => p.label.toLowerCase().includes(q));

    setResults({
      properties: propMatches.slice(0, 6),
      contacts: contactMatches.slice(0, 6),
      pages: pageMatches.slice(0, 6),
    });
    setLoading(false);
  }, [query, properties, contacts, visiblePages]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleSelectProperty = (p) => {
    const uid = p.property_uid ?? p.uid ?? p.id;
    if (uid) {
      navigate(accountUrl ? `/${accountUrl}/properties/${uid}` : `/properties/${uid}`);
    }
    setOpen(false);
    setQuery("");
  };

  const handleSelectPage = (page) => {
    const fullPath = accountUrl ? `/${accountUrl}/${page.path}` : `/${page.path}`;
    navigate(fullPath);
    setOpen(false);
    setQuery("");
  };

  const handleSelectContact = (c) => {
    if (c?.id) {
      navigate(accountUrl ? `/${accountUrl}/contacts/${c.id}` : `/contacts/${c.id}`);
    }
    setOpen(false);
    setQuery("");
  };

  const hasResults =
    results.properties.length > 0 ||
    results.contacts.length > 0 ||
    results.pages.length > 0;
  const showDropdown = open && query.length >= 0 && !disabled;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div
        className={`flex items-center gap-2 px-2.5 py-1 rounded-xl w-full focus-within:ring-0 ${
          disabled
            ? "bg-gray-200/80 dark:bg-gray-800/60 text-gray-500 dark:text-gray-500 cursor-not-allowed"
            : "bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus-within:bg-gray-200 dark:focus-within:bg-gray-700"
        }`}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <Search className={`w-4 h-4 shrink-0 ${disabled ? "text-gray-400/70" : "text-gray-400"}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          placeholder="Search properties, contacts & pages…"
          disabled={disabled}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:ring-0 focus:outline-none focus:border-none disabled:cursor-not-allowed disabled:placeholder-gray-400/70"
          aria-label="Search"
        />
      </div>

      {showDropdown && (
        <div
          className="absolute top-full left-0 mt-1 w-full max-h-80 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {query.trim() && (
            <>
              {results.contacts.length > 0 && (
                <div className="px-1.5 pb-1.5">
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase px-2.5 py-0.5 mb-0.5">
                    Contacts
                  </div>
                  {results.contacts.map((c) => (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                      onClick={() => handleSelectContact(c)}
                    >
                      <User className="w-4 h-4 shrink-0 text-gray-400" />
                      <span className="truncate">
                        {c.name || c.email || "Contact"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results.properties.length > 0 && (
                <div className="px-1.5 pb-1.5">
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase px-2.5 py-0.5 mb-0.5">
                    Properties
                  </div>
                  {results.properties.map((p) => (
                    <button
                      key={p.property_uid ?? p.id ?? p.uid}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                      onClick={() => handleSelectProperty(p)}
                    >
                      <Building2 className="w-4 h-4 shrink-0 text-gray-400" />
                      <span className="truncate">
                        {p.property_name ||
                          p.propertyName ||
                          p.nickname ||
                          p.address ||
                          p.street_address ||
                          "Property"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results.pages.length > 0 && (
                <div className="px-1.5">
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase px-2.5 py-0.5 mb-0.5">
                    Pages
                  </div>
                  {results.pages.map((page) => (
                    <button
                      key={page.path}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
                      onClick={() => handleSelectPage(page)}
                    >
                      <FileText className="w-4 h-4 shrink-0 text-gray-400" />
                      <span>{page.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {!loading && query.trim() && !hasResults && (
                <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No results for "{query}"
                </div>
              )}
            </>
          )}
          {!query.trim() && (
            <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
              Search properties, contacts by name or email, or find pages
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NavbarSearch;
