import React, {useState, useRef, useEffect, useMemo} from "react";
import {ChevronDown, Search, Star, Users, X} from "lucide-react";

function ContractorDropdown({
  value,
  contacts = [],
  favoriteProfessionals = [],
  onSelect,
  onClear,
  onSearchMore,
  placeholder = "Select contractor",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  const favoriteContractors = (favoriteProfessionals || []).slice(0, 4);
  const recentContacts = (contacts || []).slice(0, 4);

  const allItems = useMemo(
    () => [...favoriteContractors, ...recentContacts],
    [favoriteContractors, recentContacts],
  );

  const selectedContact = useMemo(() => {
    if (!value) return null;
    return (
      allItems.find((c) => String(c.id) === String(value)) ||
      allItems.find(
        (c) => (c.name || "").toLowerCase() === String(value).toLowerCase(),
      )
    );
  }, [value, allItems]);

  const displayText = selectedContact?.name || value || "";

  const handleItemSelect = (contact) => {
    onSelect(contact);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="form-input w-full text-left flex items-center justify-between gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        <span
          className={`flex-1 truncate ${
            displayText
              ? "text-gray-900 dark:text-white"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          {displayText || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {displayText && onClear && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation();
                  onClear();
                }
              }}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-72 overflow-y-auto">
          {favoriteContractors.length > 0 && (
            <div className="p-1.5">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Star className="w-3 h-3" />
                Favorite Contractors
              </p>
              {favoriteContractors.map((c) => (
                <DropdownItem
                  key={c.id}
                  contact={c}
                  isSelected={selectedContact?.id === c.id}
                  onSelect={handleItemSelect}
                />
              ))}
            </div>
          )}

          {recentContacts.length > 0 && (
            <div
              className={`p-1.5 ${favoriteContractors.length > 0 ? "border-t border-gray-100 dark:border-gray-700" : ""}`}
            >
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                Contacts
              </p>
              {recentContacts.map((c) => (
                <DropdownItem
                  key={c.id}
                  contact={c}
                  isSelected={selectedContact?.id === c.id}
                  onSelect={handleItemSelect}
                />
              ))}
            </div>
          )}

          <div className="p-1.5 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSearchMore?.();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg text-[#456564] dark:text-[#6b9a7a] hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Search className="w-4 h-4" />
              Search more…
            </button>
          </div>

          {favoriteContractors.length === 0 &&
            recentContacts.length === 0 && (
              <div className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                No contacts or favorites yet
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function DropdownItem({contact, isSelected, onSelect}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(contact)}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
        isSelected
          ? "bg-[#456564]/10 dark:bg-[#6b9a7a]/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
      }`}
    >
      <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300 shrink-0">
        {(contact.name || "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {contact.name || "Unnamed"}
        </p>
        {contact.email && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {contact.email}
          </p>
        )}
      </div>
    </button>
  );
}

export default ContractorDropdown;
