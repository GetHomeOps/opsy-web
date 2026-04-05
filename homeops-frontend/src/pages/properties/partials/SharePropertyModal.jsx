import React, {useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback} from "react";
import {createPortal} from "react-dom";
import {
  UserPlus,
  Mail,
  Send,
  Check,
  ChevronDown,
  User,
  Home,
  Shield,
  Landmark,
  Briefcase,
  Settings,
  Wrench,
  FileText,
  ArrowRightLeft,
  RefreshCw,
  X,
  Search,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import SelectDropdown from "../../contacts/SelectDropdown";
import ContactSearchModal from "./ContactSearchModal";
import {PROPERTY_SYSTEMS} from "../constants/propertySystems";
import AppApi from "../../../api/api";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const TABS = [
  {id: "owner", label: "All", icon: User, description: "All team members"},
  {
    id: "homeowner",
    label: "Homeowner",
    icon: Home,
    description: "Invite home owner",
  },
  {id: "agent", label: "Agent", icon: Briefcase, description: "Invite agent"},
  {
    id: "insurance",
    label: "Insurance",
    icon: Shield,
    description: "Invite insurance agent",
  },
  {
    id: "mortgage",
    label: "Mortgage",
    icon: Landmark,
    description: "Invite mortgage agent",
  },
];

/** Maps a team member's role to the corresponding tab id (platform `role` vs property access `property_role`) */
function memberRoleToTab(m) {
  const platform = (m.role ?? "").toLowerCase();
  const prop = (m.property_role ?? "").toLowerCase();
  if (["agent", "admin", "super_admin"].includes(platform)) return "agent";
  if (platform === "homeowner" || platform === "owner") return "homeowner";
  if (["insurer", "insurance", "insurance agent"].includes(platform))
    return "insurance";
  if (["mortgage partner", "mortgage", "mortgage agent"].includes(platform))
    return "mortgage";
  if (prop === "owner") return "homeowner";
  if (["insurer", "insurance", "insurance agent"].includes(prop))
    return "insurance";
  if (["mortgage partner", "mortgage", "mortgage agent"].includes(prop))
    return "mortgage";
  return "homeowner";
}

/** Human-readable platform role for team lists (users.role — Agent, Homeowner, etc.) */
function getPlatformTeamRoleLabel(m) {
  if (!m) return null;
  const r = (m.role ?? "").toLowerCase();
  if (["agent", "admin", "super_admin"].includes(r)) return "Agent";
  if (["homeowner", "owner"].includes(r)) return "Homeowner";
  if (["insurer", "insurance", "insurance agent"].includes(r))
    return "Insurance";
  if (["mortgage partner", "mortgage", "mortgage agent"].includes(r))
    return "Mortgage";
  if (m.role) return m.role;
  return null;
}

const PERMISSION_OPTIONS = [
  {id: "edit", label: "Edit"},
  {id: "view", label: "View"},
  {id: "none", label: "None"},
];

/** Max homeowner/household slots per plan (owner + co-owners + view-only). Free: 1 owner only; Maintain: 2; Win: unlimited. */
const HOMEOWNER_SLOT_LIMITS = {
  free: 1,
  maintain: 2,
  win: null /* unlimited */,
  homeowner_beta: 2,
  beta_homeowner: 2, // legacy users.subscription_tier
};

const HOMEOWNER_INVITE_TYPES = [
  {id: "co_owner", label: "Co-owner", description: "Full edit access"},
  {
    id: "view_only",
    label: "View-only household member",
    description: "View access only",
  },
];

/** Access sections for permission toggles (Systems, Maintenance, Docs) */
const ACCESS_SECTIONS = [
  {id: "systems", label: "Systems", icon: Settings},
  {id: "maintenance", label: "Maintenance", icon: Wrench},
  {id: "documents", label: "Docs", icon: FileText},
];

const DROPDOWN_MAX_AGENTS = 4;
const DROPDOWN_MAX_CONTACTS = 4;

function SearchableEmailField({
  contacts,
  agents = [],
  value,
  onChange,
  onBlur,
  onInviteeMeta,
  placeholder = "Type to search contacts or enter email…",
  disabled = false,
  error,
  showAgentInviteNote = false,
  onSearchMore,
  dropdownContainerRef,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const dropdownRef = useRef(null);

  const contactsWithEmail = useMemo(
    () => (contacts || []).filter((c) => c.email?.trim()),
    [contacts],
  );

  const agentsWithEmail = useMemo(
    () => (agents || []).filter((a) => a.email?.trim()),
    [agents],
  );

  const { filteredContacts, allContactsFiltered } = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    const agentEmails = new Set(
      agentsWithEmail.map((a) => (a.email || "").trim().toLowerCase()),
    );
    const deduped = contactsWithEmail.filter(
      (c) => !agentEmails.has((c.email || "").trim().toLowerCase()),
    );
    const filtered = term
      ? deduped.filter((c) => {
          const name = (c.name || "").toLowerCase();
          const email = (c.email || "").toLowerCase();
          return name.includes(term) || email.includes(term);
        })
      : deduped;
    return {
      filteredContacts: filtered.slice(0, DROPDOWN_MAX_CONTACTS),
      allContactsFiltered: filtered,
    };
  }, [contactsWithEmail, agentsWithEmail, inputValue]);

  const { filteredAgents, allAgentsFiltered } = useMemo(() => {
    if (!agentsWithEmail.length) return { filteredAgents: [], allAgentsFiltered: [] };
    const term = inputValue.trim().toLowerCase();
    const filtered = term
      ? agentsWithEmail.filter((a) => {
          const name = (a.name || "").toLowerCase();
          const email = (a.email || "").toLowerCase();
          return name.includes(term) || email.includes(term);
        })
      : agentsWithEmail;
    return {
      filteredAgents: filtered.slice(0, DROPDOWN_MAX_AGENTS),
      allAgentsFiltered: filtered,
    };
  }, [agentsWithEmail, inputValue]);

  const hasMoreResults =
    onSearchMore &&
    (allAgentsFiltered.length > DROPDOWN_MAX_AGENTS ||
      allContactsFiltered.length > DROPDOWN_MAX_CONTACTS);

  const allEmails = useMemo(() => {
    const set = new Set();
    agentsWithEmail.forEach((a) =>
      set.add((a.email || "").trim().toLowerCase()),
    );
    contactsWithEmail.forEach((c) =>
      set.add((c.email || "").trim().toLowerCase()),
    );
    return set;
  }, [agentsWithEmail, contactsWithEmail]);

  const showCustomOption =
    inputValue.trim() &&
    EMAIL_REGEX.test(inputValue.trim()) &&
    !allEmails.has(inputValue.trim().toLowerCase());

  const flatOptions = useMemo(() => {
    const items = [];
    filteredAgents.forEach((a) => items.push({...a, _group: "agent"}));
    filteredContacts.forEach((c) => items.push({...c, _group: "contact"}));
    if (showCustomOption) {
      items.push({
        id: "__custom__",
        email: inputValue.trim(),
        name: `Use "${inputValue.trim()}"`,
        isCustom: true,
        _group: "custom",
      });
    }
    if (hasMoreResults) {
      items.push({
        id: "__search_more__",
        email: null,
        name: "Search more…",
        isSearchMore: true,
        _group: "search_more",
      });
    }
    return items;
  }, [filteredAgents, filteredContacts, showCustomOption, inputValue, hasMoreResults]);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target) && (!dropdownRef.current || !dropdownRef.current.contains(e.target))) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (contact) => {
      if (contact?.isSearchMore && onSearchMore) {
        onSearchMore();
        setIsOpen(false);
        setHighlightIndex(-1);
        return;
      }
      const email = contact.email?.trim() || contact.email;
      setInputValue(email);
      onChange(email);
      if (!contact?.isCustom && !contact?.isSearchMore && email) {
        const resolvedName = (contact.name || "").trim();
        onInviteeMeta?.({ name: resolvedName });
      }
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onChange, onInviteeMeta, onSearchMore],
  );

  const handleInputChange = (e) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
    setIsOpen(true);
    setHighlightIndex(-1);
  };

  const handleInputFocus = () => {
    if (!disabled) setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      e.preventDefault();
      return;
    }
    if (!isOpen) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightIndex(-1);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowDown") {
      setHighlightIndex((i) =>
        i < flatOptions.length - 1 ? i + 1 : i,
      );
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      setHighlightIndex((i) => (i > 0 ? i - 1 : -1));
      e.preventDefault();
      return;
    }
    if (
      e.key === "Enter" &&
      highlightIndex >= 0 &&
      flatOptions[highlightIndex]
    ) {
      handleSelect(flatOptions[highlightIndex]);
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[role='option']");
      items[highlightIndex]?.scrollIntoView({block: "nearest"});
    }
  }, [highlightIndex]);

  const renderOptionItem = (item, flatIdx) => {
    const isHighlighted = highlightIndex === flatIdx;
    if (item.isSearchMore) {
      return (
        <li
          key="__search_more__"
          role="option"
          aria-selected={isHighlighted}
          className={`px-4 py-2.5 text-sm cursor-pointer flex items-center gap-3 ${
            isHighlighted
              ? "bg-[#456564]/10 dark:bg-[#5a7a78]/20 text-[#456564] dark:text-[#5a7a78]"
              : "text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
          onMouseEnter={() => setHighlightIndex(flatIdx)}
          onMouseDown={(e) => {
            e.preventDefault();
            handleSelect(item);
          }}
        >
          <Search className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
          <span className="font-medium">{item.name}</span>
        </li>
      );
    }
    if (item.isCustom) {
      return (
        <li
          key="__custom__"
          role="option"
          aria-selected={isHighlighted}
          className={`px-4 py-2.5 text-sm cursor-pointer ${
            isHighlighted
              ? "bg-[#456564]/10 dark:bg-[#5a7a78]/20 text-[#456564] dark:text-[#5a7a78]"
              : "text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
          onMouseEnter={() => setHighlightIndex(flatIdx)}
          onMouseDown={(e) => {
            e.preventDefault();
            handleSelect(item);
          }}
        >
          {item.name}
        </li>
      );
    }

    if (item.isSearchMore) {
      return (
        <li
          key="__search_more__"
          role="option"
          aria-selected={isHighlighted}
          className={`px-4 py-2.5 text-sm cursor-pointer flex items-center gap-3 ${
            isHighlighted
              ? "bg-[#456564]/10 dark:bg-[#5a7a78]/20 text-[#456564] dark:text-[#5a7a78]"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
          onMouseEnter={() => setHighlightIndex(flatIdx)}
          onMouseDown={(e) => {
            e.preventDefault();
            handleSelect(item);
          }}
        >
          <Search className="w-4 h-4 shrink-0" />
          <span>{item.name}</span>
        </li>
      );
    }

    const isAgent = item._group === "agent";
    const imgUrl = item.image_url || item.avatarUrl || item.avatar_url;

    return (
      <li
        key={`option-${flatIdx}`}
        role="option"
        aria-selected={isHighlighted}
        className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${
          isHighlighted
            ? "bg-[#456564]/10 dark:bg-[#5a7a78]/20"
            : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
        }`}
        onMouseEnter={() => setHighlightIndex(flatIdx)}
        onMouseDown={(e) => {
          e.preventDefault();
          handleSelect(item);
        }}
      >
        {isAgent ? (
          imgUrl ? (
            <img
              src={imgUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#456564] dark:bg-[#5a7a78] flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {(item.name || item.email)?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-xs font-semibold shrink-0">
            {(item.name || item.email)?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium truncate ${
              isHighlighted
                ? "text-[#456564] dark:text-[#5a7a78]"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {item.name || "Unknown"}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {item.email?.trim()}
          </p>
        </div>
        {isAgent && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#456564]/10 dark:bg-[#5a7a78]/20 text-[#456564] dark:text-[#5a7a78] shrink-0">
            Agent
          </span>
        )}
      </li>
    );
  };

  let flatIdx = 0;

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={error ? "email-error" : undefined}
          className={`form-input w-full pr-9 ${
            error ? "border-red-500 dark:border-red-500" : ""
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>
      {error && (
        <p
          id="email-error"
          className="mt-1 text-sm text-red-500 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      )}
      {showAgentInviteNote && showCustomOption && (
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
          Your agent is still not on our system! We will invite them to help
          service you!
        </p>
      )}
      {isOpen &&
        !disabled &&
        dropdownPosition &&
        createPortal(
          <ul
            ref={(el) => {
              listRef.current = el;
              dropdownRef.current = el;
              if (dropdownContainerRef) dropdownContainerRef.current = el;
            }}
            className="fixed py-1 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-auto z-[250]"
            role="listbox"
            style={{
              top: dropdownPosition.top + 4,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            {flatOptions.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {inputValue.trim()
                  ? "No matching results. Type a full email address."
                  : "No contacts with email. Type an email address."}
              </li>
            ) : (
              <>
                {filteredAgents.length > 0 && (
                  <>
                    <li className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 select-none">
                      Agents
                    </li>
                    {filteredAgents.map((a) => {
                      const idx = flatIdx++;
                      return renderOptionItem({...a, _group: "agent"}, idx);
                    })}
                  </>
                )}
                {filteredContacts.length > 0 && (
                  <>
                    {filteredAgents.length > 0 && (
                      <li className="my-1 border-t border-gray-100 dark:border-gray-700" />
                    )}
                    <li className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 select-none">
                      My Contacts
                    </li>
                    {filteredContacts.map((c) => {
                      const idx = flatIdx++;
                      return renderOptionItem({...c, _group: "contact"}, idx);
                    })}
                  </>
                )}
                {showCustomOption &&
                  renderOptionItem(
                    {
                      id: "__custom__",
                      email: inputValue.trim(),
                      name: `Use "${inputValue.trim()}"`,
                      isCustom: true,
                      _group: "custom",
                    },
                    flatIdx++,
                  )}
                {hasMoreResults &&
                  renderOptionItem(
                    {
                      id: "__search_more__",
                      name: "Search more…",
                      isSearchMore: true,
                      _group: "search_more",
                    },
                    flatIdx++,
                  )}
              </>
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}

function PermissionToggle({
  value,
  onChange,
  systemId,
  systemName,
  icon: Icon,
  "aria-label": ariaLabel,
  disabled = false,
}) {
  return (
    <div
      className="flex items-center justify-between gap-4"
      role="group"
      aria-label={ariaLabel}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 truncate shrink-0">
        {Icon && (
          <Icon className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />
        )}
        {systemName}
      </span>
      <div
        className={`inline-flex rounded-lg overflow-hidden border shrink-0 ${
          disabled
            ? "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed"
            : "border-gray-200 dark:border-gray-600"
        }`}
        role="radiogroup"
        aria-label={`${systemName} permission`}
      >
        {PERMISSION_OPTIONS.map((opt, idx) => (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={value === opt.id}
            tabIndex={disabled ? -1 : value === opt.id ? 0 : -1}
            disabled={disabled}
            onClick={() => !disabled && onChange(systemId, opt.id)}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "ArrowLeft" && idx > 0)
                onChange(systemId, PERMISSION_OPTIONS[idx - 1].id);
              if (e.key === "ArrowRight" && idx < PERMISSION_OPTIONS.length - 1)
                onChange(systemId, PERMISSION_OPTIONS[idx + 1].id);
            }}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              idx > 0 ? "border-l border-gray-200 dark:border-gray-600" : ""
            } ${
              value === opt.id
                ? "bg-[#456564] dark:bg-[#5a7a78] text-white"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            } ${disabled ? "opacity-75 cursor-not-allowed" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TeamMemberCard({
  member: m,
  showRole = false,
  currentUserId,
  onResendInvitation,
  resendingId,
  onRemove,
  canRemove = false,
}) {
  const isPending = m._pending === true;
  const isCurrentUser =
    currentUserId != null && String(m.id) === String(currentUserId);
  /* Only show resend for pending invitations – not for users who already accepted */
  const hasResend =
    isPending && m.invitationId && onResendInvitation;
  const displayRole = getPlatformTeamRoleLabel(m) ?? "Member";

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${
          isPending
            ? "bg-gray-400 dark:bg-gray-500"
            : "bg-[#456564] dark:bg-[#5a7a78]"
        }`}
      >
        {isPending
          ? m.email?.charAt(0)?.toUpperCase() || "?"
          : m.name?.charAt(0)?.toUpperCase() ||
            m.email?.charAt(0)?.toUpperCase() ||
            "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {m.name || m.email}
          {isCurrentUser && (
            <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
              (Me)
            </span>
          )}
        </p>
        {(m.email || m.inviteeEmail) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {m.email || m.inviteeEmail}
          </p>
        )}
        {showRole && !(m.email || m.inviteeEmail) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {displayRole}
          </p>
        )}
        {showRole && (m.email || m.inviteeEmail) && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {displayRole}
          </p>
        )}
        {isPending && !hasResend && (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            Pending invitation
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {hasResend && (
          <button
            type="button"
            onClick={() => onResendInvitation(m)}
            disabled={resendingId === m.invitationId}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#456564] dark:text-[#5a7a78] hover:underline disabled:opacity-50"
          >
            {resendingId === m.invitationId ? (
              <span className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Resend Invitation Email
          </button>
        )}
        {canRemove && onRemove && (
          <button
            type="button"
            onClick={() => onRemove(m)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
            aria-label="Remove member"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function SharePropertyModal({
  modalOpen,
  setModalOpen,
  propertyAddress = "",
  contacts = [],
  users = [],
  teamMembers = [],
  currentUser,
  currentAccount,
  propertyId,
  systems = [],
  limits: billingLimits = {},
  onInvite,
  onUpdateAgentPermissions,
  onTransferOwnership,
  onRemoveMember,
  initialTab = "owner",
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [email, setEmail] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [role, setRole] = useState("homeowner");
  const [homeownerInviteType, setHomeownerInviteType] = useState("co_owner");
  const [permissions, setPermissions] = useState({});
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successType, setSuccessType] = useState(null);
  const [transferOwnershipOpen, setTransferOwnershipOpen] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [platformAgents, setPlatformAgents] = useState([]);
  const [removeConfirmMember, setRemoveConfirmMember] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [searchMoreModalOpen, setSearchMoreModalOpen] = useState(false);
  const emailDropdownRef = useRef(null);

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    AppApi.getAgents()
      .then((agents) => {
        if (!cancelled) setPlatformAgents(agents ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modalOpen]);

  const allSystemIds = useMemo(() => {
    const selectedIds = systems?.selectedSystemIds ?? [];
    const customNames = systems?.customSystemNames ?? [];
    const predefined =
      selectedIds.length > 0 ? selectedIds : PROPERTY_SYSTEMS.map((s) => s.id);
    const custom = customNames.map((name) => `custom-${name}`);
    return [...predefined, ...custom];
  }, [systems?.selectedSystemIds, systems?.customSystemNames]);

  const effectiveEmail = email?.trim() || "";
  const isValidEmail = EMAIL_REGEX.test(effectiveEmail);
  const canSubmit = isValidEmail && !emailError;

  const applyToAll = useCallback((perm) => {
    const next = {};
    ACCESS_SECTIONS.forEach((s) => {
      next[s.id] = perm;
    });
    setPermissions(next);
  }, []);

  const handlePermissionChange = useCallback((sectionId, value) => {
    setPermissions((prev) => ({...prev, [sectionId]: value}));
  }, []);

  const getPermission = useCallback(
    (sectionId) => permissions[sectionId] ?? "none",
    [permissions],
  );

  useEffect(() => {
    if (modalOpen) {
      setActiveTab(initialTab ?? "owner");
      setEmail("");
      setInviteeName("");
      setRole("homeowner");
      setHomeownerInviteType("co_owner");
      setPermissions({});
      setEmailError("");
      setSuccessType(null);
      setTransferOwnershipOpen(false);
      setSelectedNewOwnerId("");
    }
  }, [modalOpen, initialTab]);

  /* Sync role when switching tabs */
  useEffect(() => {
    if (activeTab === "agent") setRole("agent");
    else if (activeTab === "homeowner") setRole("homeowner");
    else if (activeTab === "insurance") setRole("insurance");
    else if (activeTab === "mortgage") setRole("mortgage");
  }, [activeTab]);

  /* Homeowner slot limits by plan */
  const currentRole = (currentUser?.role ?? "").toLowerCase();
  const isAgent = ["agent", "admin", "super_admin"].includes(currentRole);
  const isAdminOrSuperAdmin = ["admin", "super_admin"].includes(currentRole);

  /* For admin/super_admin only: merge existing users (with emails) into contacts for the email field */
  const effectiveContacts = useMemo(() => {
    if (!isAdminOrSuperAdmin || !users?.length) return contacts;
    const contactEmails = new Set(
      (contacts ?? [])
        .map((c) => (c.email ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    const usersAsContacts = (users ?? [])
      .filter((u) => u.email?.trim())
      .filter((u) => !contactEmails.has(u.email.trim().toLowerCase()))
      .map((u) => ({
        id: u.id,
        name: u.name ?? u.email,
        email: u.email?.trim() ?? u.email,
      }));
    return [...(contacts ?? []), ...usersAsContacts];
  }, [contacts, users, isAdminOrSuperAdmin]);
  const isHomeowner = currentRole === "homeowner";
  /* Homeowner tab (agent adding homeowner): restrictions are read-only, default edit */
  const homeownerRestrictionsReadOnly =
    activeTab === "homeowner" && !isHomeowner;
  const subscriptionTier = (
    currentUser?.subscriptionTier ??
    currentUser?.subscription_tier ??
    "free"
  ).toLowerCase();
  const maxHomeownerSlots =
    HOMEOWNER_SLOT_LIMITS[subscriptionTier] ?? HOMEOWNER_SLOT_LIMITS.free;
  const homeownerCount = useMemo(() => {
    return (teamMembers ?? []).filter(
      (m) => (m.role ?? "").toLowerCase() === "homeowner" || m._pending,
    ).length;
  }, [teamMembers]);
  const atHomeownerLimit =
    maxHomeownerSlots != null && homeownerCount >= maxHomeownerSlots;

  /* View-only user limit (from plan) - enforced when adding view-only homeowners */
  const maxViewers = billingLimits?.maxViewers ?? null;
  const viewerCount = useMemo(() => {
    return (teamMembers ?? []).filter(
      (m) => (m.property_role ?? "").toLowerCase() === "viewer",
    ).length;
  }, [teamMembers]);
  const atViewerLimit =
    maxViewers != null && viewerCount >= maxViewers;

  /* Group team members by tab for display */
  const membersByTab = useMemo(() => {
    const groups = {agent: [], homeowner: [], insurance: [], mortgage: []};
    (teamMembers ?? []).forEach((m) => {
      const tab = memberRoleToTab(m);
      if (groups[tab]) groups[tab].push(m);
      else groups.homeowner.push(m);
    });

    /* If the signed-in user is on the team but tab grouping missed them (e.g. odd role payloads), list them on Agent / Homeowner tab when their platform role matches */
    const selfId = currentUser?.id;
    if (selfId != null) {
      const idStr = String(selfId);
      const self = (teamMembers ?? []).find(
        (m) => m && String(m.id) === idStr,
      );
      if (self) {
        if (isAgent && !groups.agent.some((m) => String(m.id) === idStr)) {
          groups.agent.push(self);
        }
        if (
          isHomeowner &&
          !groups.homeowner.some((m) => String(m.id) === idStr)
        ) {
          groups.homeowner.push(self);
        }
      }
    }
    return groups;
  }, [teamMembers, currentUser?.id, isAgent, isHomeowner]);

  /* Only one agent per property - block adding when one already exists */
  const hasAgent = useMemo(
    () => (membersByTab.agent ?? []).length > 0,
    [membersByTab],
  );

  const isInsuranceOrMortgageComingSoon =
    activeTab === "insurance" || activeTab === "mortgage";

  /* Initialize permissions from existing agent when viewing agent tab with hasAgent */
  useEffect(() => {
    if (activeTab === "agent" && (membersByTab.agent ?? []).length > 0) {
      const agent = membersByTab.agent[0];
      const perms = agent?.permissions ?? {};
      const merged = {};
      ACCESS_SECTIONS.forEach((s) => {
        merged[s.id] = perms[s.id] ?? "edit";
      });
      setPermissions(merged);
    }
  }, [activeTab, membersByTab]);

  /* Agent tab: default access restrictions to view for systems, maintenance, docs */
  useEffect(() => {
    if (
      activeTab === "agent" &&
      !hasAgent &&
      Object.keys(permissions).length === 0
    ) {
      const merged = {};
      ACCESS_SECTIONS.forEach((s) => {
        merged[s.id] = "view";
      });
      setPermissions(merged);
    }
  }, [activeTab, hasAgent, permissions]);

  const handleBlur = useCallback(() => {
    if (effectiveEmail && !EMAIL_REGEX.test(effectiveEmail)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  }, [effectiveEmail]);

  const handleUpdateAgentPermissions = useCallback(() => {
    if (!hasAgent || !onUpdateAgentPermissions) return;
    const agent = membersByTab.agent[0];
    if (!agent?.id) return;
    const perms = {};
    ACCESS_SECTIONS.forEach((s) => {
      perms[s.id] = getPermission(s.id);
    });
    onUpdateAgentPermissions(agent.id, perms);
    setModalOpen(false);
  }, [hasAgent, membersByTab, onUpdateAgentPermissions, getPermission]);

  const handleInvite = async () => {
    if (!canSubmit || isSubmitting) return;
    if (activeTab === "homeowner" && atHomeownerLimit) return;
    if (
      activeTab === "homeowner" &&
      homeownerInviteType === "view_only" &&
      atViewerLimit
    )
      return;
    setEmailError("");

    const emailLower = (effectiveEmail || "").trim().toLowerCase();
    const alreadyInTeam = (teamMembers ?? []).some((m) => {
      const mEmail = (m.email ?? m.inviteeEmail ?? "").trim().toLowerCase();
      return mEmail && mEmail === emailLower;
    });
    if (alreadyInTeam) {
      setEmailError(
        "This person is already on the team or has a pending invitation.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const perSystemPerms = {};
      const isViewOnly =
        activeTab === "homeowner" && homeownerInviteType === "view_only";
      const isHomeownerEditDefault = activeTab === "homeowner" && !isHomeowner;
      if (isViewOnly) {
        ACCESS_SECTIONS.forEach((s) => {
          perSystemPerms[s.id] = "view";
        });
        allSystemIds.forEach((id) => {
          perSystemPerms[id] = "view";
        });
      } else if (isHomeownerEditDefault) {
        ACCESS_SECTIONS.forEach((s) => {
          perSystemPerms[s.id] = "edit";
        });
        allSystemIds.forEach((id) => {
          perSystemPerms[id] = "edit";
        });
      } else {
        ACCESS_SECTIONS.forEach((s) => {
          perSystemPerms[s.id] = getPermission(s.id);
        });
        allSystemIds.forEach((id) => {
          perSystemPerms[id] = getPermission("systems");
        });
      }
      await onInvite?.({
        email: effectiveEmail,
        name: inviteeName.trim() || undefined,
        role,
        homeownerInviteType:
          activeTab === "homeowner" ? homeownerInviteType : undefined,
        permissions: perSystemPerms,
      });
      setSuccessType("invite");
      setTimeout(() => {
        setModalOpen(false);
      }, 1200);
    } catch (err) {
      console.error(err);
      setEmailError(err?.message || "Failed to send invite. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const showSuccessOverlay = successType !== null;
  const showInviteActions =
    activeTab === "homeowner" ||
    activeTab === "agent" ||
    activeTab === "insurance" ||
    activeTab === "mortgage";

  /* Property owner is only the explicit owner on this property team. */
  const propertyOwner = useMemo(() => {
    const list = teamMembers ?? [];
    return (
      list.find(
        (m) =>
          m &&
          !m._pending &&
          (m.property_role ?? "").toLowerCase() === "owner",
      ) ?? null
    );
  }, [teamMembers]);

  const propertyOwnerPlatformLabel = useMemo(() => {
    if (!propertyOwner) return null;
    const u = (users ?? []).find(
      (x) => x && String(x.id) === String(propertyOwner.id),
    );
    return getPlatformTeamRoleLabel({
      ...propertyOwner,
      role: propertyOwner.role ?? u?.role,
    });
  }, [propertyOwner, users]);

  /* Team members excluding the owner (to avoid duplicate display in "All" tab) */
  const teamMembersExcludingOwner = useMemo(() => {
    if (!propertyOwner?.id) return teamMembers ?? [];
    return (teamMembers ?? []).filter(
      (m) => m && String(m.id) !== String(propertyOwner.id),
    );
  }, [teamMembers, propertyOwner?.id]);

  /* Current user is the property owner (can transfer ownership) */
  const isCurrentUserPropertyOwner = useMemo(
    () => propertyOwner && String(propertyOwner.id) === String(currentUser?.id),
    [propertyOwner, currentUser?.id],
  );

  /* Options for transfer ownership: team members excluding current owner (currentUser) */
  const transferOwnerOptions = useMemo(() => {
    const currentUserId = currentUser?.id;
    return (teamMembers ?? [])
      .filter((m) => m && !m._pending && String(m.id) !== String(currentUserId))
      .map((m) => ({
        id: String(m.id),
        name: m.name || m.email || "Unknown",
      }));
  }, [teamMembers, currentUser?.id]);

  const handleTransferOwnership = useCallback(async () => {
    if (!selectedNewOwnerId || !onTransferOwnership) return;
    setTransferSubmitting(true);
    setEmailError("");
    try {
      await onTransferOwnership(selectedNewOwnerId);
      setTransferOwnershipOpen(false);
      setSelectedNewOwnerId("");
      setSuccessType("ownership_sent");
      setTimeout(() => setSuccessType(null), 2800);
    } catch (err) {
      setEmailError(
        err?.message || "Could not send transfer request. Please try again.",
      );
    } finally {
      setTransferSubmitting(false);
    }
  }, [selectedNewOwnerId, onTransferOwnership]);

  const handleResendInvitation = useCallback(async (member) => {
    const invId = member.invitationId;
    if (!invId) return;
    setResendingId(invId);
    setEmailError("");
    try {
      await AppApi.resendInvitation(invId);
      setSuccessType("resend");
      setTimeout(() => setSuccessType(null), 2000);
    } catch (err) {
      setEmailError(err?.message || "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  }, []);

  const canRemoveMember = useCallback(
    (m) => {
      if (!m) return false;
      if (!propertyOwner) return true;
      if (m._pending) return true;
      return String(m.id) !== String(propertyOwner.id);
    },
    [propertyOwner],
  );

  const handleConfirmRemove = useCallback(async () => {
    const member = removeConfirmMember;
    if (!member || !onRemoveMember) return;
    setRemovingMember(true);
    try {
      await onRemoveMember(member);
      setRemoveConfirmMember(null);
    } catch (err) {
      setEmailError(err?.message || "Failed to remove member");
    } finally {
      setRemovingMember(false);
    }
  }, [removeConfirmMember, onRemoveMember]);

  const visibleTabs = TABS;

  return (
    <>
    <ModalBlank
      id="share-property-modal"
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-2xl min-w-[24rem] max-h-[90vh] flex flex-col"
      ignoreClickRefs={[emailDropdownRef]}
    >
      <div
        className={`relative flex flex-col flex-1 min-h-0 overflow-hidden ${
          showSuccessOverlay ? "min-h-[14rem]" : ""
        }`}
      >
        {/* Success overlay */}
        {showSuccessOverlay && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-800/95 rounded-lg z-10 px-6 py-8 min-w-0"
            style={{
              animation: "shareModalFadeIn 0.3s ease-out forwards",
            }}
          >
            <style>{`
              @keyframes shareModalFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes shareModalCheckPop {
                from { opacity: 0; transform: scale(0.6); }
                to { opacity: 1; transform: scale(1); }
              }
            `}</style>
            <div
              className="flex flex-col items-center gap-3 w-full max-w-sm min-w-[min(18rem,100%)]"
              style={{
                animation:
                  "shareModalCheckPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <div className="w-14 h-14 shrink-0 rounded-full bg-[#456564]/20 dark:bg-[#5a7a78]/30 flex items-center justify-center">
                <Check className="w-8 h-8 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <p className="text-base font-semibold text-gray-900 dark:text-white text-center break-words w-full">
                {successType === "resend"
                  ? "Invitation email resent!"
                  : successType === "ownership_sent"
                    ? "Transfer request sent. They will be notified to accept or decline."
                    : "Invite sent successfully!"}
              </p>
            </div>
          </div>
        )}

        {!showSuccessOverlay && (
          <>
            <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Invite to property
              </h2>
              {propertyAddress && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate max-w-full">
                  {propertyAddress}
                </p>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto shrink-0 mx-6 md:mx-8">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    disabled={tab.disabled}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                      tab.disabled
                        ? "text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60"
                        : activeTab === tab.id
                          ? "text-[#456564] dark:text-[#5a7a78] border-b-2 border-[#456564] dark:border-[#5a7a78]"
                          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                    aria-selected={activeTab === tab.id}
                    aria-disabled={tab.disabled}
                    role="tab"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {/* ===== Owner tab: show owner (once) + team members (excluding owner) ===== */}
              {activeTab === "owner" && (
                <div className="space-y-6">
                  {/* Section 1: Owner */}
                  <div>
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                      Owner
                    </p>
                    {propertyOwner ? (
                      <div className="flex items-center gap-4 p-4 rounded-xl bg-[#456564]/5 dark:bg-[#5a7a78]/10 border border-[#456564]/20 dark:border-[#5a7a78]/30">
                        <div className="w-12 h-12 rounded-full bg-[#456564] dark:bg-[#5a7a78] flex items-center justify-center text-white font-semibold shrink-0">
                          {(propertyOwner.name || propertyOwner.email)
                            ?.charAt(0)
                            ?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {propertyOwner.name ||
                              propertyOwner.email ||
                              "Unknown"}
                            {String(propertyOwner.id) ===
                              String(currentUser?.id) && (
                              <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">
                                (Me)
                              </span>
                            )}
                          </p>
                          {(propertyOwner.email ||
                            propertyOwner.inviteeEmail) && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {propertyOwner.email ||
                                propertyOwner.inviteeEmail}
                            </p>
                          )}
                          {propertyOwnerPlatformLabel && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {propertyOwnerPlatformLabel}
                            </p>
                          )}
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-[#456564]/20 dark:bg-[#5a7a78]/30 text-[#456564] dark:text-[#5a7a78] text-xs font-semibold">
                            Owner
                          </span>
                        </div>
                        {onTransferOwnership &&
                          isCurrentUserPropertyOwner &&
                          transferOwnerOptions.length > 0 && (
                            <div className="shrink-0">
                              {!transferOwnershipOpen ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEmailError("");
                                    setTransferOwnershipOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#456564] dark:text-[#5a7a78] hover:underline"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                  Transfer ownership
                                </button>
                              ) : (
                                <div className="flex flex-col gap-2 min-w-[200px]">
                                  <SelectDropdown
                                    options={transferOwnerOptions}
                                    value={selectedNewOwnerId}
                                    onChange={(v) =>
                                      setSelectedNewOwnerId(v ?? "")
                                    }
                                    placeholder="Select new owner"
                                    name="transfer-owner"
                                    id="transfer-owner"
                                    clearable
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => void handleTransferOwnership()}
                                      disabled={
                                        !selectedNewOwnerId || transferSubmitting
                                      }
                                      className="btn-sm bg-[#456654] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {transferSubmitting ? "Sending…" : "Send request"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTransferOwnershipOpen(false);
                                        setSelectedNewOwnerId("");
                                        setEmailError("");
                                      }}
                                      className="btn-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  {emailError && transferOwnershipOpen && (
                                    <p className="text-xs text-red-600 dark:text-red-400">
                                      {emailError}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400">
                        No owner assigned
                      </div>
                    )}
                  </div>

                  {/* Section 2: Team Members (excluding owner) */}
                  {teamMembersExcludingOwner.length > 0 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                        Team Members
                      </p>
                      <div className="space-y-2">
                        {teamMembersExcludingOwner.map((m) => (
                          <TeamMemberCard
                            key={m.id ?? `pending-${m.email}`}
                            member={m}
                            showRole
                            currentUserId={currentUser?.id}
                            onResendInvitation={handleResendInvitation}
                            resendingId={resendingId}
                            onRemove={onRemoveMember ? () => setRemoveConfirmMember(m) : undefined}
                            canRemove={canRemoveMember(m)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== Invite tabs: agent, homeowner, insurance, mortgage ===== */}
              {showInviteActions && (
                <div className="space-y-6">
                  {/* Existing members for this tab */}
                  {(membersByTab[activeTab] ?? []).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                        Current{" "}
                        {TABS.find(
                          (t) => t.id === activeTab,
                        )?.label?.toLowerCase() ?? "members"}
                      </p>
                      <div className="space-y-2">
                        {(membersByTab[activeTab] ?? []).map((m) => (
                          <TeamMemberCard
                            key={m.id ?? `pending-${m.email}`}
                            member={m}
                            currentUserId={currentUser?.id}
                            onResendInvitation={handleResendInvitation}
                            resendingId={resendingId}
                            onRemove={onRemoveMember ? () => setRemoveConfirmMember(m) : undefined}
                            canRemove={canRemoveMember(m)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "homeowner" &&
                    atHomeownerLimit &&
                    maxHomeownerSlots != null && (
                      <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300">
                        You&apos;ve reached your plan limit for household
                        members ({homeownerCount} of {maxHomeownerSlots}).
                        Upgrade your plan to add more.
                      </div>
                    )}

                  {activeTab === "agent" && hasAgent && (
                    <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300">
                      An agent has already been added to this property. Only one
                      agent is allowed per property.
                    </div>
                  )}

                  {activeTab === "agent" && hasAgent && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Access restrictions
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Apply to all:
                          </span>
                          {PERMISSION_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => applyToAll(opt.id)}
                              className="px-2 py-1 text-xs font-medium rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        {ACCESS_SECTIONS.map((s) => {
                          const Icon = s.icon;
                          return (
                            <PermissionToggle
                              key={s.id}
                              systemId={s.id}
                              systemName={s.label}
                              value={getPermission(s.id)}
                              onChange={handlePermissionChange}
                              aria-label={`${s.label} permission`}
                              icon={Icon}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isInsuranceOrMortgageComingSoon ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Coming Soon
                      </p>
                    </div>
                  ) : activeTab === "agent" &&
                    hasAgent ? /* Agent already added: message and restrictions shown above; no invite form */
                  null : (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {activeTab === "agent"
                          ? "Invite an agent to collaborate on this property."
                          : isHomeowner
                            ? "Add a co-owner or view-only household member."
                            : "Invite a home owner to collaborate on this property."}
                      </p>

                      {activeTab === "homeowner" && isHomeowner && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Type
                          </label>
                          {atViewerLimit && maxViewers != null && (
                            <div className="p-3 mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-sm text-amber-800 dark:text-amber-200">
                              You&apos;ve reached your plan limit for view-only
                              members ({viewerCount} of {maxViewers}). Upgrade
                              your plan to add more.
                            </div>
                          )}
                          <div className="flex gap-3 flex-wrap">
                            {HOMEOWNER_INVITE_TYPES.map((opt) => {
                              const isViewOnly = opt.id === "view_only";
                              const isDisabled =
                                atHomeownerLimit ||
                                (isViewOnly && atViewerLimit);
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() =>
                                    !isDisabled && setHomeownerInviteType(opt.id)
                                  }
                                  disabled={isDisabled}
                                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                                    homeownerInviteType === opt.id
                                      ? "bg-[#456564] dark:bg-[#5a7a78] text-white"
                                      : "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                                  } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                  <span className="block">{opt.label}</span>
                                  <span
                                    className={`block text-xs mt-0.5 ${homeownerInviteType === opt.id ? "text-white/90" : "text-gray-500 dark:text-gray-400"}`}
                                  >
                                    {opt.description}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="invite-name"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                        >
                          Name{" "}
                          <span className="font-normal text-gray-500 dark:text-gray-400">
                            (optional)
                          </span>
                        </label>
                        <input
                          id="invite-name"
                          type="text"
                          value={inviteeName}
                          onChange={(e) => setInviteeName(e.target.value)}
                          placeholder="e.g. Jane Smith"
                          autoComplete="name"
                          disabled={
                            activeTab === "homeowner" && atHomeownerLimit
                          }
                          className="form-input w-full"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="invite-email"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                        >
                          Email address
                        </label>
                        <SearchableEmailField
                          contacts={effectiveContacts}
                          agents={
                            activeTab === "agent" ? platformAgents : []
                          }
                          value={email}
                          onChange={setEmail}
                          onBlur={handleBlur}
                          onInviteeMeta={({ name }) =>
                            setInviteeName(name ? name : "")
                          }
                          placeholder={
                            activeTab === "agent"
                              ? "Search agents, contacts, or enter email…"
                              : "Search My Contacts or enter email…"
                          }
                          error={emailError}
                          showAgentInviteNote={activeTab === "agent"}
                          onSearchMore={() => setSearchMoreModalOpen(true)}
                          dropdownContainerRef={emailDropdownRef}
                          aria-label="Invitee email"
                          aria-invalid={!!emailError}
                          disabled={
                            activeTab === "homeowner" && atHomeownerLimit
                          }
                        />
                      </div>

                      {activeTab === "agent" && !hasAgent && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Access restrictions
                            </label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Apply to all:
                              </span>
                              {PERMISSION_OPTIONS.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => applyToAll(opt.id)}
                                  className="px-2 py-1 text-xs font-medium rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-4">
                            {ACCESS_SECTIONS.map((s) => {
                              const Icon = s.icon;
                              return (
                                <PermissionToggle
                                  key={s.id}
                                  systemId={s.id}
                                  systemName={s.label}
                                  value={getPermission(s.id)}
                                  onChange={handlePermissionChange}
                                  aria-label={`${s.label} permission`}
                                  icon={Icon}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activeTab === "homeowner" && !isHomeowner && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Access restrictions
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Homeowners have full edit access by default.
                            </p>
                          </div>
                          <div className="space-y-4">
                            {ACCESS_SECTIONS.map((s) => {
                              const Icon = s.icon;
                              return (
                                <PermissionToggle
                                  key={s.id}
                                  systemId={s.id}
                                  systemName={s.label}
                                  value="edit"
                                  onChange={handlePermissionChange}
                                  aria-label={`${s.label} permission`}
                                  icon={Icon}
                                  disabled
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {showInviteActions && (
              <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                {activeTab === "agent" &&
                hasAgent &&
                onUpdateAgentPermissions ? (
                  <button
                    type="button"
                    onClick={handleUpdateAgentPermissions}
                    className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white"
                  >
                    Accept
                  </button>
                ) : null}
                {!(activeTab === "agent" && hasAgent) &&
                  !isInsuranceOrMortgageComingSoon && (
                    <button
                      type="button"
                      onClick={handleInvite}
                      disabled={
                        !canSubmit ||
                        isSubmitting ||
                        (activeTab === "homeowner" && atHomeownerLimit) ||
                        (activeTab === "homeowner" &&
                          homeownerInviteType === "view_only" &&
                          atViewerLimit)
                      }
                      className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                          Sending…
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Send invite
                          <Send className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Remove member confirmation modal */}
      <ModalBlank
        modalOpen={!!removeConfirmMember}
        setModalOpen={(open) => !open && setRemoveConfirmMember(null)}
        contentClassName="max-w-md"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Remove team member
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Are you sure you want to remove{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              {removeConfirmMember?.name || removeConfirmMember?.email}
            </span>{" "}
            from this property? They will no longer have access.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setRemoveConfirmMember(null)}
              disabled={removingMember}
              className="btn border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRemove}
              disabled={removingMember}
              className="btn bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {removingMember ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  Removing…
                </span>
              ) : (
                "Remove"
              )}
            </button>
          </div>
        </div>
      </ModalBlank>
    </ModalBlank>
    <ContactSearchModal
      modalOpen={searchMoreModalOpen}
      setModalOpen={setSearchMoreModalOpen}
      contacts={effectiveContacts}
      agents={activeTab === "agent" ? platformAgents : []}
      onSelectContact={(item) => {
        const em = item.email?.trim() || "";
        setEmail(em);
        setInviteeName((item.name || "").trim());
      }}
    />
    </>
  );
}

export default SharePropertyModal;
