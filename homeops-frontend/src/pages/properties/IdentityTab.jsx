import React, {useCallback, useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {
  Home,
  User,
  Building2,
  Ruler,
  Bed,
  Flame,
  School,
  Check,
  AlertCircle,
  Info,
  Pencil,
  ClipboardList,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import SectionCard from "./partials/passport/SectionCard";
import {StatusBadge} from "./partials/passport/StatusBadge";
import LabelValue from "./partials/passport/LabelValue";
import {useDynamicPosition} from "../../hooks/useDynamicPosition";
import {
  IDENTITY_SECTIONS,
  getSectionProgress,
} from "./constants/identitySections";
import Tooltip from "../../utils/Tooltip";
import {getIdentityAddressInputDisplayValue} from "../../hooks/useGooglePlacesAutocomplete";
import useSuppressBrowserAddressAutofill from "../../hooks/useSuppressBrowserAddressAutofill";

function SubtleLockIcon({className = ""}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M5 7V5.9C5 4.24 6.34 2.9 8 2.9c1.66 0 3 1.34 3 3V7"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-75"
      />
      <rect
        x="3.25"
        y="6.55"
        width="9.5"
        height="7.35"
        rx="1.75"
        fill="currentColor"
        className="opacity-55"
      />
      <path
        d="M8 9.05c.62 0 1.12.5 1.12 1.12 0 .43-.25.82-.62 1v1.01a.5.5 0 0 1-1 0v-1.01A1.12 1.12 0 0 1 8 9.05Z"
        fill="#F3F4F6"
        className="dark:fill-gray-300"
      />
    </svg>
  );
}

const TOOLTIP_GAP = 8;

const TOOLTIP_LEAVE_DELAY = 150;

function LockedFieldControl({
  label,
  fieldName,
  supportDataAdjustmentUrl,
  message = "Verified data from public records. This field is system-managed and cannot be edited directly.",
  ctaLabel = "Request correction",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerId = useId();
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const leaveTimeoutRef = useRef(null);

  const requestUrl =
    typeof supportDataAdjustmentUrl === "function"
      ? supportDataAdjustmentUrl(fieldName)
      : supportDataAdjustmentUrl;

  const {top, left} = useDynamicPosition({
    triggerRef: wrapperRef,
    floatingRef: tooltipRef,
    isVisible: isOpen && !!requestUrl,
    preferredPosition: "top",
    gap: TOOLTIP_GAP,
  });

  const openRequestCorrection = useCallback(() => {
    if (!requestUrl) return;
    window.open(requestUrl, "_blank", "noopener,noreferrer");
  }, [requestUrl]);

  const handleTriggerLeave = useCallback(() => {
    leaveTimeoutRef.current = setTimeout(() => setIsOpen(false), TOOLTIP_LEAVE_DELAY);
  }, []);

  const handleTooltipEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const handleTooltipLeave = useCallback(() => {
    setIsOpen(false);
  }, []);

  if (!requestUrl) {
    return (
      <span className="inline-flex ml-1 align-middle cursor-help text-gray-400 dark:text-gray-500">
        <SubtleLockIcon className="w-[0.95rem] h-[0.95rem]" />
      </span>
    );
  }

  const portalContainer =
    typeof document !== "undefined" ? document.body : null;

  const tooltipContent = (
    <div
      ref={tooltipRef}
      role="tooltip"
      aria-labelledby={triggerId}
      className="fixed z-[9999] w-64 rounded-xl border border-gray-200/90 dark:border-gray-700/70 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 shadow-xl pointer-events-auto"
      style={{
        top,
        left,
        transform: "translateX(-50%)",
      }}
      onMouseEnter={handleTooltipEnter}
      onMouseLeave={handleTooltipLeave}
    >
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
        {message}
      </p>
      <button
        type="button"
        onClick={openRequestCorrection}
        className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:text-[#456564] dark:hover:text-emerald-300 focus:outline-none focus:underline"
      >
        {ctaLabel}
      </button>
    </div>
  );

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex ml-1 align-middle"
      onMouseEnter={() => {
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current);
          leaveTimeoutRef.current = null;
        }
        setIsOpen(true);
      }}
      onMouseLeave={handleTriggerLeave}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={(e) => {
        if (!wrapperRef.current?.contains(e.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        id={triggerId}
        type="button"
        onClick={openRequestCorrection}
        className="inline-flex items-center justify-center rounded p-0.5 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-colors"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${label} is verified and system-managed. Request correction.`}
      >
        <SubtleLockIcon className="w-[0.95rem] h-[0.95rem]" />
      </button>
      {isOpen &&
        portalContainer &&
        createPortal(tooltipContent, portalContainer)}
    </span>
  );
}

/** Lock icon + tooltip for autocomplete-derived fields. Optional Request correction button when supportDataAdjustmentUrl is provided. */
function AutocompleteLockControl({tooltipText, supportDataAdjustmentUrl, fieldName}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerId = useId();
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const leaveTimeoutRef = useRef(null);

  const requestUrl =
    typeof supportDataAdjustmentUrl === "function"
      ? supportDataAdjustmentUrl(fieldName)
      : supportDataAdjustmentUrl;

  const {top, left} = useDynamicPosition({
    triggerRef: wrapperRef,
    floatingRef: tooltipRef,
    isVisible: isOpen && !!tooltipText,
    preferredPosition: "top",
    gap: TOOLTIP_GAP,
  });

  const openRequestCorrection = useCallback(() => {
    if (!requestUrl) return;
    window.open(requestUrl, "_blank", "noopener,noreferrer");
  }, [requestUrl]);

  const handleTriggerLeave = useCallback(() => {
    leaveTimeoutRef.current = setTimeout(() => setIsOpen(false), TOOLTIP_LEAVE_DELAY);
  }, []);

  const handleTooltipEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const handleTooltipLeave = useCallback(() => {
    setIsOpen(false);
  }, []);

  const portalContainer =
    typeof document !== "undefined" ? document.body : null;

  const tooltipContent = (
    <div
      ref={tooltipRef}
      role="tooltip"
      aria-labelledby={triggerId}
      className="fixed z-[9999] w-64 rounded-xl border border-gray-200/90 dark:border-gray-700/70 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 shadow-xl pointer-events-auto"
      style={{
        top,
        left,
        transform: "translateX(-50%)",
      }}
      onMouseEnter={handleTooltipEnter}
      onMouseLeave={handleTooltipLeave}
    >
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line">
        {tooltipText}
      </p>
      {requestUrl && (
        <button
          type="button"
          onClick={openRequestCorrection}
          className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:text-[#456564] dark:hover:text-emerald-300 focus:outline-none focus:underline"
        >
          Request correction
        </button>
      )}
    </div>
  );

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex ml-1 align-middle"
      onMouseEnter={() => {
        if (leaveTimeoutRef.current) {
          clearTimeout(leaveTimeoutRef.current);
          leaveTimeoutRef.current = null;
        }
        setIsOpen(true);
      }}
      onMouseLeave={handleTriggerLeave}
      onFocusCapture={() => setIsOpen(true)}
      onBlurCapture={(e) => {
        if (!wrapperRef.current?.contains(e.relatedTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        id={triggerId}
        type="button"
        onClick={requestUrl ? openRequestCorrection : undefined}
        className="inline-flex items-center justify-center rounded p-0.5 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-gray-700/40 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-gray-900 transition-colors"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={
          requestUrl
            ? "Address field is verified and system-managed. Request correction."
            : tooltipText
        }
      >
        <SubtleLockIcon className="w-[0.95rem] h-[0.95rem]" />
      </button>
      {isOpen &&
        portalContainer &&
        tooltipText &&
        createPortal(tooltipContent, portalContainer)}
    </span>
  );
}
/** Full-border inputs for primary identity fields (property name, address). */
const BORDERED_INPUT_CLASS = "form-input w-full";

/** Underline-style inputs in edit mode (bottom border only). */
const EDIT_MODE_INPUT_CLASS =
  "form-input w-full border-0 border-b rounded-none shadow-none px-0 bg-transparent focus:ring-0";

const EDIT_FIELD_LABEL_CLASS =
  "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1";

// Stable subcomponents; defined at module level so inputs don't remount on every keystroke.
function Field({
  label,
  name,
  value,
  placeholder,
  type = "text",
  inputClassName = EDIT_MODE_INPUT_CLASS,
  onChange,
  required = false,
  error,
  inputRef,
  hint,
  infoTooltip,
  lockTooltip,
  uncontrolled = false,
  readOnly = false,
  verifiedLockTooltip,
  supportDataAdjustmentUrl,
  inputExtraProps,
}) {
  const resolvedInputClass = readOnly ? BORDERED_INPUT_CLASS : inputClassName;
  const usesUnderlineInput =
    !readOnly && inputClassName === EDIT_MODE_INPUT_CLASS;
  const errorClasses = error
    ? readOnly || !usesUnderlineInput
      ? "border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500 dark:focus:border-red-500 dark:focus:ring-red-500"
      : "border-b-red-300 dark:border-b-red-500 focus:border-b-red-500 dark:focus:border-b-red-500"
    : "";
  const readOnlyClasses = readOnly
    ? "bg-gray-100/80 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-default border-gray-200 dark:border-gray-600"
    : "";
  const inputProps = uncontrolled
    ? {defaultValue: value ?? "", autoComplete: "off"}
    : {value: value ?? "", onChange: readOnly ? undefined : onChange};

  const lockContent = verifiedLockTooltip && (
    <LockedFieldControl
      label={label}
      fieldName={name}
      supportDataAdjustmentUrl={supportDataAdjustmentUrl}
    />
  );

  return (
    <div>
      <label className={EDIT_FIELD_LABEL_CLASS}>
        {label}
        {lockContent}
        {lockTooltip && !verifiedLockTooltip && (
          <AutocompleteLockControl
            tooltipText={lockTooltip}
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
            fieldName={name}
          />
        )}
        {infoTooltip && !verifiedLockTooltip && !lockTooltip && (
          <Tooltip content={infoTooltip} position="top">
            <Info className="w-4 h-4 ml-0.5 inline-block align-middle text-gray-400 dark:text-gray-500 cursor-help" />
          </Tooltip>
        )}
        {hint && (
          <span className="ml-2 text-emerald-500 text-[10px] font-normal">
            {hint}
          </span>
        )}
      </label>
      <input
        ref={inputRef}
        type={type}
        name={name}
        placeholder={placeholder}
        className={`${resolvedInputClass} ${errorClasses} ${readOnlyClasses}`}
        required={required}
        readOnly={readOnly}
        {...inputProps}
        {...inputExtraProps}
      />
      {error && (
        <div className="mt-1 flex items-center text-sm text-red-500">
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

/** Aliases for field keys when reading from propertyData (backend may use different keys) */
const FIELD_VALUE_ALIASES = {
  taxId: ["parcelTaxId"],
  bedCount: ["rooms"],
  bathCount: ["bathrooms"],
  sqFtTotal: ["squareFeet"],
};

function getFieldValue(propertyData, fieldName) {
  const keys = [fieldName, ...(FIELD_VALUE_ALIASES[fieldName] || [])];
  for (const k of keys) {
    const v = propertyData?.[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/* ---------------- Read-only (view mode) presentation ---------------- */

const SECTION_ICONS = {
  identity_address: Home,
  ownership_occupancy: User,
  general_info: Building2,
  size_lot: Ruler,
  rooms_baths: Bed,
  features_parking: Flame,
  schools: School,
};

/** Shared width for property name + address in identity sections. */
const IDENTITY_PRIMARY_FIELD_WRAP = "col-span-full min-w-0";

const READONLY_FIELD_LABELS = {
  propertyName: "Property Name",
  address: "Full Address",
  addressLine1: "Street",
  city: "City",
  state: "State",
  zip: "ZIP",
  county: "County",
  taxId: "Tax / Parcel ID",
  ownerName: "Owner Name",
  ownerName2: "Co-owner",
  ownerCity: "Owner City",
  occupantName: "Occupant Name",
  occupantType: "Occupancy",
  ownerPhone: "Owner Phone",
  propertyType: "Property Type",
  subType: "Sub Type",
  yearBuilt: "Year Built",
  sqFtTotal: "Total (ft²)",
  sqFtFinished: "Finished (ft²)",
  garageSqFt: "Garage (ft²)",
  totalDwellingSqFt: "Total Dwelling (ft²)",
  lotSize: "Lot Size",
  bedCount: "Bedrooms",
  bathCount: "Bathrooms",
  fullBaths: "Full Baths",
  threeQuarterBaths: "3/4 Baths",
  halfBaths: "Half Baths",
  numberOfShowers: "Showers",
  numberOfBathtubs: "Bathtubs",
  fireplaces: "Fireplaces",
  fireplaceTypes: "Fireplace Type",
  basement: "Basement",
  parkingType: "Parking Type",
  totalCoveredParking: "Covered Parking",
  totalUncoveredParking: "Uncovered Parking",
  schoolDistrict: "School District",
  elementarySchool: "Elementary",
  juniorHighSchool: "Junior High",
  seniorHighSchool: "Senior High",
};

function identityPrimaryFieldClass(fieldName) {
  return fieldName === "propertyName" || fieldName === "address"
    ? IDENTITY_PRIMARY_FIELD_WRAP
    : "";
}

function readOnlyDisplayValue(propertyData, fieldName) {
  if (fieldName === "address") {
    return (
      propertyData?.fullAddress ||
      propertyData?.address ||
      [
        propertyData?.addressLine1,
        propertyData?.city,
        propertyData?.state,
        propertyData?.zip,
      ]
        .filter(Boolean)
        .join(", ")
    );
  }
  const v = getFieldValue(propertyData, fieldName);
  if (typeof v === "number") return String(v);
  return v;
}

function ReadOnlySectionCard({section, propertyData}) {
  const Icon = SECTION_ICONS[section.id] ?? Home;
  const {filled, total} = getSectionProgress(propertyData, section);
  const isComplete = filled >= total;

  return (
    <div
      className="rounded-xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 p-4 h-full"
      data-section-id={section.id}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-[#456564] dark:text-[#7fa3a1] shrink-0" />
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {section.label}
        </h4>
        {isComplete ? (
          <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400/20 dark:bg-emerald-400/25 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Check className="w-3 h-3" strokeWidth={2.5} />
          </span>
        ) : (
          <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500 shrink-0">
            {filled}/{total}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {section.fields.map((fieldName) => (
          <LabelValue
            key={fieldName}
            label={READONLY_FIELD_LABELS[fieldName] ?? fieldName}
            value={readOnlyDisplayValue(propertyData, fieldName)}
            className={identityPrimaryFieldClass(fieldName)}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------------- Edit mode (saved properties) ---------------- */

const ADJUSTMENT_LOCK_MESSAGE =
  "This field is managed from verified records and can't be edited directly. Submit a data adjustment request and our team will update it for you.";

/** Label/value pair with a lock affordance that routes to a data adjustment request. */
function LockedValue({label, value, fieldName, supportDataAdjustmentUrl, className = ""}) {
  const isEmpty =
    value == null || (typeof value === "string" && value.trim() === "");
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center text-xs text-neutral-500 dark:text-neutral-400">
        <span className="truncate">{label}</span>
        <LockedFieldControl
          label={label}
          fieldName={fieldName}
          supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          message={ADJUSTMENT_LOCK_MESSAGE}
          ctaLabel="Request data adjustment"
        />
      </div>
      <div
        className={`text-sm mt-0.5 break-words ${
          isEmpty
            ? "text-neutral-400 dark:text-neutral-600"
            : "font-medium text-neutral-900 dark:text-white"
        }`}
      >
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}

/**
 * Edit-mode section card for saved properties. Mirrors the read-only card
 * layout: only Property Name and Address are direct inputs, everything else
 * is locked behind a data adjustment request.
 */
function EditableSectionCard({
  section,
  propertyData,
  handleInputChange,
  errors = {},
  addressInputRef,
  placesError,
  AutocompleteWrapper,
  supportDataAdjustmentUrl,
  addressInputExtraProps,
  /** Saved properties lock non-primary fields; new properties show label/value placeholders. */
  lockNonEditableFields = true,
}) {
  const Icon = SECTION_ICONS[section.id] ?? Home;
  const {filled, total} = getSectionProgress(propertyData, section);
  const isComplete = filled >= total;

  const addressField = (
    <Field
      inputRef={addressInputRef}
      uncontrolled
      label="Address"
      name="address"
      value={getIdentityAddressInputDisplayValue(propertyData)}
      placeholder="Start typing an address to search..."
      required
      error={errors.address || placesError}
      inputClassName={BORDERED_INPUT_CLASS}
      inputExtraProps={addressInputExtraProps}
    />
  );

  return (
    <div
      className="rounded-xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 p-4 h-full"
      data-section-id={section.id}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-[#456564] dark:text-[#7fa3a1] shrink-0" />
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {section.label}
        </h4>
        {isComplete ? (
          <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400/20 dark:bg-emerald-400/25 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Check className="w-3 h-3" strokeWidth={2.5} />
          </span>
        ) : (
          <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500 shrink-0">
            {filled}/{total}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {section.fields.map((fieldName) => {
          if (fieldName === "propertyName") {
            return (
              <div key={fieldName} className={IDENTITY_PRIMARY_FIELD_WRAP}>
                <Field
                  onChange={handleInputChange}
                  label="Property Name"
                  name="propertyName"
                  value={propertyData.propertyName}
                  placeholder="e.g. Lakewood Estate, My Home"
                  inputClassName={BORDERED_INPUT_CLASS}
                />
              </div>
            );
          }
          if (fieldName === "address") {
            return (
              <div key={fieldName} className={IDENTITY_PRIMARY_FIELD_WRAP}>
                {AutocompleteWrapper ? (
                  <AutocompleteWrapper>{addressField}</AutocompleteWrapper>
                ) : (
                  addressField
                )}
              </div>
            );
          }
          if (lockNonEditableFields) {
            return (
              <LockedValue
                key={fieldName}
                label={READONLY_FIELD_LABELS[fieldName] ?? fieldName}
                value={readOnlyDisplayValue(propertyData, fieldName)}
                fieldName={fieldName}
                supportDataAdjustmentUrl={supportDataAdjustmentUrl}
              />
            );
          }
          return (
            <LabelValue
              key={fieldName}
              label={READONLY_FIELD_LABELS[fieldName] ?? fieldName}
              value={readOnlyDisplayValue(propertyData, fieldName)}
              className={identityPrimaryFieldClass(fieldName)}
            />
          );
        })}
      </div>
    </div>
  );
}

function IdentityTab({
  propertyData,
  savedPropertyData = {},
  handleInputChange,
  errors = {},
  addressInputRef,
  placesLoaded,
  placesError,
  AutocompleteWrapper,
  supportDataAdjustmentUrl,
  expandSectionId = null,
  formDataChanged = false,
  attomRefresh = null,
  onCancelEdit,
}) {
  /* View/edit toggle: read-only label/value cards by default; the existing
   * form is shown in edit mode. New (unsaved) properties always start in
   * edit mode since there is nothing to display yet. */
  const [editOverride, setEditOverride] = useState(null);
  const hasSavedProperty = Boolean(
    savedPropertyData?.id ?? propertyData?.id,
  );
  const isEditing = editOverride ?? !hasSavedProperty;
  const prevFormDataChangedRef = useRef(formDataChanged);

  // After a successful save, return to read-only cards for saved properties.
  useEffect(() => {
    const wasChanged = prevFormDataChangedRef.current;
    prevFormDataChangedRef.current = formDataChanged;
    if (wasChanged && !formDataChanged && hasSavedProperty) {
      setEditOverride(false);
    }
  }, [formDataChanged, hasSavedProperty]);

  // Container "Complete Outstanding Tasks" jumps target form sections —
  // switch into edit mode so the scroll/focus targets exist.
  useEffect(() => {
    if (
      expandSectionId &&
      IDENTITY_SECTIONS.some((s) => s.id === expandSectionId)
    ) {
      setEditOverride(true);
    }
  }, [expandSectionId]);

  const completedSections = IDENTITY_SECTIONS.filter(
    (s) => getSectionProgress(propertyData, s).percent >= 100,
  ).length;
  const allSectionsComplete = completedSections === IDENTITY_SECTIONS.length;

  const bindAddressSearchInput = useSuppressBrowserAddressAutofill(
    "identity-address-search",
  );
  const addressInputExtraProps = bindAddressSearchInput();

  const handleCancelEdit = useCallback(() => {
    onCancelEdit?.();
    setEditOverride(false);
  }, [onCancelEdit]);

  const handleDoneEdit = useCallback(() => {
    setEditOverride(false);
  }, []);

  return (
    <SectionCard
      flat
      title="Property Identity"
      description="Core identity and ownership information for this property"
      icon={ClipboardList}
      badge={
        <StatusBadge tone={allSectionsComplete ? "emerald" : "neutral"}>
          {allSectionsComplete ? (
            <>
              <Check className="w-3 h-3" strokeWidth={2.5} />
              Complete
            </>
          ) : (
            `${completedSections} of ${IDENTITY_SECTIONS.length} complete`
          )}
        </StatusBadge>
      }
      action={
        hasSavedProperty ? (
          <div className="flex items-center gap-2">
            {attomRefresh && (
              <button
                type="button"
                disabled={
                  attomRefresh.isActive || attomRefresh.isAtLookupLimit
                }
                title={
                  attomRefresh.isAtLookupLimit
                    ? `ATTOM lookup limit reached (${attomRefresh.lookupLimit} per property)`
                    : "Fill missing identity fields from ATTOM public records"
                }
                onClick={attomRefresh.openConfirm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                {attomRefresh.isActive ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {attomRefresh.jobStatus === "queued"
                      ? "Queued…"
                      : "Pulling data…"}
                  </>
                ) : attomRefresh.isAtLookupLimit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Limit reached
                  </>
                ) : attomRefresh.jobStatus === "completed" &&
                  !attomRefresh.jobError ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Pull property data
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Pull property data
                  </>
                )}
              </button>
            )}
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDoneEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Done
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditOverride(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#7fa3a1] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit Identity
              </button>
            )}
          </div>
        ) : null
      }
      bodyClassName="pt-2"
    >
      {!isEditing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {IDENTITY_SECTIONS.map((section) => (
            <ReadOnlySectionCard
              key={section.id}
              section={section}
              propertyData={propertyData}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {IDENTITY_SECTIONS.map((section) => (
            <EditableSectionCard
              key={section.id}
              section={section}
              propertyData={propertyData}
              handleInputChange={handleInputChange}
              errors={errors}
              addressInputRef={addressInputRef}
              placesError={placesError}
              AutocompleteWrapper={AutocompleteWrapper}
              supportDataAdjustmentUrl={supportDataAdjustmentUrl}
              addressInputExtraProps={addressInputExtraProps}
              lockNonEditableFields={hasSavedProperty}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default IdentityTab;
