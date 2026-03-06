import React, {useState, useEffect, useMemo, useCallback, useRef} from "react";
import {createPortal} from "react-dom";
import {useParams} from "react-router-dom";
import useCurrentAccount from "../../../hooks/useCurrentAccount";
import {
  X,
  Calendar,
  CheckCircle2,
  Users,
  Search,
  ExternalLink,
  Clock,
  Bell,
  Star,
  MessageSquare,
  Loader2,
  Wrench,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import DatePickerInput from "../../../components/DatePickerInput";
import AppApi from "../../../api/api";

const STEPS = [
  {id: "type", label: "Type"},
  {id: "professional", label: "Professional"},
  {id: "details", label: "Details"},
  {id: "message", label: "Message"},
];

/** Build hash-router URL for opening in new tab. */
function toHashUrl(path) {
  const base = window.location.href.split("#")[0];
  const cleanPath = (path || "").replace(/^\//, "");
  return `${base}#/${cleanPath}`;
}

function generateMessageTemplate(propertyName, systemName, date, scheduleType) {
  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "[date not set]";
  const action =
    scheduleType === "inspection"
      ? "schedule an inspection"
      : "schedule maintenance";
  return `Hi,

I'd like to ${action} for the ${systemName} system at ${propertyName || "my property"}.

Proposed date: ${formattedDate}

Please let me know if this works for you, or suggest an alternative time.

Thank you!`;
}

/* ──────────────────────────── Step Indicator ──────────────────────────── */

/** Fixed slot widths keep circles/labels aligned and avoid over-stretching */
const STEP_SLOT_CLASS = "w-14 sm:w-16 flex-shrink-0";
const CONNECTOR_LINE_CLASS = "w-6 sm:w-8 h-0.5 mx-0.5 sm:mx-1 flex-shrink-0";

function StepIndicator({currentStep, steps}) {
  return (
    <div className="mb-6 flex justify-center">
      <div className="w-full max-w-[320px] sm:max-w-[360px]">
      {/* Circles and connector lines */}
      <div className="flex items-center justify-center">
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          return (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <div
                  className={`${CONNECTOR_LINE_CLASS} transition-colors duration-200 ${
                    idx <= currentStep
                      ? "bg-[#456564]"
                      : "bg-gray-200 dark:bg-gray-600"
                  }`}
                  aria-hidden
                />
              )}
              <div className={`${STEP_SLOT_CLASS} flex justify-center`}>
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
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {/* Labels row - same slot structure as circles for precise alignment */}
      <div className="flex items-start justify-center mt-1.5">
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;
          return (
            <React.Fragment key={step.id}>
              {idx > 0 && <div className={CONNECTOR_LINE_CLASS} aria-hidden />}
              <span
                className={`${STEP_SLOT_CLASS} text-[10px] sm:text-xs font-medium text-center leading-tight block px-1 whitespace-normal break-words ${
                  isActive || isCompleted
                    ? "text-[#456564] dark:text-[#7aa3a2]"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      </div>
    </div>
  );
}

/* ──────────────────── Step 1: Type ──────────────────── */

function TypeStep({scheduleType, setScheduleType}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Is this for an Inspection or Maintenance?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Choose the type of service you need.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setScheduleType("inspection")}
          className={`py-4 px-4 rounded-xl text-sm font-medium border-2 transition-all duration-150 flex flex-col items-center gap-1.5 ${
            scheduleType === "inspection"
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
          onClick={() => setScheduleType("maintenance")}
          className={`py-4 px-4 rounded-xl text-sm font-medium border-2 transition-all duration-150 flex flex-col items-center gap-1.5 ${
            scheduleType === "maintenance"
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

/* ──────────────────── Step 2: Professional ──────────────────── */

function ProfessionalStep({
  hasProfessional,
  setHasProfessional,
  selectedProfessional,
  setSelectedProfessional,
  professionalSearch,
  setProfessionalSearch,
  contacts = [],
  savedProfessionals = [],
  onBrowseDirectory,
  professionalsPath,
}) {
  const triggerRef = useRef(null);
  const [dropdownRect, setDropdownRect] = useState(null);

  const filteredContacts = useMemo(() => {
    if (!contacts?.length) return [];
    let list = contacts;
    if (professionalSearch.trim()) {
      const q = professionalSearch.toLowerCase();
      list = list.filter((c) => c.name?.toLowerCase().includes(q));
    }
    return list;
  }, [contacts, professionalSearch]);

  const filteredSaved = useMemo(() => {
    if (!savedProfessionals?.length) return [];
    let list = savedProfessionals;
    if (professionalSearch.trim()) {
      const q = professionalSearch.toLowerCase();
      list = list.filter(
        (p) =>
          `${p.first_name || ""} ${p.last_name || ""}`
            .toLowerCase()
            .includes(q) || p.company_name?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [savedProfessionals, professionalSearch]);

  const proDisplayName = (p) =>
    p.company_name ||
    `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
    "Professional";

  const [searchFocused, setSearchFocused] = useState(false);
  const hasSearchQuery = professionalSearch.trim().length > 0;
  const suggestedContacts = hasSearchQuery
    ? filteredContacts
    : filteredContacts.slice(0, 2);
  const suggestedSaved = hasSearchQuery
    ? filteredSaved
    : filteredSaved.slice(0, 2);
  const showSearchDropdown =
    searchFocused &&
    (suggestedContacts.length > 0 ||
      suggestedSaved.length > 0 ||
      hasSearchQuery);

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
  }, [showSearchDropdown, suggestedContacts.length, suggestedSaved.length]);

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
                key={`contact-${c.id}`}
                type="button"
                onClick={() => {
                  setSelectedProfessional({
                    id: `contact-${c.id}`,
                    sourceId: c.id,
                    name: c.name,
                    source: "contact",
                  });
                  setProfessionalSearch("");
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
      {suggestedSaved.length > 0 && (
        <div
          className={`px-3 py-1.5 ${suggestedContacts.length > 0 ? "border-t border-gray-100 dark:border-gray-700" : ""}`}
        >
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            Saved Professionals
          </p>
          <div className="mt-1 space-y-0.5">
            {suggestedSaved.map((p) => (
              <button
                key={`pro-${p.id}`}
                type="button"
                onClick={() => {
                  setSelectedProfessional({
                    id: `pro-${p.id}`,
                    sourceId: p.id,
                    name: proDisplayName(p),
                    source: "professional",
                  });
                  setProfessionalSearch("");
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
      {hasSearchQuery &&
        suggestedContacts.length === 0 &&
        suggestedSaved.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
            No matches found. Try a different search or browse the directory.
          </p>
        )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Do you already have a professional?
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select from your contacts or saved professionals, or browse the
          directory.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setHasProfessional(true)}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all duration-150 ${
            hasProfessional === true
              ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2] dark:border-[#7aa3a2] dark:bg-[#7aa3a2]/10"
              : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => {
            setHasProfessional(false);
            setSelectedProfessional(null);
          }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border transition-all duration-150 ${
            hasProfessional === false
              ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2] dark:border-[#7aa3a2] dark:bg-[#7aa3a2]/10"
              : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
          }`}
        >
          No
        </button>
      </div>

      {hasProfessional === true && (
        <div className="space-y-4">
          <div className="relative" ref={triggerRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Search className="w-4 h-4 text-[#456564]" />
                Search My Contacts & Saved Professionals
              </span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={professionalSearch}
                onChange={(e) => setProfessionalSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Search by name..."
                className="form-input w-full pl-9 text-sm"
                autoComplete="off"
              />
            </div>
            {createPortal(dropdownContent, document.body)}
          </div>

          {selectedProfessional && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#456564]/5 dark:bg-[#456564]/10 border border-[#456564]/20 dark:border-[#7aa3a2]/20">
              <CheckCircle2 className="w-5 h-5 text-[#456564] dark:text-[#7aa3a2] flex-shrink-0" />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Selected: {selectedProfessional.name}
              </span>
              <button
                type="button"
                onClick={() => setSelectedProfessional(null)}
                className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {hasProfessional === false && (
        <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-center space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Find a professional in our directory.
          </p>
          <button
            type="button"
            onClick={onBrowseDirectory}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#34514f] text-white transition-colors"
          >
            Browse Professionals Directory
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── Step 3: Scheduling Details ──────────────────── */

function DetailsStep({
  scheduledDate,
  setScheduledDate,
  scheduledTime,
  setScheduledTime,
  scheduleType,
  maintenanceRecommendations = [],
  maintenanceLoading = false,
}) {
  const hasRecommendations =
    scheduleType === "inspection" &&
    Array.isArray(maintenanceRecommendations) &&
    maintenanceRecommendations.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Scheduling Details
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Pick a date and time, add notes, and set a reminder.
        </p>
      </div>

      {scheduleType === "inspection" && (
        <div className="rounded-lg border border-[#456564]/20 dark:border-[#7aa3a2]/30 bg-[#456564]/5 dark:bg-[#456564]/10 p-4">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-[#456564] dark:text-[#7aa3a2]" />
            Suggested inspection scope
          </h4>
          {maintenanceLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading recommendations...
            </p>
          ) : hasRecommendations ? (
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1.5">
              {maintenanceRecommendations.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#456564] dark:text-[#7aa3a2] flex-shrink-0 mt-0.5" />
                  <span>{typeof item === "string" ? item : item.task || item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No specific recommendations yet. Add inspection documents or run AI analysis for tailored suggestions.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#456564]" />
              Date
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
    </div>
  );
}

/* ──────────────────── Step 4: Message your contractor ──────────────────── */

const ALERT_OPTIONS = [
  {id: "1d", label: "1 day before"},
  {id: "3d", label: "3 days before"},
  {id: "1w", label: "1 week before"},
  {id: "2w", label: "2 weeks before"},
];

function MessageStep({
  messageBody,
  setMessageBody,
  alertEnabled,
  setAlertEnabled,
  alertTiming,
  setAlertTiming,
  alertDate,
  setAlertDate,
  alertTime,
  setAlertTime,
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          Message your contractor
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Add a message to send with the scheduling request.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          <span className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#456564]" />
            Message
          </span>
        </label>
        <textarea
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          placeholder="Hi, I'd like to schedule..."
          rows={6}
          className="form-input w-full resize-none text-sm leading-relaxed"
        />
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#456564]" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Set up alert/reminder
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={alertEnabled}
            onClick={() => setAlertEnabled(!alertEnabled)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              alertEnabled ? "bg-[#456564]" : "bg-gray-300 dark:bg-gray-600"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                alertEnabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
        {alertEnabled && (
          <div className="space-y-3 mt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Remind me
              </label>
              <select
                value={alertTiming}
                onChange={(e) => setAlertTiming(e.target.value)}
                className="form-select w-full text-sm"
              >
                {ALERT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Or pick specific date
                </label>
                <DatePickerInput
                  name="alertDate"
                  value={alertDate}
                  onChange={(e) => setAlertDate(e.target.value)}
                  popoverClassName="z-[250]"
                  showOffsetControl
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={alertTime}
                  onChange={(e) => setAlertTime(e.target.value)}
                  className="form-input w-full text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════ Main Modal ═══════════════════════════ */

function getCurrentTimeHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function ScheduleSystemModal({
  isOpen,
  onClose,
  systemLabel,
  systemType,
  contacts = [],
  onSchedule,
  onScheduleSuccess,
  propertyId,
  propertyData = {},
  checklistItemId = null,
}) {
  const {accountUrl: paramAccountUrl} = useParams();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = paramAccountUrl || currentAccount?.url || "";
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [scheduleType, setScheduleType] = useState(null);
  const [hasProfessional, setHasProfessional] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [professionalSearch, setProfessionalSearch] = useState("");
  const [savedProfessionals, setSavedProfessionals] = useState([]);

  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [maintenanceRecommendations, setMaintenanceRecommendations] = useState([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [alertTiming, setAlertTiming] = useState("3d");
  const [alertDate, setAlertDate] = useState("");
  const [alertTime, setAlertTime] = useState("");

  const propertyName =
    propertyData?.propertyName ||
    propertyData?.name ||
    propertyData?.identity?.propertyName ||
    "";
  const professionalsPath = accountUrl
    ? `/${accountUrl}/professionals`
    : "/professionals";

  useEffect(() => {
    if (!isOpen) return;
    AppApi.getSavedProfessionals()
      .then((data) => setSavedProfessionals(data || []))
      .catch(() => setSavedProfessionals([]));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setShowSuccess(false);
      setSaving(false);
      setSubmitError(null);
      setScheduleType(null);
      setHasProfessional(null);
      setSelectedProfessional(null);
      setProfessionalSearch("");
      setScheduledDate("");
      setScheduledTime("");
      setMessageBody("");
      setMaintenanceRecommendations([]);
      setMaintenanceLoading(false);
      setAlertEnabled(true);
      setAlertTiming("3d");
      setAlertDate("");
      setAlertTime("");
    }
  }, [isOpen]);

  /* Fetch maintenance recommendations when scheduling an inspection */
  const propId =
    propertyId ??
    propertyData?.id ??
    propertyData?.identity?.id ??
    propertyData?.property_uid ??
    propertyData?.identity?.property_uid;
  useEffect(() => {
    if (
      !isOpen ||
      scheduleType !== "inspection" ||
      !propId ||
      !systemType ||
      !systemLabel
    ) {
      setMaintenanceRecommendations([]);
      return;
    }
    let cancelled = false;
    setMaintenanceLoading(true);
    AppApi.getAIMaintenanceAdvice(propId, {
      systemType,
      systemName: systemLabel,
      systemContext: {},
    })
      .then((advice) => {
        if (!cancelled && advice?.suggestions?.length) {
          setMaintenanceRecommendations(advice.suggestions);
        } else if (!cancelled) {
          setMaintenanceRecommendations([]);
        }
      })
      .catch(() => {
        if (!cancelled) setMaintenanceRecommendations([]);
      })
      .finally(() => {
        if (!cancelled) setMaintenanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, scheduleType, propId, systemType, systemLabel]);

  const messageTemplateSetRef = useRef(false);
  useEffect(() => {
    if (currentStep === 3 && !messageTemplateSetRef.current) {
      setMessageBody(
        generateMessageTemplate(
          propertyName,
          systemLabel,
          scheduledDate,
          scheduleType,
        ),
      );
      messageTemplateSetRef.current = true;
    }
    if (currentStep !== 3) messageTemplateSetRef.current = false;
  }, [currentStep, scheduledDate, scheduleType, systemLabel, propertyName]);

  const handleBrowseDirectory = useCallback(() => {
    window.open(toHashUrl(professionalsPath), "_blank");
  }, [professionalsPath]);

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
    if (currentStep === 0) return scheduleType !== null;
    if (currentStep === 1) return hasProfessional !== null;
    if (currentStep === 2) return !!scheduledDate;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const effectiveTime = scheduledTime?.trim() || getCurrentTimeHHMM();
    if (scheduledDate && onSchedule) {
      onSchedule(scheduledDate);
    }

    const propId =
      propertyId ??
      propertyData?.id ??
      propertyData?.identity?.id ??
      propertyData?.property_uid ??
      propertyData?.identity?.property_uid;

    if (!propId) {
      setSubmitError(
        "Property could not be identified. Please save the property first and try again.",
      );
      return;
    }

    if (!scheduledDate) {
      setSubmitError("Please select a date.");
      return;
    }

    let alertTimingVal = "3d";
    let alertCustomDaysVal = null;
    if (alertEnabled) {
      if (alertDate) {
        const scheduled = new Date(scheduledDate);
        const alert = new Date(alertDate);
        const diffMs = scheduled - alert;
        const diffDays = Math.max(
          1,
          Math.floor(diffMs / (24 * 60 * 60 * 1000)),
        );
        alertTimingVal = "custom";
        alertCustomDaysVal = diffDays;
      } else {
        alertTimingVal = alertTiming;
      }
    }

    const eventPayload = {
      system_key: systemType || "general",
      system_name: systemLabel,
      contractor_id: selectedProfessional?.sourceId ?? null,
      contractor_source: selectedProfessional?.source ?? null,
      contractor_name: selectedProfessional?.name ?? null,
      scheduled_date: scheduledDate,
      scheduled_time: effectiveTime,
      recurrence_type: "one-time",
      alert_timing: alertEnabled ? alertTimingVal : "3d",
      alert_custom_days: alertCustomDaysVal,
      email_reminder: alertEnabled,
      message_enabled: !!messageBody?.trim(),
      message_body: messageBody?.trim() || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      checklist_item_id: checklistItemId || null,
    };

    setSaving(true);
    try {
      await AppApi.createMaintenanceEvent(propId, eventPayload);
      onScheduleSuccess?.();
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose(false);
      }, 1200);
    } catch (err) {
      console.error("Failed to create maintenance event:", err);
      const msg =
        err?.messages?.[0] ??
        err?.message ??
        "Failed to save. Please try again.";
      setSubmitError(
        typeof msg === "string" ? msg : "Failed to save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (showSuccess) {
    return (
      <ModalBlank
        id="schedule-system-modal"
        modalOpen={isOpen}
        setModalOpen={onClose}
        closeOnClickOutside={false}
        contentClassName="max-w-md"
      >
        <div className="relative p-8 flex flex-col items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              Scheduled!
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {scheduleType === "inspection" ? "Inspection" : "Maintenance"} for{" "}
              {systemLabel}
            </p>
          </div>
        </div>
      </ModalBlank>
    );
  }

  return (
    <ModalBlank
      id="schedule-system-modal"
      modalOpen={isOpen}
      setModalOpen={onClose}
      closeOnClickOutside={false}
      contentClassName="max-w-lg"
    >
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-200 dark:bg-emerald-700/60 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-emerald-800 dark:text-emerald-100" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Schedule
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {systemLabel}
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <StepIndicator currentStep={currentStep} steps={STEPS} />

        <div
          key={currentStep}
          className="min-h-[220px]"
          style={{
            animation: "scheduleStepFadeIn 0.2s ease-out forwards",
          }}
        >
          <style>{`
            @keyframes scheduleStepFadeIn {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {currentStep === 0 && (
            <TypeStep
              scheduleType={scheduleType}
              setScheduleType={setScheduleType}
            />
          )}
          {currentStep === 1 && (
            <ProfessionalStep
              hasProfessional={hasProfessional}
              setHasProfessional={setHasProfessional}
              selectedProfessional={selectedProfessional}
              setSelectedProfessional={setSelectedProfessional}
              professionalSearch={professionalSearch}
              setProfessionalSearch={setProfessionalSearch}
              contacts={contacts}
              savedProfessionals={savedProfessionals}
              onBrowseDirectory={handleBrowseDirectory}
              professionalsPath={professionalsPath}
            />
          )}
          {currentStep === 2 && (
            <DetailsStep
              scheduledDate={scheduledDate}
              setScheduledDate={setScheduledDate}
              scheduledTime={scheduledTime}
              setScheduledTime={setScheduledTime}
              scheduleType={scheduleType}
              maintenanceRecommendations={maintenanceRecommendations}
              maintenanceLoading={maintenanceLoading}
            />
          )}
          {currentStep === 3 && (
            <MessageStep
              messageBody={messageBody}
              setMessageBody={setMessageBody}
              alertEnabled={alertEnabled}
              setAlertEnabled={setAlertEnabled}
              alertTiming={alertTiming}
              setAlertTiming={setAlertTiming}
              alertDate={alertDate}
              setAlertDate={setAlertDate}
              alertTime={alertTime}
              setAlertTime={setAlertTime}
            />
          )}
        </div>

        {submitError && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {submitError}
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleBrowseDirectory}
              className="text-xs text-[#456564] hover:underline font-medium inline-flex items-center gap-1"
            >
              Find a professional in the directory
            </button>
          </div>
          <div className="flex justify-between">
            <button
              type="button"
              onClick={currentStep === 0 ? () => onClose(false) : handleBack}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              {currentStep === 0 ? "Cancel" : "Back"}
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!scheduledDate || saving}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Schedule"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalBlank>
  );
}

export default ScheduleSystemModal;
