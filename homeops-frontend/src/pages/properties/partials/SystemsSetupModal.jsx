import React, {useState, useEffect, useCallback, useId, useRef} from "react";
import {createPortal} from "react-dom";
import {useParams, useNavigate} from "react-router-dom";
import {useDynamicPosition} from "../../../hooks/useDynamicPosition";
import {useAuth} from "../../../context/AuthContext";
import {
  Plus,
  X,
  Settings2,
  CheckCircle2,
  Loader2,
  Search,
  SearchX,
  SearchCheck,
  AlertCircle,
  FileCheck,
  Upload,
  ChevronRight,
  ArrowUpCircle,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import {PROPERTY_SYSTEMS} from "../constants/propertySystems";

/** Systems available in setup modal (excludes Inspections - add via Maintenance tab) */
const SETUP_SYSTEMS = PROPERTY_SYSTEMS.filter((s) => s.id !== "inspections");
import useGooglePlacesAutocomplete from "../../../hooks/useGooglePlacesAutocomplete";
import useDocumentUpload from "../../../hooks/useDocumentUpload";
import AppApi from "../../../api/api";
import AIFindingsPanel from "./AIFindingsPanel";
import UpgradePrompt from "../../../components/UpgradePrompt";
import OpsyMascot from "../../../images/opsy1.png";
import HouseIcon from "../../../images/house_icon.webp";
import GlassIcon from "../../../images/glass_icon.webp";
import {
  normalizeAiSystemToken,
  toDisplaySystemName,
  mapAiSystemTypeToIds,
} from "../helpers/aiSystemNormalization";
import {
  setInspectionFlowState,
  clearInspectionFlowState,
  getInspectionFlowState,
} from "../helpers/inspectionFlowSession";

/** Step definitions for the stepper. Order matters. */
const STEP_IDS = ["identity", "details", "inspection", "systems"];

const STEP_CONFIG = {
  identity: {label: "Identity"},
  details: {label: "Details"},
  systems: {label: "Systems"},
  inspection: {label: "Inspection"},
};

/** Property detail fields populated from RentCast public records, keyed by display group. */
const AI_FIELD_GROUPS = [
  {
    label: "Identity & Address",
    fields: [
      {key: "taxId", label: "Tax / Parcel ID"},
      {key: "county", label: "County"},
    ],
  },
  {
    label: "Ownership",
    fields: [
      {key: "ownerName", label: "Owner Name"},
      {key: "ownerName2", label: "Owner Name 2"},
      {key: "ownerCity", label: "Owner City"},
    ],
  },
  {
    label: "General",
    fields: [
      {key: "propertyType", label: "Property Type"},
      {key: "subType", label: "Sub Type"},
      {key: "roofType", label: "Roof Type"},
      {key: "yearBuilt", label: "Year Built", type: "number"},
    ],
  },
  {
    label: "Size & Lot",
    fields: [
      {key: "sqFtTotal", label: "Total ft²", type: "number"},
      {key: "sqFtFinished", label: "Finished ft²", type: "number"},
      {key: "garageSqFt", label: "Garage ft²", type: "number"},
      {key: "totalDwellingSqFt", label: "Total Dwelling ft²", type: "number"},
      {key: "lotSize", label: "Lot Size"},
    ],
  },
  {
    label: "Rooms & Baths",
    fields: [
      {key: "bedCount", label: "Bedrooms", type: "number"},
      {key: "bathCount", label: "Bathrooms", type: "number"},
      {key: "fullBaths", label: "Full Baths", type: "number"},
      {key: "threeQuarterBaths", label: "3/4 Baths", type: "number"},
      {key: "halfBaths", label: "Half Baths", type: "number"},
      {key: "numberOfShowers", label: "Showers", type: "number"},
      {key: "numberOfBathtubs", label: "Bathtubs", type: "number"},
    ],
  },
  {
    label: "Features & Parking",
    fields: [
      {key: "fireplaces", label: "Fireplaces", type: "number"},
      {key: "fireplaceTypes", label: "Fireplace Types"},
      {key: "basement", label: "Basement"},
      {key: "parkingType", label: "Parking Type"},
      {key: "totalCoveredParking", label: "Covered Parking", type: "number"},
      {
        key: "totalUncoveredParking",
        label: "Uncovered Parking",
        type: "number",
      },
    ],
  },
  {
    label: "Schools",
    fields: [
      {key: "schoolDistrict", label: "School District"},
      {key: "elementarySchool", label: "Elementary"},
      {key: "juniorHighSchool", label: "Junior High"},
      {key: "seniorHighSchool", label: "Senior High"},
    ],
  },
];

const TOTAL_AI_FIELDS = AI_FIELD_GROUPS.reduce(
  (acc, g) => acc + g.fields.length,
  0,
);

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

function LockedFieldControl({label, requestUrl}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerId = useId();
  const wrapperRef = useRef(null);
  const tooltipRef = useRef(null);
  const leaveTimeoutRef = useRef(null);

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
    leaveTimeoutRef.current = setTimeout(
      () => setIsOpen(false),
      TOOLTIP_LEAVE_DELAY,
    );
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

/** Returns { status, message, iconColor, bgGradient, cardClass, textClass } based on lookup result. */
function getDataLookupStatus(predictError, retrievedCount, totalFields) {
  if (predictError || retrievedCount === 0) {
    return {
      status: "red",
      message:
        "Whoops! Opsy was unable to pull data on your property. Please be on the lookout for how we can improve your experience.",
      iconColor: "text-red-500 dark:text-red-400",
      bgGradient:
        "from-red-500/12 to-red-500/5 dark:from-red-500/20 dark:to-red-500/8",
      cardClass:
        "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30",
      textClass: "text-red-800 dark:text-red-200",
    };
  }
  const ratio = retrievedCount / totalFields;
  if (ratio >= 0.6) {
    return {
      status: "green",
      message:
        "Congrats, we were able to pull most information from public records.",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      bgGradient:
        "from-emerald-500/12 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/8",
      cardClass:
        "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30",
      textClass: "text-emerald-800 dark:text-emerald-200",
    };
  }
  return {
    status: "orange",
    message:
      "We were able to pull a portion of the property data. Please be on the lookout for a follow up from Opsy on how to improve your data.",
    iconColor: "text-amber-600 dark:text-amber-400",
    bgGradient:
      "from-amber-500/12 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/8",
    cardClass:
      "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-800 dark:text-amber-200",
  };
}

function SystemsSetupModal({
  modalOpen,
  setModalOpen,
  initialStep = null,
  onlyStep = null,
  propertyId = null,
  selectedSystemIds = [],
  customSystems = [],
  isNewProperty = false,
  skipIdentityStep = false,
  formData = {},
  onIdentityFieldsChange,
  onSave,
  onSaveProperty,
  onScheduleMaintenance,
  upgradeUrl: upgradeUrlProp,
  externalSuggestedSystems = [],
}) {
  const {accountUrl: accountUrlParam} = useParams();
  const navigate = useNavigate();
  const accountUrl = accountUrlParam || "";
  const upgradeUrl =
    upgradeUrlProp ?? (accountUrl ? `/${accountUrl}/settings/upgrade` : null);

  const initialIds = selectedSystemIds ?? [];
  const [selected, setSelected] = useState(new Set(initialIds));
  const [custom, setCustom] = useState(
    customSystems.length
      ? customSystems.map((n) => ({id: `custom-${n}`, name: n}))
      : [],
  );
  const [newCustomName, setNewCustomName] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const showSystemsOnly = skipIdentityStep || !isNewProperty;
  const [step, setStep] = useState(showSystemsOnly ? "inspection" : "identity");
  const [identityFields, setIdentityFields] = useState({
    propertyName: "",
    address: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    zip: "",
    county: "",
    ownerName: "",
    ownerName2: "",
    ownerCity: "",
    occupantName: "",
    occupantType: "",
  });

  const [aiFields, setAiFields] = useState({});
  const [retrievedFieldCount, setRetrievedFieldCount] = useState(0);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState(null);
  const [hasPredicted, setHasPredicted] = useState(false);
  const [inspectionReportAvailable, setInspectionReportAvailable] =
    useState(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [analysisJobId, setAnalysisJobId] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptTitle, setUpgradePromptTitle] =
    useState("Upgrade your plan");
  const [upgradePromptMsg, setUpgradePromptMsg] = useState("");
  const [planRestrictionForAnalysis, setPlanRestrictionForAnalysis] =
    useState(false);
  const [selectedSuggestedSystems, setSelectedSuggestedSystems] = useState(
    new Set(),
  );
  const [savingProperty, setSavingProperty] = useState(false);
  const [propertyTypePreset, setPropertyTypePreset] = useState(null);
  const [lookupSource, setLookupSource] = useState(null);

  const {currentUser} = useAuth();
  const firstName =
    (currentUser?.name || "").trim().split(/\s+/)[0] ||
    currentUser?.firstName ||
    "";
  const possessiveName = !firstName
    ? "My"
    : firstName.endsWith("s")
      ? `${firstName}'`
      : `${firstName}'s`;
  const [savePropertyError, setSavePropertyError] = useState(null);
  const pollIntervalRef = useRef(null);
  const hasAppliedSuggestedRef = useRef(false);
  const hasAutoSelectedSuggestedRef = useRef(false);

  const handlePlaceSelected = useCallback((parsed) => {
    setPredictError(null);
    setIdentityFields((prev) => ({
      ...prev,
      address: parsed.formattedAddress,
      addressLine1: parsed.addressLine1,
      addressLine2: parsed.addressLine2 || prev.addressLine2,
      city: parsed.city,
      state: parsed.state,
      zip: parsed.zip,
      county: parsed.county,
    }));
  }, []);

  const {
    inputRef: addressInputRef,
    isLoaded: placesLoaded,
    error: placesError,
    AutocompleteWrapper: AddressAutocompleteWrapper,
  } = useGooglePlacesAutocomplete({onPlaceSelected: handlePlaceSelected});

  useEffect(() => {
    if (!modalOpen) return;
    const systemsOnly = skipIdentityStep || !isNewProperty;
    const defaultStep = onlyStep ?? (systemsOnly ? "inspection" : "identity");
    setStep(initialStep ?? defaultStep);
    setIdentityFields({
      propertyName: formData?.propertyName ?? "",
      address:
        formData?.address ||
        formData?.fullAddress ||
        [formData?.address, formData?.city, formData?.state, formData?.zip]
          .filter(Boolean)
          .join(", ") ||
        "",
      addressLine1: formData?.addressLine1 ?? "",
      addressLine2: formData?.addressLine2 ?? "",
      city: formData?.city ?? "",
      state: formData?.state ?? "",
      zip: formData?.zip ?? "",
      county: formData?.county ?? "",
      ownerName: formData?.ownerName ?? "",
      ownerName2: formData?.ownerName2 ?? "",
      ownerCity: formData?.ownerCity ?? "",
      occupantName: formData?.occupantName ?? "",
      occupantType: formData?.occupantType ?? "",
    });
    setAiFields({});
    setRetrievedFieldCount(0);
    setSelected(new Set(selectedSystemIds ?? []));
    setCustom(
      customSystems.length
        ? customSystems.map((n) => ({id: `custom-${n}`, name: n}))
        : [],
    );
    setNewCustomName("");
    setShowSuccess(false);
    setPredicting(false);
    setPredictError(null);
    setHasPredicted(false);
    setInspectionReportAvailable(onlyStep === "inspection" ? true : null);
    setUploadedDocs([]);
    setAnalysisJobId(null);
    setAnalysisStatus(null);
    setAnalysisProgress(null);
    setAnalysisError(null);
    setAnalysisResult(null);
    setPlanRestrictionForAnalysis(false);
    setSelectedSuggestedSystems(new Set());
    setSavingProperty(false);
    setSavePropertyError(null);
    setPropertyTypePreset(null);
    setLookupSource(null);
    hasAppliedSuggestedRef.current = false;
    hasAutoSelectedSuggestedRef.current = false;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, skipIdentityStep, isNewProperty, initialStep, onlyStep]);

  const handleIdentityFieldChange = (key, value) => {
    setIdentityFields((prev) => ({...prev, [key]: value}));
  };

  const PROPERTY_TYPE_PRESETS = [
    {id: "primary", label: "Primary Home", suffix: "Primary Home"},
    {id: "second", label: "Second Home", suffix: "Second Home"},
    {
      id: "investment",
      label: "Investment Property",
      suffix: "Investment Property",
    },
  ];

  const handlePropertyTypePresetChange = (presetId) => {
    const next = propertyTypePreset === presetId ? null : presetId;
    setPropertyTypePreset(next);
    if (next) {
      const preset = PROPERTY_TYPE_PRESETS.find((p) => p.id === next);
      if (preset) {
        const base = possessiveName || "My";
        const ownerName =
          (currentUser?.name || "").trim() ||
          identityFields.ownerName?.trim() ||
          "";
        const isOwnerOccupied = next === "primary" || next === "second";
        setIdentityFields((prev) => ({
          ...prev,
          propertyName: `${base} ${preset.suffix}`,
          occupantName: isOwnerOccupied ? ownerName : "",
          occupantType: isOwnerOccupied ? "Owner" : "",
        }));
      }
    } else {
      setIdentityFields((prev) => ({
        ...prev,
        occupantName: "",
        occupantType: "",
      }));
    }
  };

  const handleIdentityContinue = () => {
    onIdentityFieldsChange?.(identityFields);
    setSavePropertyError(null);
    // Don't reset lookup state if user already attempted a lookup (1 per property limit)
    if (!hasPredicted && !predictError) {
      setAiFields({});
      setHasPredicted(false);
      setPredictError(null);
      setRetrievedFieldCount(0);
    }
    setStep("details");
  };

  const handleDetailsContinue = async () => {
    const payload = {...identityFields};
    for (const group of AI_FIELD_GROUPS) {
      for (const f of group.fields) {
        const val = aiFields[f.key];
        if (val !== undefined && val !== null && val !== "") {
          payload[f.key] = f.type === "number" ? Number(val) : val;
        }
      }
    }
    if (hasPredicted) {
      payload.identityDataSource = lookupSource ?? "attom";
    }
    onIdentityFieldsChange?.(payload);

    if (isNewProperty && onSaveProperty) {
      setSavingProperty(true);
      setSavePropertyError(null);
      try {
        await onSaveProperty(payload);
        setStep("inspection");
      } catch (err) {
        setSavePropertyError(
          err?.message || "Failed to save property. Please try again.",
        );
      } finally {
        setSavingProperty(false);
      }
    } else {
      setStep("inspection");
    }
  };

  const handleLookupProperty = async () => {
    setPredicting(true);
    setPredictError(null);
    setSavePropertyError(null);
    try {
      const propertyInfo = {
        address: identityFields.address,
        addressLine1: identityFields.addressLine1,
        city: identityFields.city,
        state: identityFields.state,
        zip: identityFields.zip,
      };
      const result = await AppApi.lookupPropertyDetails(propertyInfo);
      if (result?.prediction) {
        setLookupSource(result.source ?? "attom");
        const p = result.prediction;
        const newFields = {};
        for (const group of AI_FIELD_GROUPS) {
          for (const f of group.fields) {
            if (
              p[f.key] !== undefined &&
              p[f.key] !== null &&
              p[f.key] !== ""
            ) {
              newFields[f.key] = p[f.key];
            }
          }
        }
        setAiFields(newFields);
        setRetrievedFieldCount(Object.keys(newFields).length);
        setHasPredicted(true);
      } else {
        setRetrievedFieldCount(0);
        setPredictError(
          "No property data found. Please enter values manually.",
        );
      }
    } catch (err) {
      const msg =
        err?.message || "No property data found. Please enter values manually.";
      setPredictError(msg);
      setRetrievedFieldCount(0);
    } finally {
      setPredicting(false);
    }
  };

  const toggleSystem = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustomSystem = () => {
    const baseName = newCustomName.trim();
    if (!baseName) return;
    setCustom((prev) => {
      const existingNames = new Set(prev.map((s) => s.name));
      let name = baseName;
      let counter = 2;
      while (existingNames.has(name)) {
        name = `${baseName} ${counter}`;
        counter++;
      }
      return [...prev, {id: `custom-${Date.now()}`, name}];
    });
    setNewCustomName("");
  };

  const removeCustomSystem = (id) => {
    setCustom((prev) => prev.filter((s) => s.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const persistSystems = () => {
    onSave?.({
      selectedIds: [...selected],
      customNames: custom.map((s) => s.name),
    });
  };

  const visibleSteps = onlyStep
    ? onlyStep === "inspection"
      ? ["inspection", "systems"]
      : [onlyStep]
    : isNewProperty
      ? STEP_IDS
      : STEP_IDS.filter((s) => s === "inspection" || s === "systems");
  const inspectionUploadOnly = onlyStep === "inspection";
  const currentStepIndex = visibleSteps.indexOf(step);
  const canGoToStep = (targetStep) => {
    const idx = visibleSteps.indexOf(targetStep);
    return idx >= 0 && idx <= currentStepIndex;
  };

  const goToStep = (targetStep) => {
    if (canGoToStep(targetStep)) {
      if (targetStep === "identity") setPredictError(null);
      setStep(targetStep);
    }
  };

  const handleSave = () => {
    setShowSuccess(true);
    setTimeout(() => {
      persistSystems();
      setModalOpen(false);
    }, 1400);
  };

  const handleInspectionContinue = () => {
    if (inspectionUploadOnly) {
      setModalOpen(false);
    } else {
      setStep("systems");
    }
  };

  // Pre-select systems when first reaching Systems step:
  // - If AI suggested systems exist (from internal analysis or external prop), add those.
  // - Otherwise preserve current selection; only default to all when nothing is selected yet.
  useEffect(() => {
    if (step !== "systems" || hasAppliedSuggestedRef.current) return;
    hasAppliedSuggestedRef.current = true;

    const suggested =
      (analysisResult?.suggestedSystemsToAdd ?? []).length > 0
        ? analysisResult.suggestedSystemsToAdd
        : externalSuggestedSystems ?? [];
    if (suggested.length > 0) {
      const selectedSuggestedNorm = new Set(
        [...selectedSuggestedSystems]
          .map((k) => normalizeAiSystemToken(k))
          .filter(Boolean),
      );
      const selectedOnlySuggestions = suggested.filter((s) =>
        selectedSuggestedNorm.has(
          normalizeAiSystemToken(s.systemType ?? s.system_key),
        ),
      );
      const shouldRespectSelection =
        hasAutoSelectedSuggestedRef.current || selectedSuggestedNorm.size > 0;
      const suggestionsToApply = shouldRespectSelection
        ? selectedOnlySuggestions
        : suggested;

      const standardIds = new Set();
      const customNames = new Set();
      suggestionsToApply.forEach((s) => {
        const raw = String(s.systemType ?? s.system_key ?? "").trim();
        if (!raw) return;
        const mappedIds = mapAiSystemTypeToIds(raw, SETUP_SYSTEMS);
        if (mappedIds.length > 0) {
          mappedIds.forEach((id) => standardIds.add(id));
        } else {
          const displayName = toDisplaySystemName(raw);
          if (displayName) customNames.add(displayName);
        }
      });
      const existingCustomNames = new Set(
        custom.map((c) => c.name.toLowerCase()),
      );
      const newCustomEntries = [...customNames]
        .filter((name) => !existingCustomNames.has(String(name).toLowerCase()))
        .map((name) => ({
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name,
        }));
      const idsToAddToSelected = [
        ...standardIds,
        ...newCustomEntries.map((c) => c.id),
      ];
      if (idsToAddToSelected.length > 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          idsToAddToSelected.forEach((id) => next.add(id));
          return next;
        });
      }
      if (newCustomEntries.length > 0) {
        setCustom((prev) => [...prev, ...newCustomEntries]);
      }
    } else {
      // No report analyzed: preserve saved/loaded systems in Configure flow.
      // Only fall back to selecting all for first-time setup when there is no selection yet.
      setSelected((prev) =>
        prev.size > 0 ? prev : new Set(SETUP_SYSTEMS.map((s) => s.id)),
      );
    }
  }, [
    step,
    analysisResult?.suggestedSystemsToAdd,
    externalSuggestedSystems,
    selectedSuggestedSystems,
    custom,
  ]);

  // Poll analysis job status
  useEffect(() => {
    if (!analysisJobId) return;
    const poll = async () => {
      try {
        const data = await AppApi.getInspectionAnalysisJob(analysisJobId);
        setAnalysisStatus(data.status);
        setAnalysisProgress(data.progress);
        setAnalysisError(data.errorMessage || null);
        if (propertyId) {
          const cur = getInspectionFlowState(propertyId);
          if (cur?.phase === "analyzing") {
            setInspectionFlowState(propertyId, {
              ...cur,
              progress: data.progress ?? cur.progress,
            });
          }
        }
        if (data.status === "completed" && data.result) {
          setAnalysisResult(data.result);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (data.status === "failed") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch (err) {
        setAnalysisError(err?.message || "Failed to fetch analysis status");
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };
    poll();
    pollIntervalRef.current = setInterval(poll, 2500);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [analysisJobId, propertyId]);

  useEffect(() => {
    if (!propertyId) return;
    if (analysisStatus === "completed" || analysisStatus === "failed") {
      clearInspectionFlowState(propertyId);
    }
  }, [propertyId, analysisStatus]);

  // Auto-select all suggested systems when analysis completes (tiles appear pre-checked)
  useEffect(() => {
    const suggested = analysisResult?.suggestedSystemsToAdd ?? [];
    if (suggested.length === 0 || hasAutoSelectedSuggestedRef.current) return;
    hasAutoSelectedSuggestedRef.current = true;
    const sysKeys = suggested
      .map((s) => String(s.systemType ?? s.system_key ?? "").trim())
      .filter(Boolean);
    if (sysKeys.length > 0) {
      setSelectedSuggestedSystems(new Set(sysKeys));
    }
  }, [analysisResult?.suggestedSystemsToAdd]);

  const startAnalysisForDoc = useCallback(
    async (s3Key, fileName, mimeType) => {
      if (!propertyId) return;
      setInspectionFlowState(propertyId, {
        phase: "starting_analysis",
        fileName,
        s3Key,
        mimeType: mimeType || "application/pdf",
      });
      try {
        const jobId = await AppApi.startInspectionAnalysis(propertyId, {
          s3Key,
          fileName,
          mimeType,
        });
        setInspectionFlowState(propertyId, {
          phase: "analyzing",
          jobId,
          fileName,
          s3Key,
          mimeType: mimeType || "application/pdf",
        });
        setAnalysisJobId(jobId);
        setAnalysisStatus("queued");
        setAnalysisError(null);
      } catch (err) {
        clearInspectionFlowState(propertyId);
        const msg = err?.message || "Failed to start analysis";
        setAnalysisError(msg);
        setAnalysisStatus("failed");
        const isTierRestriction =
          err?.status === 403 &&
          (msg.toLowerCase().includes("quota") ||
            msg.toLowerCase().includes("limit") ||
            msg.toLowerCase().includes("upgrade"));
        if (isTierRestriction) {
          setPlanRestrictionForAnalysis(true);
        }
      }
    },
    [propertyId],
  );

  const {
    uploadDocument,
    isUploading,
    progress: uploadProgress,
    error: uploadError,
  } = useDocumentUpload();

  useEffect(() => {
    if (!propertyId || !isUploading) return;
    const cur = getInspectionFlowState(propertyId);
    if (cur?.phase === "uploading") {
      setInspectionFlowState(propertyId, {
        ...cur,
        progress: uploadProgress,
      });
    }
  }, [propertyId, isUploading, uploadProgress]);

  const isTierError = (err) => {
    const status = err?.status ?? err?.response?.status;
    const msg = (err?.message || err?.error?.message || "").toLowerCase();
    return (
      status === 403 &&
      (msg.includes("quota") ||
        msg.includes("limit") ||
        msg.includes("upgrade") ||
        msg.includes("document limit"))
    );
  };

  const handleInspectionFileDrop = useCallback(
    async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []).filter(
        (f) => f.type === "application/pdf" || f.type.startsWith("image/"),
      );
      if (!propertyId || files.length === 0) return;
      for (const file of files) {
        setInspectionFlowState(propertyId, {
          phase: "uploading",
          fileName: file.name,
          progress: 0,
        });
        const result = await uploadDocument(file);
        if (!result?.key) {
          clearInspectionFlowState(propertyId);
          continue;
        }
        setInspectionFlowState(propertyId, {
          phase: "saving",
          fileName: file.name,
          s3Key: result.key,
          mimeType: file.type || "application/pdf",
        });
        try {
          AppApi._suppressTierEmit = true;
          const docDate = new Date().toISOString().slice(0, 10);
          await AppApi.createPropertyDocument({
            property_id: propertyId,
            document_name: "Inspection Report",
            document_date: docDate,
            document_key: result.key,
            document_type: "inspection",
            system_key: "inspectionReport",
            file_size_bytes: file.size,
          });
          setUploadedDocs((prev) => [
            ...prev,
            {key: result.key, name: file.name, type: file.type},
          ]);
          if (file.type === "application/pdf") {
            await startAnalysisForDoc(result.key, file.name, file.type);
            break;
          }
          clearInspectionFlowState(propertyId);
        } catch (docErr) {
          if (isTierError(docErr)) {
            setUploadedDocs((prev) => [
              ...prev,
              {key: result.key, name: file.name, type: file.type},
            ]);
            setPlanRestrictionForAnalysis(true);
          } else {
            clearInspectionFlowState(propertyId);
            throw docErr;
          }
          break;
        } finally {
          AppApi._suppressTierEmit = false;
        }
      }
    },
    [propertyId, uploadDocument, startAnalysisForDoc],
  );

  const handleInspectionFileSelect = useCallback(
    async (e) => {
      const files = Array.from(e.target?.files ?? []);
      e.target.value = "";
      if (!propertyId || files.length === 0) return;
      for (const file of files) {
        setInspectionFlowState(propertyId, {
          phase: "uploading",
          fileName: file.name,
          progress: 0,
        });
        const result = await uploadDocument(file);
        if (!result?.key) {
          clearInspectionFlowState(propertyId);
          continue;
        }
        setInspectionFlowState(propertyId, {
          phase: "saving",
          fileName: file.name,
          s3Key: result.key,
          mimeType: file.type || "application/pdf",
        });
        try {
          AppApi._suppressTierEmit = true;
          const docDate = new Date().toISOString().slice(0, 10);
          await AppApi.createPropertyDocument({
            property_id: propertyId,
            document_name: "Inspection Report",
            document_date: docDate,
            document_key: result.key,
            document_type: "inspection",
            system_key: "inspectionReport",
            file_size_bytes: file.size,
          });
          setUploadedDocs((prev) => [
            ...prev,
            {key: result.key, name: file.name, type: file.type},
          ]);
          if (file.type === "application/pdf") {
            await startAnalysisForDoc(result.key, file.name, file.type);
            break;
          }
          clearInspectionFlowState(propertyId);
        } catch (docErr) {
          if (isTierError(docErr)) {
            setUploadedDocs((prev) => [
              ...prev,
              {key: result.key, name: file.name, type: file.type},
            ]);
            setPlanRestrictionForAnalysis(true);
          } else {
            clearInspectionFlowState(propertyId);
            throw docErr;
          }
          break;
        } finally {
          AppApi._suppressTierEmit = false;
        }
      }
    },
    [propertyId, uploadDocument, startAnalysisForDoc],
  );

  const removeInspectionFile = (index) => {
    setUploadedDocs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setAnalysisJobId(null);
        setAnalysisStatus(null);
        setAnalysisResult(null);
        setAnalysisError(null);
        setPlanRestrictionForAnalysis(false);
        if (propertyId) clearInspectionFlowState(propertyId);
      }
      return next;
    });
  };

  const handleRetryAnalysis = useCallback(() => {
    const lastPdf = uploadedDocs.find((d) => d.type === "application/pdf");
    if (lastPdf && propertyId) {
      setAnalysisError(null);
      startAnalysisForDoc(lastPdf.key, lastPdf.name, lastPdf.type);
    }
  }, [uploadedDocs, propertyId, startAnalysisForDoc]);

  const toggleSuggestedSystem = (sysKey) => {
    setSelectedSuggestedSystems((prev) => {
      const next = new Set(prev);
      if (next.has(sysKey)) next.delete(sysKey);
      else next.add(sysKey);
      return next;
    });
  };

  const handleToggleSelectAllSuggested = () => {
    const suggested = analysisResult?.suggestedSystemsToAdd ?? [];
    const sysKeys = suggested
      .map((s) => String(s.systemType ?? s.system_key ?? "").trim())
      .filter(Boolean);
    const normalizedSysKeys = sysKeys.map((k) => normalizeAiSystemToken(k));
    const selectedNorm = new Set(
      [...selectedSuggestedSystems]
        .map((k) => normalizeAiSystemToken(k))
        .filter(Boolean),
    );
    const allSelected =
      normalizedSysKeys.length > 0 &&
      normalizedSysKeys.every((k) => selectedNorm.has(k));
    setSelectedSuggestedSystems(allSelected ? new Set() : new Set(sysKeys));
  };

  const handleScheduleFromAi = (item) => {
    onScheduleMaintenance?.(item);
    setModalOpen(false);
  };

  const suggestedFromAi = analysisResult?.suggestedSystemsToAdd ?? [];
  const initialSelectedSet = new Set(selectedSystemIds ?? []);
  const allSuggestedAlreadyIncluded =
    suggestedFromAi.length > 0 &&
    suggestedFromAi.every((s) => {
      const raw = String(s.systemType ?? s.system_key ?? "").trim();
      if (!raw) return true;
      const mappedIds = mapAiSystemTypeToIds(raw, SETUP_SYSTEMS);
      return mappedIds.length > 0 && mappedIds.every((id) => initialSelectedSet.has(id));
    });
  const allSystemsIncluded =
    allSuggestedAlreadyIncluded &&
    SETUP_SYSTEMS.every((s) => initialSelectedSet.has(s.id));

  return (
    <ModalBlank
      id="systems-setup-modal"
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-4xl"
    >
      <div className="relative">
        {/* Opsy mascot and horizontal step tracker */}
        {!showSuccess && visibleSteps.length > 1 && (
          <div className="px-6 md:px-8 pt-6 pb-0">
            <div className="flex justify-center mb-4">
              <img
                src={OpsyMascot}
                alt=""
                className="h-24 w-auto object-contain"
              />
            </div>
            <nav
              className="flex items-start justify-center max-w-md mx-auto"
              aria-label="Progress"
            >
              {visibleSteps.map((stepId, idx) => {
                const config = STEP_CONFIG[stepId];
                const isActive = step === stepId;
                const isCompleted = currentStepIndex > idx;
                const isClickable = canGoToStep(stepId);
                return (
                  <React.Fragment key={stepId}>
                    <button
                      type="button"
                      onClick={() => isClickable && goToStep(stepId)}
                      disabled={!isClickable}
                      className={`group flex flex-col items-center gap-1.5 ${
                        isClickable ? "cursor-pointer" : "cursor-default"
                      }`}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <span
                        className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all duration-200 ${
                          isActive
                            ? "bg-[#456564] text-white ring-4 ring-[#456564]/10 dark:ring-[#456564]/20"
                            : isCompleted
                              ? "bg-[#456564] text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {isCompleted && !isActive ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <span
                        className={`text-[11px] font-medium leading-tight text-center transition-colors duration-200 ${
                          isActive
                            ? "text-gray-900 dark:text-white"
                            : isCompleted
                              ? "text-gray-600 dark:text-gray-300"
                              : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {config.label}
                      </span>
                    </button>
                    {idx < visibleSteps.length - 1 && (
                      <div className="h-7 flex-1 flex items-center mx-1.5 sm:mx-2.5">
                        <div
                          className={`w-full h-px transition-colors duration-300 ${
                            currentStepIndex > idx
                              ? "bg-[#456564]"
                              : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
          </div>
        )}

        <style>{`
          @keyframes systemsStepFadeIn {
            from { opacity: 0; transform: translateX(12px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes systemsModalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes systemsModalScaleIn {
            from { opacity: 0; transform: scale(0.85); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
        <div className="p-6 md:p-8 relative min-h-[320px] pt-0">
          {/* Success overlay with animation */}
          {showSuccess && (
            <>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-gray-800/95 rounded-lg z-10"
                style={{animation: "systemsModalFadeIn 0.3s ease-out forwards"}}
              >
                <div
                  className="flex flex-col items-center gap-3"
                  style={{
                    animation:
                      "systemsModalScaleIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s forwards",
                  }}
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    Setup complete!
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Step 1: Identity & Address — property name + address only (details from RentCast) */}
          {step === "identity" && isNewProperty && (
            <div
              className="space-y-8 -mt-20"
              style={{animation: "systemsStepFadeIn 0.35s ease-out forwards"}}
            >
              {/* Centered header */}
              <div className="text-center">
                <div className="flex flex-col items-center">
                  <img
                    src={HouseIcon}
                    alt=""
                    className="w-64 h-64 object-contain block -mb-10"
                  />
                  <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-1">
                    Let's set up your property
                  </h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed mt-0">
                  Enter the name and address. We'll look up property details
                  from public records.
                </p>
              </div>

              {/* Centered form — property name + address only */}
              <div className="flex justify-center">
                <div className="w-full max-w-md space-y-6">
                  {/* Property type checkboxes — mutually exclusive, auto-fill name */}
                  <div className="flex flex-wrap gap-4">
                    {PROPERTY_TYPE_PRESETS.map((preset) => (
                      <label
                        key={preset.id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={propertyTypePreset === preset.id}
                          onChange={() =>
                            handlePropertyTypePresetChange(preset.id)
                          }
                          className="property-type-checkbox rounded border-gray-300 dark:border-gray-600 text-[#456564]"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                          {preset.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                      Property name
                    </label>
                    <input
                      type="text"
                      value={identityFields.propertyName}
                      onChange={(e) =>
                        handleIdentityFieldChange(
                          "propertyName",
                          e.target.value,
                        )
                      }
                      placeholder="e.g. Lakewood Estate, My Home"
                      className="form-input w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-colors py-3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                      Address
                    </label>
                    {AddressAutocompleteWrapper ? (
                      <AddressAutocompleteWrapper>
                        <input
                          key={String(modalOpen)}
                          ref={addressInputRef}
                          type="text"
                          defaultValue={identityFields.address}
                          placeholder="Start typing an address to search..."
                          className="form-input w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-colors py-3"
                          autoComplete="off"
                        />
                      </AddressAutocompleteWrapper>
                    ) : (
                      <input
                        key={String(modalOpen)}
                        ref={addressInputRef}
                        type="text"
                        defaultValue={identityFields.address}
                        placeholder="Start typing an address to search..."
                        className="form-input w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-colors py-3"
                        autoComplete="off"
                      />
                    )}
                    {placesError && (
                      <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                        {placesError} — you can still type the address manually.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-4">
                {!isNewProperty && (
                  <button
                    type="button"
                    onClick={() => setStep("details")}
                    className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleIdentityContinue}
                  className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2 transition-colors"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Property Data Lookup — fetch details from RentCast public records (new properties only) */}
          {step === "details" && isNewProperty && (
            <div
              className="space-y-6"
              style={{animation: "systemsStepFadeIn 0.35s ease-out forwards"}}
            >
              <div className="text-center pb-2">
                {(() => {
                  const showStatusMessage = hasPredicted || predictError;
                  const status = getDataLookupStatus(
                    predictError,
                    retrievedFieldCount,
                    TOTAL_AI_FIELDS,
                  );
                  const iconBoxClass = showStatusMessage
                    ? `rounded-2xl shadow-sm bg-gradient-to-br ${status.bgGradient}`
                    : "";
                  const iconClass = showStatusMessage
                    ? status.iconColor
                    : "text-[#456564]";
                  const StatusIcon = showStatusMessage
                    ? status.status === "red"
                      ? SearchX
                      : SearchCheck
                    : null;
                  return (
                    <>
                      <div
                        className={`relative inline-flex items-center justify-center w-16 h-16 p-0 ${iconBoxClass} mb-4`}
                      >
                        {showStatusMessage ? (
                          <StatusIcon
                            className={`w-8 h-8 ${iconClass}`}
                            strokeWidth={1.5}
                          />
                        ) : (
                          <img
                            src={GlassIcon}
                            alt="Property data lookup"
                            className="w-16 h-16 object-contain scale-[2.25]"
                          />
                        )}
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
                        Property Data Lookup
                      </h2>
                      {showStatusMessage ? (
                        <div
                          className={`rounded-xl border px-4 py-3 max-w-md mx-auto ${status.cardClass}`}
                        >
                          <p
                            className={`text-sm leading-relaxed ${status.textClass}`}
                          >
                            {status.message}
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                          Pull property details from public records based on the
                          address you provided.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Property lookup button — one lookup per property */}
              {(() => {
                const hasAddress = !!(
                  identityFields.address?.trim() ||
                  identityFields.addressLine1?.trim()
                );
                const lookupUsed = hasPredicted || predictError;
                const canLookup = hasAddress && !lookupUsed && !predicting;
                return (
                  <div className="flex flex-col items-center gap-3">
                    <button
                      type="button"
                      disabled={!canLookup}
                      onClick={handleLookupProperty}
                      className="btn bg-gradient-to-r from-[#456564] to-[#3a5548] hover:from-[#34514f] hover:to-[#2d4640] text-white shadow-sm inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {predicting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      {predicting
                        ? "Looking up property..."
                        : "Look up property data"}
                    </button>
                    {!hasAddress && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Enter an address on the previous step to look up
                        property data.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Property data fields: only show fields with API data; API-populated are locked */}
              {hasPredicted && (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-5 md:p-6 space-y-5 max-h-[45vh] overflow-y-auto">
                  {AI_FIELD_GROUPS.map((group) => {
                    const fieldsWithData = group.fields.filter(
                      (f) =>
                        aiFields[f.key] !== undefined &&
                        aiFields[f.key] !== null &&
                        String(aiFields[f.key]).trim() !== "",
                    );
                    if (fieldsWithData.length === 0) return null;
                    return (
                      <div key={group.label}>
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                          {group.label}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {fieldsWithData.map((f) => {
                            const val = aiFields[f.key] ?? formData?.[f.key];
                            const isFromApi =
                              val !== undefined &&
                              val !== null &&
                              String(val).trim() !== "";
                            const supportUrl = (() => {
                              if (!accountUrl || !isFromApi) return null;
                              const params = new URLSearchParams();
                              const systemLabel =
                                (lookupSource ||
                                  formData?.identity_data_source) === "rentcast"
                                  ? "RentCast"
                                  : "ATTOM";
                              params.set("system", systemLabel);
                              params.set("field", f.key);
                              if (propertyId) {
                                params.set("propertyId", String(propertyId));
                              }
                              const propertyLabel =
                                identityFields.propertyName ||
                                identityFields.address;
                              if (propertyLabel) {
                                params.set("propertyLabel", propertyLabel);
                              }
                              if (val != null && String(val).trim() !== "") {
                                params.set("currentValue", String(val));
                              }
                              return `/${accountUrl}/settings/support/data-adjustment?${params.toString()}`;
                            })();

                            return (
                              <div key={f.key}>
                                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  {f.label}
                                  {isFromApi && (
                                    <LockedFieldControl
                                      label={f.label}
                                      requestUrl={supportUrl}
                                    />
                                  )}
                                </label>
                                <input
                                  type={f.type === "number" ? "number" : "text"}
                                  value={val ?? ""}
                                  readOnly={isFromApi}
                                  aria-readonly={isFromApi}
                                  aria-label={
                                    isFromApi
                                      ? `${f.label} (verified, read-only)`
                                      : f.label
                                  }
                                  onChange={
                                    isFromApi
                                      ? undefined
                                      : (e) =>
                                          setAiFields((prev) => ({
                                            ...prev,
                                            [f.key]: e.target.value,
                                          }))
                                  }
                                  className={
                                    isFromApi
                                      ? "form-input w-full text-sm rounded-lg border-gray-200 dark:border-gray-600 bg-gray-100/80 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-default py-1.5 focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-600 focus:border-gray-300 dark:focus:border-gray-600"
                                      : "form-input w-full text-sm rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#456564]/20 focus:border-[#456564] transition-colors py-1.5"
                                  }
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {savePropertyError &&
                (() => {
                  const isPropertyLimit = /property limit/i.test(
                    savePropertyError,
                  );
                  if (isPropertyLimit) {
                    return (
                      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-900/20 p-4">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              Property limit reached
                            </p>
                            <p className="text-sm text-amber-700 dark:text-amber-300/90 mt-0.5">
                              You've used all properties on your current plan.
                              Upgrade to add more.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUpgradePromptTitle("Property limit reached");
                            setUpgradePromptMsg(
                              "You've used all properties on your current plan. Upgrade to add more.",
                            );
                            setUpgradePromptOpen(true);
                          }}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-sm font-medium transition-colors"
                        >
                          <ArrowUpCircle className="w-4 h-4" />
                          Upgrade plan
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{savePropertyError}</span>
                    </div>
                  );
                })()}
              <div className="flex justify-between gap-3 pt-0">
                <button
                  type="button"
                  onClick={() => setStep("identity")}
                  disabled={savingProperty}
                  className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-60"
                >
                  Back
                </button>
                <div className="flex gap-3">
                  {!isNewProperty && (
                    <button
                      type="button"
                      onClick={() => setStep("inspection")}
                      className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDetailsContinue}
                    disabled={savingProperty}
                    className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {savingProperty ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving property…
                      </>
                    ) : (
                      "Continue"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Property Systems (final step — after inspection) */}
          {step === "systems" && (
            <div
              style={{animation: "systemsStepFadeIn 0.35s ease-out forwards"}}
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#456564]/10 dark:bg-[#456564]/20 shadow-sm">
                  <Settings2 className="w-6 h-6 text-[#456564]" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    Property Systems
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    Please deselect the systems you do not wish to track and
                    maintain.
                  </p>
                </div>
              </div>

              {/* Predefined systems grid */}
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Common systems
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SETUP_SYSTEMS.map((sys) => {
                    const Icon = sys.icon;
                    const isSelected = selected.has(sys.id);
                    return (
                      <button
                        key={sys.id}
                        type="button"
                        onClick={() => toggleSystem(sys.id)}
                        className={`group relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 ${
                          isSelected
                            ? "border-[#456564] bg-[#456564]/[0.04] dark:bg-[#456564]/10 ring-1 ring-[#456564]/20"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-800/60"
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors duration-200 ${
                            isSelected
                              ? "bg-[#456564] text-white"
                              : "bg-gray-100 dark:bg-gray-700/70 text-gray-400 dark:text-gray-500 group-hover:bg-gray-200/70 dark:group-hover:bg-gray-700"
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px]" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <span
                            className={`text-sm font-medium block leading-tight ${
                              isSelected
                                ? "text-gray-900 dark:text-white"
                                : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {sys.name}
                          </span>
                          {sys.description && (
                            <span className="text-[11px] leading-snug text-gray-400 dark:text-gray-500 mt-0.5 block">
                              {sys.description}
                            </span>
                          )}
                        </div>
                        <div
                          className={`w-[18px] h-[18px] rounded flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                            isSelected
                              ? "bg-[#456564] text-white"
                              : "border border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="currentColor"
                              viewBox="0 0 12 12"
                            >
                              <path d="M10.28 2.28L3.989 8.575 1.695 6.28A1 1 0 00.28 7.695l3 3a1 1 0 001.414 0l7-7a1 1 0 10-1.414-1.414z" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add custom system */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Add Additional System(s)
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (e.preventDefault(), addCustomSystem())
                    }
                    placeholder="e.g. Solar, Pool, Elevator"
                    className="form-input flex-1 rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={addCustomSystem}
                    className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>

              {/* Custom systems list */}
              {custom.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Custom systems
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {custom.map((sys) => {
                      const isSelected = selected.has(sys.id);
                      return (
                        <div
                          key={sys.id}
                          className={`inline-flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg border ${
                            isSelected
                              ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/10"
                              : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800/50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSystem(sys.id)}
                            className="text-sm font-medium text-gray-800 dark:text-gray-200"
                          >
                            {sys.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCustomSystem(sys.id)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
                            aria-label={`Remove ${sys.name}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-8 border-t border-gray-200/80 dark:border-gray-700/80 mt-8">
                {onlyStep !== "systems" && (
                  <button
                    type="button"
                    onClick={() => goToStep("inspection")}
                    className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Back
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2"
                  >
                    {isNewProperty ? "Complete setup" : "Update systems"}
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Inspection Report (before systems) */}
          {step === "inspection" && (
            <div
              className="space-y-8"
              style={{animation: "systemsStepFadeIn 0.35s ease-out forwards"}}
            >
              <div className="text-center max-w-md mx-auto">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#456564]/15 to-[#456564]/5 dark:from-[#456564]/25 dark:to-[#456564]/10 mb-5">
                  <FileCheck
                    className="w-8 h-8 text-[#456564]"
                    strokeWidth={1.5}
                  />
                </div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  {inspectionUploadOnly
                    ? "Upload inspection report"
                    : "Inspection Report"}
                </h2>
                {!inspectionUploadOnly && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Do you have an inspection report available for this property?
                  </p>
                )}
                {inspectionUploadOnly && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    Add a PDF or image. AI analysis runs automatically for PDFs.
                  </p>
                )}
              </div>

              {/* Yes/No toggle — skipped when opened for upload-only (e.g. Passport Opsymization) */}
              {!inspectionUploadOnly && (
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setInspectionReportAvailable(true)}
                    className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all duration-200 ${
                      inspectionReportAvailable === true
                        ? "border-[#456564] bg-[#456564]/10 dark:bg-[#456564]/20 shadow-sm"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800/50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        inspectionReportAvailable === true
                          ? "border-[#456564] bg-[#456564]"
                          : "border-gray-300 dark:border-gray-500"
                      }`}
                    >
                      {inspectionReportAvailable === true && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span
                      className={`font-medium ${
                        inspectionReportAvailable === true
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      Yes
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionReportAvailable(false)}
                    className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all duration-200 ${
                      inspectionReportAvailable === false
                        ? "border-[#456564] bg-[#456564]/10 dark:bg-[#456564]/20 shadow-sm"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-800/50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        inspectionReportAvailable === false
                          ? "border-[#456564] bg-[#456564]"
                          : "border-gray-300 dark:border-gray-500"
                      }`}
                    >
                      {inspectionReportAvailable === false && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <span
                      className={`font-medium ${
                        inspectionReportAvailable === false
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      No
                    </span>
                  </button>
                </div>
              )}

              {/* File upload (shown when Yes, or immediately in upload-only flow) */}
              {(inspectionUploadOnly || inspectionReportAvailable === true) && (
                <div className="space-y-4">
                  {!propertyId && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Save the property first to upload and analyze inspection
                      reports.
                    </p>
                  )}
                  <div
                    className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-8 transition-all duration-300"
                    style={{
                      animation: "systemsStepFadeIn 0.3s ease-out forwards",
                    }}
                  >
                    <div
                      className="relative flex flex-col items-center justify-center min-h-[160px] py-6"
                      onDragOver={(e) => e.preventDefault()}
                      onDragLeave={(e) => e.preventDefault()}
                      onDrop={
                        propertyId
                          ? handleInspectionFileDrop
                          : (e) => e.preventDefault()
                      }
                    >
                      <input
                        type="file"
                        multiple
                        accept=".pdf,image/*"
                        onChange={handleInspectionFileSelect}
                        disabled={!propertyId || isUploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                        id="inspection-file-input"
                      />
                      {isUploading ? (
                        <>
                          <Loader2 className="w-12 h-12 text-[#456564] animate-spin mb-4" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Uploading… {uploadProgress}%
                          </p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Drag & drop your inspection report here
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            or click to browse (PDF, images). AI analysis runs
                            for PDFs.
                          </p>
                        </>
                      )}
                      {uploadError && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                          {uploadError}
                        </p>
                      )}
                      {uploadedDocs.length > 0 && (
                        <div className="w-full max-w-sm space-y-2 mt-4">
                          {uploadedDocs.map((doc, idx) => (
                            <div
                              key={`${doc.key}-${idx}`}
                              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600"
                            >
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                                {doc.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeInspectionFile(idx)}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
                                aria-label={`Remove ${doc.name}`}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Single inline upgrade message when plan doesn't support AI analysis */}
                  {planRestrictionForAnalysis && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-900/20 p-5">
                      <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                        Your current plan does not include AI report analysis.
                        Upgrade to unlock personalized insights, prioritized
                        recommendations, and action items tailored to your
                        inspection report.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            upgradeUrl ??
                              (accountUrl
                                ? `/${accountUrl}/settings/upgrade`
                                : "/settings/upgrade"),
                          )
                        }
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-sm font-medium transition-colors"
                      >
                        <ArrowUpCircle className="w-4 h-4" />
                        Upgrade plan
                      </button>
                    </div>
                  )}

                  {/* AI Findings panel — hidden when plan restriction or all suggested already on property */}
                  {!planRestrictionForAnalysis &&
                    (analysisJobId || analysisStatus) && (
                      <AIFindingsPanel
                        status={analysisStatus}
                        progress={analysisProgress}
                        errorMessage={analysisError}
                        result={analysisResult}
                        suggestedSystemsToAdd={
                          allSuggestedAlreadyIncluded
                            ? []
                            : analysisResult?.suggestedSystemsToAdd ?? []
                        }
                        selectedSuggestedSystems={[...selectedSuggestedSystems]}
                        onToggleSuggestedSystem={toggleSuggestedSystem}
                        onToggleSelectAllSuggested={
                          handleToggleSelectAllSuggested
                        }
                        onScheduleMaintenance={undefined}
                        onRetry={handleRetryAnalysis}
                      />
                    )}

                </div>
              )}

              <div className="flex justify-between items-center gap-3 pt-4">
                <div>
                  {canGoToStep("details") && (
                    <button
                      type="button"
                      onClick={() => goToStep("details")}
                      className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      Back
                    </button>
                  )}
                </div>
                {analysisStatus === "completed" && suggestedFromAi.length > 0 ? (
                  allSystemsIncluded ? (
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2 ml-auto"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Done
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStep("systems")}
                      className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2 ml-auto"
                    >
                      Continue to systems
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleInspectionContinue}
                    disabled={
                      analysisStatus === "queued" ||
                      analysisStatus === "processing"
                    }
                    className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2 ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {analysisStatus === "queued" ||
                    analysisStatus === "processing" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing…
                      </>
                    ) : inspectionUploadOnly ? (
                      "Done"
                    ) : (
                      <>
                        Continue
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <UpgradePrompt
        open={upgradePromptOpen}
        onClose={() => {
          setUpgradePromptOpen(false);
          setUpgradePromptTitle("Upgrade your plan");
          setUpgradePromptMsg("");
        }}
        title={upgradePromptTitle}
        message={
          upgradePromptMsg ||
          "You've reached the limit for your current plan. Upgrade to unlock inspection report analysis and more AI features."
        }
        upgradeUrl={upgradeUrl}
      />
    </ModalBlank>
  );
}

export default SystemsSetupModal;
