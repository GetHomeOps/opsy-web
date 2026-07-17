import React, {useCallback, useEffect, useState} from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileCheck,
  Loader2,
  Search,
  SearchCheck,
  SearchX,
  Upload,
  X,
} from "lucide-react";
import ModalBlank from "../../components/ModalBlank";
import useGooglePlacesAutocomplete from "../../hooks/useGooglePlacesAutocomplete";
import useSuppressBrowserAddressAutofill from "../../hooks/useSuppressBrowserAddressAutofill";
import {uploadDocumentFile} from "../../hooks/useDocumentUpload";
import AppApi, {getApiErrorMessage} from "../../api/api";
import {useAuth} from "../../context/AuthContext";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";
import {MAX_DOCUMENT_UPLOAD_LABEL} from "../../constants/documentUpload";
import {
  canUploadDocumentsOnDemo,
  DEMO_UPLOAD_UNAVAILABLE_MESSAGE,
} from "../../utils/demoSite";
import OpsyMascot from "../../images/opsy1.png";
import HouseIcon from "../../images/house2_icon.webp";
import GlassIcon from "../../images/glass_icon.webp";
import {
  DETAIL_FIELD_GROUPS,
  TOTAL_DETAIL_FIELDS,
  inferDocumentType,
  inferMimeType,
} from "./prePurchaseUtils";
import PrePurchaseProcessing from "./PrePurchaseProcessing";

const RUNNING_STATUSES = [
  "extracting",
  "identifying_systems",
  "detecting_issues",
  "generating_recommendations",
];

const STEP_IDS = ["identity", "details", "inspection"];
const STEP_CONFIG = {
  identity: {label: "Identity"},
  details: {label: "Details"},
  inspection: {label: "Inspection"},
};

const PROPERTY_TYPE_PRESETS = [
  {id: "primary", label: "Primary Home", suffix: "Primary Home"},
  {id: "second", label: "Second Home", suffix: "Second Home"},
  {id: "investment", label: "Investment Property", suffix: "Investment Property"},
];

function getDataLookupStatus(predictError, retrievedCount, totalFields) {
  if (predictError || retrievedCount === 0) {
    return {
      status: "red",
      message:
        "Whoops! Opsy was unable to pull data on this property. You can continue and add details later.",
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
      "We were able to pull a portion of the property data. You can continue with what we found.",
    iconColor: "text-amber-600 dark:text-amber-400",
    bgGradient:
      "from-amber-500/12 to-amber-500/5 dark:from-amber-500/20 dark:to-amber-500/8",
    cardClass:
      "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-800 dark:text-amber-200",
  };
}

/**
 * Pre-purchase setup wizard (Identity → Details → Inspection). Creates the
 * analysis after Details, then optionally uploads an inspection report and
 * starts analysis in the background. Mirrors SystemsSetupModal chrome.
 */
export default function PrePurchaseSetupModal({
  modalOpen,
  setModalOpen,
  accountId,
  onComplete,
  onCancel,
  onIdentityChange,
}) {
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

  const [step, setStep] = useState("identity");
  const [identityFields, setIdentityFields] = useState({
    propertyName: "",
    address: "",
    addressLine1: "",
    city: "",
    state: "",
    zip: "",
  });
  const [propertyTypePreset, setPropertyTypePreset] = useState(null);

  const [detailFields, setDetailFields] = useState({});
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState(null);
  const [hasPredicted, setHasPredicted] = useState(false);
  const [retrievedFieldCount, setRetrievedFieldCount] = useState(0);
  const [lookupSource, setLookupSource] = useState(null);

  const [creatingAnalysis, setCreatingAnalysis] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createdAnalysisId, setCreatedAnalysisId] = useState(null);

  const [inspectionReportAvailable, setInspectionReportAvailable] =
    useState(null);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [documentSaveError, setDocumentSaveError] = useState(null);
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [completingSetup, setCompletingSetup] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [retryingAnalysis, setRetryingAnalysis] = useState(false);

  const handlePlaceSelected = useCallback((parsed) => {
    const next = {
      address: parsed.formattedAddress || "",
      addressLine1: parsed.addressLine1 || parsed.formattedAddress || "",
      city: parsed.city || "",
      state: parsed.state || "",
      zip: parsed.zip || "",
    };
    setIdentityFields((prev) => ({
      ...prev,
      ...next,
      propertyName:
        prev.propertyName.trim() ||
        parsed.addressLine1 ||
        parsed.formattedAddress ||
        prev.propertyName,
    }));
    setHasPredicted(false);
    setPredictError(null);
    setDetailFields({});
    setRetrievedFieldCount(0);
  }, []);

  const {
    inputRef: addressInputRef,
    error: placesError,
    AutocompleteWrapper: AddressAutocompleteWrapper,
  } = useGooglePlacesAutocomplete({onPlaceSelected: handlePlaceSelected});

  const bindAddressSearchInput = useSuppressBrowserAddressAutofill(
    "pre-purchase-setup-address-search"
  );

  useEffect(() => {
    if (!modalOpen) return;
    setStep("identity");
    setIdentityFields({
      propertyName: "",
      address: "",
      addressLine1: "",
      city: "",
      state: "",
      zip: "",
    });
    setPropertyTypePreset(null);
    setDetailFields({});
    setPredicting(false);
    setPredictError(null);
    setHasPredicted(false);
    setRetrievedFieldCount(0);
    setLookupSource(null);
    setCreatingAnalysis(false);
    setCreateError(null);
    setCreatedAnalysisId(null);
    setInspectionReportAvailable(null);
    setUploadedDocs([]);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setDocumentSaveError(null);
    setStartingAnalysis(false);
    setCompletingSetup(false);
    setAnalysisProgress(null);
    setRetryingAnalysis(false);
  }, [modalOpen]);

  // Poll analysis status while the wizard is waiting for AI to finish
  useEffect(() => {
    if (!modalOpen || !createdAnalysisId || !analysisProgress) return undefined;
    const status = analysisProgress.status;
    if (!RUNNING_STATUSES.includes(status) && status !== "uploading") {
      return undefined;
    }
    const id = setInterval(async () => {
      try {
        const data = await AppApi.getPrePurchaseAnalysis(createdAnalysisId);
        setAnalysisProgress(data);
      } catch {
        // Keep last known progress; next tick will retry
      }
    }, 2000);
    return () => clearInterval(id);
  }, [modalOpen, createdAnalysisId, analysisProgress?.status]);

  // Notify parent after identity updates (never call parent setState from a child setState updater)
  useEffect(() => {
    if (!modalOpen) return;
    onIdentityChange?.(identityFields);
  }, [identityFields, modalOpen, onIdentityChange]);

  function updateIdentity(key, value) {
    setIdentityFields((prev) => ({...prev, [key]: value}));
  }

  function handlePropertyTypePresetChange(presetId) {
    const next = propertyTypePreset === presetId ? null : presetId;
    setPropertyTypePreset(next);
    if (next) {
      const preset = PROPERTY_TYPE_PRESETS.find((p) => p.id === next);
      if (preset) {
        const base = possessiveName || "My";
        updateIdentity("propertyName", `${base} ${preset.suffix}`);
      }
    }
  }

  function handleIdentityContinue() {
    const typed = addressInputRef?.current?.value?.trim() || "";
    let next = identityFields;
    if (!identityFields.addressLine1?.trim() && typed) {
      next = {
        ...identityFields,
        address: typed,
        addressLine1: typed,
      };
      setIdentityFields(next);
    }
    const hasAddr =
      next.addressLine1?.trim() ||
      next.address?.trim() ||
      next.propertyName?.trim() ||
      typed;
    if (!hasAddr) return;

    if (!hasPredicted && !predictError) {
      setDetailFields({});
      setRetrievedFieldCount(0);
    }
    setCreateError(null);
    setStep("details");
  }

  async function handleLookupProperty() {
    setPredicting(true);
    setPredictError(null);
    try {
      const result = await AppApi.lookupPropertyDetails({
        address: identityFields.address,
        addressLine1: identityFields.addressLine1,
        city: identityFields.city,
        state: identityFields.state,
        zip: identityFields.zip,
      });
      if (result?.prediction) {
        setLookupSource(result.source ?? "attom");
        const p = result.prediction;
        const newFields = {};
        for (const group of DETAIL_FIELD_GROUPS) {
          for (const f of group.fields) {
            if (p[f.key] != null && p[f.key] !== "") {
              newFields[f.key] = p[f.key];
            }
          }
        }
        setDetailFields(newFields);
        setRetrievedFieldCount(Object.keys(newFields).length);
        setHasPredicted(true);

        // Enrich display name from lookup when empty
        setIdentityFields((prev) => {
          if (prev.propertyName?.trim()) return prev;
          const name = prev.addressLine1 || p.ownerName || "";
          if (!name) return prev;
          return {...prev, propertyName: name};
        });
      } else {
        setRetrievedFieldCount(0);
        setPredictError("No property data found. You can continue anyway.");
      }
    } catch (err) {
      setPredictError(
        getApiErrorMessage(err, "No property data found. You can continue anyway.")
      );
      setRetrievedFieldCount(0);
    } finally {
      setPredicting(false);
    }
  }

  async function handleDetailsContinue() {
    if (createdAnalysisId) {
      setStep("inspection");
      return;
    }
    if (!accountId) {
      setCreateError("No account selected.");
      return;
    }
    const street =
      identityFields.addressLine1?.trim() ||
      identityFields.address?.trim() ||
      addressInputRef?.current?.value?.trim() ||
      "";
    const displayName = identityFields.propertyName?.trim() || street || null;
    if (!street && !displayName) {
      setCreateError("Enter an address or display name first.");
      return;
    }

    setCreatingAnalysis(true);
    setCreateError(null);
    try {
      const analysis = await AppApi.createPrePurchaseAnalysis({
        accountId,
        displayName,
        street: street || null,
        city: identityFields.city?.trim() || null,
        state: identityFields.state?.trim() || null,
        zip: identityFields.zip?.trim() || null,
        identityData: hasPredicted ? detailFields : null,
        identityDataSource: hasPredicted ? lookupSource ?? "attom" : null,
      });
      setCreatedAnalysisId(analysis.id);
      setCreatingAnalysis(false);
      setStep("inspection");
    } catch (err) {
      setCreateError(getApiErrorMessage(err, "Failed to create analysis."));
      setCreatingAnalysis(false);
    }
  }

  function finishSetup(analysisId) {
    if (!analysisId || completingSetup) return;
    setCompletingSetup(true);
    onComplete?.(analysisId);
  }

  async function processInspectionFiles(files) {
    if (!canUploadDocumentsOnDemo()) {
      setUploadError(DEMO_UPLOAD_UNAVAILABLE_MESSAGE);
      return;
    }
    if (!createdAnalysisId || !files.length) return;

    setUploadError(null);
    setDocumentSaveError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      for (const file of files) {
        const result = await uploadDocumentFile(file, {
          uploadFolder: S3_UPLOAD_FOLDER.PRE_PURCHASE,
          onProgress: (pct) => setUploadProgress(pct),
        });
        if (!result?.key) {
          setUploadError("Upload failed");
          continue;
        }

        try {
          await AppApi.addPrePurchaseDocument(createdAnalysisId, {
            documentName: file.name,
            documentKey: result.key,
            documentType: inferDocumentType(file.name) || "inspection",
            mimeType: inferMimeType(file),
            fileSizeBytes: file.size ?? null,
          });
          setUploadedDocs((prev) => [
            ...prev,
            {key: result.key, name: file.name, type: file.type},
          ]);

          setStartingAnalysis(true);
          await AppApi.startPrePurchaseAnalysis(createdAnalysisId);
          const data = await AppApi.getPrePurchaseAnalysis(createdAnalysisId);
          setAnalysisProgress(data);
          return;
        } catch (docErr) {
          setDocumentSaveError(
            getApiErrorMessage(
              docErr,
              "Failed to save inspection report. Please try again."
            )
          );
          break;
        }
      }
    } catch (err) {
      setUploadError(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setIsUploading(false);
      setStartingAnalysis(false);
      setUploadProgress(0);
    }
  }

  async function handleRetryAnalysis() {
    if (!createdAnalysisId || retryingAnalysis) return;
    setRetryingAnalysis(true);
    setDocumentSaveError(null);
    try {
      await AppApi.retryPrePurchaseAnalysis(createdAnalysisId);
      const data = await AppApi.getPrePurchaseAnalysis(createdAnalysisId);
      setAnalysisProgress(data);
    } catch (err) {
      setDocumentSaveError(
        getApiErrorMessage(err, "Could not retry analysis. Please try again.")
      );
    } finally {
      setRetryingAnalysis(false);
    }
  }

  async function handleInspectionFileDrop(e) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []).filter(
      (f) =>
        f.type === "application/pdf" ||
        f.type.startsWith("image/") ||
        /\.(pdf|docx?)$/i.test(f.name)
    );
    await processInspectionFiles(files);
  }

  async function handleInspectionFileSelect(e) {
    const files = Array.from(e.target?.files ?? []);
    e.target.value = "";
    await processInspectionFiles(files);
  }

  function removeInspectionFile(index) {
    setDocumentSaveError(null);
    setUploadedDocs((prev) => prev.filter((_, i) => i !== index));
  }

  const analysisStatus = analysisProgress?.status;
  const analysisRunning =
    startingAnalysis ||
    (analysisStatus &&
      (RUNNING_STATUSES.includes(analysisStatus) ||
        analysisStatus === "uploading"));
  const analysisCompleted = analysisStatus === "completed";
  const analysisFailed = analysisStatus === "failed";

  const isBusy =
    creatingAnalysis ||
    isUploading ||
    startingAnalysis ||
    completingSetup ||
    analysisRunning ||
    retryingAnalysis;

  function handleClose() {
    if (isBusy && !analysisFailed) return;
    if (createdAnalysisId) {
      finishSetup(createdAnalysisId);
      return;
    }
    setModalOpen(false);
    onCancel?.();
  }

  const currentStepIndex = STEP_IDS.indexOf(step);
  const canGoToStep = (targetStep) => {
    const idx = STEP_IDS.indexOf(targetStep);
    if (
      createdAnalysisId &&
      targetStep !== "inspection" &&
      step === "inspection"
    ) {
      return false;
    }
    return idx >= 0 && idx <= currentStepIndex;
  };

  return (
    <ModalBlank
      id="pre-purchase-setup-modal"
      modalOpen={modalOpen}
      setModalOpen={(open) => {
        if (!open) handleClose();
        else setModalOpen(true);
      }}
      closeOnClickOutside={!isBusy}
      closeOnEscape={!isBusy}
      contentClassName="max-w-4xl"
    >
      <div className="relative px-6 md:px-8 pt-6 pb-6">
        <style>{`
          @keyframes systemsStepFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div className="flex justify-center mb-4">
          <img
            src={OpsyMascot}
            alt=""
            className="h-24 w-auto object-contain"
          />
        </div>

        <nav
          className="flex items-start justify-center max-w-md mx-auto mb-6"
          aria-label="Setup steps"
        >
          {STEP_IDS.map((stepId, idx) => {
            const config = STEP_CONFIG[stepId];
            const isActive = step === stepId;
            const isCompleted = currentStepIndex > idx;
            const isClickable = canGoToStep(stepId);
            return (
              <React.Fragment key={stepId}>
                <button
                  type="button"
                  onClick={() => isClickable && setStep(stepId)}
                  disabled={!isClickable}
                  className={`group flex flex-col items-center gap-1.5 ${
                    isClickable ? "cursor-pointer" : "cursor-default"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? "btn-segment-active ring-4 ring-[var(--opsy-accent,#456564)]/10"
                        : isCompleted
                          ? "btn-segment-active"
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
                {idx < STEP_IDS.length - 1 && (
                  <div className="h-7 flex-1 flex items-center mx-1.5 sm:mx-2.5">
                    <div
                      className={`h-0.5 w-full rounded-full transition-colors ${
                        currentStepIndex > idx
                          ? "bg-[var(--opsy-accent,#456564)]"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Identity */}
        {step === "identity" && (
          <div
            className="space-y-5"
            style={{animation: "systemsStepFadeIn 0.35s ease-out forwards"}}
          >
            <div className="text-center">
              <div className="flex flex-col items-center">
                <img
                  src={HouseIcon}
                  alt=""
                  className="w-64 h-auto max-h-44 object-contain block mt-2 mb-3"
                />
                <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white mb-1">
                  Let&apos;s set up this analysis
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed mt-1">
                Enter the name and address. We&apos;ll look up property details
                from public records.
              </p>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-md space-y-4">
                <div className="flex flex-wrap gap-3">
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
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={identityFields.propertyName}
                    onChange={(e) =>
                      updateIdentity("propertyName", e.target.value)
                    }
                    placeholder="e.g. Lakewood Estate, My Home"
                    className="form-input w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-colors py-2.5"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
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
                        className="form-input w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-colors py-2.5"
                        {...bindAddressSearchInput()}
                      />
                    </AddressAutocompleteWrapper>
                  ) : (
                    <input
                      key={String(modalOpen)}
                      ref={addressInputRef}
                      type="text"
                      defaultValue={identityFields.address}
                      placeholder="Start typing an address to search..."
                      className="form-input w-full rounded-xl border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#456564]/30 focus:border-[#456564] transition-colors py-2.5"
                      {...bindAddressSearchInput()}
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

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="btn border border-gray-200 dark:border-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIdentityContinue}
                className="btn btn-primary inline-flex items-center gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Details */}
        {step === "details" && (
          <div
            className="space-y-4"
            style={{animation: "systemsStepFadeIn 0.35s ease-out forwards"}}
          >
            <div className="text-center pb-1">
              {(() => {
                const showStatusMessage = hasPredicted || predictError;
                const status = getDataLookupStatus(
                  predictError,
                  retrievedFieldCount,
                  TOTAL_DETAIL_FIELDS
                );
                const iconBoxClass = showStatusMessage
                  ? `rounded-2xl shadow-sm bg-gradient-to-br ${status.bgGradient}`
                  : "";
                const StatusIcon = showStatusMessage
                  ? status.status === "red"
                    ? SearchX
                    : SearchCheck
                  : null;
                return (
                  <>
                    <div
                      className={`relative inline-flex items-center justify-center w-14 h-14 p-0 ${iconBoxClass} mb-3`}
                    >
                      {showStatusMessage ? (
                        <StatusIcon
                          className={`w-7 h-7 ${status.iconColor}`}
                          strokeWidth={1.5}
                        />
                      ) : (
                        <img
                          src={GlassIcon}
                          alt="Property data lookup"
                          className="w-14 h-14 object-contain scale-[2]"
                        />
                      )}
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white mb-1">
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
                    className="btn btn-primary shadow-sm inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
                      Enter an address on the previous step to look up property
                      data.
                    </p>
                  )}
                  {lookupSource && hasPredicted && (
                    <p className="text-xs text-neutral-500">
                      Source:{" "}
                      {lookupSource === "rentcast" ? "RentCast" : "ATTOM"}
                    </p>
                  )}
                </div>
              );
            })()}

            {hasPredicted && (
              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-5 md:p-6 space-y-5 max-h-[45vh] overflow-y-auto">
                {DETAIL_FIELD_GROUPS.map((group) => {
                  const fieldsWithData = group.fields.filter(
                    (f) =>
                      detailFields[f.key] != null &&
                      String(detailFields[f.key]).trim() !== ""
                  );
                  if (fieldsWithData.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        {group.label}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {fieldsWithData.map((f) => (
                          <div key={f.key}>
                            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {f.label}
                            </label>
                            <input
                              type={f.type === "number" ? "number" : "text"}
                              value={detailFields[f.key] ?? ""}
                              readOnly
                              className="form-input w-full text-sm rounded-lg border-gray-200 dark:border-gray-600 bg-gray-100/80 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 cursor-default py-1.5"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {createError && (
              <div className="flex items-center gap-1.5 text-sm text-red-500 dark:text-red-400 justify-center">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("identity")}
                disabled={creatingAnalysis || !!createdAnalysisId}
                className="btn border border-gray-200 dark:border-gray-600 disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleDetailsContinue}
                disabled={creatingAnalysis}
                className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
              >
                {creatingAnalysis ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating profile…
                  </>
                ) : (
                  <>
                    {createdAnalysisId ? "Continue" : "Create profile"}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Inspection */}
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
                Uploading starts analysis in the background.
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setInspectionReportAvailable(true)}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all duration-200 disabled:opacity-60 ${
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
                disabled={isBusy}
                onClick={() => setInspectionReportAvailable(false)}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all duration-200 disabled:opacity-60 ${
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

            {inspectionReportAvailable === true && (
              <div className="space-y-4">
                {!createdAnalysisId && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                    Create the profile first to upload and analyze inspection
                    reports.
                  </p>
                )}
                {analysisProgress &&
                (analysisRunning || analysisCompleted || analysisFailed) ? (
                  <PrePurchaseProcessing
                    analysis={analysisProgress}
                    onRetry={
                      analysisFailed ? handleRetryAnalysis : undefined
                    }
                    retrying={retryingAnalysis}
                    inWizard
                  />
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 p-8 transition-all duration-300">
                    <div
                      className="relative flex flex-col items-center justify-center min-h-[160px] py-6"
                      onDragOver={(e) => e.preventDefault()}
                      onDragLeave={(e) => e.preventDefault()}
                      onDrop={
                        createdAnalysisId && !isBusy
                          ? handleInspectionFileDrop
                          : (e) => e.preventDefault()
                      }
                    >
                      <input
                        type="file"
                        multiple
                        accept=".pdf,image/*,.doc,.docx"
                        onChange={handleInspectionFileSelect}
                        disabled={
                          !createdAnalysisId ||
                          isBusy ||
                          !canUploadDocumentsOnDemo()
                        }
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                        id="pre-purchase-inspection-file-input"
                      />
                      {isUploading || startingAnalysis ? (
                        <>
                          <Loader2 className="w-12 h-12 text-[#456564] animate-spin mb-4" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {startingAnalysis
                              ? "Starting analysis…"
                              : `Uploading… ${uploadProgress}%`}
                          </p>
                        </>
                      ) : !canUploadDocumentsOnDemo() ? (
                        <p className="text-sm text-amber-800 dark:text-amber-200 text-center px-4">
                          {DEMO_UPLOAD_UNAVAILABLE_MESSAGE}
                        </p>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Drag & drop your inspection report here
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            or click to browse (PDF, images). Maximum file size{" "}
                            {MAX_DOCUMENT_UPLOAD_LABEL} per file. Analysis starts
                            automatically after upload.
                          </p>
                        </>
                      )}
                      {uploadError && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                          {uploadError}
                        </p>
                      )}
                      {documentSaveError && (
                        <div className="mt-3 w-full max-w-sm flex items-start gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20">
                          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-red-700 dark:text-red-300">
                              {documentSaveError}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocumentSaveError(null);
                            }}
                            className="p-0.5 rounded text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0"
                            aria-label="Dismiss error"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
                                disabled={isBusy}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 disabled:opacity-50"
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
                )}
                {documentSaveError && analysisProgress && (
                  <p className="text-xs text-red-600 dark:text-red-400 text-center">
                    {documentSaveError}
                  </p>
                )}
              </div>
            )}

            {inspectionReportAvailable === false && (
              <p className="text-sm text-center text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                You can upload documents later from the analysis page.
              </p>
            )}

            <div className="flex justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("details")}
                disabled={isBusy || analysisCompleted}
                className="btn border border-gray-200 dark:border-gray-600 disabled:opacity-60"
              >
                Back
              </button>
              {inspectionReportAvailable === false ? (
                <button
                  type="button"
                  onClick={() => finishSetup(createdAnalysisId)}
                  disabled={!createdAnalysisId || isBusy}
                  className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                >
                  Complete setup
                </button>
              ) : analysisCompleted ? (
                <button
                  type="button"
                  onClick={() => finishSetup(createdAnalysisId)}
                  disabled={!createdAnalysisId || completingSetup}
                  className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {completingSetup ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  View analysis
                </button>
              ) : analysisRunning ? (
                <button
                  type="button"
                  disabled
                  className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing…
                </button>
              ) : analysisFailed ? (
                <button
                  type="button"
                  onClick={() => finishSetup(createdAnalysisId)}
                  disabled={!createdAnalysisId || completingSetup}
                  className="btn border border-gray-200 dark:border-gray-600 inline-flex items-center gap-2 disabled:opacity-60"
                >
                  Continue anyway
                </button>
              ) : inspectionReportAvailable === true &&
                uploadedDocs.length > 0 &&
                !isBusy ? (
                <button
                  type="button"
                  onClick={() => finishSetup(createdAnalysisId)}
                  disabled={!createdAnalysisId}
                  className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
                >
                  Continue to analysis
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => finishSetup(createdAnalysisId)}
                  disabled={!createdAnalysisId || isBusy}
                  className="btn border border-gray-200 dark:border-gray-600 disabled:opacity-60"
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalBlank>
  );
}
