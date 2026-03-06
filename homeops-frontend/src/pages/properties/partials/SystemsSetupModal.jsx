import React, {useState, useEffect, useCallback, useRef} from "react";
import {
  Plus,
  X,
  Settings2,
  CheckCircle2,
  Sparkles,
  Loader2,
  Search,
  AlertCircle,
  Database,
  FileCheck,
  Upload,
  ChevronRight,
} from "lucide-react";
import ModalBlank from "../../../components/ModalBlank";
import {
  PROPERTY_SYSTEMS,
  STANDARD_CUSTOM_SYSTEM_FIELDS,
} from "../constants/propertySystems";

/** Systems available in setup modal (excludes Inspections - add via Maintenance tab) */
const SETUP_SYSTEMS = PROPERTY_SYSTEMS.filter((s) => s.id !== "inspections");
import useGooglePlacesAutocomplete from "../../../hooks/useGooglePlacesAutocomplete";
import useDocumentUpload from "../../../hooks/useDocumentUpload";
import AppApi from "../../../api/api";
import AIFindingsPanel from "./AIFindingsPanel";
import UpgradePrompt from "../../../components/UpgradePrompt";

/** Step definitions for the stepper. Order matters. */
const STEP_IDS = ["identity", "details", "inspection", "systems"];

const STEP_CONFIG = {
  identity: { label: "Identity" },
  details: { label: "Details" },
  systems: { label: "Systems" },
  inspection: { label: "Inspection" },
};

/** Property detail fields populated from RentCast public records, keyed by display group. */
const AI_FIELD_GROUPS = [
  {
    label: "Identity & Address",
    fields: [
      {key: "taxId", label: "Tax / Parcel ID"},
      {key: "addressLine2", label: "Address Line 2"},
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

function SystemsSetupModal({
  modalOpen,
  setModalOpen,
  initialStep = null,
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
}) {
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
  });

  const [aiFields, setAiFields] = useState({});
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState(null);
  const [hasPredicted, setHasPredicted] = useState(false);
  const [inspectionReportAvailable, setInspectionReportAvailable] = useState(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [analysisJobId, setAnalysisJobId] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptMsg, setUpgradePromptMsg] = useState("");
  const [selectedSuggestedSystems, setSelectedSuggestedSystems] = useState(new Set());
  const [savingProperty, setSavingProperty] = useState(false);
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
    const defaultStep = systemsOnly ? "inspection" : "identity";
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
    });
    setAiFields({});
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
    setInspectionReportAvailable(null);
    setUploadedDocs([]);
    setAnalysisJobId(null);
    setAnalysisStatus(null);
    setAnalysisProgress(null);
    setAnalysisError(null);
    setAnalysisResult(null);
    setSelectedSuggestedSystems(new Set());
    setSavingProperty(false);
    setSavePropertyError(null);
    hasAppliedSuggestedRef.current = false;
    hasAutoSelectedSuggestedRef.current = false;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, skipIdentityStep, isNewProperty, initialStep]);

  const handleIdentityFieldChange = (key, value) => {
    setIdentityFields((prev) => ({...prev, [key]: value}));
  };

  const handleIdentityContinue = () => {
    onIdentityFieldsChange?.(identityFields);
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
    onIdentityFieldsChange?.(payload);

    if (isNewProperty && onSaveProperty) {
      setSavingProperty(true);
      setSavePropertyError(null);
      try {
        await onSaveProperty(payload);
        setStep("inspection");
      } catch (err) {
        setSavePropertyError(err?.message || "Failed to save property. Please try again.");
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
        setHasPredicted(true);
      }
    } catch (err) {
      const msg =
        err?.message || "No property data found. Please enter values manually.";
      setPredictError(msg);
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

  const visibleSteps = isNewProperty
    ? STEP_IDS
    : STEP_IDS.filter((s) => s === "inspection" || s === "systems");
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
    setStep("systems");
  };

  // Pre-select recommended systems when first reaching Systems step (including custom AI-suggested)
  useEffect(() => {
    if (step !== "systems" || !analysisResult?.suggestedSystemsToAdd?.length || hasAppliedSuggestedRef.current) return;
    hasAppliedSuggestedRef.current = true;
    const suggested = analysisResult.suggestedSystemsToAdd;
    const standardIds = [];
    const customNames = [];
    suggested.forEach((s) => {
      const raw = String(s.systemType ?? s.system_key ?? "").trim();
      if (!raw) return;
      const match = SETUP_SYSTEMS.find(
        (sys) => sys.id === raw || sys.id.toLowerCase() === raw.toLowerCase(),
      );
      if (match) {
        standardIds.push(match.id);
      } else {
        const displayName =
          raw.charAt(0).toUpperCase() + raw.slice(1).replace(/([A-Z])/g, " $1").trim();
        customNames.push(displayName);
      }
    });
    const existingCustomNames = new Set(custom.map((c) => c.name.toLowerCase()));
    const newCustomEntries = customNames
      .filter((name) => !existingCustomNames.has(name.toLowerCase()))
      .map((name) => ({id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name}));
    const idsToAddToSelected = [...standardIds, ...newCustomEntries.map((c) => c.id)];
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
  }, [step, analysisResult?.suggestedSystemsToAdd, custom]);

  const handleSkipSystems = () => {
    persistSystems();
    setModalOpen(false);
  };

  // Poll analysis job status
  useEffect(() => {
    if (!analysisJobId) return;
    const poll = async () => {
      try {
        const data = await AppApi.getInspectionAnalysisJob(analysisJobId);
        setAnalysisStatus(data.status);
        setAnalysisProgress(data.progress);
        setAnalysisError(data.errorMessage || null);
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
  }, [analysisJobId]);

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
      try {
        const jobId = await AppApi.startInspectionAnalysis(propertyId, {
          s3Key,
          fileName,
          mimeType,
        });
        setAnalysisJobId(jobId);
        setAnalysisStatus("queued");
        setAnalysisError(null);
      } catch (err) {
        const msg = err?.message || "Failed to start analysis";
        setAnalysisError(msg);
        setAnalysisStatus("failed");
        const isTierRestriction =
          err?.status === 403 &&
          (msg.toLowerCase().includes("quota") ||
            msg.toLowerCase().includes("limit") ||
            msg.toLowerCase().includes("upgrade"));
        if (isTierRestriction) {
          setUpgradePromptMsg(msg);
          setUpgradePromptOpen(true);
        }
      }
    },
    [propertyId]
  );

  const {uploadDocument, isUploading, progress: uploadProgress, error: uploadError} = useDocumentUpload();

  const handleInspectionFileDrop = useCallback(
    async (e) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []).filter(
        (f) => f.type === "application/pdf" || f.type.startsWith("image/")
      );
      if (!propertyId || files.length === 0) return;
      for (const file of files) {
        const result = await uploadDocument(file);
        if (result?.key) {
          const docDate = new Date().toISOString().slice(0, 10);
          await AppApi.createPropertyDocument({
            property_id: propertyId,
            document_name: "Inspection Report",
            document_date: docDate,
            document_key: result.key,
            document_type: "inspection",
            system_key: "inspectionReport",
          });
          setUploadedDocs((prev) => [...prev, {key: result.key, name: file.name, type: file.type}]);
          if (file.type === "application/pdf") {
            startAnalysisForDoc(result.key, file.name, file.type);
            break;
          }
        }
      }
    },
    [propertyId, uploadDocument, startAnalysisForDoc]
  );

  const handleInspectionFileSelect = useCallback(
    async (e) => {
      const files = Array.from(e.target?.files ?? []);
      e.target.value = "";
      if (!propertyId || files.length === 0) return;
      for (const file of files) {
        const result = await uploadDocument(file);
        if (result?.key) {
          const docDate = new Date().toISOString().slice(0, 10);
          await AppApi.createPropertyDocument({
            property_id: propertyId,
            document_name: "Inspection Report",
            document_date: docDate,
            document_key: result.key,
            document_type: "inspection",
            system_key: "inspectionReport",
          });
          setUploadedDocs((prev) => [...prev, {key: result.key, name: file.name, type: file.type}]);
          if (file.type === "application/pdf") {
            startAnalysisForDoc(result.key, file.name, file.type);
            break;
          }
        }
      }
    },
    [propertyId, uploadDocument, startAnalysisForDoc]
  );

  const removeInspectionFile = (index) => {
    setUploadedDocs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setAnalysisJobId(null);
        setAnalysisStatus(null);
        setAnalysisResult(null);
        setAnalysisError(null);
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
    const allSelected = sysKeys.length > 0 && sysKeys.every((k) => selectedSuggestedSystems.has(k));
    setSelectedSuggestedSystems(allSelected ? new Set() : new Set(sysKeys));
  };

  const handleScheduleFromAi = (item) => {
    onScheduleMaintenance?.(item);
    setModalOpen(false);
  };

  return (
    <ModalBlank
      id="systems-setup-modal"
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      contentClassName="max-w-4xl"
    >
      <div className="relative">
        {/* Horizontal step tracker */}
        {!showSuccess && visibleSteps.length > 1 && (
          <div className="px-6 md:px-8 pt-6 pb-2">
            <nav className="flex items-start justify-center max-w-md mx-auto" aria-label="Progress">
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
        <div className="p-6 md:p-8 relative min-h-[320px] pt-8">
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
            className="space-y-10"
            style={{animation: "systemsStepFadeIn 0.35s ease-out forwards"}}
          >
            {/* Centered header */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#456564]/15 to-[#456564]/5 dark:from-[#456564]/25 dark:to-[#456564]/10 mb-5 shadow-sm">
                <Sparkles
                  className="w-8 h-8 text-[#456564]"
                  strokeWidth={1.5}
                />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
                Let's set up your property
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                Enter the name and address. We'll look up property details from
                public records.
              </p>
            </div>

            {/* Centered form — property name + address only */}
            <div className="flex justify-center">
              <div className="w-full max-w-md space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                    Property name
                  </label>
                  <input
                    type="text"
                    value={identityFields.propertyName}
                    onChange={(e) =>
                      handleIdentityFieldChange("propertyName", e.target.value)
                    }
                    placeholder="e.g. Lakewood Estate, My Home"
                    className="form-input w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-colors py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                    Address
                    {placesLoaded && (
                      <span className="ml-2 text-emerald-600 dark:text-emerald-400 text-xs font-normal">
                        Autocomplete active
                      </span>
                    )}
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

            <div className="flex justify-center gap-3 pt-6">
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
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#456564]/12 to-[#456564]/5 dark:from-[#456564]/20 dark:to-[#456564]/8 mb-4 shadow-sm">
                <Database className="w-8 h-8 text-[#456564]" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white mb-2">
                Property Data Lookup
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                Pull property details from public records based on the address
                you provided. You can review and edit every field before saving.
              </p>
            </div>

            {/* Property lookup button */}
            {(() => {
              const hasAddress = !!(
                identityFields.address?.trim() ||
                identityFields.addressLine1?.trim()
              );
              return (
                <div className="flex flex-col items-center gap-3">
                  <button
                    type="button"
                    disabled={predicting || !hasAddress}
                    onClick={handleLookupProperty}
                    className="btn bg-gradient-to-r from-[#456564] to-[#3a5548] hover:from-[#34514f] hover:to-[#2d4640] text-white shadow-sm inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {predicting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {predicting
                      ? "Looking up property..."
                      : hasPredicted
                        ? "Look up again"
                        : "Look up property data"}
                  </button>
                  {predictError && (
                    <div className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{predictError}</span>
                    </div>
                  )}
                  {!hasAddress && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Enter an address on the previous step to look up property
                      data.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Property data fields (editable) */}
            {hasPredicted && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-5 md:p-6 space-y-5 max-h-[45vh] overflow-y-auto">
                {AI_FIELD_GROUPS.map((group) => (
                  <div key={group.label}>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                      {group.label}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {group.fields.map((f) => (
                        <div key={f.key}>
                          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                            {f.label}
                          </label>
                          <input
                            type={f.type === "number" ? "number" : "text"}
                            value={aiFields[f.key] ?? ""}
                            onChange={(e) =>
                              setAiFields((prev) => ({
                                ...prev,
                                [f.key]: e.target.value,
                              }))
                            }
                            className="form-input w-full text-sm rounded-lg border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-[#456564]/20 focus:border-[#456564] transition-colors py-1.5"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {savePropertyError && (
              <div className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{savePropertyError}</span>
              </div>
            )}
            <div className="flex justify-between gap-3 pt-2">
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
                  Select the systems included in this property. You can add
                  custom systems below.
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
                Add custom system
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Custom systems will appear in the Systems tab with these
                standard fields:
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {STANDARD_CUSTOM_SYSTEM_FIELDS.map((f) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700/60 text-xs text-gray-600 dark:text-gray-400"
                  >
                    {f.label}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCustomName}
                  onChange={(e) => setNewCustomName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), addCustomSystem())
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
              <button
                type="button"
                onClick={() => goToStep("inspection")}
                className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Back
              </button>
              <div className="flex gap-3">
                {!isNewProperty && (
                  <button
                    type="button"
                    onClick={handleSkipSystems}
                    className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2"
                >
                  Complete setup
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
                Inspection Report
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Do you have an inspection report available for this property?
              </p>
            </div>

            {/* Yes/No toggle */}
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

            {/* File upload (shown when Yes) */}
            {inspectionReportAvailable === true && (
              <div className="space-y-4">
                {!propertyId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Save the property first to upload and analyze inspection reports.
                  </p>
                )}
                <div
                  className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-8 transition-all duration-300"
                  style={{animation: "systemsStepFadeIn 0.3s ease-out forwards"}}
                >
                  <div
                    className="relative flex flex-col items-center justify-center min-h-[160px] py-6"
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={(e) => e.preventDefault()}
                    onDrop={propertyId ? handleInspectionFileDrop : (e) => e.preventDefault()}
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
                          or click to browse (PDF, images). AI analysis runs for PDFs.
                        </p>
                      </>
                    )}
                    {uploadError && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-2">{uploadError}</p>
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

                {/* AI Findings panel */}
                {(analysisJobId || analysisStatus) && (
                  <AIFindingsPanel
                    status={analysisStatus}
                    progress={analysisProgress}
                    errorMessage={analysisError}
                    result={analysisResult}
                    suggestedSystemsToAdd={analysisResult?.suggestedSystemsToAdd ?? []}
                    selectedSuggestedSystems={[...selectedSuggestedSystems]}
                    onToggleSuggestedSystem={toggleSuggestedSystem}
                    onToggleSelectAllSuggested={handleToggleSelectAllSuggested}
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
              <button
                type="button"
                onClick={handleInspectionContinue}
                disabled={analysisStatus === "queued" || analysisStatus === "processing"}
                className="btn bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center gap-2 ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {analysisStatus === "queued" || analysisStatus === "processing" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      <UpgradePrompt
        open={upgradePromptOpen}
        onClose={() => {
          setUpgradePromptOpen(false);
          setUpgradePromptMsg("");
        }}
        title="Upgrade your plan"
        message={
          upgradePromptMsg ||
          "You've reached the limit for your current plan. Upgrade to unlock inspection report analysis and more AI features."
        }
      />
    </ModalBlank>
  );
}

export default SystemsSetupModal;
