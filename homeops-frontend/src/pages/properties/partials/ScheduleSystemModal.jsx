import React, {useState, useEffect, useMemo, useCallback, useRef} from "react";
import {createPortal} from "react-dom";
import {useParams} from "react-router-dom";
import useCurrentAccount from "../../../hooks/useCurrentAccount";
import {useAuth} from "../../../context/AuthContext";
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
  Loader2,
  Wrench,
  Mail,
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

function coerceContractorId(sourceId) {
  if (sourceId == null || sourceId === "") return null;
  if (typeof sourceId === "number" && Number.isInteger(sourceId)) return sourceId;
  const n = parseInt(String(sourceId), 10);
  return Number.isFinite(n) ? n : null;
}

/** Build URL for opening in new tab (BrowserRouter). */
function toShareUrl(path) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const cleanPath = (path || "").replace(/^\//, "");
  return `${origin}/${cleanPath}`;
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

/** Fixed slot widths keep circles/labels aligned — wide enough for "Professional" */
const STEP_SLOT_CLASS = "w-20 sm:w-24 flex-shrink-0";
const CONNECTOR_LINE_CLASS = "w-8 sm:w-10 h-0.5 mx-1 sm:mx-2 flex-shrink-0";

function StepIndicator({currentStep, steps}) {
  return (
    <div className="mb-6 flex justify-center">
      <div className="w-full max-w-[420px] sm:max-w-[480px]">
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
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      idx + 1
                    )}
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
                {idx > 0 && (
                  <div className={CONNECTOR_LINE_CLASS} aria-hidden />
                )}
                <span
                  className={`${STEP_SLOT_CLASS} text-[10px] sm:text-xs font-medium text-center leading-tight block px-0.5 whitespace-nowrap ${
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
                    email: c.email || null,
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
                    email: p.email || null,
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
  checklistItems = [],
  selectedChecklistItemId,
  setSelectedChecklistItemId,
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
          Choose a date to continue (required). Time is optional; reminder options
          are on the next step.
        </p>
      </div>

      {(() => {
        const pendingItems = checklistItems.filter(
          (item) => (item.status || "").toLowerCase() !== "completed"
        );
        return pendingItems.length > 0;
      })() && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Link to ToDo
          </label>
          <select
            value={selectedChecklistItemId ?? ""}
            onChange={(e) =>
              setSelectedChecklistItemId(e.target.value || null)
            }
            className="form-select w-full"
          >
            <option value="">None — general event</option>
            {checklistItems
              .filter(
                (item) => (item.status || "").toLowerCase() !== "completed"
              )
              .map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
                {item.priority && item.priority !== "medium"
                  ? ` (${item.priority})`
                  : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            Link this event to an inspection checklist item
          </p>
        </div>
      )}

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
                  <span>
                    {typeof item === "string" ? item : item.task || item}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No specific recommendations yet. Add inspection documents or run
              AI analysis for tailored suggestions.
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
              <span className="text-red-500 dark:text-red-400 font-normal" aria-hidden>
                *
              </span>
              <span className="sr-only">(required)</span>
            </span>
          </label>
          <DatePickerInput
            name="scheduledDate"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            popoverClassName="z-[250]"
            showOffsetControl
            required
          />
          {!scheduledDate?.trim() && (
            <p className="mt-1.5 text-xs text-amber-800/90 dark:text-amber-200/90">
              Select a date to enable Next.
            </p>
          )}
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

function formatTimeForPreview(time) {
  if (!time) return "";
  const [h, m] = (time || "").split(":");
  const hour = parseInt(h, 10);
  if (isNaN(hour)) return time;
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m || "00"} ${ampm}`;
}

function EmailPreview({
  contractorName,
  contractorEmail,
  propertyAddress,
  systemName,
  scheduledDate,
  scheduledTime,
  scheduleType,
  messageBody,
  setMessageBody,
  senderName,
  replyEmail,
}) {
  const defaultWording = useMemo(
    () =>
      generateMessageTemplate(
        propertyAddress,
        systemName,
        scheduledDate,
        scheduleType,
      ),
    [propertyAddress, systemName, scheduledDate, scheduleType],
  );
  const displayBody =
    messageBody != null && String(messageBody).trim() !== ""
      ? messageBody
      : defaultWording;

  const formattedDate = scheduledDate
    ? new Date(scheduledDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "[date not set]";
  const formattedTime = formatTimeForPreview(scheduledTime);

  return (
    <div className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 shrink-0">
        <Mail className="w-4 h-4 text-[#456564] flex-shrink-0" />
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Email Preview
        </span>
      </div>
      <div className="p-4 text-sm flex flex-col gap-3 overflow-hidden">
        <div className="space-y-1 text-gray-600 dark:text-gray-400 shrink-0">
          <p>
            <span className="font-medium text-gray-500 dark:text-gray-500">To:</span>{" "}
            {contractorEmail ? (
              <>
                {contractorName || "Contractor"}
                <span className="text-gray-400"> &lt;{contractorEmail}&gt;</span>
              </>
            ) : (
              <span className="italic">No contractor selected</span>
            )}
          </p>
          {replyEmail && (
            <p>
              <span className="font-medium text-gray-500 dark:text-gray-500">Reply-To:</span>{" "}
              {replyEmail}
            </p>
          )}
          <p>
            <span className="font-medium text-gray-500 dark:text-gray-500">Subject:</span>{" "}
            Service scheduled — {systemName || "Maintenance"}
            {propertyAddress ? ` at ${propertyAddress}` : ""}
          </p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-600 pt-3 flex flex-col gap-4 shrink-0">
          <textarea
            value={displayBody}
            onChange={(e) => setMessageBody(e.target.value)}
            placeholder="Hi, I'd like to schedule..."
            rows={10}
            className="form-input w-full resize-y text-sm leading-relaxed min-h-[200px] max-h-96 overflow-y-auto border-gray-200 dark:border-gray-600"
          />
          {(propertyAddress || systemName || formattedDate) && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 text-xs space-y-1">
              {propertyAddress && <p><span className="font-medium">Property:</span> {propertyAddress}</p>}
              {systemName && <p><span className="font-medium">System:</span> {systemName}</p>}
              <p><span className="font-medium">Date:</span> {formattedDate}{formattedTime ? ` at ${formattedTime}` : ""}</p>
              {senderName && <p><span className="font-medium">Requested by:</span> {senderName}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageStep({
  messageBody,
  setMessageBody,
  replyEmail,
  setReplyEmail,
  alertEnabled,
  setAlertEnabled,
  alertTiming,
  setAlertTiming,
  alertDate,
  setAlertDate,
  alertTime,
  setAlertTime,
  selectedProfessional,
  propertyName,
  systemLabel,
  scheduledDate,
  scheduledTime,
  scheduleType,
  senderName,
  maintenanceRecommendations = [],
  maintenanceLoading = false,
  sendEmail,
  setSendEmail,
}) {
  const propertyAddress = propertyName; // Could be expanded with full address
  const hasRecommendations =
    scheduleType === "inspection" &&
    Array.isArray(maintenanceRecommendations) &&
    maintenanceRecommendations.length > 0;

  return (
    <div className="space-y-5">
      {/* ── Email toggle ── */}
      <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#456564]/10 dark:bg-[#7aa3a2]/10 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-[#456564] dark:text-[#7aa3a2]" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block leading-snug">
              Email contractor
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
              Notify when scheduling
            </span>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sendEmail}
          onClick={() => setSendEmail(!sendEmail)}
          className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
            sendEmail ? "bg-[#456564]" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              sendEmail ? "left-6" : "left-1"
            }`}
          />
        </button>
      </div>

      {/* ── Collapsible email content ── */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{gridTemplateRows: sendEmail ? "1fr" : "0fr"}}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className={`grid grid-cols-1 lg:grid-cols-12 gap-6 pb-1 transition-opacity duration-300 ${
              sendEmail ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="lg:col-span-4 min-w-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Reply-to email
              </label>
              <input
                type="email"
                value={replyEmail}
                onChange={(e) => setReplyEmail(e.target.value)}
                placeholder="your@email.com"
                className="form-input w-full text-sm"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Contractors will reply to this address instead of no-reply.
              </p>
            </div>
            <div className="lg:col-span-8 min-w-0 flex flex-col">
              <EmailPreview
                contractorName={selectedProfessional?.name}
                contractorEmail={selectedProfessional?.email}
                propertyAddress={propertyName}
                systemName={systemLabel}
                scheduledDate={scheduledDate}
                scheduledTime={scheduledTime}
                scheduleType={scheduleType}
                messageBody={messageBody}
                setMessageBody={setMessageBody}
                senderName={senderName}
                replyEmail={replyEmail?.trim() || null}
              />
            </div>
          </div>
        </div>
      </div>

      {scheduleType === "inspection" &&
        (hasRecommendations || maintenanceLoading) && (
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
                  <span>
                    {typeof item === "string" ? item : item.task || item}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* ── Alert / reminder ── */}
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
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <label className="col-span-1 text-xs font-medium text-gray-500 dark:text-gray-400 min-h-[2.5rem] flex items-end leading-snug">
                Or pick specific date
              </label>
              <label className="col-span-1 text-xs font-medium text-gray-500 dark:text-gray-400 min-h-[2.5rem] flex items-end leading-snug">
                Time
              </label>
              <div className="min-w-0">
                <DatePickerInput
                  name="alertDate"
                  value={alertDate}
                  onChange={(e) => setAlertDate(e.target.value)}
                  popoverClassName="z-[250]"
                  showOffsetControl
                  className="form-input w-full h-10 py-0 leading-10 text-sm"
                />
              </div>
              <input
                type="time"
                value={alertTime}
                onChange={(e) => setAlertTime(e.target.value)}
                className="form-input w-full h-10 py-0 text-sm min-w-0"
              />
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
  const {currentUser} = useAuth();
  const accountUrl = paramAccountUrl || currentAccount?.url || "";
  const [currentStep, setCurrentStep] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState(null); // "email" | "schedule"
  const [submitError, setSubmitError] = useState(null);

  const [scheduleType, setScheduleType] = useState(null);
  const [hasProfessional, setHasProfessional] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [professionalSearch, setProfessionalSearch] = useState("");
  const [savedProfessionals, setSavedProfessionals] = useState([]);

  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState(null);
  const [checklistItems, setChecklistItems] = useState([]);
  const [messageBody, setMessageBody] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [maintenanceRecommendations, setMaintenanceRecommendations] = useState(
    [],
  );
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [alertTiming, setAlertTiming] = useState("3d");
  const [alertDate, setAlertDate] = useState("");
  const [alertTime, setAlertTime] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const propertyName =
    propertyData?.propertyName ||
    propertyData?.name ||
    propertyData?.identity?.propertyName ||
    "";
  const professionalsPath = accountUrl
    ? `/${accountUrl}/professionals`
    : "/professionals";

  const propId =
    propertyId ??
    propertyData?.id ??
    propertyData?.identity?.id ??
    propertyData?.property_uid ??
    propertyData?.identity?.property_uid;

  useEffect(() => {
    if (!isOpen) return;
    AppApi.getSavedProfessionals()
      .then((data) => setSavedProfessionals(data || []))
      .catch(() => setSavedProfessionals([]));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !propId || !systemType) {
      setChecklistItems([]);
      return;
    }
    let cancelled = false;
    AppApi.getInspectionChecklist(propId, {systemKey: systemType})
      .then((items) => {
        if (!cancelled) setChecklistItems(items || []);
      })
      .catch(() => {
        if (!cancelled) setChecklistItems([]);
      });
    return () => { cancelled = true; };
  }, [isOpen, propId, systemType]);

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
      setSelectedChecklistItemId(checklistItemId || null);
      setMessageBody("");
      setReplyEmail(
        currentUser?.data?.email ||
          currentUser?.email ||
          "",
      );
      setMaintenanceRecommendations([]);
      setMaintenanceLoading(false);
      setAlertEnabled(true);
      setAlertTiming("3d");
      setAlertDate("");
      setAlertTime("");
      setSendEmail(true);
    }
  }, [isOpen, currentUser?.data?.email, currentUser?.email]);
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
    if (currentStep !== 3) {
      messageTemplateSetRef.current = false;
      return;
    }
    if (!sendEmail) {
      setMessageBody("");
      messageTemplateSetRef.current = false;
      return;
    }
    if (!messageTemplateSetRef.current) {
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
  }, [
    currentStep,
    sendEmail,
    scheduledDate,
    scheduleType,
    systemLabel,
    propertyName,
  ]);

  const handleBrowseDirectory = useCallback(() => {
    window.open(toShareUrl(professionalsPath), "_blank");
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

  const nextDisabledTitle = () => {
    if (canAdvance()) return undefined;
    if (currentStep === 0) return "Select a type to continue";
    if (currentStep === 1) return "Choose whether you have a professional to continue";
    if (currentStep === 2) return "Select a date to continue";
    return undefined;
  };

  const handleSubmit = async (sendEmailNow = false) => {
    setSubmitError(null);
    setSavingAction(sendEmailNow ? "email" : "schedule");
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

    const resolvedMessageBody = sendEmail
      ? (messageBody?.trim() ||
          generateMessageTemplate(
            propertyName,
            systemLabel,
            scheduledDate,
            scheduleType,
          )).trim()
      : "";

    const eventPayload = {
      system_key: systemType || "general",
      system_name: systemLabel,
      event_type: scheduleType === "inspection" ? "inspection" : "maintenance",
      contractor_id: coerceContractorId(selectedProfessional?.sourceId),
      contractor_source: selectedProfessional?.source ?? null,
      contractor_name: selectedProfessional?.name ?? null,
      contractor_email:
        sendEmailNow && selectedProfessional?.email
          ? selectedProfessional.email
          : null,
      scheduled_date: scheduledDate,
      scheduled_time: effectiveTime,
      recurrence_type: "one-time",
      alert_timing: alertEnabled ? alertTimingVal : "3d",
      alert_custom_days: alertCustomDaysVal,
      email_reminder: alertEnabled,
      message_enabled: sendEmail && !!resolvedMessageBody,
      message_body: sendEmail && resolvedMessageBody ? resolvedMessageBody : null,
      reply_email:
        sendEmail && replyEmail?.trim() ? replyEmail.trim() : null,
      send_email_now: sendEmailNow,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      checklist_item_id: selectedChecklistItemId
        ? parseInt(selectedChecklistItemId, 10)
        : null,
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
      setSavingAction(null);
    }
  };

  if (showSuccess) {
    return (
      <ModalBlank
        id="schedule-system-modal"
        modalOpen={isOpen}
        setModalOpen={onClose}
        closeOnClickOutside={false}
        contentClassName="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0"
      >
        <div className="relative p-8 flex flex-col flex-1 min-h-0 items-center justify-center min-h-[200px]">
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
      contentClassName="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0"
    >
      <div className="relative flex flex-col flex-1 min-h-0 p-6">
        <div className="flex items-center justify-between mb-4 shrink-0">
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

        <div className="shrink-0">
          <StepIndicator currentStep={currentStep} steps={STEPS} />
        </div>

        <div
          key={currentStep}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 -mr-1"
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
              checklistItems={checklistItems}
              selectedChecklistItemId={selectedChecklistItemId}
              setSelectedChecklistItemId={setSelectedChecklistItemId}
            />
          )}
          {currentStep === 3 && (
            <MessageStep
              messageBody={messageBody}
              setMessageBody={setMessageBody}
              replyEmail={replyEmail}
              setReplyEmail={setReplyEmail}
              alertEnabled={alertEnabled}
              setAlertEnabled={setAlertEnabled}
              alertTiming={alertTiming}
              setAlertTiming={setAlertTiming}
              alertDate={alertDate}
              setAlertDate={setAlertDate}
              alertTime={alertTime}
              setAlertTime={setAlertTime}
              selectedProfessional={selectedProfessional}
              propertyName={propertyName}
              systemLabel={systemLabel}
              scheduledDate={scheduledDate}
              scheduledTime={scheduledTime}
              scheduleType={scheduleType}
              senderName={
                currentUser?.data?.name || currentUser?.name || ""
              }
              maintenanceRecommendations={maintenanceRecommendations}
              maintenanceLoading={maintenanceLoading}
              sendEmail={sendEmail}
              setSendEmail={setSendEmail}
            />
          )}
        </div>

        {submitError && (
          <div className="shrink-0 mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {submitError}
          </div>
        )}

        <div className="shrink-0 flex flex-col gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                title={nextDisabledTitle()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  handleSubmit(sendEmail && !!selectedProfessional?.email)
                }
                disabled={
                  !scheduledDate ||
                  saving ||
                  (sendEmail && !selectedProfessional?.email)
                }
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                title={
                  sendEmail && !selectedProfessional?.email
                    ? "Select a contractor with an email to send"
                    : !scheduledDate
                      ? "Select a date to continue"
                      : undefined
                }
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {savingAction === "email"
                      ? "Sending..."
                      : "Saving..."}
                  </>
                ) : sendEmail && selectedProfessional?.email ? (
                  <>
                    <Mail className="w-4 h-4" />
                    Send email and schedule
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </>
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
