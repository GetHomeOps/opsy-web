import React, {useCallback, useId, useRef, useState} from "react";
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
} from "lucide-react";
import {useDynamicPosition} from "../../hooks/useDynamicPosition";
import {usStates} from "../../data/states";
import {
  IDENTITY_SECTIONS,
  getSectionProgress,
} from "./constants/identitySections";
import {
  RENTCAST_FIELD_KEYS,
  RENTCAST_VERIFIED_TOOLTIP,
  AUTCOMPLETE_LOCK_TOOLTIP,
} from "./constants/rentcastFields";
import Tooltip from "../../utils/Tooltip";

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

function LockedFieldControl({label, fieldName, supportDataAdjustmentUrl}) {
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
        Verified data from public records. This field is system-managed and
        cannot be edited directly.
      </p>
      <button
        type="button"
        onClick={openRequestCorrection}
        className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:text-[#456564] dark:hover:text-emerald-300 focus:outline-none focus:underline"
      >
        Request correction
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
// Stable subcomponents; defined at module level so inputs don't remount on every keystroke.
function Field({
  label,
  name,
  value,
  placeholder,
  type = "text",
  inputClassName = "form-input w-full",
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
}) {
  const errorClasses = error
    ? "border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500 dark:focus:border-red-500 dark:focus:ring-red-500"
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
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
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
        className={`${inputClassName} ${errorClasses} ${readOnlyClasses}`}
        required={required}
        readOnly={readOnly}
        {...inputProps}
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

function SelectField({
  label,
  name,
  value,
  options,
  onChange,
  required = false,
  error,
  infoTooltip,
  lockTooltip,
  readOnly = false,
  verifiedLockTooltip,
  supportDataAdjustmentUrl,
}) {
  const errorClasses = error
    ? "border-red-300 dark:border-red-500 focus:border-red-500 focus:ring-red-500 dark:focus:border-red-500 dark:focus:ring-red-500"
    : "";
  const readOnlyClasses = readOnly
    ? "bg-gray-100/80 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-default border-gray-200 dark:border-gray-600"
    : "";

  const lockContent = verifiedLockTooltip && (
    <LockedFieldControl
      label={label}
      fieldName={name}
      supportDataAdjustmentUrl={supportDataAdjustmentUrl}
    />
  );

  if (readOnly) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
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
        </label>
        <div
          className={`form-input w-full min-h-[2.5rem] ${errorClasses} ${readOnlyClasses} py-2.5 flex items-center`}
          aria-readonly
        >
          {value ?? ""}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
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
      </label>
      <select
        name={name}
        value={value ?? ""}
        onChange={onChange}
        className={`form-select w-full ${errorClasses}`}
        required={required}
      >
        <option value="">Select…</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && (
        <div className="mt-1 flex items-center text-sm text-red-500">
          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function SectionWithProgress({
  sectionId,
  label,
  icon: Icon,
  propertyData,
  children,
}) {
  const section = IDENTITY_SECTIONS.find((s) => s.id === sectionId);
  const {percent, filled, total} = section
    ? getSectionProgress(propertyData, section)
    : {percent: 0, filled: 0, total: 1};
  const isComplete = percent >= 100;

  return (
    <div
      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden relative"
      data-section-id={sectionId}
    >
      <style>{`
        @keyframes identityCheckPop {
          from {
            opacity: 0;
            transform: scale(0.5) translate(12px, -12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translate(0, 0);
          }
        }
      `}</style>

      {/* Progress bar - compresses (hides) when complete */}
      <div
        className="absolute top-0 left-0 right-0 overflow-hidden bg-gray-200 dark:bg-gray-600"
        style={{
          height: isComplete ? 0 : 3,
          opacity: isComplete ? 0 : 1,
          transition: "height 0.35s ease-out, opacity 0.25s ease-out",
        }}
      >
        <div
          className="h-full bg-emerald-400 dark:bg-emerald-400/90 transition-all duration-500 ease-out"
          style={{width: `${percent}%`}}
        />
      </div>

      {/* Checkmark - pops in top-right when complete */}
      {isComplete && (
        <div
          className="absolute top-4 right-4 flex items-center justify-center w-7 h-7 rounded-full bg-emerald-400/20 dark:bg-emerald-400/25 text-emerald-600 dark:text-emerald-400"
          style={{
            animation:
              "identityCheckPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
          }}
        >
          <Check className="w-4 h-4" strokeWidth={2.25} />
        </div>
      )}

      <div className="p-6 pt-7">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-2 pr-10">
          <Icon className="h-5 w-5 text-[#456654] flex-shrink-0" />
          {label}
          {!isComplete && total > 0 && (
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
              ({filled}/{total})
            </span>
          )}
        </h3>
        {children}
      </div>
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

function IdentityTab({
  propertyData,
  handleInputChange,
  errors = {},
  addressInputRef,
  placesLoaded,
  placesError,
  AutocompleteWrapper,
  identityDataSource,
  supportDataAdjustmentUrl,
}) {
  /** Lock only when field is API-sourced (RentCast or ATTOM) AND has a non-empty API value */
  const isRentCastLocked = (fieldName) => {
    const isApiSourced = identityDataSource === "rentcast" || identityDataSource === "attom";
    if (!isApiSourced || !RENTCAST_FIELD_KEYS.has(fieldName))
      return false;
    const val = getFieldValue(propertyData, fieldName);
    return val !== undefined && val !== null && String(val).trim() !== "";
  };

  return (
    <div className="space-y-4">
      {/* Identity + Address */}
      <SectionWithProgress
        sectionId="identity_address"
        label="Identity & Address"
        icon={Home}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-3">
            <Field
              onChange={handleInputChange}
              label="Property Name"
              name="propertyName"
              value={propertyData.propertyName}
              placeholder="e.g. Lakewood Estate, My Home"
            />
          </div>

          <div className="md:col-span-3">
            {AutocompleteWrapper ? (
              <AutocompleteWrapper>
                <Field
                  inputRef={addressInputRef}
                  uncontrolled
                  label="Address"
                  name="address"
                  value={
                    propertyData.address ||
                    propertyData.fullAddress ||
                    [
                      propertyData.address,
                      propertyData.city,
                      propertyData.state,
                      propertyData.zip,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                    ""
                  }
                  placeholder="Start typing an address to search..."
                  required
                  error={errors.address || placesError}
                  readOnly={!!propertyData.addressLine1}
                  lockTooltip={
                    propertyData.addressLine1 ? AUTCOMPLETE_LOCK_TOOLTIP : undefined
                  }
                  supportDataAdjustmentUrl={supportDataAdjustmentUrl}
                />
              </AutocompleteWrapper>
            ) : (
              <Field
                inputRef={addressInputRef}
                uncontrolled
                label="Address"
                name="address"
                value={
                  propertyData.address ||
                  propertyData.fullAddress ||
                  [
                    propertyData.address,
                    propertyData.city,
                    propertyData.state,
                    propertyData.zip,
                  ]
                    .filter(Boolean)
                    .join(", ") ||
                  ""
                }
                placeholder="Start typing an address to search..."
                required
                error={errors.address || placesError}
                readOnly={!!propertyData.addressLine1}
                lockTooltip={
                  propertyData.addressLine1 ? AUTCOMPLETE_LOCK_TOOLTIP : undefined
                }
                supportDataAdjustmentUrl={supportDataAdjustmentUrl}
              />
            )}
          </div>

          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Field
                onChange={handleInputChange}
                label="Street"
                name="addressLine1"
                value={propertyData.addressLine1}
                placeholder="e.g. 123 Main St"
                readOnly
                lockTooltip={AUTCOMPLETE_LOCK_TOOLTIP}
                supportDataAdjustmentUrl={supportDataAdjustmentUrl}
              />
            </div>
            <Field
              onChange={handleInputChange}
              label="City"
              name="city"
              value={propertyData.city}
              required
              error={errors.city}
              readOnly
              lockTooltip={AUTCOMPLETE_LOCK_TOOLTIP}
              supportDataAdjustmentUrl={supportDataAdjustmentUrl}
            />
            <SelectField
              onChange={handleInputChange}
              label="State"
              name="state"
              value={propertyData.state}
              options={usStates.map((s) => s.code)}
              required
              error={errors.state}
              readOnly
              lockTooltip={AUTCOMPLETE_LOCK_TOOLTIP}
              supportDataAdjustmentUrl={supportDataAdjustmentUrl}
            />
            <Field
              onChange={handleInputChange}
              label="ZIP"
              name="zip"
              value={propertyData.zip}
              required
              error={errors.zip}
              readOnly
              lockTooltip={AUTCOMPLETE_LOCK_TOOLTIP}
              supportDataAdjustmentUrl={supportDataAdjustmentUrl}
            />
            <Field
              onChange={handleInputChange}
              label="County"
              name="county"
              value={propertyData.county}
              placeholder="e.g. King"
              readOnly={isRentCastLocked("county") || !!propertyData.addressLine1}
              verifiedLockTooltip={
                isRentCastLocked("county") ? RENTCAST_VERIFIED_TOOLTIP : undefined
              }
              supportDataAdjustmentUrl={supportDataAdjustmentUrl}
              lockTooltip={
                !isRentCastLocked("county") && propertyData.addressLine1
                  ? AUTCOMPLETE_LOCK_TOOLTIP
                  : undefined
              }
            />
            <Field
              onChange={handleInputChange}
              label="Tax / Parcel ID"
              name="taxId"
              value={propertyData.taxId || propertyData.parcelTaxId}
              placeholder="e.g. 9278300025"
              readOnly={isRentCastLocked("taxId")}
              verifiedLockTooltip={
                isRentCastLocked("taxId") ? RENTCAST_VERIFIED_TOOLTIP : undefined
              }
              supportDataAdjustmentUrl={supportDataAdjustmentUrl}
            />
          </div>
        </div>
      </SectionWithProgress>

      {/* Ownership & Occupancy */}
      <SectionWithProgress
        sectionId="ownership_occupancy"
        label="Ownership & Occupancy"
        icon={User}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="Owner Name"
            name="ownerName"
            value={propertyData.ownerName}
            readOnly={isRentCastLocked("ownerName")}
            verifiedLockTooltip={
              isRentCastLocked("ownerName") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Owner Name 2"
            name="ownerName2"
            value={propertyData.ownerName2}
            readOnly={isRentCastLocked("ownerName2")}
            verifiedLockTooltip={
              isRentCastLocked("ownerName2") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Owner City"
            name="ownerCity"
            value={propertyData.ownerCity}
            placeholder="e.g. Seattle WA"
            readOnly={isRentCastLocked("ownerCity")}
            verifiedLockTooltip={
              isRentCastLocked("ownerCity") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Occupant Name"
            name="occupantName"
            value={propertyData.occupantName}
          />
          <SelectField
            onChange={handleInputChange}
            label="Occupant Type"
            name="occupantType"
            value={propertyData.occupantType}
            options={["Owner", "Tenant", "Vacant", "Unknown"]}
          />
          <Field
            onChange={handleInputChange}
            label="Owner Phone"
            name="ownerPhone"
            value={propertyData.ownerPhone}
            placeholder="(000) 000-0000"
          />
        </div>
      </SectionWithProgress>

      {/* General Property Info */}
      <SectionWithProgress
        sectionId="general_info"
        label="General Information"
        icon={Building2}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SelectField
            onChange={handleInputChange}
            label="Property Type"
            name="propertyType"
            value={propertyData.propertyType}
            options={[
              "Single Family",
              "Townhouse",
              "Condo",
              "Multi-Family",
              "Manufactured",
              "Land",
              "Other",
            ]}
            readOnly={isRentCastLocked("propertyType")}
            verifiedLockTooltip={
              isRentCastLocked("propertyType") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Sub Type"
            name="subType"
            value={propertyData.subType}
            placeholder="e.g. Residential"
            readOnly={isRentCastLocked("subType")}
            verifiedLockTooltip={
              isRentCastLocked("subType") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Year Built"
            name="yearBuilt"
            type="number"
            value={propertyData.yearBuilt}
            readOnly={isRentCastLocked("yearBuilt")}
            verifiedLockTooltip={
              isRentCastLocked("yearBuilt") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
        </div>
      </SectionWithProgress>

      {/* Size & Lot */}
      <SectionWithProgress
        sectionId="size_lot"
        label="Size & Lot"
        icon={Ruler}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="Total (ft²)"
            name="sqFtTotal"
            type="number"
            value={propertyData.sqFtTotal || propertyData.squareFeet}
            readOnly={isRentCastLocked("sqFtTotal")}
            verifiedLockTooltip={
              isRentCastLocked("sqFtTotal") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Finished (ft²)"
            name="sqFtFinished"
            type="number"
            value={propertyData.sqFtFinished}
            readOnly={isRentCastLocked("sqFtFinished")}
            verifiedLockTooltip={
              isRentCastLocked("sqFtFinished") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Garage (ft²)"
            name="garageSqFt"
            type="number"
            value={propertyData.garageSqFt}
          />
          <Field
            onChange={handleInputChange}
            label="Total Dwelling (ft²)"
            name="totalDwellingSqFt"
            type="number"
            value={propertyData.totalDwellingSqFt}
            readOnly={isRentCastLocked("totalDwellingSqFt")}
            verifiedLockTooltip={
              isRentCastLocked("totalDwellingSqFt") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Lot Size"
            name="lotSize"
            value={propertyData.lotSize}
            placeholder="e.g. .200 ac / 8,700 sf"
            readOnly={isRentCastLocked("lotSize")}
            verifiedLockTooltip={
              isRentCastLocked("lotSize") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
        </div>
      </SectionWithProgress>

      {/* Rooms & Baths */}
      <SectionWithProgress
        sectionId="rooms_baths"
        label="Rooms & Baths"
        icon={Bed}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="Bedrooms"
            name="bedCount"
            type="number"
            value={propertyData.bedCount || propertyData.rooms}
            readOnly={isRentCastLocked("bedCount")}
            verifiedLockTooltip={
              isRentCastLocked("bedCount") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Bathrooms"
            name="bathCount"
            type="number"
            value={propertyData.bathCount || propertyData.bathrooms}
            readOnly={isRentCastLocked("bathCount")}
            verifiedLockTooltip={
              isRentCastLocked("bathCount") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Full Baths"
            name="fullBaths"
            type="number"
            value={propertyData.fullBaths}
            readOnly={isRentCastLocked("fullBaths")}
            verifiedLockTooltip={
              isRentCastLocked("fullBaths") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="3/4 Baths"
            name="threeQuarterBaths"
            type="number"
            value={propertyData.threeQuarterBaths}
            readOnly={isRentCastLocked("threeQuarterBaths")}
            verifiedLockTooltip={
              isRentCastLocked("threeQuarterBaths") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Half Baths"
            name="halfBaths"
            type="number"
            value={propertyData.halfBaths}
            readOnly={isRentCastLocked("halfBaths")}
            verifiedLockTooltip={
              isRentCastLocked("halfBaths") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />

          <Field
            onChange={handleInputChange}
            label="Number of Showers"
            name="numberOfShowers"
            type="number"
            value={propertyData.numberOfShowers}
            readOnly={isRentCastLocked("numberOfShowers")}
            verifiedLockTooltip={
              isRentCastLocked("numberOfShowers") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Number of Bathtubs"
            name="numberOfBathtubs"
            type="number"
            value={propertyData.numberOfBathtubs}
            readOnly={isRentCastLocked("numberOfBathtubs")}
            verifiedLockTooltip={
              isRentCastLocked("numberOfBathtubs") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
        </div>
      </SectionWithProgress>

      {/* Features & Parking */}
      <SectionWithProgress
        sectionId="features_parking"
        label="Features & Parking"
        icon={Flame}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="Fireplaces"
            name="fireplaces"
            type="number"
            value={propertyData.fireplaces}
            readOnly={isRentCastLocked("fireplaces")}
            verifiedLockTooltip={
              isRentCastLocked("fireplaces") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <SelectField
            onChange={handleInputChange}
            label="Fireplace Type"
            name="fireplaceTypes"
            value={propertyData.fireplaceTypes}
            options={["Gas", "Wood", "Other"]}
            readOnly={isRentCastLocked("fireplaceTypes")}
            verifiedLockTooltip={
              isRentCastLocked("fireplaceTypes") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <SelectField
            onChange={handleInputChange}
            label="Basement"
            name="basement"
            value={propertyData.basement}
            options={[
              "Daylight",
              "Fully Finished",
              "Partially Finished",
              "Roughed in",
              "Unfinished",
              "None",
            ]}
            readOnly={isRentCastLocked("basement")}
            verifiedLockTooltip={
              isRentCastLocked("basement") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />

          <Field
            onChange={handleInputChange}
            label="Parking Type"
            name="parkingType"
            value={propertyData.parkingType}
            placeholder="e.g. Driveway Parking"
            readOnly={isRentCastLocked("parkingType")}
            verifiedLockTooltip={
              isRentCastLocked("parkingType") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Total Covered Parking"
            name="totalCoveredParking"
            type="number"
            value={propertyData.totalCoveredParking}
            readOnly={isRentCastLocked("totalCoveredParking")}
            verifiedLockTooltip={
              isRentCastLocked("totalCoveredParking") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Total Uncovered Parking"
            name="totalUncoveredParking"
            type="number"
            value={propertyData.totalUncoveredParking}
            readOnly={isRentCastLocked("totalUncoveredParking")}
            verifiedLockTooltip={
              isRentCastLocked("totalUncoveredParking") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
        </div>
      </SectionWithProgress>

      {/* Schools */}
      <SectionWithProgress
        sectionId="schools"
        label="Schools"
        icon={School}
        propertyData={propertyData}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Field
            onChange={handleInputChange}
            label="School District"
            name="schoolDistrict"
            value={propertyData.schoolDistrict}
            placeholder="e.g. Seattle"
            readOnly={isRentCastLocked("schoolDistrict")}
            verifiedLockTooltip={
              isRentCastLocked("schoolDistrict") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Elementary"
            name="elementarySchool"
            value={propertyData.elementarySchool}
            readOnly={isRentCastLocked("elementarySchool")}
            verifiedLockTooltip={
              isRentCastLocked("elementarySchool") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Junior High"
            name="juniorHighSchool"
            value={propertyData.juniorHighSchool}
            readOnly={isRentCastLocked("juniorHighSchool")}
            verifiedLockTooltip={
              isRentCastLocked("juniorHighSchool") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
          <Field
            onChange={handleInputChange}
            label="Senior High"
            name="seniorHighSchool"
            value={propertyData.seniorHighSchool}
            readOnly={isRentCastLocked("seniorHighSchool")}
            verifiedLockTooltip={
              isRentCastLocked("seniorHighSchool") ? RENTCAST_VERIFIED_TOOLTIP : undefined
            }
            supportDataAdjustmentUrl={supportDataAdjustmentUrl}
          />
        </div>
      </SectionWithProgress>
    </div>
  );
}

export default IdentityTab;
