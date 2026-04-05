import React, {useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect} from "react";
import {createPortal} from "react-dom";
import {
  UserPlus,
  Send,
  Check,
  ChevronDown,
  X,
  Search,
  AlertCircle,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import AppApi from "../../../api/api";

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const MAX_DROPDOWN_ITEMS = 6;

function AgentSearchField({
  agents,
  value,
  onChange,
  onSelectAgent,
  placeholder = "Search agents or enter email...",
  disabled = false,
  error,
}) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const dropdownRef = useRef(null);

  const agentsWithEmail = useMemo(
    () => (agents || []).filter((a) => a.email?.trim()),
    [agents],
  );

  const filtered = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    if (!term) return agentsWithEmail.slice(0, MAX_DROPDOWN_ITEMS);
    return agentsWithEmail
      .filter((a) => {
        const name = (a.name || "").toLowerCase();
        const email = (a.email || "").toLowerCase();
        return name.includes(term) || email.includes(term);
      })
      .slice(0, MAX_DROPDOWN_ITEMS);
  }, [agentsWithEmail, inputValue]);

  const allEmails = useMemo(() => {
    const set = new Set();
    agentsWithEmail.forEach((a) => set.add((a.email || "").trim().toLowerCase()));
    return set;
  }, [agentsWithEmail]);

  const showCustomOption =
    inputValue.trim() &&
    EMAIL_REGEX.test(inputValue.trim()) &&
    !allEmails.has(inputValue.trim().toLowerCase());

  const flatOptions = useMemo(() => {
    const items = [...filtered];
    if (showCustomOption) {
      items.push({
        id: "__custom__",
        email: inputValue.trim(),
        name: `Use "${inputValue.trim()}"`,
        isCustom: true,
      });
    }
    return items;
  }, [filtered, showCustomOption, inputValue]);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target))
      ) {
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
    (item) => {
      const email = item.email?.trim() || "";
      setInputValue(email);
      onChange(email);
      if (!item.isCustom) {
        onSelectAgent?.(item);
      }
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onChange, onSelectAgent],
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
      setHighlightIndex((i) => (i < flatOptions.length - 1 ? i + 1 : i));
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowUp") {
      setHighlightIndex((i) => (i > 0 ? i - 1 : -1));
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" && highlightIndex >= 0 && flatOptions[highlightIndex]) {
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

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Agent email"
          className={`form-input w-full pr-9 ${
            error ? "border-red-500 dark:border-red-500" : ""
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-500 dark:text-red-400" role="alert">
          {error}
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
                  ? "No matching agents. Type a full email address."
                  : "No agents available."}
              </li>
            ) : (
              flatOptions.map((item, idx) => {
                const isHighlighted = highlightIndex === idx;
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
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(item);
                      }}
                    >
                      {item.name}
                    </li>
                  );
                }

                const imgUrl = item.image_url || item.avatarUrl || item.avatar_url;
                return (
                  <li
                    key={item.id || idx}
                    role="option"
                    aria-selected={isHighlighted}
                    className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${
                      isHighlighted
                        ? "bg-[#456564]/10 dark:bg-[#5a7a78]/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(item);
                    }}
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#456564] dark:bg-[#5a7a78] flex items-center justify-center text-white text-xs font-semibold shrink-0">
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
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#456564]/10 dark:bg-[#5a7a78]/20 text-[#456564] dark:text-[#5a7a78] shrink-0">
                      Agent
                    </span>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}

function BulkInviteModal({
  modalOpen,
  setModalOpen,
  selectedProperties = [],
  currentAccount,
}) {
  const [agents, setAgents] = useState([]);
  const [email, setEmail] = useState("");
  const [selectedAgentName, setSelectedAgentName] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [removedIds, setRemovedIds] = useState(new Set());
  const agentDropdownRef = useRef(null);

  const visibleProperties = useMemo(
    () => selectedProperties.filter((p) => !removedIds.has(p.id)),
    [selectedProperties, removedIds],
  );

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    AppApi.getAgents()
      .then((list) => {
        if (!cancelled) setAgents(list ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (modalOpen) {
      setEmail("");
      setSelectedAgentName("");
      setEmailError("");
      setIsSubmitting(false);
      setResults(null);
      setRemovedIds(new Set());
    }
  }, [modalOpen]);

  const effectiveEmail = email?.trim() || "";
  const isValidEmail = EMAIL_REGEX.test(effectiveEmail);
  const canSubmit = isValidEmail && visibleProperties.length > 0 && !emailError;

  const handleRemoveProperty = useCallback((id) => {
    setRemovedIds((prev) => new Set([...prev, id]));
  }, []);

  const handleBlur = useCallback(() => {
    if (effectiveEmail && !EMAIL_REGEX.test(effectiveEmail)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  }, [effectiveEmail]);

  const handleSendInvites = async () => {
    if (!canSubmit || isSubmitting) return;
    setEmailError("");
    setIsSubmitting(true);

    const accountId = currentAccount?.id;
    const succeeded = [];
    const failed = [];

    for (const prop of visibleProperties) {
      /* API expects DB integer id (property_users.property_id), not property_uid string */
      const propertyId = prop.id;
      try {
        await AppApi.createInvitation({
          type: "property",
          inviteeEmail: effectiveEmail,
          inviteeName: selectedAgentName || undefined,
          accountId,
          propertyId,
          intendedRole: "agent",
        });
        succeeded.push(prop);
      } catch (err) {
        failed.push({
          property: prop,
          error: err?.message || "Failed to send invitation",
        });
      }
    }

    setResults({succeeded, failed});
    setIsSubmitting(false);
  };

  const showResults = results !== null;

  return (
    <ModalBlank
      id="bulk-invite-modal"
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-2xl min-w-[24rem] max-h-[90vh] flex flex-col"
      ignoreClickRefs={[agentDropdownRef]}
    >
      <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
        {showResults ? (
          <div className="p-6 flex flex-col items-center gap-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center ${
                results.failed.length === 0
                  ? "bg-[#456564]/20 dark:bg-[#5a7a78]/30"
                  : "bg-amber-100 dark:bg-amber-500/20"
              }`}
            >
              {results.failed.length === 0 ? (
                <Check className="w-8 h-8 text-[#456564] dark:text-[#5a7a78]" />
              ) : (
                <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <div className="text-center">
              {results.succeeded.length > 0 && (
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  {results.succeeded.length}{" "}
                  {results.succeeded.length === 1 ? "invitation" : "invitations"}{" "}
                  sent successfully!
                </p>
              )}
              {results.failed.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {results.failed.length}{" "}
                    {results.failed.length === 1 ? "invitation" : "invitations"}{" "}
                    failed:
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                    {results.failed.map((f, i) => (
                      <li key={i} className="truncate">
                        <span className="font-medium">
                          {f.property.property_name ||
                            f.property.propertyName ||
                            f.property.address ||
                            f.property.passport_id}
                        </span>
                        : {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white mt-2"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 pb-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#456564]/10 dark:bg-[#5a7a78]/20 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Bulk Invite Agent
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Invite an agent to {visibleProperties.length}{" "}
                    {visibleProperties.length === 1 ? "property" : "properties"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-0 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Agent
                </label>
                <AgentSearchField
                  agents={agents}
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    setEmailError("");
                  }}
                  onSelectAgent={(agent) =>
                    setSelectedAgentName((agent.name || "").trim())
                  }
                  placeholder="Search agents or enter email..."
                  disabled={isSubmitting}
                  error={emailError}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Properties ({visibleProperties.length})
                </label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400">
                            Property
                          </th>
                          <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                            Address
                          </th>
                          <th className="w-10 px-2 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                        {visibleProperties.map((prop) => (
                          <tr
                            key={prop.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                          >
                            <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                              <div className="font-medium truncate max-w-[200px]">
                                {prop.property_name ||
                                  prop.propertyName ||
                                  prop.nickname ||
                                  prop.passport_id ||
                                  "Unnamed"}
                              </div>
                              {prop.passport_id && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {prop.passport_id}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                              <span className="truncate block max-w-[250px]">
                                {[prop.address, prop.city, prop.state]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </span>
                            </td>
                            <td className="px-2 py-2.5">
                              <button
                                type="button"
                                onClick={() => handleRemoveProperty(prop.id)}
                                disabled={isSubmitting}
                                className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                aria-label="Remove property"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {visibleProperties.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                            >
                              No properties selected
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={isSubmitting}
                className="btn border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendInvites}
                onMouseDown={handleBlur}
                disabled={!canSubmit || isSubmitting}
                className="btn bg-[#456564] hover:bg-[#3d5857] dark:bg-[#5a7a78] dark:hover:bg-[#4d6a68] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Send {visibleProperties.length}{" "}
                    {visibleProperties.length === 1 ? "invite" : "invites"}
                    <Send className="w-4 h-4" />
                  </span>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalBlank>
  );
}

export default BulkInviteModal;
