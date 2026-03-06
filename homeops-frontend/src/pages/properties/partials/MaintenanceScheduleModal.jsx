import React, {useState, useEffect, useMemo, useCallback, useRef} from "react";
import {createPortal} from "react-dom";
import {useNavigate, useParams} from "react-router-dom";
import {
  X,
  Calendar,
  CheckCircle2,
  Users,
  Search,
  ExternalLink,
  Sparkles,
  Loader2,
  ChevronRight,
  Bell,
  Mail,
  MessageSquare,
  Clock,
  Repeat,
  Star,
  MapPin,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import DatePickerInput from "../../../components/DatePickerInput";
import {
  RECURRENCE_OPTIONS,
  RECURRENCE_UNITS,
  ALERT_TIMING_OPTIONS,
} from "../constants/maintenanceSchedule";
import AppApi from "../../../api/api";

const STEPS = [
  {id: "type", label: "Request Type"},
  {id: "contractor", label: "Contractor"},
  {id: "schedule", label: "Schedule"},
  {id: "message", label: "Message & AI"},
];

/** Build hash-router URL for external links (e.g. window.open). */
function toHashUrl(path) {
  const base = window.location.href.split("#")[0];
  const cleanPath = (path || "").replace(/^\//, "");
  return `${base}#/${cleanPath}`;
}

function generateMessageTemplate(propertyName, systemName, date, requestType) {
  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "[date not set]";
  const action =
    requestType === "inspection"
      ? "schedule an inspection"
      : "schedule maintenance";
  return `Hi,

I'd like to ${action} for the ${systemName} system at ${propertyName || "my property"}.

Proposed date: ${formattedDate}

Please let me know if this works for you, or suggest an alternative time.

Thank you!`;
}

const MOCK_AI_RESPONSE = {
  recommendedFrequency: "Annual inspection recommended",
  riskWarning: null,
  suggestedQuestions: [
    "What is included in a standard maintenance visit?",
    "Do you offer a maintenance plan or service contract?",
    "Are there any signs of wear I should monitor between visits?",
  ],
  suggestions: [],
};

/** Map systemType to propertyData field names for context extraction */
const SYSTEM_FIELD_PREFIXES = {
  roof: "roof",
  gutters: "gutter",
  foundation: "foundation",
  exterior: "siding",
  windows: "window",
  heating: "heating",
  ac: "ac",
  waterHeating: "waterHeating",
  electrical: "electrical",
  plumbing: "plumbing",
  safety: "safety",
  inspections: "inspections",
};

/** Extract system-specific context from propertyData for AI analysis. */
function buildSystemContext(propertyData, systemType) {
  const prefix =
    SYSTEM_FIELD_PREFIXES[systemType] || systemType;
  const merged = { ...propertyData, ...(propertyData?.identity || {}) };
  const context = {};
  const fieldSuffixes = [
    "LastInspection",
    "LastMaintenance",
    "NextInspection",
    "Condition",
    "Issues",
    "InstallDate",
    "Material",
    "Warranty",
    "SystemType",
    "Location",
  ];
  for (const suffix of fieldSuffixes) {
    const key = `${prefix}${suffix}`;
    const val = merged[key];
    if (val != null && String(val).trim() !== "") {
      const contextKey =
        suffix.charAt(0).toLowerCase() + suffix.slice(1);
      context[contextKey] = val;
    }
  }
  return context;
}

/* ──────────────────────────── Step Indicator ──────────────────────────── */

function StepIndicator({currentStep, steps}) {
  const circleSize = 32; // w-8 h-8 = 32px
  const lineVerticalOffset = circleSize / 2; // align line with center of circles

  return (
    <div className="mb-6 flex justify-center">
      <div className="flex items-start justify-center">
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          return (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <div
                  className={`flex-shrink-0 h-0.5 w-4 sm:w-8 mx-0.5 transition-colors duration-200 ${
                    idx <= currentStep
                      ? "bg-[#456564]"
                      : "bg-gray-200 dark:bg-gray-600"
                  }`}
                  style={{marginTop: `${lineVerticalOffset - 1}px`}}
                  aria-hidden
                />
              )}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200 ${
                    isCompleted
                      ? "border-[#456564] bg-[#456564] text-white"
                      : isActive
                        ? "border-[#456564] bg-[#456564] text-white"
                        : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] sm:text-xs font-medium mt-1.5 text-center leading-tight max-w-[72px] truncate ${
                    isActive || isCompleted
                      ? "text-[#456564] dark:text-[#7aa3a2]"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                  title={step.label}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────── Step 0: Request Type ──────────────────── */

function RequestTypeStep({requestType, setRequestType}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          What type of request is this?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose whether you need an inspection or routine maintenance.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setRequestType("inspection")}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium border transition-all duration-150 flex flex-col items-center gap-1.5 ${
            requestType === "inspection"
              ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2] dark:border-[#7aa3a2] dark:bg-[#7aa3a2]/10"
              : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
          }`}
        >
          <span className="font-semibold">Inspection</span>
          <span className="text-xs opacity-90">
            Assess condition, identify issues
          </span>
        </button>
        <button
          type="button"
          onClick={() => setRequestType("maintenance")}
          className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium border transition-all duration-150 flex flex-col items-center gap-1.5 ${
            requestType === "maintenance"
              ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2] dark:border-[#7aa3a2] dark:bg-[#7aa3a2]/10"
              : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
          }`}
        >
          <span className="font-semibold">Maintenance</span>
          <span className="text-xs opacity-90">Routine service, repairs</span>
        </button>
      </div>
    </div>
  );
}

/* ──────────────────── Step 1: Contractor Selection ──────────────────── */

function ContractorStep({
  contacts,
  savedProfessionals,
  savedProfessionalsLoading,
  systemType,
  hasContractor,
  setHasContractor,
  selectedContractor,
  setSelectedContractor,
  contractorSearch,
  setContractorSearch,
  onBrowseDirectory,
  professionalsPath,
}) {
  const filteredContacts = useMemo(() => {
    if (!contacts?.length) return [];
    let list = contacts;
    if (contractorSearch) {
      const q = contractorSearch.toLowerCase();
      list = list.filter((c) => c.name?.toLowerCase().includes(q));
    }
    return list;
  }, [contacts, contractorSearch]);

  const filteredSaved = useMemo(() => {
    if (!savedProfessionals?.length) return [];
    let list = savedProfessionals;
    if (contractorSearch) {
      const q = contractorSearch.toLowerCase();
      list = list.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          p.company_name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [savedProfessionals, contractorSearch]);

  const proDisplayName = (p) =>
    p.company_name || `${p.first_name} ${p.last_name}`;

  const triggerRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isCustomEmail =
    contractorSearch.trim() && emailRegex.test(contractorSearch.trim());
  const suggestedContacts = filteredContacts.slice(0, 2);
  const suggestedFavorites = filteredSaved.slice(0, 2);
  const showSearchDropdown =
    searchFocused &&
    (suggestedContacts.length > 0 ||
      suggestedFavorites.length > 0 ||
      isCustomEmail ||
      (!!contractorSearch &&
        suggestedContacts.length === 0 &&
        suggestedFavorites.length === 0));

  useEffect(() => {
    if (showSearchDropdown && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownRect(null);
    }
  }, [
    showSearchDropdown,
    suggestedContacts.length,
    suggestedFavorites.length,
    isCustomEmail,
  ]);

  const dropdownContent = showSearchDropdown && dropdownRect && (
    <div
      className="fixed py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-[250] max-h-64 overflow-y-auto"
      style={{
        top: dropdownRect.top,
        left: dropdownRect.left,
        width: dropdownRect.width,
        minWidth: 200,
      }}
    >
      {suggestedContacts.length > 0 && (
        <div className="px-3 py-1.5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            My Contacts
          </p>
          <div className="mt-1 space-y-0.5">
            {suggestedContacts.map((c) => (
              <button
                key={`sug-contact-${c.id}`}
                type="button"
                onClick={() => {
                  setSelectedContractor({
                    id: `contact-${c.id}`,
                    sourceId: c.id,
                    name: c.name,
                    source: "contact",
                  });
                  setContractorSearch("");
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                  {c.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {c.name}
                  </p>
                  {(c.phone || c.email) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {c.phone || c.email}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {suggestedFavorites.length > 0 && (
        <div
          className={`px-3 py-1.5 ${suggestedContacts.length > 0 ? "border-t border-gray-100 dark:border-gray-700" : ""}`}
        >
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            Favorite Professionals
          </p>
          <div className="mt-1 space-y-0.5">
            {suggestedFavorites.map((p) => (
              <button
                key={`sug-pro-${p.id}`}
                type="button"
                onClick={() => {
                  setSelectedContractor({
                    id: `pro-${p.id}`,
                    sourceId: p.id,
                    name: proDisplayName(p),
                    source: "professional",
                  });
                  setContractorSearch("");
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-300">
                  {proDisplayName(p)?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {proDisplayName(p)}
                  </p>
                  {p.category_name && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {p.category_name}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      {isCustomEmail && (
        <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              setSelectedContractor({
                id: "custom-email",
                sourceId: null,
                name: contractorSearch.trim(),
                email: contractorSearch.trim(),
                source: "custom",
              });
              setContractorSearch("");
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#456564]/20 flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-[#456564] dark:text-[#7aa3a2]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Use email: {contractorSearch.trim()}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add as contractor (not in contacts)
              </p>
            </div>
          </button>
        </div>
      )}
      {contractorSearch &&
        suggestedContacts.length === 0 &&
        suggestedFavorites.length === 0 &&
        !isCustomEmail && (
          <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            No matches. Type a valid email to add as contractor.
          </p>
        )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Assign a Contractor
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Do you already have a contractor for this system?
        </p>
      </div>

      {/* Toggle */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setHasContractor(true)}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all duration-150 ${
            hasContractor === true
              ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2] dark:border-[#7aa3a2] dark:bg-[#7aa3a2]/10"
              : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
          }`}
        >
          Yes, I have one
        </button>
        <button
          type="button"
          onClick={() => {
            setHasContractor(false);
            setSelectedContractor(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all duration-150 ${
            hasContractor === false
              ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2] dark:border-[#7aa3a2] dark:bg-[#7aa3a2]/10"
              : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
          }`}
        >
          No
        </button>
      </div>

      {/* "Yes" flow — pick from contacts or favorites */}
      {hasContractor === true && (
        <div className="space-y-4">
          {/* Search bar with dropdown suggestions */}
          <div className="relative" ref={triggerRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Search className="w-4 h-4 text-[#456564]" />
                Search My Contacts & Favorite Professionals
              </span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={contractorSearch}
                onChange={(e) => setContractorSearch(e.target.value)}
                onFocus={(e) => {
                  setSearchFocused(true);
                  e.target.select?.();
                }}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Search by name or type any email..."
                className="form-input w-full pl-9 text-sm"
                autoComplete="off"
              />
            </div>
            {createPortal(dropdownContent, document.body)}
          </div>

          {/* Selected contractor display */}
          {selectedContractor && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#456564]/5 dark:bg-[#456564]/10 border border-[#456564]/20 dark:border-[#7aa3a2]/20">
              <CheckCircle2 className="w-5 h-5 text-[#456564] dark:text-[#7aa3a2] flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Selected: {selectedContractor.name}
              </span>
              <button
                type="button"
                onClick={() => setSelectedContractor(null)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
              >
                Clear
              </button>
            </div>
          )}

          {/* Browse Directory */}
          <button
            type="button"
            onClick={() =>
              window.open(
                toHashUrl(professionalsPath || "/professionals"),
                "_blank",
              )
            }
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#456564] dark:text-[#7aa3a2] hover:underline"
          >
            Browse Directory
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* "No" flow — offer to browse the directory */}
      {hasContractor === false && (
        <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-center space-y-3">
          <MapPin className="w-8 h-8 text-[#456564] dark:text-[#7aa3a2] mx-auto" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Would you like to find one in our professional directory?
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Browse verified contractors and save them to your favorites for next
            time.
          </p>
          <button
            type="button"
            onClick={onBrowseDirectory}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#34514f] text-white transition-colors"
          >
            Browse Directory
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── Step 2: Schedule & Alerts ──────────────────── */

function ScheduleStep({
  scheduledDate,
  setScheduledDate,
  scheduledTime,
  setScheduledTime,
  recurrenceType,
  setRecurrenceType,
  customIntervalValue,
  setCustomIntervalValue,
  customIntervalUnit,
  setCustomIntervalUnit,
  alertTiming,
  setAlertTiming,
  alertCustomDays,
  setAlertCustomDays,
  emailReminder,
  setEmailReminder,
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Schedule Details
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pick a date and configure recurrence and reminders.
        </p>
      </div>

      {/* Date & Time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#456564]" />
              Maintenance Date
            </span>
          </label>
          <DatePickerInput
            name="scheduledDate"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            popoverClassName="z-[250]"
            showOffsetControl
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#456564]" />
              Time (optional)
            </span>
          </label>
          <input
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="form-input w-full"
          />
        </div>
      </div>

      {/* Recurrence */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          <span className="flex items-center gap-1.5">
            <Repeat className="w-4 h-4 text-[#456564]" />
            Recurrence
          </span>
        </label>
        <select
          value={recurrenceType}
          onChange={(e) => setRecurrenceType(e.target.value)}
          className="form-select w-full"
        >
          {RECURRENCE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        {recurrenceType === "custom" && (
          <div className="flex items-center gap-3 mt-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Every
            </span>
            <input
              type="number"
              min="1"
              max="365"
              value={customIntervalValue}
              onChange={(e) =>
                setCustomIntervalValue(
                  Math.max(1, parseInt(e.target.value) || 1),
                )
              }
              className="form-input w-20 text-center"
            />
            <select
              value={customIntervalUnit}
              onChange={(e) => setCustomIntervalUnit(e.target.value)}
              className="form-select w-28"
            >
              {RECURRENCE_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          <span className="flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-[#456564]" />
            Reminder
          </span>
        </label>
        <select
          value={alertTiming}
          onChange={(e) => setAlertTiming(e.target.value)}
          className="form-select w-full"
        >
          {ALERT_TIMING_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        {alertTiming === "custom" && (
          <div className="flex items-center gap-3 mt-3">
            <input
              type="number"
              min="1"
              max="90"
              value={alertCustomDays}
              onChange={(e) =>
                setAlertCustomDays(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="form-input w-20 text-center"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              days before
            </span>
          </div>
        )}

        {/* Email reminder */}
        <div className="flex items-center justify-between mt-4 py-3 px-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email reminder
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Coming soon
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled
            onClick={() => setEmailReminder(!emailReminder)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-not-allowed opacity-50 ${
              emailReminder ? "bg-[#456564]" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                emailReminder ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── Step 3: Message & AI Assist ──────────────────── */

function MessageStep({
  selectedContractor,
  messageEnabled,
  setMessageEnabled,
  messageBody,
  setMessageBody,
  aiAdvice,
  aiLoading,
  onRequestAI,
  showAI,
  setShowAI,
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Message & AI Assist
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {selectedContractor
            ? "Optionally send a message to your contractor and get AI recommendations."
            : "Get AI-powered maintenance recommendations for this system."}
        </p>
      </div>

      {/* Messaging */}
      {selectedContractor && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-[#456564]" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Send message to {selectedContractor.name}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMessageEnabled(!messageEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
                messageEnabled ? "bg-[#456564]" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200 ${
                  messageEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {messageEnabled && (
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={6}
              className="form-input w-full text-sm leading-relaxed"
            />
          )}
        </div>
      )}

      {/* AI Assist */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
        <button
          type="button"
          onClick={() => {
            setShowAI(!showAI);
            if (!showAI && !aiAdvice) onRequestAI();
          }}
          className="flex items-center gap-2.5 text-sm font-medium text-[#456564] dark:text-[#7aa3a2] hover:underline"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#456564]/15 to-[#456564]/5 dark:from-[#456564]/25 dark:to-[#456564]/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          AI Maintenance Advisor
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-200 ${showAI ? "rotate-90" : ""}`}
          />
        </button>

        {showAI && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 space-y-4">
            {aiLoading ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#456564]" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Analyzing system data...
                </span>
              </div>
            ) : aiAdvice ? (
              <>
                {/* Recommended frequency */}
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Repeat className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      Recommended Frequency
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {aiAdvice.recommendedFrequency}
                    </p>
                  </div>
                </div>

                {/* Risk warning */}
                {aiAdvice.riskWarning && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50">
                    <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bell className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Attention
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {aiAdvice.riskWarning}
                      </p>
                    </div>
                  </div>
                )}

                {/* AI suggestions: Replace X, maintain Y */}
                {aiAdvice.suggestions?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                      Based on Your System
                    </p>
                    <ul className="space-y-1.5">
                      {aiAdvice.suggestions.map((s, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                        >
                          <span className="text-[#456564] dark:text-[#7aa3a2] mt-0.5 flex-shrink-0">
                            •
                          </span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggested questions */}
                {aiAdvice.suggestedQuestions?.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                      Suggested Questions for Your Contractor
                    </p>
                    <ul className="space-y-1.5">
                      {aiAdvice.suggestedQuestions.map((q, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
                        >
                          <span className="text-[#456564] dark:text-[#7aa3a2] mt-0.5">
                            •
                          </span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onRequestAI}
                className="w-full py-3 text-sm font-medium text-[#456564] dark:text-[#7aa3a2] hover:bg-[#456564]/5 rounded-lg transition-colors"
              >
                Get AI Recommendations
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────── Success Overlay (reuses SchedulePopover pattern) ───────────────── */

function SuccessOverlay() {
  return (
    <>
      <style>{`
        @keyframes msmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes msmScaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-800/95 rounded-lg z-10"
        style={{animation: "msmFadeIn 0.2s ease-out forwards"}}
      >
        <div
          className="flex flex-col items-center gap-3"
          style={{
            animation:
              "msmScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s forwards",
          }}
        >
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            Maintenance scheduled!
          </p>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════ Main Modal ═══════════════════════════ */

function MaintenanceScheduleModal({
  isOpen,
  onClose,
  systemType,
  systemLabel,
  propertyData = {},
  propertyIdFallback,
  contacts = [],
  onSchedule,
  initialScheduledDate = "",
  initialScheduledTime = "",
  embedded = false,
}) {
  const navigate = useNavigate();
  const {accountUrl} = useParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Step 0 state
  const [requestType, setRequestType] = useState(null);
  // Step 1 state
  const [hasContractor, setHasContractor] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [contractorSearch, setContractorSearch] = useState("");
  const [savedProfessionals, setSavedProfessionals] = useState([]);
  const [savedProfessionalsLoading, setSavedProfessionalsLoading] =
    useState(false);

  // Step 2 state
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("one-time");
  const [customIntervalValue, setCustomIntervalValue] = useState(3);
  const [customIntervalUnit, setCustomIntervalUnit] = useState("months");
  const [alertTiming, setAlertTiming] = useState("3d");
  const [alertCustomDays, setAlertCustomDays] = useState(5);
  const [emailReminder, setEmailReminder] = useState(false);

  // Step 3 state
  const [messageEnabled, setMessageEnabled] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const propertyName =
    propertyData.propertyName ||
    propertyData.name ||
    propertyData.identity?.propertyName ||
    "";
  const propertyLocation =
    propertyData.address || propertyData.identity?.address || "";
  const professionalsPath = accountUrl
    ? `/${accountUrl}/professionals`
    : "/professionals";

  useEffect(() => {
    if (!isOpen) return;
    setSavedProfessionalsLoading(true);
    AppApi.getSavedProfessionals()
      .then((data) => setSavedProfessionals(data || []))
      .catch(() => setSavedProfessionals([]))
      .finally(() => setSavedProfessionalsLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setShowSuccess(false);
      setSaving(false);
      setRequestType(null);
      setHasContractor(null);
      setSelectedContractor(null);
      setContractorSearch("");
      setScheduledDate(initialScheduledDate || "");
      setScheduledTime(initialScheduledTime || "");
      setRecurrenceType("one-time");
      setCustomIntervalValue(3);
      setCustomIntervalUnit("months");
      setAlertTiming("3d");
      setAlertCustomDays(5);
      setEmailReminder(false);
      setMessageEnabled(false);
      setMessageBody("");
      setShowAI(false);
      setAiAdvice(null);
      setAiLoading(false);
    }
  }, [isOpen, initialScheduledDate, initialScheduledTime]);

  // Update message template when dependencies change
  useEffect(() => {
    if (messageEnabled || currentStep === 3) {
      setMessageBody(
        generateMessageTemplate(
          propertyName,
          systemLabel,
          scheduledDate,
          requestType,
        ),
      );
    }
  }, [selectedContractor, scheduledDate, currentStep, requestType]);

  const propertyId =
    propertyData?.id ??
    propertyData?.property_uid ??
    propertyData?.identity?.id ??
    propertyIdFallback;

  const requestAIAdvice = useCallback(async () => {
    if (!propertyId) {
      setAiAdvice(MOCK_AI_RESPONSE);
      return;
    }
    setAiLoading(true);
    try {
      const systemContext = buildSystemContext(propertyData, systemType);
      const advice = await AppApi.getAIMaintenanceAdvice(propertyId, {
        systemType,
        systemName: systemLabel,
        systemContext,
      });
      setAiAdvice({
        ...MOCK_AI_RESPONSE,
        ...advice,
        suggestions: advice.suggestions ?? [],
      });
    } catch {
      setAiAdvice(MOCK_AI_RESPONSE);
    } finally {
      setAiLoading(false);
    }
  }, [propertyId, systemType, systemLabel, propertyData]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const canAdvance = () => {
    if (currentStep === 0) return requestType !== null;
    if (currentStep === 1) return hasContractor !== null;
    if (currentStep === 2) return !!scheduledDate;
    return true;
  };

  const handleSave = async () => {
    if (scheduledDate && onSchedule) {
      onSchedule(scheduledDate);
    }

    const eventPayload = {
      system_key: systemType,
      system_name: systemLabel,
      contractor_id: selectedContractor?.sourceId ?? null,
      contractor_source: selectedContractor?.source ?? null,
      contractor_name: selectedContractor?.name ?? null,
      scheduled_date: scheduledDate,
      scheduled_time: (() => {
        const t = scheduledTime?.trim();
        if (t) return t;
        const n = new Date();
        return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
      })(),
      recurrence_type: recurrenceType,
      recurrence_interval_value:
        recurrenceType === "custom" ? customIntervalValue : null,
      recurrence_interval_unit:
        recurrenceType === "custom" ? customIntervalUnit : null,
      alert_timing: alertTiming,
      alert_custom_days: alertTiming === "custom" ? alertCustomDays : null,
      email_reminder: emailReminder,
      message_enabled: messageEnabled && !!selectedContractor,
      message_body: messageEnabled ? messageBody : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    setSaving(true);
    try {
      await AppApi.createMaintenanceEvent(propertyId, eventPayload);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose(true);
      }, 1400);
    } catch (err) {
      console.error("Failed to create maintenance event:", err);
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div className="relative p-6">
      {showSuccess && <SuccessOverlay />}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-800/40 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Schedule Maintenance
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {systemLabel}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onClose(false)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="pt-4 pb-2">
        <StepIndicator currentStep={currentStep} steps={STEPS} />
      </div>

      {/* Step content */}
      <div className="min-h-[280px]">
        {currentStep === 0 && (
          <RequestTypeStep
            requestType={requestType}
            setRequestType={setRequestType}
          />
        )}
        {currentStep === 1 && (
          <ContractorStep
            contacts={contacts}
            savedProfessionals={savedProfessionals}
            savedProfessionalsLoading={savedProfessionalsLoading}
            systemType={systemType}
            hasContractor={hasContractor}
            setHasContractor={setHasContractor}
            selectedContractor={selectedContractor}
            setSelectedContractor={setSelectedContractor}
            contractorSearch={contractorSearch}
            setContractorSearch={setContractorSearch}
            onBrowseDirectory={() => {
              onClose(false);
              navigate(professionalsPath || "/professionals", {replace: false});
            }}
            professionalsPath={professionalsPath}
          />
        )}
        {currentStep === 2 && (
          <ScheduleStep
            scheduledDate={scheduledDate}
            setScheduledDate={setScheduledDate}
            scheduledTime={scheduledTime}
            setScheduledTime={setScheduledTime}
            recurrenceType={recurrenceType}
            setRecurrenceType={setRecurrenceType}
            customIntervalValue={customIntervalValue}
            setCustomIntervalValue={setCustomIntervalValue}
            customIntervalUnit={customIntervalUnit}
            setCustomIntervalUnit={setCustomIntervalUnit}
            alertTiming={alertTiming}
            setAlertTiming={setAlertTiming}
            alertCustomDays={alertCustomDays}
            setAlertCustomDays={setAlertCustomDays}
            emailReminder={emailReminder}
            setEmailReminder={setEmailReminder}
          />
        )}
        {currentStep === 3 && (
          <MessageStep
            selectedContractor={selectedContractor}
            messageEnabled={messageEnabled}
            setMessageEnabled={setMessageEnabled}
            messageBody={messageBody}
            setMessageBody={setMessageBody}
            aiAdvice={aiAdvice}
            aiLoading={aiLoading}
            onRequestAI={requestAIAdvice}
            showAI={showAI}
            setShowAI={setShowAI}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
        <div>
          {currentStep > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance()}
              className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!scheduledDate || saving}
              className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Schedule"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <ModalBlank
      id="maintenance-schedule-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      closeOnClickOutside={false}
      contentClassName="max-w-2xl"
    >
      {content}
    </ModalBlank>
  );
}

export default MaintenanceScheduleModal;
