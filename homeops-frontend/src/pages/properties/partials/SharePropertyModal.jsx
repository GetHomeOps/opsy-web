import React, {useState, useEffect, useRef, useMemo, useCallback} from "react";
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
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import SelectDropdown from "../../contacts/SelectDropdown";
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

/** Maps a team member's role to the corresponding tab id */
function memberRoleToTab(m) {
  const role = (m.role ?? m.property_role ?? "").toLowerCase();
  if (["agent", "admin", "super_admin"].includes(role)) return "agent";
  if (["homeowner", "owner"].includes(role)) return "homeowner";
  if (["insurer", "insurance", "insurance agent"].includes(role)) return "insurance";
  if (["mortgage partner", "mortgage", "mortgage agent"].includes(role)) return "mortgage";
  return "homeowner";
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
  win: null, /* unlimited */
};

const HOMEOWNER_INVITE_TYPES = [
  {id: "co_owner", label: "Co-owner", description: "Full edit access"},
  {id: "view_only", label: "View-only household member", description: "View access only"},
];

/** Access sections for permission toggles (Systems, Maintenance, Docs) */
const ACCESS_SECTIONS = [
  {id: "systems", label: "Systems", icon: Settings},
  {id: "maintenance", label: "Maintenance", icon: Wrench},
  {id: "documents", label: "Docs", icon: FileText},
];

function SearchableEmailField({
  contacts,
  value,
  onChange,
  onBlur,
  placeholder = "Type to search contacts or enter email…",
  disabled = false,
  error,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  const contactsWithEmail = useMemo(
    () => (contacts || []).filter((c) => c.email?.trim()),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    if (!term) return contactsWithEmail.slice(0, 8);
    return contactsWithEmail.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [contactsWithEmail, inputValue]);

  const showCustomOption =
    inputValue.trim() &&
    EMAIL_REGEX.test(inputValue.trim()) &&
    !contactsWithEmail.some(
      (c) => c.email?.trim().toLowerCase() === inputValue.trim().toLowerCase(),
    );

  const options = showCustomOption
    ? [
        ...filteredContacts,
        {
          id: "__custom__",
          email: inputValue.trim(),
          name: `Use "${inputValue.trim()}"`,
          isCustom: true,
        },
      ]
    : filteredContacts;

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (contact) => {
      const email = contact.email?.trim() || contact.email;
      setInputValue(email);
      onChange(email);
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onChange],
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
      setHighlightIndex((i) => (i < options.length - 1 ? i + 1 : i));
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      setHighlightIndex((i) => (i > 0 ? i - 1 : -1));
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && highlightIndex >= 0 && options[highlightIndex]) {
      handleSelect(options[highlightIndex]);
      e.preventDefault();
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIndex];
      el?.scrollIntoView({block: "nearest"});
    }
  }, [highlightIndex]);

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
      {isOpen && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-auto"
          role="listbox"
        >
          {options.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
              {inputValue.trim()
                ? "No matching contacts. Type a full email address."
                : "No contacts with email. Type an email address."}
            </li>
          ) : (
            options.map((contact, idx) => (
              <li
                key={contact.id || contact.email}
                role="option"
                aria-selected={highlightIndex === idx}
                className={`px-4 py-2.5 text-sm cursor-pointer ${
                  highlightIndex === idx
                    ? "bg-[#456564]/10 dark:bg-[#5a7a78]/20 text-[#456564] dark:text-[#5a7a78]"
                    : "text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
                onMouseEnter={() => setHighlightIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(contact);
                }}
              >
                {contact.isCustom
                  ? contact.name
                  : `${contact.name || "Unknown"} (${contact.email?.trim()})`}
              </li>
            ))
          )}
        </ul>
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
        {Icon && <Icon className="w-4 h-4 text-[#456564] dark:text-[#5a7a78]" />}
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

function TeamMemberCard({member: m, showRole = false, currentUserId, onResendInvitation, resendingId}) {
  const isPending = m._pending === true;
  const isCurrentUser = currentUserId != null && String(m.id) === String(currentUserId);
  const hasResend = isPending && m.invitationId && onResendInvitation;
  const displayRole = (() => {
    const r = (m.role ?? "").toLowerCase();
    if (["agent", "admin", "super_admin"].includes(r)) return "Agent";
    if (["homeowner", "owner"].includes(r)) return "Homeowner";
    if (["insurer", "insurance", "insurance agent"].includes(r)) return "Insurance";
    if (["mortgage partner", "mortgage", "mortgage agent"].includes(r)) return "Mortgage";
    return m.role ?? "Member";
  })();

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${
          isPending ? "bg-gray-400 dark:bg-gray-500" : "bg-[#456564] dark:bg-[#5a7a78]"
        }`}
      >
        {isPending
          ? (m.email?.charAt(0)?.toUpperCase() || "?")
          : (m.name?.charAt(0)?.toUpperCase() || m.email?.charAt(0)?.toUpperCase() || "?")}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {m.name || m.email}
          {isCurrentUser && (
            <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(Me)</span>
          )}
        </p>
        {showRole && (
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
      {hasResend && (
        <button
          type="button"
          onClick={() => onResendInvitation(m)}
          disabled={resendingId === m.invitationId}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-[#456564] dark:text-[#5a7a78] hover:underline disabled:opacity-50"
        >
          {resendingId === m.invitationId ? (
            <span className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Resend Invitation Email
        </button>
      )}
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
  onInvite,
  onUpdateAgentPermissions,
  onTransferOwnership,
  initialTab = "owner",
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("homeowner");
  const [homeownerInviteType, setHomeownerInviteType] = useState("co_owner");
  const [permissions, setPermissions] = useState({});
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successType, setSuccessType] = useState(null);
  const [transferOwnershipOpen, setTransferOwnershipOpen] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState("");
  const [resendingId, setResendingId] = useState(null);

  const allSystemIds = useMemo(() => {
    const selectedIds = systems?.selectedSystemIds ?? [];
    const customNames = systems?.customSystemNames ?? [];
    const predefined = selectedIds.length > 0 ? selectedIds : PROPERTY_SYSTEMS.map((s) => s.id);
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
      (contacts ?? []).map((c) => (c.email ?? "").trim().toLowerCase()).filter(Boolean),
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
  const homeownerRestrictionsReadOnly = activeTab === "homeowner" && !isHomeowner;
  const subscriptionTier = (currentUser?.subscriptionTier ?? currentUser?.subscription_tier ?? "free").toLowerCase();
  const maxHomeownerSlots = HOMEOWNER_SLOT_LIMITS[subscriptionTier] ?? HOMEOWNER_SLOT_LIMITS.free;
  const homeownerCount = useMemo(() => {
    return (teamMembers ?? []).filter(
      (m) => (m.role ?? "").toLowerCase() === "homeowner" || m._pending,
    ).length;
  }, [teamMembers]);
  const atHomeownerLimit = maxHomeownerSlots != null && homeownerCount >= maxHomeownerSlots;

  /* Group team members by tab for display */
  const membersByTab = useMemo(() => {
    const groups = {agent: [], homeowner: [], insurance: [], mortgage: []};
    (teamMembers ?? []).forEach((m) => {
      const tab = memberRoleToTab(m);
      if (groups[tab]) groups[tab].push(m);
      else groups.homeowner.push(m);
    });
    return groups;
  }, [teamMembers]);

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
    setEmailError("");

    const emailLower = (effectiveEmail || "").trim().toLowerCase();
    const alreadyInTeam = (teamMembers ?? []).some((m) => {
      const mEmail = (m.email ?? m.inviteeEmail ?? "").trim().toLowerCase();
      return mEmail && mEmail === emailLower;
    });
    if (alreadyInTeam) {
      setEmailError("This person is already on the team or has a pending invitation.");
      return;
    }

    setIsSubmitting(true);
    try {
      const perSystemPerms = {};
      const isViewOnly = activeTab === "homeowner" && homeownerInviteType === "view_only";
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
        role,
        homeownerInviteType: activeTab === "homeowner" ? homeownerInviteType : undefined,
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

  /* Property owner: the team member with property_role "owner" */
  const propertyOwner = useMemo(
    () =>
      (teamMembers ?? []).find(
        (m) =>
          m && (m.property_role ?? m.role ?? "").toLowerCase() === "owner",
      ) ?? null,
    [teamMembers],
  );

  /* Team members excluding the owner (to avoid duplicate display in "All" tab) */
  const teamMembersExcludingOwner = useMemo(() => {
    if (!propertyOwner?.id) return teamMembers ?? [];
    return (teamMembers ?? []).filter(
      (m) => m && String(m.id) !== String(propertyOwner.id),
    );
  }, [teamMembers, propertyOwner?.id]);

  /* Current user is the property owner (can transfer ownership) */
  const isCurrentUserPropertyOwner = useMemo(
    () =>
      propertyOwner &&
      String(propertyOwner.id) === String(currentUser?.id),
    [propertyOwner, currentUser?.id],
  );

  /* Options for transfer ownership: team members excluding current owner (currentUser) */
  const transferOwnerOptions = useMemo(() => {
    const currentUserId = currentUser?.id;
    return (teamMembers ?? [])
      .filter((m) => m && !m._pending && String(m.id) !== String(currentUserId))
      .map((m) => ({id: m.id, name: m.name || m.email || "Unknown"}));
  }, [teamMembers, currentUser?.id]);

  const handleTransferOwnership = useCallback(() => {
    if (!selectedNewOwnerId || !onTransferOwnership) return;
    onTransferOwnership(selectedNewOwnerId);
    setTransferOwnershipOpen(false);
    setSelectedNewOwnerId("");
    setModalOpen(false);
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

  /* Regular agents see only Home Owner tab; admin/super_admin see both Agent and Home Owner; homeowners see both. */
  const isRegularAgent = currentRole === "agent";
  const visibleTabs = useMemo(() => {
    return TABS.filter((tab) => {
      if (tab.id === "agent" && isRegularAgent) return false;
      return true;
    });
  }, [isRegularAgent]);

  return (
    <ModalBlank
      id="share-property-modal"
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-2xl min-w-[24rem] max-h-[90vh] flex flex-col"
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
                {successType === "resend" ? "Invitation email resent!" : "Invite sent successfully!"}
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
                          {(propertyOwner.name || propertyOwner.email)?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {propertyOwner.name || propertyOwner.email || "Unknown"}
                            {String(propertyOwner.id) === String(currentUser?.id) && (
                              <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">(Me)</span>
                            )}
                          </p>
                          {(propertyOwner.email || propertyOwner.inviteeEmail) && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {propertyOwner.email || propertyOwner.inviteeEmail}
                            </p>
                          )}
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-[#456564]/20 dark:bg-[#5a7a78]/30 text-[#456564] dark:text-[#5a7a78] text-xs font-semibold">
                            Owner
                          </span>
                        </div>
                        {onTransferOwnership && isCurrentUserPropertyOwner && transferOwnerOptions.length > 0 && (
                      <div className="shrink-0">
                        {!transferOwnershipOpen ? (
                          <button
                            type="button"
                            onClick={() => setTransferOwnershipOpen(true)}
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
                              onChange={(v) => setSelectedNewOwnerId(v ?? "")}
                              placeholder="Select new owner"
                              name="transfer-owner"
                              id="transfer-owner"
                              clearable
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleTransferOwnership}
                                disabled={!selectedNewOwnerId}
                                className="btn-sm bg-[#456654] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Transfer
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferOwnershipOpen(false);
                                  setSelectedNewOwnerId("");
                                }}
                                className="btn-sm border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
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
                          <TeamMemberCard key={m.id ?? `pending-${m.email}`} member={m} showRole currentUserId={currentUser?.id} onResendInvitation={handleResendInvitation} resendingId={resendingId} />
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
                        Current {TABS.find((t) => t.id === activeTab)?.label?.toLowerCase() ?? "members"}
                      </p>
                      <div className="space-y-2">
                        {(membersByTab[activeTab] ?? []).map((m) => (
                          <TeamMemberCard key={m.id ?? `pending-${m.email}`} member={m} currentUserId={currentUser?.id} onResendInvitation={handleResendInvitation} resendingId={resendingId} />
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "homeowner" && atHomeownerLimit && maxHomeownerSlots != null && (
                    <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300">
                      You&apos;ve reached your plan limit for household members ({homeownerCount} of {maxHomeownerSlots}). Upgrade your plan to add more.
                    </div>
                  )}

                  {activeTab === "agent" && hasAgent && (
                    <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300">
                      An agent has already been added to this property. Only one agent is allowed per property.
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
                  ) : activeTab === "agent" && hasAgent ? (
                    /* Agent already added: message and restrictions shown above; no invite form */
                    null
                  ) : (
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
                      <div className="flex gap-3 flex-wrap">
                        {HOMEOWNER_INVITE_TYPES.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setHomeownerInviteType(opt.id)}
                            disabled={atHomeownerLimit}
                            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                              homeownerInviteType === opt.id
                                ? "bg-[#456564] dark:bg-[#5a7a78] text-white"
                                : "bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            } ${atHomeownerLimit ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <span className="block">{opt.label}</span>
                            <span className={`block text-xs mt-0.5 ${homeownerInviteType === opt.id ? "text-white/90" : "text-gray-500 dark:text-gray-400"}`}>
                              {opt.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="invite-email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                    >
                      Email address
                    </label>
                    <SearchableEmailField
                      contacts={effectiveContacts}
                      value={email}
                      onChange={setEmail}
                      onBlur={handleBlur}
                      placeholder="Search My Contacts or enter email…"
                      error={emailError}
                      aria-label="Invitee email"
                      aria-invalid={!!emailError}
                      disabled={activeTab === "homeowner" && atHomeownerLimit}
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
                {activeTab === "agent" && hasAgent && onUpdateAgentPermissions ? (
                  <button
                    type="button"
                    onClick={handleUpdateAgentPermissions}
                    className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white"
                  >
                    Accept
                  </button>
                ) : null}
                {!(activeTab === "agent" && hasAgent) && !isInsuranceOrMortgageComingSoon && (
                  <button
                    type="button"
                    onClick={handleInvite}
                    disabled={!canSubmit || isSubmitting || (activeTab === "homeowner" && atHomeownerLimit)}
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
    </ModalBlank>
  );
}

export default SharePropertyModal;
