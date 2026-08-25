import React, {
  useReducer,
  useRef,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import PropertyContext from "../../context/PropertyContext";
import UserContext from "../../context/UserContext";
import ContactContext from "../../context/ContactContext";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import UpgradePrompt from "../../components/UpgradePrompt";
import DemoFeatureUnavailableModal from "../../components/DemoFeatureUnavailableModal";
import useDemoFeatureGate from "../../hooks/useDemoFeatureGate";
import SystemsTab from "./SystemsTab";
import MaintenanceTab from "./MaintenanceTab";
import IdentityTab from "./IdentityTab";
import DocumentsTab from "./DocumentsTab";
import FinancialsTab from "./FinancialsTab";
import DocumentAnalysisOrchestrator from "./partials/DocumentAnalysisOrchestrator";
import {REQUEST_INSPECTION_OPSYMIZATION_EVENT} from "./helpers/documentAnalysisFlow";
import {PROPERTY_DOCUMENTS_CHANGED_EVENT} from "./helpers/inspectionFlowSession";
import ScoreCard from "./ScoreCard";
import HomeOpsTeam from "./partials/HomeOpsTeam";
import PropertyPassportHeader from "./partials/passport/PropertyPassportHeader";
import PropertyOverviewDashboard from "./partials/passport/PropertyOverviewDashboard";
import EmptyStateCard from "./partials/passport/EmptyStateCard";
import SystemsSetupModal from "./partials/SystemsSetupModal";
import ScheduleSystemModal from "./partials/ScheduleSystemModal";
import SharePropertyModal from "./partials/SharePropertyModal";
import PropertyUnauthorized from "./PropertyUnauthorized";
import PropertyNotFound from "./PropertyNotFound";
import {ApiError} from "../../api/api";
/** True if the API error indicates the property does not exist (404 or 403 "Property not found"). */
function isPropertyNotFoundError(err) {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404) return true;
  if (err.status === 403) {
    const msg = (
      err.message ||
      (err.messages && err.messages[0]) ||
      ""
    ).toLowerCase();
    return msg.includes("not found");
  }
  return false;
}
import {
  preparePropertyValues,
  prepareIdentityForUpdate,
  prepareTeamForProperty,
  teamsAreEqual,
  mapPropertyFromBackend,
  deriveStreetFromAddress,
} from "./helpers/preparePropertyValues";

function getAddressFingerprint(data) {
  const line1 = (
    data?.addressLine1 ||
    deriveStreetFromAddress(data?.address) ||
    ""
  )
    .trim()
    .toLowerCase();
  const city = (data?.city || "").trim().toLowerCase();
  const state = (data?.state || "").trim().toUpperCase();
  const zip = String(data?.zip || "").trim();
  return `${line1}|${city}|${state}|${zip}`;
}

function hasCompleteAddressForAttom(data) {
  const line1 = (
    data?.addressLine1 ||
    deriveStreetFromAddress(data?.address) ||
    ""
  ).trim();
  return !!(
    line1 &&
    String(data?.city || "").trim() &&
    String(data?.state || "").trim() &&
    String(data?.zip || "").trim()
  );
}

/** True when at least one vendor-populated identity field (beyond address) is present. */
function hasNonAddressIdentityFields(data) {
  const candidates = [
    data?.yearBuilt,
    data?.propertyType,
    data?.sqFtTotal,
    data?.bedCount,
    data?.taxId,
    data?.county,
    data?.ownerName,
  ];
  return candidates.some((v) => {
    if (v == null) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "number") return Number.isFinite(v) && v !== 0;
    return true;
  });
}
import {mapSystemsFromBackend} from "./helpers/mapSystemsFromBackend";
import {prepareSystemsForApi} from "./helpers/prepareSystemsForApi";
import {
  splitFormDataByTabs,
  mergeFormDataFromTabs,
  INITIAL_IDENTITY,
  INITIAL_SYSTEMS,
  SYSTEM_FIELD_NAMES,
} from "./helpers/formDataByTabs";
import {buildPropertyPayloadFromRefresh} from "./helpers/buildPropertyPayloadFromRefresh";
import {openMaintenanceRecordInNewTab} from "./helpers/maintenanceRecordNavigation";
import {formSystemsToArray} from "./helpers/formSystemsToArray";
import {buildCustomSystemsForUi} from "./helpers/systemKeyUtils";
import {computeHpsScore} from "./helpers/computeHpsScore";
import {
  mapMaintenanceRecordsFromBackend,
  prepareMaintenanceRecordsForApi,
  computeMaintenanceSyncPlan,
  isNewMaintenanceRecord,
} from "./helpers/maintenanceRecordMapping";
import {
  STANDARD_CUSTOM_SYSTEM_FIELDS,
  PROPERTY_SYSTEMS,
  DEFAULT_SYSTEM_IDS,
} from "./constants/propertySystems";
import {
  IDENTITY_SECTIONS,
  isSectionComplete,
  FIELD_ALIASES,
} from "./constants/identitySections";
import {
  ADJUSTABLE_FIELD_KEYS,
  ADDRESS_FIELD_KEYS,
} from "./constants/rentcastFields";
import {
  isSystemComplete,
  isCustomSystemComplete,
} from "./constants/systemSections";
import Banner from "../../partials/containers/Banner";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import {
  FileText,
  Settings,
  Wrench,
  Image as ImageIcon,
  ClipboardList,
  Home,
  Zap,
  Droplet,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileBarChart,
  FilePenLine,
  Landmark,
  Lock,
  Loader2,
  Sparkles,
  X,
  Check,
  UserPlus,
  Briefcase,
  RefreshCw,
  CheckCircle2,
  Plus,
} from "lucide-react";
import AIAssistantSidebar from "./partials/AIAssistantSidebar";
import AttomRefreshConfirmDialog from "./partials/AttomRefreshConfirmDialog";
import {useAttomRefresh} from "./hooks/useAttomRefresh";
import {getPropertyAssistantHeaderLines} from "./helpers/propertyAssistantHeader";
import InspectionReportModal from "./partials/InspectionReportModal";
import InviteAgentBenefitsModal from "./partials/InviteAgentBenefitsModal";
import SponsorshipOfferModal from "../settings/partials/SponsorshipOfferModal";
import {
  dismissSponsorshipIcon,
  isSponsorshipIconDismissed,
  snoozeSponsorshipOffer,
} from "../../components/SponsorshipOfferWatcher";
import ModalBlank from "../../components/ModalBlank";
import InspectionAnalysisModalContent from "./partials/InspectionAnalysisModalContent";
import useImageUpload from "../../hooks/useImageUpload";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";
import usePresignedPreview from "../../hooks/usePresignedPreview";
import useGooglePlacesAutocomplete, {
  getIdentityAddressInputDisplayValue,
} from "../../hooks/useGooglePlacesAutocomplete";
import useAddPropertyWithLimitCheck from "../../hooks/useAddPropertyWithLimitCheck";
import useBillingStatus from "../../hooks/useBillingStatus";
import useSponsorshipEligibility from "../../hooks/useSponsorshipEligibility";
import ImageUploadField from "../../components/ImageUploadField";
import homePlaceholder from "../../images/home_placeholder.png";
import paymentPlanIcon from "../../images/payment_plan.png";
import {useTranslation} from "react-i18next";
import Transition from "../../utils/Transition";

const initialFormData = {
  identity: {...INITIAL_IDENTITY},
  systems: {...INITIAL_SYSTEMS},
  maintenanceRecords: [],
};

const initialState = {
  formData: initialFormData,
  errors: {},
  isSubmitting: false,
  property: null,
  /** Systems from backend - kept separate from identity/formData */
  systems: [],
  /** Maintenance records as last saved to backend; used for tree date display only */
  savedMaintenanceRecords: [],
  activeTab: "identity",
  isNew: true,
  formDataChanged: false,
  /** True when systems tab data has been modified since last save/load */
  systemsDirty: false,
  isInitialLoad: true,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
  /** Set when GET property returns 403 (user not on HomeOps team) */
  propertyAccessDenied: false,
  /** Set when GET property returns 404 or 403 "Property not found" */
  propertyNotFound: false,
  /** When AI reanalysis last ran (for Systems tab badge) */
  aiSummaryUpdatedAt: null,
};

const FREE_PLAN_CODES = ["homeowner_free", "agent_free", "free"];
const INSPECTION_ANALYSIS_UPDATED_EVENT = "inspection-analysis:updated";

const INVITE_AGENT_DISMISS_KEY = "opsy-invite-agent-dismissed";

function getInviteAgentDismissedStorageKey(propertyUid) {
  return `${INVITE_AGENT_DISMISS_KEY}-${propertyUid}`;
}

function isInviteAgentCtaDismissed(propertyUid) {
  if (!propertyUid) return false;
  try {
    return (
      localStorage.getItem(getInviteAgentDismissedStorageKey(propertyUid)) ===
      "true"
    );
  } catch {
    return false;
  }
}

function dismissInviteAgentCtaPermanently(propertyUid) {
  if (!propertyUid) return;
  try {
    localStorage.setItem(
      getInviteAgentDismissedStorageKey(propertyUid),
      "true",
    );
  } catch (_) {}
}

/** Build default team member for the current user (creator) so new property always has at least one. */
function getCreatorAsTeamMember(currentUser) {
  if (!currentUser?.id) return null;
  const r = (currentUser.role ?? "").toLowerCase();
  const displayRole =
    r === "super_admin"
      ? "Admin"
      : r === "agent"
        ? "Agent"
        : r === "homeowner"
          ? "Homeowner"
          : "Agent";
  /* Prefer displayable URLs (image_url, avatarUrl) over S3 keys (image) for <img src> */
  const photoUrl =
    currentUser.image_url ??
    currentUser.avatarUrl ??
    currentUser.avatar_url ??
    currentUser.image ??
    currentUser.avatar;
  return {
    id: currentUser.id,
    name: currentUser.name ?? "User",
    role: displayRole,
    image: photoUrl,
    image_url: photoUrl,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_FORM_DATA": {
      const p = action.payload ?? {};
      const hasTabbed =
        "identity" in p || "systems" in p || "maintenanceRecords" in p;
      const sysDirty =
        !state.isInitialLoad && "systems" in p ? true : state.systemsDirty;
      if (hasTabbed) {
        return {
          ...state,
          formData: {
            identity: {...state.formData.identity, ...(p.identity ?? {})},
            systems: {...state.formData.systems, ...(p.systems ?? {})},
            maintenanceRecords:
              p.maintenanceRecords ?? state.formData.maintenanceRecords ?? [],
          },
          formDataChanged: !state.isInitialLoad,
          systemsDirty: sysDirty,
        };
      }
      const split = splitFormDataByTabs(p);
      return {
        ...state,
        formData: {
          identity: {...state.formData.identity, ...split.identity},
          systems: {...state.formData.systems, ...split.systems},
          maintenanceRecords:
            split.maintenanceRecords.length > 0
              ? split.maintenanceRecords
              : (state.formData.maintenanceRecords ?? []),
        },
        formDataChanged: !state.isInitialLoad,
        systemsDirty: sysDirty,
      };
    }
    case "SET_IDENTITY_FORM_DATA":
      return {
        ...state,
        formData: {
          ...state.formData,
          identity: {...state.formData.identity, ...action.payload},
        },
        formDataChanged: !state.isInitialLoad,
      };
    case "SET_IDENTITY_FORM_DATA_SILENT":
      return {
        ...state,
        formData: {
          ...state.formData,
          identity: {...state.formData.identity, ...action.payload},
        },
      };
    case "SET_SYSTEMS_FORM_DATA":
      return {
        ...state,
        formData: {
          ...state.formData,
          systems: {...state.formData.systems, ...action.payload},
        },
        formDataChanged: !state.isInitialLoad,
        systemsDirty: true,
      };
    case "SET_SYSTEMS_FORM_DATA_SILENT":
      return {
        ...state,
        formData: {
          ...state.formData,
          systems: {...state.formData.systems, ...action.payload},
        },
      };
    case "SET_MAINTENANCE_FORM_DATA":
      return {
        ...state,
        formData: {
          ...state.formData,
          maintenanceRecords: action.payload ?? [],
        },
        formDataChanged: true,
        isInitialLoad: false,
      };
    case "SET_MAINTENANCE_FORM_DATA_SILENT":
      return {
        ...state,
        formData: {
          ...state.formData,
          maintenanceRecords: action.payload ?? [],
        },
        isInitialLoad: false,
      };
    case "MERGE_SAVED_MAINTENANCE_RECORD": {
      const record = action.payload;
      if (!record?.id) return state;
      const existing = state.savedMaintenanceRecords ?? [];
      const idx = existing.findIndex((r) => String(r.id) === String(record.id));
      const nextSaved =
        idx >= 0
          ? existing.map((r, i) => (i === idx ? {...r, ...record} : r))
          : [...existing, record];
      return {...state, savedMaintenanceRecords: nextSaved};
    }
    case "SET_ERRORS":
      return {...state, errors: action.payload};
    case "SET_VALIDATION_FAILED":
      return {
        ...state,
        errors: action.payload.errors,
        activeTab: "identity",
      };
    case "SET_SUBMITTING":
      return {...state, isSubmitting: action.payload};
    case "SET_PROPERTY": {
      const payload = action.payload;
      const nextFormData = payload
        ? payload.identity && payload.systems
          ? {...payload}
          : splitFormDataByTabs(payload)
        : {...initialFormData};
      const savedRecords = payload ? (payload.maintenanceRecords ?? []) : [];
      return {
        ...state,
        property: payload,
        isNew: !payload,
        formData: nextFormData,
        savedMaintenanceRecords: Array.isArray(savedRecords)
          ? savedRecords
          : [],
        formDataChanged: false,
        systemsDirty: false,
        isInitialLoad: true,
        errors: {},
        propertyAccessDenied: false,
        propertyNotFound: false,
      };
    }
    case "REFRESH_PROPERTY_AFTER_SAVE": {
      const payload = action.payload;
      const nextFormData = payload
        ? payload.identity && payload.systems
          ? {...payload}
          : splitFormDataByTabs(payload)
        : {...initialFormData};
      const savedRecords = payload ? (payload.maintenanceRecords ?? []) : [];
      return {
        ...state,
        property: payload,
        formData: nextFormData,
        savedMaintenanceRecords: Array.isArray(savedRecords)
          ? savedRecords
          : [],
        formDataChanged: false,
        systemsDirty: false,
        isInitialLoad: false,
        errors: {},
      };
    }
    case "SAVE_COMPLETED": {
      const {propertyPayload, systems, banner, aiSummaryUpdatedAt} =
        action.payload;
      const nextFormData = propertyPayload
        ? propertyPayload.identity && propertyPayload.systems
          ? {...propertyPayload}
          : splitFormDataByTabs(propertyPayload)
        : {...initialFormData};
      const savedRecords = propertyPayload
        ? (propertyPayload.maintenanceRecords ?? [])
        : [];
      return {
        ...state,
        property: propertyPayload,
        formData: nextFormData,
        savedMaintenanceRecords: Array.isArray(savedRecords)
          ? savedRecords
          : [],
        systems: systems ?? state.systems,
        formDataChanged: false,
        systemsDirty: false,
        isInitialLoad: false,
        errors: {},
        bannerOpen: banner?.open ?? false,
        bannerType: banner?.type ?? "success",
        bannerMessage: banner?.message ?? "",
        ...(aiSummaryUpdatedAt !== undefined ? {aiSummaryUpdatedAt} : {}),
      };
    }
    /** After ATTOM completes while the form is dirty: refresh the saved
     *  property baseline and fill only empty local identity fields so
     *  unsaved edits are preserved but public-records values still appear. */
    case "ATTOM_REFRESH_MERGE": {
      const {propertyPayload, systems, identityFill, banner} = action.payload;
      const nextProperty = propertyPayload
        ? propertyPayload.identity && propertyPayload.systems
          ? {...propertyPayload}
          : splitFormDataByTabs(propertyPayload)
        : state.property;
      return {
        ...state,
        property: nextProperty,
        formData: {
          ...state.formData,
          identity: {
            ...state.formData.identity,
            ...(identityFill ?? {}),
          },
        },
        systems: systems ?? state.systems,
        isInitialLoad: false,
        bannerOpen: banner?.open ?? false,
        bannerType: banner?.type ?? "success",
        bannerMessage: banner?.message ?? "",
      };
    }
    case "SET_PROPERTY_ACCESS_DENIED":
      return {...state, propertyAccessDenied: action.payload};
    case "SET_PROPERTY_NOT_FOUND":
      return {...state, propertyNotFound: action.payload};
    case "SET_SYSTEMS":
      return {...state, systems: action.payload ?? []};
    case "SET_AI_SUMMARY_UPDATED_AT":
      return {...state, aiSummaryUpdatedAt: action.payload ?? null};
    case "SET_ACTIVE_TAB":
      return {...state, activeTab: action.payload};
    case "SET_FORM_CHANGED":
      return {
        ...state,
        formDataChanged: action.payload,
        isInitialLoad: false,
      };
    case "SET_BANNER":
      return {
        ...state,
        bannerOpen: action.payload.open,
        bannerType: action.payload.type,
        bannerMessage: action.payload.message,
      };
    default:
      return state;
  }
}

const platformUsers = [];
const mockProperties = [];

const tabs = [
  {id: "overview", label: "Overview"},
  {id: "identity", label: "Identity"},
  {id: "systems", label: "Systems"},
  {id: "maintenance", label: "Maintenance"},
  {id: "documents", label: "Documents"},
  {id: "media", label: "Media"},
  {id: "financials", label: "Financials"},
];

/** Router nav slice after create — avoids duplicating newUid if context already includes it. */
function buildPropertyFormNavStateFromProperties(properties, newUid) {
  const u = String(newUid);
  const baseIds = (properties ?? []).map((p) => p.property_uid ?? p.id);
  const visiblePropertyIds = baseIds.some((id) => String(id) === u)
    ? baseIds
    : [...baseIds, newUid];
  const idx = visiblePropertyIds.findIndex((id) => String(id) === u);
  return {
    currentIndex: idx + 1,
    totalItems: visiblePropertyIds.length,
    visiblePropertyIds,
  };
}

/* Property Form Container */
function PropertyFormContainer() {
  const {uid: uidForInitialTab} = useParams();
  /* Existing properties land on the Overview dashboard; the create flow starts
     on Identity since there is nothing to summarize yet. */
  const [state, dispatch] = useReducer(reducer, initialState, (init) => ({
    ...init,
    activeTab: uidForInitialTab === "new" ? "identity" : "overview",
  }));
  const navigate = useNavigate();
  const location = useLocation();
  const {uid, accountUrl: accountUrlParam} = useParams();
  const [searchParams] = useSearchParams();
  const invitationIdFromUrlRaw =
    searchParams.get("invitation")?.trim?.() || searchParams.get("invitation");
  const [validatedInvitationId, setValidatedInvitationId] = useState(null);
  const [isValidatingInvitationId, setIsValidatingInvitationId] =
    useState(false);
  const invitationIdFromUrl = validatedInvitationId;
  const isInvitationView = Boolean(
    invitationIdFromUrlRaw &&
    uid !== "new" &&
    (isValidatingInvitationId || invitationIdFromUrl),
  );
  const tabFromUrl = searchParams.get("tab");
  const {t} = useTranslation();
  const {
    currentAccount,
    createProperty,
    createSystemsForProperty,
    properties,
    maintenanceRecords,
    setMaintenanceRecords,
    getPropertyById,
    addUsersToProperty,
    getPropertyTeam,
    invalidatePropertyTeamCache,
    updateProperty,
    updateTeam,
    getSystemsByPropertyId,
    updateSystemsForProperty,
    getMaintenanceRecordsByPropertyId,
    createMaintenanceRecords,
    updateMaintenanceRecord,
    deleteMaintenanceRecord,
    refreshProperties,
  } = useContext(PropertyContext);

  const {users} = useContext(UserContext);
  const {contacts} = useContext(ContactContext);
  const {currentUser} = useAuth();
  const {plan, limits, isAdmin} = useBillingStatus();
  const {
    eligibility: sponsorshipEligibility,
    eligiblePropertyUid,
    refresh: refreshSponsorshipEligibility,
  } = useSponsorshipEligibility();
  const [sponsorshipOfferOpen, setSponsorshipOfferOpen] = useState(false);
  /* The hero icon shows whenever the homeowner is eligible for agent coverage.
     Clicking "Not now" persists a dismissal (it stays hidden across navigation), but
     that dismissal is scoped to the current eligibility episode: it auto-clears the
     moment eligibility lapses (see useSponsorshipEligibility), so a newly confirmed
     agent surfaces the icon again. The offer always remains reachable from Billing,
     and the separate 14-day snooze only governs the global auto-popup. */
  const [sponsorshipOfferDismissed, setSponsorshipOfferDismissed] = useState(
    () => isSponsorshipIconDismissed(currentAccount?.id),
  );
  const showSponsorshipOfferOnHero =
    !isInvitationView &&
    !sponsorshipOfferDismissed &&
    eligiblePropertyUid != null &&
    uid !== "new" &&
    String(uid) === eligiblePropertyUid;

  /* Re-read the persisted dismissal when the account changes or eligibility resolves
     (the hook clears it while not eligible, so a fresh episode shows the icon). */
  useEffect(() => {
    setSponsorshipOfferDismissed(isSponsorshipIconDismissed(currentAccount?.id));
  }, [currentAccount?.id, eligiblePropertyUid]);

  async function handleAcceptSponsorship() {
    await AppApi.acceptSponsorship({accountId: currentAccount?.id});
    setSponsorshipOfferOpen(false);
    await refreshSponsorshipEligibility();
  }

  function handleDismissSponsorshipOffer() {
    snoozeSponsorshipOffer(currentAccount?.id);
    dismissSponsorshipIcon(currentAccount?.id);
    setSponsorshipOfferDismissed(true);
    setSponsorshipOfferOpen(false);
  }
  const accountUrl =
    accountUrlParam || currentAccount?.url || currentAccount?.name || "";
  const isPaidUser =
    isAdmin || (plan?.code && !FREE_PLAN_CODES.includes(plan.code));
  const aiFeaturesEnabled = limits?.aiFeaturesEnabled ?? true;
  const aiFromOverride = !!limits?.aiFeaturesFromOverride;
  const canUseAiFeatures =
    isAdmin || (!!aiFeaturesEnabled && (isPaidUser || aiFromOverride));
  const aiDemoGate = useDemoFeatureGate("ai");
  const [homeopsTeam, setHomeopsTeam] = useState([]);
  const [systemsSetupModalOpen, setSystemsSetupModalOpen] = useState(false);
  const [newPropertyCheckingLimits, setNewPropertyCheckingLimits] = useState(
    uid === "new",
  );
  const [systemsSetupInitialStep, setSystemsSetupInitialStep] = useState(null);
  const [systemsSetupOnlyStep, setSystemsSetupOnlyStep] = useState(null);
  const [externalSuggestedSystems, setExternalSuggestedSystems] = useState([]);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptTitle, setUpgradePromptTitle] =
    useState("Upgrade your plan");
  const [upgradePromptMsg, setUpgradePromptMsg] = useState("");
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiSidebarSystemLabel, setAiSidebarSystemLabel] = useState(null);
  const [aiSidebarSystemContext, setAiSidebarSystemContext] = useState(null);
  const [aiSidebarInitialPrompt, setAiSidebarInitialPrompt] = useState(null);
  const [inspectionAnalysis, setInspectionAnalysis] = useState(null);
  const [inspectionReportModalOpen, setInspectionReportModalOpen] =
    useState(false);
  const [inspectionReportSystemId, setInspectionReportSystemId] =
    useState(null);
  const [scheduleFromAiModalOpen, setScheduleFromAiModalOpen] = useState(false);
  const [scheduleFromAiPrefill, setScheduleFromAiPrefill] = useState(null);
  const [createdPropertyFromModal, setCreatedPropertyFromModal] =
    useState(null);
  const [maintenanceEvents, setMaintenanceEvents] = useState([]);
  const [overviewDocuments, setOverviewDocuments] = useState([]);
  const [propertyNotes, setPropertyNotes] = useState([]);
  const [propertyNotesLoading, setPropertyNotesLoading] = useState(false);
  const [propertyNotesSaving, setPropertyNotesSaving] = useState(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalInitialTab, setShareModalInitialTab] = useState("owner");
  const [blankModalOpen, setBlankModalOpen] = useState(false);
  const [inspectionAutoReportMeta, setInspectionAutoReportMeta] =
    useState(null);
  const [inspectionAutoStart, setInspectionAutoStart] = useState(false);
  const [documentsUploadModalRequested, setDocumentsUploadModalRequested] =
    useState(false);
  const [invitationModalOpen, setInvitationModalOpen] = useState(false);
  const [invitationReviewMode, setInvitationReviewMode] = useState(false);
  const [invitationAcceptingId, setInvitationAcceptingId] = useState(null);
  const [invitationDecliningId, setInvitationDecliningId] = useState(null);
  const [invitationError, setInvitationError] = useState(null);
  const invitationMainCardRef = useRef(null);
  const invitationActionInProgressRef = useRef(false);
  const [invitationAcceptedModalOpen, setInvitationAcceptedModalOpen] =
    useState(false);
  const [showInviteAgentCta, setShowInviteAgentCta] = useState(false);
  const [hasResolvedTeamForCta, setHasResolvedTeamForCta] = useState(
    uid === "new",
  );
  const [propertyDetailsLoading, setPropertyDetailsLoading] = useState(false);
  const [inviteAgentBenefitsOpen, setInviteAgentBenefitsOpen] = useState(false);
  const [mainPhotoMenuOpen, setMainPhotoMenuOpen] = useState(false);
  const {handleAddProperty, isChecking: addPropertyChecking} =
    useAddPropertyWithLimitCheck({
      accountId: currentAccount?.id,
      accountUrl,
      onLimitReached: () => {
        setUpgradePromptTitle("Property limit reached");
        setUpgradePromptMsg(
          "You've used all properties on your current plan. Upgrade to add more.",
        );
        setUpgradePromptOpen(true);
      },
    });
  const mainPhotoInputRef = useRef(null);
  const actionsTriggerRef = useRef(null);
  const actionsDropdownRef = useRef(null);
  const saveBarRef = useRef(null);
  const blankModalButtonRef = useRef(null);
  const originalMaintenanceRecordIdsRef = useRef(new Set());
  const originalTeamRef = useRef(null);
  const [expandSectionId, setExpandSectionId] = useState(null);

  const openAiAssistantWithPlanCheck = useCallback(() => {
    if (aiDemoGate.blocked) {
      aiDemoGate.showModal();
      return;
    }
    if (!canUseAiFeatures) {
      setUpgradePromptTitle(
        isPaidUser && !aiFeaturesEnabled
          ? "AI not included on this plan"
          : "Opsy Assistant not included",
      );
      setUpgradePromptMsg(
        isPaidUser && !aiFeaturesEnabled
          ? "Your subscription does not include AI inspection analysis or the Opsy assistant. Upgrade to a plan that includes AI features."
          : "Your plan does not include the Opsy assistant. Upgrade to get AI-powered maintenance and property insights.",
      );
      setUpgradePromptOpen(true);
      return;
    }
    setAiSidebarOpen(true);
  }, [aiDemoGate, canUseAiFeatures, isPaidUser, aiFeaturesEnabled]);

  const aiAssistantPropertyHeader = useMemo(
    () => getPropertyAssistantHeaderLines(state.formData.identity),
    [state.formData.identity],
  );

  const openInspectionAnalysisWithPlanCheck = useCallback(
    (filedDocument = null) => {
      if (aiDemoGate.blocked) {
        aiDemoGate.showModal();
        return;
      }
      if (!canUseAiFeatures) {
        setUpgradePromptTitle("AI inspection analysis not included");
        setUpgradePromptMsg(
          "Your subscription does not include AI inspection analysis. Upgrade to a plan that includes AI features.",
        );
        setUpgradePromptOpen(true);
        return;
      }
      if (filedDocument) {
        const s3Key =
          filedDocument.document_key ??
          filedDocument.documentKey ??
          filedDocument.s3Key ??
          "";
        setInspectionAutoReportMeta({
          s3Key: String(s3Key).trim(),
          fileName: filedDocument.document_name ?? filedDocument.name ?? null,
          mimeType:
            filedDocument.mime_type ??
            filedDocument.mimeType ??
            "application/pdf",
          document_date: filedDocument.document_date ?? null,
        });
        setInspectionAutoStart(true);
      } else {
        setInspectionAutoReportMeta(null);
        setInspectionAutoStart(false);
      }
      setBlankModalOpen(true);
    },
    [aiDemoGate.blocked, aiDemoGate.showModal, canUseAiFeatures],
  );

  // Merged formData – declared early so callbacks can reference it
  const mergedFormData = mergeFormDataFromTabs(state.formData);
  /** Last persisted property (load/save); used for read-only locks — not live form edits */
  const savedMergedPropertyData = useMemo(
    () => (state.property ? mergeFormDataFromTabs(state.property) : {}),
    [state.property],
  );
  const identityDataSource =
    mergedFormData?.identityDataSource ??
    state.property?.identity?.identityDataSource;
  const currentPropertyId =
    state.property?.identity?.id ??
    state.property?.id ??
    (uid !== "new" ? uid : null);
  const currentPropertyContextLabel =
    mergedFormData?.propertyName ||
    mergedFormData?.address ||
    state.property?.property_name ||
    [mergedFormData?.address, mergedFormData?.city, mergedFormData?.state]
      .filter(Boolean)
      .join(", ");

  const supportDataAdjustmentUrl = useCallback(
    (fieldKey) => {
      if (!accountUrl) return undefined;
      if (!fieldKey) return undefined;

      const base = `/${accountUrl}/settings/support/data-adjustment`;
      const params = new URLSearchParams();

      const resolveCurrentVal = (key) => {
        const v = mergedFormData?.[key] ?? mergedFormData?.identity?.[key];
        if (v != null && (typeof v !== "string" || String(v).trim() !== ""))
          return v;
        const aliases = FIELD_ALIASES[key];
        if (aliases) {
          for (const alt of aliases) {
            const av = mergedFormData?.[alt] ?? mergedFormData?.identity?.[alt];
            if (
              av != null &&
              (typeof av !== "string" || String(av).trim() !== "")
            )
              return av;
          }
        }
        return undefined;
      };
      const currentVal = resolveCurrentVal(fieldKey);
      if (currentVal != null && String(currentVal).trim() !== "") {
        params.set("currentValue", String(currentVal).trim());
      }

      if (!ADJUSTABLE_FIELD_KEYS.has(fieldKey)) return undefined;

      if (ADDRESS_FIELD_KEYS.has(fieldKey)) {
        params.set("system", "Address");
      } else if (identityDataSource === "attom") {
        params.set("system", "ATTOM");
      } else if (identityDataSource === "rentcast") {
        params.set("system", "RentCast");
      } else {
        params.set("system", "Property Identity");
      }
      params.set("field", fieldKey);
      if (currentPropertyId)
        params.set("propertyId", String(currentPropertyId));
      if (currentPropertyContextLabel)
        params.set("propertyLabel", currentPropertyContextLabel);
      return `${base}?${params.toString()}`;
    },
    [
      accountUrl,
      currentPropertyContextLabel,
      currentPropertyId,
      identityDataSource,
      mergedFormData,
    ],
  );

  const {
    uploadImage: uploadMainPhoto,
    imagePreviewUrl: mainPhotoPreviewUrl,
    uploadedImageUrl: mainPhotoUploadedUrl,
    imageUploading: mainPhotoUploading,
    imageUploadError: mainPhotoUploadError,
    setImageUploadError: setMainPhotoUploadError,
    clearPreview: clearMainPhotoPreview,
    clearUploadedUrl: clearMainPhotoUploadedUrl,
  } = useImageUpload({
    uploadFolder: S3_UPLOAD_FOLDER.PROPERTY_PHOTOS,
    onSuccess: (key) => {
      dispatch({type: "SET_IDENTITY_FORM_DATA", payload: {mainPhoto: key}});
      if (state.isInitialLoad) {
        dispatch({type: "SET_FORM_CHANGED", payload: true});
      }
    },
  });

  const {
    url: mainPhotoPresignedUrl,
    fetchPreview: fetchMainPhotoPresigned,
    clearUrl: clearMainPhotoPresignedUrl,
    currentKey: mainPhotoPresignedKey,
  } = usePresignedPreview();

  /* Sync active tab from URL ?tab=documents (e.g. from homeowner quick action) */
  useEffect(() => {
    if (uid === "new" || !tabFromUrl) return;
    const validTabs = [
      "overview",
      "identity",
      "systems",
      "maintenance",
      "documents",
      "media",
      "financials",
      "photos",
    ];
    if (validTabs.includes(tabFromUrl)) {
      dispatch({type: "SET_ACTIVE_TAB", payload: tabFromUrl});
    }
  }, [uid, tabFromUrl]);

  /* Google Places Autocomplete for Identity tab address field */
  const handleIdentityPlaceSelected = useCallback((parsed) => {
    dispatch({
      type: "SET_IDENTITY_FORM_DATA",
      payload: {
        address: parsed.formattedAddress,
        fullAddress: parsed.formattedAddress,
        addressLine1: parsed.addressLine1,
        addressLine2: parsed.addressLine2,
        city: parsed.city,
        state: parsed.state,
        zip: parsed.zip,
        county: parsed.county,
      },
    });
    dispatch({type: "SET_FORM_CHANGED", payload: true});
  }, []);

  const {
    inputRef: identityAddressRef,
    isLoaded: identityPlacesLoaded,
    error: identityPlacesError,
    AutocompleteWrapper: IdentityAutocompleteWrapper,
  } = useGooglePlacesAutocomplete({
    onPlaceSelected: handleIdentityPlaceSelected,
  });

  /* Fetch presigned URL when mainPhoto is an S3 key (not blob or http) */
  const mainPhotoKey =
    state.property?.identity?.mainPhoto ??
    state.formData?.identity?.mainPhoto ??
    "";
  const mainPhotoNeedsPresigned =
    mainPhotoKey &&
    !mainPhotoKey.startsWith("blob:") &&
    !mainPhotoKey.startsWith("http");
  useEffect(() => {
    if (mainPhotoNeedsPresigned) {
      fetchMainPhotoPresigned(mainPhotoKey);
    }
  }, [mainPhotoNeedsPresigned, mainPhotoKey, fetchMainPhotoPresigned]);

  // Report: stored PDF report (TODO: integrate with backend)
  const hasReport = Boolean(state.property?.reportUrl);

  /* Close actions dropdown on click outside or Escape */
  useEffect(() => {
    const clickHandler = ({target}) => {
      if (
        !actionsDropdownOpen ||
        actionsDropdownRef.current?.contains(target) ||
        actionsTriggerRef.current?.contains(target)
      )
        return;
      setActionsDropdownOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }, [actionsDropdownOpen]);
  useEffect(() => {
    const keyHandler = ({keyCode}) => {
      if (!actionsDropdownOpen || keyCode !== 27) return;
      setActionsDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [actionsDropdownOpen]);

  /* Open systems setup modal on load when creating a new property. Check limit first. */
  useEffect(() => {
    if (uid !== "new") return;
    let cancelled = false;
    const ADMIN_ROLES = ["super_admin", "admin"];
    if (ADMIN_ROLES.includes(currentUser?.role)) {
      setNewPropertyCheckingLimits(false);
      setSystemsSetupModalOpen(true);
      return;
    }
    (async () => {
      try {
        const res = await AppApi.getBillingStatus(currentAccount?.id);
        const max = res?.limits?.maxProperties;
        const count = res?.usage?.propertiesCount ?? 0;
        if (max != null && count >= max && !cancelled) {
          const accountLabel =
            currentAccount?.name || currentAccount?.url || accountUrl;
          navigate(`/${accountUrl}/properties`, {
            replace: true,
            state: {
              propertyLimitReached: true,
              propertyLimitMessage: `You've used all properties (${count}/${max}) on the "${accountLabel}" account's current plan. Upgrade to add more.`,
            },
          });
          return;
        }
        if (!cancelled) setSystemsSetupModalOpen(true);
      } catch {
        if (!cancelled) setSystemsSetupModalOpen(true);
      } finally {
        if (!cancelled) setNewPropertyCheckingLimits(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, currentUser?.role, currentAccount?.id, accountUrl, navigate]);

  /* When modal closes with a created-but-not-yet-navigated property (e.g. user dismissed without completing), navigate to it */
  const prevModalOpenRef = useRef(systemsSetupModalOpen);
  useEffect(() => {
    const wasOpen = prevModalOpenRef.current;
    prevModalOpenRef.current = systemsSetupModalOpen;
    if (
      wasOpen &&
      !systemsSetupModalOpen &&
      createdPropertyFromModal?.property_uid
    ) {
      const newUid = createdPropertyFromModal.property_uid;
      setCreatedPropertyFromModal(null);
      navigate(`/${accountUrl}/properties/${newUid}`, {
        replace: true,
        state: buildPropertyFormNavStateFromProperties(properties, newUid),
      });
    }
  }, [
    systemsSetupModalOpen,
    createdPropertyFromModal,
    properties,
    accountUrl,
    navigate,
  ]);

  /* Open AI sidebar when navigating from property card with openAiSidebar */
  useEffect(() => {
    if (uid !== "new" && location.state?.openAiSidebar) {
      openAiAssistantWithPlanCheck();
      const {openAiSidebar: _, ...restState} = location.state ?? {};
      navigate(location.pathname, {replace: true, state: restState});
    }
  }, [
    uid,
    location.state,
    location.pathname,
    navigate,
    openAiAssistantWithPlanCheck,
  ]);

  /* True when an agent is on the team or any invitation is still pending (API pending rows use
   * editor/viewer, not role "agent", so _pending is required). Used only to suppress the floating
   * CTA. Only platform role `agent` counts — admin/super_admin are HomeOps internal users. */
  const hasAgentOrPendingInvitation = useMemo(() => {
    return (homeopsTeam ?? []).some((m) => {
      if (m._pending === true) return true;
      return (m.role ?? "").toLowerCase() === "agent";
    });
  }, [homeopsTeam]);

  /* Platform agents and tethered assistants share agent-like workspace UX —
     admins/super_admins should still see the "invite an agent" CTA. */
  const isCurrentUserAgent = ["agent", "assistant"].includes(
    (currentUser?.role ?? "").toLowerCase(),
  );

  // Invitation mode is only enabled when the invitation belongs to the
  // current user and targets the currently viewed property.
  useEffect(() => {
    if (!invitationIdFromUrlRaw || uid === "new") {
      setValidatedInvitationId(null);
      setIsValidatingInvitationId(false);
      return;
    }

    let cancelled = false;

    async function validateInvitationAccess() {
      setIsValidatingInvitationId(true);
      setValidatedInvitationId(null);
      try {
        const received = await AppApi.getReceivedInvitations({
          status: "pending",
        });
        if (cancelled) return;

        const isValid = (received ?? []).some((inv) => {
          const matchesInvitation =
            String(inv.id) === String(invitationIdFromUrlRaw);
          const invitationPropertyRef = inv.propertyUid ?? inv.propertyId;
          const matchesProperty =
            invitationPropertyRef != null &&
            String(invitationPropertyRef) === String(uid);
          return matchesInvitation && matchesProperty;
        });

        if (isValid) {
          setValidatedInvitationId(invitationIdFromUrlRaw);
          return;
        }
      } catch (err) {
        console.warn("Failed to validate invitation access:", err);
      }

      if (cancelled) return;

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("invitation");
      const nextSearch = nextParams.toString();
      navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, {
        replace: true,
        state: location.state,
      });
    }

    validateInvitationAccess().finally(() => {
      if (!cancelled) setIsValidatingInvitationId(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    invitationIdFromUrlRaw,
    uid,
    searchParams,
    navigate,
    location.pathname,
    location.state,
  ]);

  useEffect(() => {
    if (
      uid === "new" ||
      !hasResolvedTeamForCta ||
      hasAgentOrPendingInvitation ||
      isCurrentUserAgent ||
      isInviteAgentCtaDismissed(uid)
    ) {
      setShowInviteAgentCta(false);
      return;
    }
    setShowInviteAgentCta(true);
  }, [
    uid,
    hasResolvedTeamForCta,
    hasAgentOrPendingInvitation,
    isCurrentUserAgent,
  ]);

  /* Open invitation modal when viewing property from invitation notification */
  useEffect(() => {
    if (isInvitationView && state.property && invitationIdFromUrl) {
      setInvitationModalOpen(true);
      setInvitationReviewMode(false);
    }
  }, [isInvitationView, state.property, invitationIdFromUrl]);

  const enrichPropertyTeamMembers = useCallback(
    (raw) =>
      (raw ?? []).map((m) => {
        const u = users?.find(
          (us) => us && m?.id != null && Number(us.id) === Number(m.id),
        );
        return {
          ...m,
          role: m.role,
          property_role: m.property_role ?? "editor",
          image_url:
            m.image_url ?? m.avatar_url ?? u?.image_url ?? u?.avatarUrl,
          image:
            m.image ?? u?.image ?? u?.avatarUrl ?? u?.avatar_url ?? u?.avatar,
        };
      }),
    [users],
  );

  const reloadHomeopsTeam = useCallback(
    async ({bypassCache = true} = {}) => {
      if (uid === "new") return [];
      const team = await getPropertyTeam(uid, {bypassCache});
      const raw = team?.property_users ?? [];
      const enriched = enrichPropertyTeamMembers(raw);
      setHomeopsTeam(enriched);
      originalTeamRef.current = prepareTeamForProperty(enriched);
      return enriched;
    },
    [uid, getPropertyTeam, enrichPropertyTeamMembers],
  );

  const afterPropertyInvitationAcceptedInApp = useCallback(async () => {
    window.dispatchEvent(new CustomEvent("opsy:notifications-refresh"));
    setInvitationModalOpen(false);
    setInvitationReviewMode(false);
    await reloadHomeopsTeam();
    setInvitationAcceptedModalOpen(true);
    refreshProperties?.();
  }, [reloadHomeopsTeam, refreshProperties]);

  const dismissInvitationAcceptedModal = useCallback(() => {
    setInvitationAcceptedModalOpen(false);
    navigate(`/${accountUrl}/properties/${uid}`, {replace: true});
  }, [accountUrl, uid, navigate]);

  /* When ownership transfer is accepted from notifications, refresh team in-place so owner badge updates without page reload. */
  useEffect(() => {
    if (typeof window === "undefined" || uid === "new") return;
    let cancelled = false;
    const handleOwnershipChanged = async (event) => {
      const detail = event?.detail ?? {};
      const eventUid = detail.propertyUid;
      const eventPropertyId = detail.propertyId;
      const currentPropertyId =
        state.property?.identity?.id ?? state.property?.id;
      const matchesUid = eventUid != null && String(eventUid) === String(uid);
      const matchesId =
        eventPropertyId != null &&
        currentPropertyId != null &&
        String(eventPropertyId) === String(currentPropertyId);
      if (!matchesUid && !matchesId) return;
      try {
        await reloadHomeopsTeam();
        if (cancelled) return;
        refreshProperties?.();
      } catch (err) {
        console.error("[PropertyForm] ownership refresh failed:", err);
      }
    };
    window.addEventListener(
      "opsy:property-ownership-changed",
      handleOwnershipChanged,
    );
    return () => {
      cancelled = true;
      window.removeEventListener(
        "opsy:property-ownership-changed",
        handleOwnershipChanged,
      );
    };
  }, [
    uid,
    state.property?.identity?.id,
    state.property?.id,
    reloadHomeopsTeam,
    refreshProperties,
  ]);

  /* Refresh team when invitations change elsewhere in the app (e.g. accept from notifications). */
  useEffect(() => {
    if (typeof window === "undefined" || uid === "new") return;
    let cancelled = false;
    const handleTeamChanged = async (event) => {
      const detail = event?.detail ?? {};
      const eventUid = detail.propertyUid;
      const eventPropertyId = detail.propertyId;
      const currentPropertyId =
        state.property?.identity?.id ?? state.property?.id;
      const matchesUid = eventUid != null && String(eventUid) === String(uid);
      const matchesId =
        eventPropertyId != null &&
        currentPropertyId != null &&
        String(eventPropertyId) === String(currentPropertyId);
      if (!matchesUid && !matchesId) return;
      try {
        await reloadHomeopsTeam();
        if (!cancelled) refreshProperties?.();
      } catch (err) {
        console.error("[PropertyForm] team refresh failed:", err);
      }
    };
    window.addEventListener("opsy:property-team-changed", handleTeamChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(
        "opsy:property-team-changed",
        handleTeamChanged,
      );
    };
  }, [
    uid,
    state.property?.identity?.id,
    state.property?.id,
    reloadHomeopsTeam,
    refreshProperties,
  ]);

  /* Fetch inspection analysis for hero card pill and report context */
  const propertyIdForApi =
    state.property?.identity?.id ??
    state.property?.id ??
    (uid !== "new" ? uid : null);
  useEffect(() => {
    if (!propertyIdForApi) return;
    AppApi.getInspectionAnalysisByProperty(propertyIdForApi)
      .then((res) => setInspectionAnalysis(res?.analysis ?? null))
      .catch(() => setInspectionAnalysis(null));
  }, [propertyIdForApi]);

  useEffect(() => {
    if (typeof window === "undefined" || !propertyIdForApi) return;
    const normalizedPropertyId = String(propertyIdForApi);
    const handleInspectionAnalysisUpdated = async (event) => {
      const eventPropertyId = String(event?.detail?.propertyId ?? "");
      if (eventPropertyId && eventPropertyId !== normalizedPropertyId) return;
      try {
        const res =
          await AppApi.getInspectionAnalysisByProperty(propertyIdForApi);
        setInspectionAnalysis(res?.analysis ?? null);
      } catch {
        // Keep existing analysis if refresh fails.
      }
    };
    window.addEventListener(
      INSPECTION_ANALYSIS_UPDATED_EVENT,
      handleInspectionAnalysisUpdated,
    );
    return () => {
      window.removeEventListener(
        INSPECTION_ANALYSIS_UPDATED_EVENT,
        handleInspectionAnalysisUpdated,
      );
    };
  }, [propertyIdForApi]);

  useEffect(() => {
    if (typeof window === "undefined" || !propertyIdForApi) return;
    const normalizedPropertyId = String(propertyIdForApi);
    const handleOpsymizationRequest = (event) => {
      if (String(event.detail?.propertyId ?? "") !== normalizedPropertyId)
        return;
      openInspectionAnalysisWithPlanCheck(event.detail?.document ?? null);
    };
    window.addEventListener(
      REQUEST_INSPECTION_OPSYMIZATION_EVENT,
      handleOpsymizationRequest,
    );
    return () =>
      window.removeEventListener(
        REQUEST_INSPECTION_OPSYMIZATION_EVENT,
        handleOpsymizationRequest,
      );
  }, [propertyIdForApi, openInspectionAnalysisWithPlanCheck]);

  /* Get property by ID and its systems */
  useEffect(() => {
    async function loadPropertyAndSystems() {
      if (uid === "new") return;
      setPropertyDetailsLoading(true);
      try {
        /* Use preloaded data from create flow to avoid blank/loading state */
        const preloaded = location.state?.createdProperty;
        const preloadedUid = location.state?.createdPropertyUid;
        if (preloaded && preloadedUid === uid) {
          dispatch({
            type: "SET_PROPERTY",
            payload: preloaded,
          });
          const propertyId = preloaded.identity?.id ?? preloaded.id;
          if (propertyId) {
            const systemsRes = await getSystemsByPropertyId(propertyId);
            const systemsArr = systemsRes?.systems ?? systemsRes ?? [];
            dispatch({type: "SET_SYSTEMS", payload: systemsArr});
            if (systemsRes?.aiSummaryUpdatedAt) {
              dispatch({
                type: "SET_AI_SUMMARY_UPDATED_AT",
                payload: systemsRes.aiSummaryUpdatedAt,
              });
            }
          }
          return;
        }
        /* Instant display: when navigating from Properties list, show list property immediately while full fetch runs */
        const listProperty = location.state?.property;
        const listPropertyUid =
          listProperty?.property_uid ??
          listProperty?.propertyUid ??
          listProperty?.id;
        if (listProperty && listPropertyUid === uid) {
          const flat = mapPropertyFromBackend(listProperty) ?? listProperty;
          const tabbed = splitFormDataByTabs(flat);
          dispatch({
            type: "SET_PROPERTY",
            payload: {
              ...tabbed,
              maintenanceRecords: tabbed.maintenanceRecords ?? [],
              systems: tabbed.systems ?? {
                selectedSystemIds: [],
                customSystemNames: [],
                customSystemsData: {},
              },
            },
          });
        }
        try {
          const [property, systemsRes, rawRecords] = await Promise.all([
            getPropertyById(uid),
            getSystemsByPropertyId(uid),
            getMaintenanceRecordsByPropertyId(uid),
          ]);
          const systemsArr = systemsRes?.systems ?? systemsRes ?? [];
          if (systemsRes?.aiSummaryUpdatedAt) {
            dispatch({
              type: "SET_AI_SUMMARY_UPDATED_AT",
              payload: systemsRes.aiSummaryUpdatedAt,
            });
          }
          const maintenanceRecords = mapMaintenanceRecordsFromBackend(
            rawRecords ?? [],
          );
          setMaintenanceRecords(maintenanceRecords);
          originalMaintenanceRecordIdsRef.current = new Set(
            (maintenanceRecords ?? [])
              .filter((r) => !isNewMaintenanceRecord(r))
              .map((r) => r.id),
          );
          const includedSystems = (systemsArr ?? []).filter(
            (s) => s.included !== false,
          );
          const flat = mapPropertyFromBackend(property) ?? property;
          const tabbed = splitFormDataByTabs(flat);
          const fromSystems = mapSystemsFromBackend(includedSystems);
          const selectedIdsFromBackend = includedSystems
            .map((s) => s.system_key ?? s.systemKey)
            .filter((k) => k && !k.startsWith("custom-"));
          const customNamesFromBackend = Object.keys(
            fromSystems.customSystemsData ?? {},
          );
          dispatch({
            type: "SET_PROPERTY",
            payload: {
              ...tabbed,
              maintenanceRecords: maintenanceRecords ?? [],
              systems: {
                ...tabbed.systems,
                ...fromSystems,
                selectedSystemIds:
                  selectedIdsFromBackend.length > 0
                    ? selectedIdsFromBackend
                    : (tabbed.systems.selectedSystemIds ?? []),
                customSystemNames:
                  customNamesFromBackend.length > 0
                    ? customNamesFromBackend
                    : (tabbed.systems.customSystemNames ?? []),
                customSystemsData:
                  fromSystems.customSystemsData ??
                  tabbed.systems.customSystemsData ??
                  {},
              },
            },
          });
          dispatch({type: "SET_SYSTEMS", payload: systemsArr ?? []});
        } catch (err) {
          if (err instanceof ApiError) {
            if (isPropertyNotFoundError(err)) {
              dispatch({type: "SET_PROPERTY_NOT_FOUND", payload: true});
            } else if (err.status === 403) {
              dispatch({type: "SET_PROPERTY_ACCESS_DENIED", payload: true});
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      } finally {
        setPropertyDetailsLoading(false);
      }
    }
    loadPropertyAndSystems();
  }, [uid]);

  /* Fetch maintenance events for Systems tab (scheduled icon + date) */
  const effectivePropertyId =
    state.property?.identity?.id ??
    state.property?.id ??
    (uid !== "new" ? uid : null);
  const fetchMaintenanceEvents = useCallback(() => {
    if (!effectivePropertyId) return;
    AppApi.getMaintenanceEventsByProperty(effectivePropertyId)
      .then((events) => {
        setMaintenanceEvents(events ?? []);
        window.dispatchEvent(new CustomEvent("inspection-checklist:updated"));
      })
      .catch(() => setMaintenanceEvents([]));
  }, [effectivePropertyId]);
  const handleMaintenanceRecordsChange = useCallback(
    (records, options = {}) => {
      dispatch({
        type: options.silent
          ? "SET_MAINTENANCE_FORM_DATA_SILENT"
          : "SET_MAINTENANCE_FORM_DATA",
        payload: records,
      });
      if (options.persistedRecord?.id != null) {
        dispatch({
          type: "MERGE_SAVED_MAINTENANCE_RECORD",
          payload: options.persistedRecord,
        });
        originalMaintenanceRecordIdsRef.current.add(options.persistedRecord.id);
      }
    },
    [],
  );
  const handleOpenMaintenanceRecordView = useCallback(
    (record) => {
      openMaintenanceRecordInNewTab({
        accountUrl,
        propertyId: uid,
        record,
      });
    },
    [accountUrl, uid],
  );
  useEffect(() => {
    if (!effectivePropertyId) {
      setMaintenanceEvents([]);
      return;
    }
    let cancelled = false;
    AppApi.getMaintenanceEventsByProperty(effectivePropertyId)
      .then((events) => {
        if (!cancelled) setMaintenanceEvents(events ?? []);
      })
      .catch(() => {
        if (!cancelled) setMaintenanceEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [effectivePropertyId]);

  const refreshOverviewDocuments = useCallback(() => {
    if (!effectivePropertyId) {
      setOverviewDocuments([]);
      return;
    }
    AppApi.getPropertyDocuments(effectivePropertyId)
      .then((docs) => setOverviewDocuments(docs ?? []))
      .catch(() => setOverviewDocuments([]));
  }, [effectivePropertyId]);

  const refreshPropertyNotes = useCallback(() => {
    if (!effectivePropertyId) {
      setPropertyNotes([]);
      return;
    }
    setPropertyNotesLoading(true);
    AppApi.getPropertyNotes(effectivePropertyId)
      .then((notes) => setPropertyNotes(notes ?? []))
      .catch(() => setPropertyNotes([]))
      .finally(() => setPropertyNotesLoading(false));
  }, [effectivePropertyId]);

  useEffect(() => {
    refreshOverviewDocuments();
  }, [refreshOverviewDocuments]);

  useEffect(() => {
    refreshPropertyNotes();
  }, [refreshPropertyNotes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleDocumentsChanged = () => refreshOverviewDocuments();
    window.addEventListener(
      PROPERTY_DOCUMENTS_CHANGED_EVENT,
      handleDocumentsChanged,
    );
    return () => {
      window.removeEventListener(
        PROPERTY_DOCUMENTS_CHANGED_EVENT,
        handleDocumentsChanged,
      );
    };
  }, [refreshOverviewDocuments]);

  const handleAddPropertyNote = useCallback(
    async (body) => {
      if (!effectivePropertyId) return;
      setPropertyNotesSaving(true);
      try {
        const note = await AppApi.createPropertyNote(effectivePropertyId, body);
        setPropertyNotes((prev) => [note, ...prev]);
      } finally {
        setPropertyNotesSaving(false);
      }
    },
    [effectivePropertyId],
  );

  const handleUpdatePropertyNote = useCallback(async (noteId, body) => {
    setPropertyNotesSaving(true);
    try {
      const note = await AppApi.updatePropertyNote(noteId, body);
      setPropertyNotes((prev) =>
        prev.map((n) => (n.id === note.id ? note : n)),
      );
    } finally {
      setPropertyNotesSaving(false);
    }
  }, []);

  const handleDeletePropertyNote = useCallback(async (noteId) => {
    await AppApi.deletePropertyNote(noteId);
    setPropertyNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  /** Latest form snapshot for ATTOM completion (poll may finish after many renders). */
  const attomFormSnapshotRef = useRef({
    formDataChanged: false,
    formData: null,
    systems: null,
  });
  attomFormSnapshotRef.current = {
    formDataChanged: state.formDataChanged,
    formData: state.formData,
    systems: state.systems,
  };

  /** Called after a background ATTOM lookup completes. Refetches the property
   *  and applies newly filled identity fields to the form. When the form is
   *  dirty, only empty local fields are filled so unsaved edits are kept. */
  const handleAttomRefreshComplete = useCallback(
    async (populatedKeys = []) => {
      if (!effectivePropertyId || uid === "new") return;
      try {
        const refreshed = await getPropertyById(uid);
        if (!refreshed) return;
        const systemsRes = await getSystemsByPropertyId(
          effectivePropertyId,
        ).catch(() => null);
        const snapshot = attomFormSnapshotRef.current;
        const systemsFromBackend =
          systemsRes?.systems ?? systemsRes ?? snapshot.systems ?? [];
        const propertyPayload = {
          ...buildPropertyPayloadFromRefresh(
            refreshed,
            systemsFromBackend ?? [],
            refreshed,
          ),
          maintenanceRecords: snapshot.formData?.maintenanceRecords ?? [],
        };
        const scrollEl = document.querySelector(".flex-1.overflow-y-auto");
        const scrollPos = scrollEl?.scrollTop ?? window.scrollY ?? 0;
        const wroteCount = Array.isArray(populatedKeys)
          ? populatedKeys.length
          : 0;

        if (snapshot.formDataChanged) {
          const refreshedFlat = mergeFormDataFromTabs(propertyPayload);
          const localFlat = mergeFormDataFromTabs(snapshot.formData);
          const identityKeys = [
            ...IDENTITY_SECTIONS.flatMap((s) => s.fields ?? []),
            "fullAddress",
            "addressLine2",
            "county",
          ];
          const isEmptyVal = (v) =>
            v == null ||
            v === "" ||
            (typeof v === "string" && v.trim() === "") ||
            (typeof v === "number" && !Number.isFinite(v));
          const isFilledVal = (v) => !isEmptyVal(v);
          const identityFill = {};
          for (const key of identityKeys) {
            if (isEmptyVal(localFlat[key]) && isFilledVal(refreshedFlat[key])) {
              identityFill[key] = refreshedFlat[key];
            }
          }
          if (refreshedFlat.identityDataSource != null) {
            identityFill.identityDataSource = refreshedFlat.identityDataSource;
          }
          if (refreshedFlat.identityLookupPopulatedKeys != null) {
            identityFill.identityLookupPopulatedKeys =
              refreshedFlat.identityLookupPopulatedKeys;
          }
          const filledCount = Object.keys(identityFill).filter(
            (k) =>
              k !== "identityDataSource" &&
              k !== "identityLookupPopulatedKeys",
          ).length;
          dispatch({
            type: "ATTOM_REFRESH_MERGE",
            payload: {
              propertyPayload,
              systems: systemsFromBackend ?? snapshot.systems,
              identityFill,
              banner: {
                open: true,
                type: filledCount > 0 || wroteCount > 0 ? "success" : "info",
                message:
                  filledCount > 0
                    ? "Missing property details filled from ATTOM public records. Your unsaved edits were preserved."
                    : "ATTOM lookup finished. No additional empty Identity fields were available to fill. Your unsaved edits were preserved.",
              },
            },
          });
        } else {
          dispatch({
            type: "SAVE_COMPLETED",
            payload: {
              propertyPayload,
              systems: systemsFromBackend ?? snapshot.systems,
              banner: {
                open: true,
                type: wroteCount > 0 ? "success" : "info",
                message:
                  wroteCount > 0
                    ? "Missing property details filled from ATTOM public records."
                    : "ATTOM lookup finished. No additional empty Identity fields were available to fill.",
              },
            },
          });
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector(".flex-1.overflow-y-auto");
            if (el) el.scrollTop = scrollPos;
            else if (scrollPos) window.scrollTo(0, scrollPos);
          });
        });
      } catch (err) {
        console.error("[PropertyForm] handleAttomRefreshComplete error:", err);
      }
    },
    [
      effectivePropertyId,
      uid,
      getPropertyById,
      getSystemsByPropertyId,
      dispatch,
    ],
  );

  const handleAttomRefreshFailed = useCallback(
    (message) => {
      const normalized =
        message &&
        /could not be found|verify the address/i.test(String(message))
          ? "We couldn't find public records for this address. Your property is saved — enter details manually on the Identity tab, or use Refresh property data to try again."
          : message ||
            "Public records lookup failed. Double-check the address and try again.";
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: normalized,
        },
      });
    },
    [dispatch],
  );

  const attomRefresh = useAttomRefresh(
    uid !== "new" ? effectivePropertyId : null,
    {
      onComplete: handleAttomRefreshComplete,
      onFail: handleAttomRefreshFailed,
    },
  );

  const initialAttomPullAttemptedRef = useRef(false);
  /** Set when user chooses "Save & pull" so we enqueue ATTOM after a successful save
   *  even if the address fingerprint did not change. */
  const pendingAttomPullAfterSaveRef = useRef(false);
  useEffect(() => {
    initialAttomPullAttemptedRef.current = false;
    pendingAttomPullAfterSaveRef.current = false;
  }, [effectivePropertyId]);

  /** Auto-pull ATTOM when a saved property has never had a lookup and has a complete address.
   * Skip when vendor source is set AND non-address identity fields are already present
   * (converted pre-purchase with source but empty fields should still auto-pull). */
  useEffect(() => {
    if (uid === "new" || !effectivePropertyId) return;
    if (!attomRefresh.initialLoaded || initialAttomPullAttemptedRef.current)
      return;
    if (attomRefresh.isActive || attomRefresh.isAtLookupLimit) return;
    if (attomRefresh.lookupCount > 0) return;
    const sourceIsVendor =
      identityDataSource === "attom" || identityDataSource === "rentcast";
    if (sourceIsVendor && hasNonAddressIdentityFields(savedMergedPropertyData))
      return;
    if (!hasCompleteAddressForAttom(savedMergedPropertyData)) return;

    initialAttomPullAttemptedRef.current = true;
    void attomRefresh.startRefresh({silent: true});
  }, [
    uid,
    effectivePropertyId,
    attomRefresh.initialLoaded,
    attomRefresh.isActive,
    attomRefresh.isAtLookupLimit,
    attomRefresh.lookupCount,
    attomRefresh.startRefresh,
    identityDataSource,
    savedMergedPropertyData,
  ]);

  const refreshPropertySystems = useCallback(async () => {
    if (!effectivePropertyId) return;
    try {
      const systemsRes = await getSystemsByPropertyId(effectivePropertyId);
      const systemsArr = systemsRes?.systems ?? systemsRes ?? [];
      const includedSystems = (systemsArr ?? []).filter(
        (s) => s.included !== false,
      );
      const fromSystems = mapSystemsFromBackend(includedSystems);
      const selectedIdsFromBackend = includedSystems
        .map((s) => s.system_key ?? s.systemKey)
        .filter((k) => k && !String(k).startsWith("custom-"));
      const customNamesFromBackend = Object.keys(
        fromSystems.customSystemsData ?? {},
      );
      const {customSystemsData, ...flatFields} = fromSystems;
      dispatch({
        type: "SET_SYSTEMS_FORM_DATA_SILENT",
        payload: {
          ...flatFields,
          selectedSystemIds:
            selectedIdsFromBackend.length > 0
              ? selectedIdsFromBackend
              : (state.formData.systems?.selectedSystemIds ?? []),
          customSystemNames:
            customNamesFromBackend.length > 0
              ? customNamesFromBackend
              : (state.formData.systems?.customSystemNames ?? []),
          customSystemsData:
            customSystemsData ??
            state.formData.systems?.customSystemsData ??
            {},
        },
      });
      dispatch({type: "SET_SYSTEMS", payload: systemsArr ?? []});
    } catch (err) {
      console.error("[PropertyForm] refreshPropertySystems error:", err);
    }
  }, [
    effectivePropertyId,
    getSystemsByPropertyId,
    dispatch,
    state.formData.systems,
  ]);

  const refreshPropertyIdentity = useCallback(async () => {
    if (!uid || uid === "new") return;
    try {
      const property = await getPropertyById(uid);
      const flat = mapPropertyFromBackend(property) ?? property;
      const tabbed = splitFormDataByTabs(flat);
      if (tabbed?.identity) {
        dispatch({
          type: "SET_IDENTITY_FORM_DATA_SILENT",
          payload: tabbed.identity,
        });
      }
    } catch (err) {
      console.error("[PropertyForm] refreshPropertyIdentity error:", err);
    }
  }, [uid, getPropertyById, dispatch]);

  const handleDocumentAnalysisApplied = useCallback(async () => {
    await Promise.all([refreshPropertySystems(), refreshPropertyIdentity()]);
  }, [refreshPropertySystems, refreshPropertyIdentity]);

  /* Reset form when navigating TO new from another property (not on initial mount); clear 403 when uid changes */
  const prevUidRef = useRef(null);
  useEffect(() => {
    if (uid === "new") {
      setHasResolvedTeamForCta(true);
      const cameFromOtherProperty =
        prevUidRef.current != null && prevUidRef.current !== "new";
      if (cameFromOtherProperty) {
        dispatch({type: "SET_PROPERTY", payload: null});
        dispatch({type: "SET_SYSTEMS", payload: []});
        dispatch({type: "SET_PROPERTY_ACCESS_DENIED", payload: false});
        dispatch({type: "SET_PROPERTY_NOT_FOUND", payload: false});
        setHomeopsTeam([]);
      }
    } else if (prevUidRef.current !== uid) {
      setHasResolvedTeamForCta(false);
      dispatch({type: "SET_PROPERTY_ACCESS_DENIED", payload: false});
      dispatch({type: "SET_PROPERTY_NOT_FOUND", payload: false});
    }
    prevUidRef.current = uid;
  }, [uid]);

  /* New property: ensure at least the creator is on the team (cannot be removed in modal) */
  useEffect(() => {
    if (uid !== "new" || !currentUser?.id) return;
    setHomeopsTeam((prev) => {
      if (prev.length > 0) return prev;
      const creator = getCreatorAsTeamMember(currentUser);
      return creator ? [creator] : prev;
    });
  }, [uid, currentUser?.id, currentUser?.name, currentUser?.role]);

  /* Clear main photo preview and presigned URL when switching properties */
  const prevPropertyUidRef = useRef(null);
  useEffect(() => {
    const currentUid =
      state.property?.id ?? state.property?.identity?.id ?? null;
    const switched =
      prevPropertyUidRef.current != null &&
      currentUid !== prevPropertyUidRef.current;
    const cleared = prevPropertyUidRef.current != null && currentUid == null;
    prevPropertyUidRef.current = currentUid;
    if (switched || cleared) {
      clearMainPhotoPreview();
      clearMainPhotoUploadedUrl();
      clearMainPhotoPresignedUrl();
    }
  }, [
    state.property,
    clearMainPhotoPreview,
    clearMainPhotoUploadedUrl,
    clearMainPhotoPresignedUrl,
  ]);

  /* Show main photo upload error in the top banner instead of under the image */
  useEffect(() => {
    if (mainPhotoUploadError) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: mainPhotoUploadError,
        },
      });
    }
  }, [mainPhotoUploadError]);

  /* Sets default HomeOps Team (only for existing properties; new form keeps team [] from reset effect). Enrich with property_role as role and user image from context so photos and roles display after save/refetch. */
  useEffect(() => {
    let cancelled = false;
    async function setDefaultHomeopsTeam() {
      if (uid === "new") {
        setHasResolvedTeamForCta(true);
        return;
      }
      try {
        const team = await getPropertyTeam(uid, {bypassCache: true});
        const raw = team?.property_users ?? [];
        const enriched = raw.map((m) => {
          const u = users?.find(
            (us) => us && m?.id != null && Number(us.id) === Number(m.id),
          );
          return {
            ...m,
            /* Preserve role (user type: agent, homeowner) for tab categorization; property_role for access (owner, editor, viewer) */
            role: m.role,
            property_role: m.property_role ?? "editor",
            image_url:
              m.image_url ?? m.avatar_url ?? u?.image_url ?? u?.avatarUrl,
            image:
              m.image ?? u?.image ?? u?.avatarUrl ?? u?.avatar_url ?? u?.avatar,
          };
        });
        if (cancelled) return;
        setHomeopsTeam(enriched);
        originalTeamRef.current = prepareTeamForProperty(enriched);
      } finally {
        if (!cancelled) setHasResolvedTeamForCta(true);
      }
    }
    setDefaultHomeopsTeam();
    return () => {
      cancelled = true;
    };
    /* Depend on the stable property id rather than the whole `state.property`
       object — `SET_PROPERTY` runs up to 3x per navigation (preloaded create
       payload, optimistic list-state, full fetch) and each new object reference
       was retriggering this effect, kicking off duplicate /team/:uid fetches. */
  }, [
    uid,
    currentUser?.id,
    state.property?.identity?.id ?? state.property?.id,
  ]);

  /* Handles the change of the property */
  const handleChange = (event) => {
    const {name, value} = event.target;
    if (state.errors[name]) {
      dispatch({
        type: "SET_ERRORS",
        payload: {...state.errors, [name]: null},
      });
    }
    if (name.startsWith("customSystem_")) {
      const rest = name.slice("customSystem_".length);
      const sep = "::";
      const idx = rest.lastIndexOf(sep);
      const systemName = idx >= 0 ? rest.slice(0, idx) : rest;
      const fieldKey = idx >= 0 ? rest.slice(idx + sep.length) : "";
      if (systemName && fieldKey) {
        const prev = state.formData.systems?.customSystemsData ?? {};
        const prevSystem = prev[systemName] ?? {};
        dispatch({
          type: "SET_SYSTEMS_FORM_DATA",
          payload: {
            customSystemsData: {
              ...prev,
              [systemName]: {...prevSystem, [fieldKey]: value},
            },
          },
        });
      }
      if (state.isInitialLoad) {
        dispatch({type: "SET_FORM_CHANGED", payload: true});
      }
      return;
    }
    if (SYSTEM_FIELD_NAMES.has(name)) {
      const processed = value;
      dispatch({type: "SET_SYSTEMS_FORM_DATA", payload: {[name]: processed}});
      if (state.isInitialLoad) {
        dispatch({type: "SET_FORM_CHANGED", payload: true});
      }
      return;
    }
    const numericFields = [
      "price",
      "squareFeet",
      "rooms",
      "bathrooms",
      "yearBuilt",
      "sqFtTotal",
      "sqFtFinished",
      "garageSqFt",
      "totalDwellingSqFt",
      "bedCount",
      "bathCount",
      "fullBaths",
      "threeQuarterBaths",
      "halfBaths",
      "numberOfShowers",
      "numberOfBathtubs",
      "fireplaces",
      "totalCoveredParking",
      "totalUncoveredParking",
    ];
    const processed = numericFields.includes(name)
      ? value === ""
        ? null
        : Number(value)
      : value;
    dispatch({type: "SET_IDENTITY_FORM_DATA", payload: {[name]: processed}});
    if (state.isInitialLoad) {
      dispatch({type: "SET_FORM_CHANGED", payload: true});
    }
  };

  // Ref so systems completion callback always sees latest healthMetrics (avoids stale closure)
  const formDataRef = useRef(state.formData);
  formDataRef.current = state.formData;

  /* Silent systems update – used by auto-populate from AI analysis; does not show save bar. */
  const handleSilentSystemsUpdate = useCallback((payload) => {
    if (payload && typeof payload === "object") {
      dispatch({type: "SET_SYSTEMS_FORM_DATA_SILENT", payload});
    }
  }, []);

  /* Handles changes in systems section completion – updates healthMetrics for persistence.
     Uses SET_IDENTITY_FORM_DATA_SILENT so switching to Systems tab doesn't show the save bar. */
  const handleSystemsCompletionChange = useCallback(
    (completedCount, totalCount) => {
      const currentHealthMetrics =
        formDataRef.current?.identity?.healthMetrics ?? {};
      const currentSystemsIdentified =
        currentHealthMetrics.systemsIdentified ?? {
          current: 0,
          total: totalCount,
        };
      if (
        currentSystemsIdentified.current !== completedCount ||
        currentSystemsIdentified.total !== totalCount
      ) {
        dispatch({
          type: "SET_IDENTITY_FORM_DATA_SILENT",
          payload: {
            healthMetrics: {
              ...currentHealthMetrics,
              systemsIdentified: {
                current: completedCount,
                total: totalCount,
              },
            },
          },
        });
      }
    },
    [],
  );

  /* Required identity fields for create (backend expects strings). */
  const REQUIRED_IDENTITY_FIELDS = [
    {key: "address", label: "Address"},
    {key: "city", label: "City"},
    {key: "state", label: "State"},
    {key: "zip", label: "ZIP"},
  ];

  /* Persist team members invited before the property existed as invitation rows. */
  async function persistPendingTeamInvitations(propertyId, team) {
    const inviteAccountId = currentAccount?.id;
    if (!propertyId || !inviteAccountId) return;
    const pending = (team || []).filter(
      (m) =>
        m &&
        m._pending === true &&
        !m.invitationId &&
        (m.email || m.inviteeEmail),
    );
    for (const member of pending) {
      const inviteeEmail = (member.email || member.inviteeEmail || "").trim();
      if (!inviteeEmail) continue;
      const intendedRole = member.property_role || "editor";
      const intendedPropertyRole = member.intendedPropertyRole;
      const permissions = member.permissions;
      try {
        const res = await AppApi.createInvitation({
          type: "property",
          inviteeEmail,
          inviteeName: (member.name || "").trim() || undefined,
          accountId: inviteAccountId,
          propertyId,
          intendedRole,
          ...(intendedPropertyRole ? {intendedPropertyRole} : {}),
          ...(permissions && Object.keys(permissions).length > 0
            ? {permissions}
            : {}),
          skipInviteEmail: member._sendInviteEmail !== true,
        });
        if (res?.invitation?.id) {
          member.invitationId = res.invitation.id;
        }
      } catch (err) {
        console.error(
          "[property create] failed to persist pending invitation:",
          err?.message || err,
        );
      }
    }
  }

  /* Handles the submission of the property (create) */
  async function handleSubmit(event) {
    event.preventDefault();
    const identity = state.formData.identity ?? {};
    const missing = REQUIRED_IDENTITY_FIELDS.filter(({key}) => {
      const v = identity[key];
      return v == null || (typeof v === "string" && !v.trim());
    });
    if (missing.length > 0) {
      const newErrors = {};
      missing.forEach(({key, label}) => {
        newErrors[key] = `${label} is required`;
      });
      dispatch({type: "SET_VALIDATION_FAILED", payload: {errors: newErrors}});
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `Please fill in the required fields: ${missing
            .map(({label}) => label)
            .join(", ")}.`,
        },
      });
      return;
    }
    dispatch({type: "SET_ERRORS", payload: {}});
    dispatch({type: "SET_SUBMITTING", payload: true});
    try {
      const merged = mergeFormDataFromTabs(state.formData);
      merged.hpsScore = computeHpsScore(merged);
      const propertyData = preparePropertyValues(merged);
      propertyData.account_id = currentAccount?.id;
      const res = await createProperty(propertyData);
      if (res) {
        const propertyId = res.id;
        /* Add users to property (exclude creator - backend already added them as owner) */
        const teamWithoutCreator = homeopsTeam.filter(
          (m) => m && m.id != null && String(m.id) !== String(currentUser?.id),
        );
        if (teamWithoutCreator.length > 0) {
          await addUsersToProperty(
            propertyId,
            prepareTeamForProperty(teamWithoutCreator),
          );
        }
        await persistPendingTeamInvitations(propertyId, homeopsTeam);
        const systemsPayloads = prepareSystemsForApi(
          state.formData.systems ?? {},
          propertyId,
        );
        /* Create systems for property */
        await createSystemsForProperty(propertyId, systemsPayloads);
        const newUid = res.property_uid ?? res.id;

        /* Create maintenance records for property (batch endpoint) */
        const recordsToCreate = state.formData.maintenanceRecords ?? [];
        const recordsWithoutDate = recordsToCreate.filter(
          (r) => !(r.date != null && String(r.date).trim()),
        );
        if (recordsWithoutDate.length > 0) {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: `Please add a date to all maintenance records before saving. ${recordsWithoutDate.length} record(s) are missing a date.`,
            },
          });
          dispatch({type: "SET_SUBMITTING", payload: false});
          return;
        }
        const payloads = prepareMaintenanceRecordsForApi(
          recordsToCreate,
          propertyId,
        );
        if (payloads.length > 0) {
          await createMaintenanceRecords(propertyId, payloads);
        }

        /* Fetch the created property so we can pass it in nav state and avoid the loading/blank screen */
        const refreshed = await getPropertyById(newUid);
        const rawRecords = await getMaintenanceRecordsByPropertyId(propertyId);
        const maintenanceRecordsFromCreate = mapMaintenanceRecordsFromBackend(
          rawRecords ?? [],
        );
        setMaintenanceRecords(maintenanceRecordsFromCreate);
        originalMaintenanceRecordIdsRef.current = new Set(
          (maintenanceRecordsFromCreate ?? [])
            .filter((r) => !isNewMaintenanceRecord(r))
            .map((r) => r.id),
        );
        const systemsRes = await getSystemsByPropertyId(propertyId);
        const systemsFromBackend = systemsRes?.systems ?? systemsRes ?? [];
        const preloadedPayload = {
          ...buildPropertyPayloadFromRefresh(
            refreshed,
            systemsFromBackend ?? [],
            res,
          ),
          maintenanceRecords: maintenanceRecordsFromCreate ?? [],
        };

        navigate(`/${accountUrl}/properties/${newUid}`, {
          replace: true,
          state: {
            createdProperty: preloadedPayload,
            createdPropertyUid: newUid,
            ...buildPropertyFormNavStateFromProperties(properties, newUid),
          },
        });
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: t("propertyCreatedSuccessfullyMessage"),
          },
        });
      } else {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: t("propertyCreateErrorMessage"),
          },
        });
      }
    } catch (err) {
      console.error("Error creating property:", err);
      if (
        err?.status === 403 &&
        err?.message?.toLowerCase().includes("limit")
      ) {
        // TierLimitBanner shows globally from ApiError — don't also open UpgradePrompt
      } else {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message:
              t("propertyCreateErrorMessage") +
              (err?.message ? ` ${err.message}` : ""),
          },
        });
      }
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  const handleBackToProperties = () => navigate(`/${accountUrl}/properties`);
  const handleNewProperty = () => handleAddProperty();

  const handleTeamChange = (team) => {
    setHomeopsTeam(team);
    dispatch({type: "SET_FORM_CHANGED", payload: true});
  };

  const handleCancelChanges = () => {
    if (state.property) {
      dispatch({type: "SET_PROPERTY", payload: state.property});
      dispatch({type: "SET_FORM_CHANGED", payload: false});
    } else {
      dispatch({type: "SET_PROPERTY", payload: null});
      navigate(`/${accountUrl}/properties`);
    }
  };

  const handleCancelIdentityEdit = useCallback(() => {
    if (!state.property) return;

    const saved = mergeFormDataFromTabs(state.property);
    const identityFieldKeys = [
      ...IDENTITY_SECTIONS.flatMap((s) => s.fields ?? []),
      "fullAddress",
      "addressLine2",
    ];
    const payload = {};
    for (const key of identityFieldKeys) {
      payload[key] = saved[key] ?? saved.identity?.[key] ?? null;
    }
    dispatch({type: "SET_IDENTITY_FORM_DATA_SILENT", payload});

    if (identityAddressRef.current) {
      identityAddressRef.current.value =
        getIdentityAddressInputDisplayValue(saved) ?? "";
    }

    const identityErrorKeys = [
      "propertyName",
      "address",
      "city",
      "state",
      "zip",
    ];
    const nextErrors = {...state.errors};
    let errorsChanged = false;
    for (const key of identityErrorKeys) {
      if (nextErrors[key]) {
        nextErrors[key] = null;
        errorsChanged = true;
      }
    }
    if (errorsChanged) {
      dispatch({type: "SET_ERRORS", payload: nextErrors});
    }

    const maintenanceDirty =
      JSON.stringify(state.formData.maintenanceRecords ?? []) !==
      JSON.stringify(state.savedMaintenanceRecords ?? []);
    dispatch({
      type: "SET_FORM_CHANGED",
      payload: state.systemsDirty || maintenanceDirty,
    });
  }, [
    state.property,
    state.errors,
    state.systemsDirty,
    state.formData.maintenanceRecords,
    state.savedMaintenanceRecords,
  ]);

  /** Scroll to section and highlight – runs after tab switch so target is in DOM. */
  const INCOMPLETE_SECTION_GLOW = [
    "shadow-[0_0_0_1px_rgba(251,146,60,0.45),0_0_20px_rgba(251,146,60,0.25)]",
    "hover:!shadow-[0_0_0_1px_rgba(251,146,60,0.45),0_0_20px_rgba(251,146,60,0.25)]",
  ];
  const runScrollToSection = useCallback((tab, sectionId) => {
    const dataAttr =
      sectionId === "__all_complete__"
        ? "health-status"
        : tab === "identity"
          ? sectionId
          : tab === "systems"
            ? `system-${sectionId}`
            : tab === "maintenance"
              ? "maintenance"
              : null;
    if (!dataAttr) return;

    const scrollAndHighlight = () => {
      const el = document.querySelector(`[data-section-id="${dataAttr}"]`);
      if (!el) return;
      el.scrollIntoView({behavior: "smooth", block: "start"});
      el.classList.add(...INCOMPLETE_SECTION_GLOW);
      const focusable = el.querySelector(
        "input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      const focusDelay = tab === "systems" ? 350 : 400;
      if (focusable) {
        setTimeout(() => focusable.focus({preventScroll: true}), focusDelay);
      }
      setTimeout(() => el.classList.remove(...INCOMPLETE_SECTION_GLOW), 1500);
    };

    const delay = sectionId === "__all_complete__" ? 50 : 200;
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollAndHighlight);
      });
    }, delay);
  }, []);

  /** Find first incomplete section and navigate to it when "Complete Outstanding Tasks" is clicked. */
  const handleCompleteOutstandingTasks = useCallback(() => {
    try {
      const data = mergedFormData ?? {};
      const visibleSystemIds =
        (data.selectedSystemIds?.length ?? 0) > 0
          ? data.selectedSystemIds
          : DEFAULT_SYSTEM_IDS;
      const customSystemNames = data.customSystemNames ?? [];
      const systemItems = [
        ...PROPERTY_SYSTEMS.filter((s) => visibleSystemIds.includes(s.id)),
        ...customSystemNames.map((name, index) => ({
          id: `custom-${name}-${index}`,
          name,
        })),
      ];
      const currentMaintenance =
        data.healthMetrics?.maintenanceCompleted?.current ?? 0;

      // 1. First incomplete identity section
      const firstIncompleteIdentity = IDENTITY_SECTIONS.find(
        (s) => !isSectionComplete(data, s),
      );
      if (firstIncompleteIdentity) {
        dispatch({type: "SET_ACTIVE_TAB", payload: "identity"});
        // IdentityTab listens for identity section ids to switch into edit mode
        setExpandSectionId(firstIncompleteIdentity.id);
        runScrollToSection("identity", firstIncompleteIdentity.id);
        return;
      }

      // 2. First incomplete system
      for (const item of systemItems) {
        const isComplete = item.id?.startsWith("custom-")
          ? isCustomSystemComplete(data.customSystemsData ?? {}, item.name)
          : isSystemComplete(data, item.id);
        if (!isComplete) {
          dispatch({type: "SET_ACTIVE_TAB", payload: "systems"});
          setExpandSectionId(item.id);
          runScrollToSection("systems", item.id);
          return;
        }
      }

      // 3. First incomplete maintenance
      if (currentMaintenance < systemItems.length) {
        dispatch({type: "SET_ACTIVE_TAB", payload: "maintenance"});
        setExpandSectionId(null);
        runScrollToSection("maintenance", "maintenance");
        return;
      }

      // All sections complete — the completion card lives on the Overview tab
      dispatch({type: "SET_ACTIVE_TAB", payload: "overview"});
      setExpandSectionId(null);
      runScrollToSection("overview", "__all_complete__");
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: "All outstanding tasks are complete!",
        },
      });
    } catch (err) {
      console.error("Complete Outstanding Tasks error:", err);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: "Something went wrong. Please try again.",
        },
      });
    }
  }, [mergedFormData, runScrollToSection]);

  async function handleUpdate(event) {
    event.preventDefault();
    const identity = state.formData.identity ?? {};
    const missing = REQUIRED_IDENTITY_FIELDS.filter(({key}) => {
      const v = identity[key];
      return v == null || (typeof v === "string" && !v.trim());
    });
    if (missing.length > 0) {
      pendingAttomPullAfterSaveRef.current = false;
      const newErrors = {};
      missing.forEach(({key, label}) => {
        newErrors[key] = `${label} is required`;
      });
      dispatch({type: "SET_VALIDATION_FAILED", payload: {errors: newErrors}});
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: `Please fill in the required fields: ${missing
            .map(({label}) => label)
            .join(", ")}.`,
        },
      });
      return;
    }
    dispatch({type: "SET_ERRORS", payload: {}});
    dispatch({type: "SET_SUBMITTING", payload: true});
    const t0 = performance.now();
    const prevAddressFingerprint = getAddressFingerprint(
      savedMergedPropertyData,
    );
    const nextIdentity = state.formData.identity ?? {};
    const nextAddressFingerprint = getAddressFingerprint(nextIdentity);
    const addressChangedForAttom =
      prevAddressFingerprint !== nextAddressFingerprint &&
      hasCompleteAddressForAttom(nextIdentity);
    try {
      const propertyId = state.property?.identity?.id ?? state.property?.id;
      const merged = mergeFormDataFromTabs(state.formData);
      const identityPayload = prepareIdentityForUpdate(
        state.formData.identity ?? {},
      );
      identityPayload.hps_score = computeHpsScore(merged);
      const t1 = performance.now();
      const res = await updateProperty(propertyId, identityPayload);
      if (process.env.NODE_ENV === "development") {
        console.debug(
          "[perf] updateProperty",
          (performance.now() - t1).toFixed(0),
          "ms |",
          "payload:",
          (JSON.stringify(identityPayload).length / 1024).toFixed(1),
          "KB",
        );
      }
      if (res) {
        /* --- Validate maintenance dates before starting parallel work --- */
        const currentRecords = state.formData.maintenanceRecords ?? [];
        const recordsWithoutDate = currentRecords.filter(
          (r) => !(r.date != null && String(r.date).trim()),
        );
        if (recordsWithoutDate.length > 0) {
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "error",
              message: `Please add a date to all maintenance records before saving. ${recordsWithoutDate.length} record(s) are missing a date.`,
            },
          });
          dispatch({type: "SET_SUBMITTING", payload: false});
          return;
        }

        /* --- Prepare all payloads synchronously --- */
        const preparedTeam = prepareTeamForProperty(homeopsTeam);
        const teamUnchanged =
          originalTeamRef.current &&
          teamsAreEqual(preparedTeam, originalTeamRef.current);

        const systemsArray = formSystemsToArray(
          mergeFormDataFromTabs(state.formData) ?? {},
          res.id,
          state.systems ?? [],
        );

        const syncPlan = computeMaintenanceSyncPlan(
          currentRecords,
          originalMaintenanceRecordIdsRef.current,
          res.id,
        );

        /* --- Fan out independent save operations in parallel --- */
        if (process.env.NODE_ENV === "development") {
          console.debug(
            "[perf] save plan:",
            "team:",
            teamUnchanged ? "skip" : "update",
            "| systems:",
            state.systemsDirty ? systemsArray.length : "skip (clean)",
            "| maintenance: del",
            syncPlan.toDelete.length,
            "create",
            syncPlan.toCreate.length,
            "update",
            syncPlan.toUpdate.length,
          );
        }
        const tParallel = performance.now();

        const teamPromise = teamUnchanged
          ? Promise.resolve(null)
          : (async () => {
              await updateTeam(res.id, preparedTeam);
              return getPropertyTeam(uid);
            })();

        const systemsPromise = state.systemsDirty
          ? updateSystemsForProperty(res.id, systemsArray)
          : Promise.resolve(null);

        const maintenancePromise = (async () => {
          let created = [];
          let updated = [];
          if (syncPlan.toDelete.length > 0) {
            await Promise.all(
              syncPlan.toDelete.map((id) =>
                deleteMaintenanceRecord(id, res.id),
              ),
            );
          }
          if (syncPlan.toCreate.length > 0) {
            created =
              (await createMaintenanceRecords(res.id, syncPlan.toCreate)) ?? [];
          }
          if (syncPlan.toUpdate.length > 0) {
            updated = await Promise.all(
              syncPlan.toUpdate.map(({id, payload}) =>
                updateMaintenanceRecord(id, payload),
              ),
            );
          }
          return {created, updated};
        })();

        const [teamResult, systemsResult, maintenanceSyncResult] =
          await Promise.all([teamPromise, systemsPromise, maintenancePromise]);

        if (process.env.NODE_ENV === "development") {
          console.debug(
            "[perf] parallel phase (team+systems+maintenance)",
            (performance.now() - tParallel).toFixed(0),
            "ms",
          );
        }

        /* --- Handle team side effects (redirect if user removed themselves) --- */
        if (teamResult) {
          const propertyUsers = teamResult?.property_users ?? [];
          const isSuperAdmin =
            (currentUser?.role ?? "").toLowerCase() === "super_admin";
          if (!isSuperAdmin) {
            const currentUserId = currentUser?.id;
            const stillOnTeam =
              currentUserId == null
                ? true
                : propertyUsers.some(
                    (m) =>
                      m && String(m.id ?? m.user_id) === String(currentUserId),
                  );
            if (!stillOnTeam) {
              dispatch({type: "SET_SUBMITTING", payload: false});
              navigate(`/${accountUrl}/properties`);
              return;
            }
          }
          const enriched = propertyUsers.map((m) => {
            const u = users?.find(
              (us) => us && m?.id != null && Number(us.id) === Number(m.id),
            );
            return {
              ...m,
              role: m.role,
              property_role: m.property_role ?? "editor",
              image_url:
                m.image_url ?? m.avatar_url ?? u?.image_url ?? u?.avatarUrl,
              image:
                m.image ??
                u?.image ??
                u?.avatarUrl ??
                u?.avatar_url ??
                u?.avatar,
            };
          });
          setHomeopsTeam(enriched);
          originalTeamRef.current = prepareTeamForProperty(enriched);
        }

        /* --- Derive maintenance records from sync results (no refetch needed) --- */
        const allBackendRecords = [
          ...(maintenanceSyncResult?.created ?? []),
          ...(maintenanceSyncResult?.updated ?? []),
        ];
        if (process.env.NODE_ENV === "development") {
          console.debug(
            "[perf] handleUpdate total",
            (performance.now() - t0).toFixed(0),
            "ms |",
            "API calls: ~" +
              (1 +
                (teamUnchanged ? 0 : 2) +
                (state.systemsDirty ? 1 : 0) +
                syncPlan.toDelete.length +
                (syncPlan.toCreate.length ? 1 : 0) +
                syncPlan.toUpdate.length),
          );
        }

        const maintenanceRecords =
          mapMaintenanceRecordsFromBackend(allBackendRecords);
        setMaintenanceRecords(maintenanceRecords);
        originalMaintenanceRecordIdsRef.current = new Set(
          maintenanceRecords
            .filter((r) => !isNewMaintenanceRecord(r))
            .map((r) => r.id),
        );
        const systemsFromBackend = systemsResult
          ? (systemsResult.systems ?? systemsResult ?? [])
          : (state.systems ?? []);

        const scrollEl = document.querySelector(".flex-1.overflow-y-auto");
        const scrollPos = scrollEl?.scrollTop ?? window.scrollY ?? 0;

        dispatch({
          type: "SAVE_COMPLETED",
          payload: {
            propertyPayload: {
              ...buildPropertyPayloadFromRefresh(
                res,
                systemsFromBackend ?? [],
                res,
              ),
              maintenanceRecords: maintenanceRecords ?? [],
            },
            systems: systemsFromBackend ?? [],
            banner: {
              open: true,
              type: "success",
              message: t("propertyUpdatedSuccessfullyMessage"),
            },
            aiSummaryUpdatedAt: systemsResult?.aiSummaryUpdatedAt ?? undefined,
          },
        });

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector(".flex-1.overflow-y-auto");
            if (el) el.scrollTop = scrollPos;
            else if (scrollPos) window.scrollTo(0, scrollPos);
          });
        });

        const shouldPullAttom =
          (addressChangedForAttom || pendingAttomPullAfterSaveRef.current) &&
          !attomRefresh.isActive &&
          !attomRefresh.isAtLookupLimit;
        pendingAttomPullAfterSaveRef.current = false;
        if (shouldPullAttom) {
          void attomRefresh.startRefresh({silent: true});
        }
      } else {
        pendingAttomPullAfterSaveRef.current = false;
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "error",
            message: t("propertyUpdateErrorMessage"),
          },
        });
      }
    } catch (err) {
      pendingAttomPullAfterSaveRef.current = false;
      console.error("Error updating property:", err);
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message:
            t("propertyUpdateErrorMessage") +
            (err?.message ? ` ${err.message}` : ""),
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  const handleSaveAndPullAttom = async () => {
    pendingAttomPullAfterSaveRef.current = true;
    attomRefresh.closeConfirm();
    await handleUpdate({preventDefault() {}});
  };

  // Build prev/next nav state; URL param is property_uid. We still track by id internally.
  useAutoCloseBanner(state.bannerOpen, state.bannerMessage, () =>
    dispatch({
      type: "SET_BANNER",
      payload: {
        open: false,
        type: state.bannerType,
        message: state.bannerMessage,
      },
    }),
  );

  const buildNavigationState = (propertyUid, preferredVisiblePropertyIds) => {
    const normalizedUid = String(propertyUid);
    const preferredIds = Array.isArray(preferredVisiblePropertyIds)
      ? preferredVisiblePropertyIds.filter((id) => id != null)
      : [];

    const knownPropertyIds = new Set(
      properties.map((p) => String(p.property_uid ?? p.id)),
    );

    // Drop deleted/stale ids, dedupe, and keep the current property (handles createProperty +
    // navigate appending the same uid twice, and router state left over after delete).
    const sanitizePreferredIds = (ids) => {
      const seen = new Set();
      const out = [];
      for (const id of ids) {
        const s = String(id);
        if (seen.has(s)) continue;
        if (!knownPropertyIds.has(s) && s !== normalizedUid) continue;
        seen.add(s);
        out.push(id);
      }
      return out;
    };

    if (preferredIds.length > 0) {
      const sanitized = sanitizePreferredIds(preferredIds);
      const scopedIndex = sanitized.findIndex(
        (id) => String(id) === normalizedUid,
      );
      if (scopedIndex !== -1) {
        return {
          currentIndex: scopedIndex + 1,
          totalItems: sanitized.length,
          visiblePropertyIds: sanitized,
        };
      }
    }

    // Fallback: sort by passport_id ascending to match PropertiesList default order.
    const sortedProperties = [...properties].sort((a, b) =>
      (a.passport_id || "").localeCompare(b.passport_id || ""),
    );
    const visiblePropertyIds = sortedProperties.map(
      (p) => p.property_uid ?? p.id,
    );
    const propertyIndex = visiblePropertyIds.findIndex(
      (id) => String(id) === normalizedUid,
    );
    if (propertyIndex === -1) return null;
    return {
      currentIndex: propertyIndex + 1,
      totalItems: visiblePropertyIds.length,
      visiblePropertyIds,
    };
  };

  // Card shows saved property data only; updates after load or save, not while typing
  const cardData = state.property
    ? mergeFormDataFromTabs(state.property)
    : mergedFormData;

  // Hero background image (same source as ImageUploadField)
  const heroImageUrl =
    mainPhotoPreviewUrl ||
    (state.formData.identity?.mainPhoto !== ""
      ? cardData.mainPhotoUrl
      : null) ||
    (state.formData.identity?.mainPhoto !== ""
      ? cardData.mainPhoto?.startsWith?.("blob:")
        ? cardData.mainPhoto
        : null
      : null) ||
    (mainPhotoPresignedKey === mainPhotoKey ? mainPhotoPresignedUrl : null) ||
    mainPhotoUploadedUrl ||
    null;

  // Systems to show in Systems tab: only those with included=true (from modal selection)
  const visibleSystemIds = state.formData.systems?.selectedSystemIds ?? [];

  const propertyOverviewDashboard = (readOnly = false) => (
    <PropertyOverviewDashboard
      readOnly={readOnly}
      propertyData={mergedFormData}
      maintenanceRecords={state.formData.maintenanceRecords ?? []}
      maintenanceEvents={maintenanceEvents}
      propertyDocuments={overviewDocuments}
      photosCount={(state.formData.identity?.photos ?? []).length}
      inspectionAnalysis={inspectionAnalysis}
      onNavigateTab={
        readOnly
          ? undefined
          : (tabId) => dispatch({type: "SET_ACTIVE_TAB", payload: tabId})
      }
      onCompleteOutstandingTasks={
        readOnly ? undefined : handleCompleteOutstandingTasks
      }
      onOpenInspectionAnalysis={
        readOnly ? undefined : openInspectionAnalysisWithPlanCheck
      }
      onUploadInspectionReport={
        readOnly
          ? undefined
          : () => {
              dispatch({type: "SET_ACTIVE_TAB", payload: "documents"});
              setDocumentsUploadModalRequested(true);
            }
      }
      notes={propertyNotes}
      notesLoading={propertyNotesLoading}
      notesSaving={propertyNotesSaving}
      currentUserId={currentUser?.id}
      onAddNote={readOnly ? undefined : handleAddPropertyNote}
      onUpdateNote={readOnly ? undefined : handleUpdatePropertyNote}
      onDeleteNote={readOnly ? undefined : handleDeletePropertyNote}
      scoreCardSlot={
        <ScoreCard
          variant="overview"
          propertyData={mergedFormData}
          propertyDetailsLoading={propertyDetailsLoading}
          onCompleteOutstandingTasks={
            readOnly ? undefined : handleCompleteOutstandingTasks
          }
          propertyId={
            uid !== "new"
              ? (state.property?.identity?.id ?? state.property?.id ?? uid)
              : null
          }
          maintenanceRecords={state.formData.maintenanceRecords ?? []}
        />
      }
      teamSlot={
        <HomeOpsTeam
          compact
          teamMembers={homeopsTeam}
          isLoadingTeam={uid !== "new" && !hasResolvedTeamForCta}
          hideAddButton={readOnly}
          onOpenShareModal={
            readOnly
              ? undefined
              : () => {
                  setShareModalInitialTab("owner");
                  setShareModalOpen(true);
                }
          }
          onMemberClick={
            readOnly
              ? undefined
              : (tab) => {
                  setShareModalInitialTab(tab);
                  setShareModalOpen(true);
                }
          }
        />
      }
    />
  );

  const handleOpenSystemsSetup = useCallback((suggested = []) => {
    if (Array.isArray(suggested) && suggested.length > 0) {
      setExternalSuggestedSystems(suggested);
    }
    setSystemsSetupOnlyStep("systems");
    setSystemsSetupInitialStep("systems");
    setSystemsSetupModalOpen(true);
  }, []);

  const systemsToShowForAnalysis = useMemo(() => {
    const customNames = state.formData.systems?.customSystemNames ?? [];
    const selected = PROPERTY_SYSTEMS.filter((s) =>
      visibleSystemIds.includes(s.id),
    ).map((s) => ({id: s.id, label: s.name}));
    const custom = buildCustomSystemsForUi(
      customNames,
      state.systems ?? [],
    ).map(({id, label}) => ({id, label}));
    return [
      {id: "inspectionReport", label: "Inspection Report"},
      ...selected,
      ...custom,
    ];
  }, [
    visibleSystemIds,
    state.formData.systems?.customSystemNames,
    state.systems,
  ]);

  // Array of systems for use when updating systems on the backend (camelCase, backend-ready)
  const propertyId = state.property?.identity?.id ?? state.property?.id;
  const systemsArray = formSystemsToArray(
    mergedFormData ?? {},
    propertyId ?? 0,
    state.systems ?? [],
  );
  /* console.log("systemsArray: ", systemsArray);
  console.log("state.formData: ", state.formData);
  console.log("maintenanceRecords: ", state.formData.maintenanceRecords); */

  // While loading an existing property, don't show empty form; show loading until we get data or a 403/404.
  // Never show loading during save so the form doesn't briefly disappear.
  const loadingExisting =
    uid !== "new" &&
    state.property == null &&
    !state.propertyNotFound &&
    !state.propertyAccessDenied &&
    !state.isSubmitting;
  if (loadingExisting) {
    return (
      <div className="mx-0 sm:mx-4 sm:px-4 lg:px-8 pt-6 pb-2 flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading property…</span>
        </div>
      </div>
    );
  }

  if (uid === "new" && newPropertyCheckingLimits) {
    return (
      <div className="mx-0 sm:mx-4 sm:px-4 lg:px-8 pt-6 pb-2 flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Setting up new property…</span>
        </div>
      </div>
    );
  }

  if (state.propertyNotFound && uid !== "new") {
    return (
      <div className="mx-0 sm:mx-4 sm:px-4 lg:px-8 pt-6 pb-2">
        <PropertyNotFound />
      </div>
    );
  }

  if (state.propertyAccessDenied && uid !== "new") {
    return (
      <div className="mx-0 sm:mx-4 sm:px-4 lg:px-8 pt-6 pb-2">
        <PropertyUnauthorized />
      </div>
    );
  }

  return (
    <div className="mx-0 sm:mx-4 sm:px-4 lg:px-8 pt-6 pb-2">
      <SharePropertyModal
        modalOpen={shareModalOpen}
        setModalOpen={setShareModalOpen}
        initialTab={shareModalInitialTab}
        propertyAddress={
          [
            state.formData.identity?.address,
            state.formData.identity?.city,
            state.formData.identity?.state,
            state.formData.identity?.zip,
          ]
            .filter(Boolean)
            .join(", ") ||
          state.formData.identity?.fullAddress ||
          ""
        }
        contacts={contacts ?? []}
        users={users ?? []}
        teamMembers={homeopsTeam}
        currentUser={currentUser}
        currentAccount={currentAccount}
        accountIdForProperty={
          savedMergedPropertyData?.accountId ?? currentAccount?.id ?? null
        }
        propertyId={
          uid !== "new"
            ? (state.property?.identity?.id ?? state.property?.id ?? uid)
            : null
        }
        systems={state.formData.systems}
        limits={limits ?? {}}
        onUpdateAgentPermissions={(memberId, permissions) => {
          const next = homeopsTeam.map((m) =>
            String(m.id) === String(memberId)
              ? {...m, permissions: permissions ?? {}}
              : m,
          );
          handleTeamChange(next);
        }}
        onRefreshTeam={reloadHomeopsTeam}
        onTransferOwnership={async (newOwnerIdStr) => {
          const propertyKey =
            uid !== "new"
              ? (state.property?.identity?.id ?? state.property?.id ?? uid)
              : null;
          if (!propertyKey) {
            throw new Error("Save the property before transferring ownership.");
          }
          const toUserId = parseInt(String(newOwnerIdStr), 10);
          if (!Number.isFinite(toUserId)) {
            throw new Error("Invalid team member selected.");
          }
          await AppApi.requestPropertyOwnershipTransfer(propertyKey, toUserId);
          window.dispatchEvent(new CustomEvent("opsy:notifications-refresh"));
        }}
        onInvite={async ({
          email: inviteEmail,
          name: inviteDisplayName,
          role,
          homeownerInviteType,
          permissions,
          skipInviteEmail,
          invitationEmailNote,
          invitationEmailMainPlain,
          invitationEmailCc,
        }) => {
          const propertyId =
            uid !== "new"
              ? (state.property?.identity?.id ?? state.property?.id ?? uid)
              : null;
          const intendedRole =
            role === "agent"
              ? "editor"
              : homeownerInviteType === "view_only"
                ? "viewer"
                : "editor";
          /* Persist the invitation category (which tab the invitee will
             appear under) so refreshing the page doesn't lose the "this was
             an agent invite" intent — intended_role only carries the access
             level, not the category. */
          const intendedPropertyRole = [
            "agent",
            "homeowner",
            "insurance",
            "mortgage",
          ].includes(role)
            ? role
            : undefined;
          const displayRoleMap = {
            agent: "Agent",
            homeowner: "Homeowner",
            insurance: "Insurer",
            mortgage: "Mortgage Partner",
          };
          const displayRole = displayRoleMap[role] ?? "Homeowner";
          const nameForDisplay =
            (inviteDisplayName || "").trim() ||
            (inviteEmail || "").split("@")[0] ||
            inviteEmail;
          const pendingMember = {
            email: inviteEmail,
            name: nameForDisplay,
            role: displayRole,
            property_role: intendedRole,
            permissions: permissions ?? {},
            _pending: true,
            _sendInviteEmail: skipInviteEmail !== true,
            ...(intendedPropertyRole ? {intendedPropertyRole} : {}),
          };
          const inviteAccountId =
            savedMergedPropertyData?.accountId ?? currentAccount?.id;
          if (
            propertyId &&
            inviteAccountId &&
            typeof AppApi.createInvitation === "function"
          ) {
            /* Persist per-section access restrictions on the invitation row
               so refreshing the page (or the invitee accepting later) doesn't
               drop the inviter's choices back to defaults. */
            const permissionsForApi =
              permissions && Object.keys(permissions).length > 0
                ? permissions
                : undefined;
            try {
              const res = await AppApi.createInvitation({
                type: "property",
                inviteeEmail: inviteEmail,
                inviteeName: (inviteDisplayName || "").trim() || undefined,
                accountId: inviteAccountId,
                propertyId,
                intendedRole,
                ...(intendedPropertyRole ? {intendedPropertyRole} : {}),
                ...(permissionsForApi ? {permissions: permissionsForApi} : {}),
                skipInviteEmail: skipInviteEmail === true,
                ...(invitationEmailNote ? {invitationEmailNote} : {}),
                ...(invitationEmailMainPlain ? {invitationEmailMainPlain} : {}),
                ...(invitationEmailCc?.length ? {invitationEmailCc} : {}),
              });
              invalidatePropertyTeamCache(uid, propertyId);
              if (res?.invitation?.id) {
                pendingMember.invitationId = res.invitation.id;
              }
              /* Invitation is already persisted — only refresh local list; do not mark property form dirty. */
              setHomeopsTeam((prev) => [...prev, pendingMember]);
              window.dispatchEvent(
                new CustomEvent("opsy:property-team-changed", {
                  detail: {propertyUid: uid, propertyId},
                }),
              );
              return res;
            } catch (err) {
              const msg = String(err?.message ?? "").toLowerCase();
              if (
                msg.includes("already been sent") ||
                msg.includes("already on the property team")
              ) {
                invalidatePropertyTeamCache(uid, propertyId);
                await reloadHomeopsTeam();
              }
              throw err;
            }
          } else {
            handleTeamChange([...homeopsTeam, pendingMember]);
            return null;
          }
        }}
        onRemoveMember={async (member) => {
          const propertyId =
            uid !== "new"
              ? (state.property?.identity?.id ?? state.property?.id ?? uid)
              : null;
          if (member._pending && member.invitationId) {
            await AppApi.revokeInvitation(member.invitationId);
            invalidatePropertyTeamCache(uid, propertyId);
            setHomeopsTeam((prev) =>
              prev.filter((m) =>
                m._pending
                  ? m.invitationId !== member.invitationId
                  : String(m.id) !== String(member.id),
              ),
            );
            window.dispatchEvent(
              new CustomEvent("opsy:property-team-changed", {
                detail: {propertyUid: uid, propertyId},
              }),
            );
          } else if (propertyId && member.id) {
            const newTeam = homeopsTeam.filter(
              (m) => String(m.id) !== String(member.id),
            );
            await updateTeam(propertyId, prepareTeamForProperty(newTeam));
            invalidatePropertyTeamCache(uid, propertyId);
            await reloadHomeopsTeam();
            window.dispatchEvent(
              new CustomEvent("opsy:property-team-changed", {
                detail: {propertyUid: uid, propertyId},
              }),
            );
          }
        }}
      />
      <SystemsSetupModal
        modalOpen={systemsSetupModalOpen}
        setModalOpen={(open) => {
          if (!open) {
            setSystemsSetupInitialStep(null);
            setSystemsSetupOnlyStep(null);
            setExternalSuggestedSystems([]);
          }
          setSystemsSetupModalOpen(open);
        }}
        initialStep={systemsSetupInitialStep}
        onlyStep={systemsSetupOnlyStep}
        externalSuggestedSystems={externalSuggestedSystems}
        propertyId={
          createdPropertyFromModal?.id ??
          (uid !== "new"
            ? (state.property?.identity?.id ?? state.property?.id ?? uid)
            : null)
        }
        selectedSystemIds={state.formData.systems?.selectedSystemIds ?? []}
        customSystems={state.formData.systems?.customSystemNames ?? []}
        isNewProperty={uid === "new"}
        skipIdentityStep={uid !== "new"}
        formData={mergedFormData}
        onIdentityFieldsChange={(fields) => {
          const payload = {};
          for (const [key, value] of Object.entries(fields)) {
            if (value !== undefined) payload[key] = value;
          }
          dispatch({
            type: "SET_IDENTITY_FORM_DATA",
            payload,
          });
        }}
        onSaveProperty={async (identityPayload) => {
          const identity = identityPayload ?? {};
          const missing = REQUIRED_IDENTITY_FIELDS.filter(({key}) => {
            const v = identity[key];
            return v == null || (typeof v === "string" && !v.trim());
          });
          if (missing.length > 0) {
            throw new Error(
              `Please fill in: ${missing.map(({label}) => label).join(", ")}`,
            );
          }
          dispatch({type: "SET_IDENTITY_FORM_DATA", payload: identity});
          const merged = mergeFormDataFromTabs({
            ...state.formData,
            identity: {...state.formData.identity, ...identity},
          });
          merged.hpsScore = computeHpsScore(merged);
          const propertyData = preparePropertyValues(merged);
          propertyData.account_id = currentAccount?.id;
          const res = await createProperty(propertyData);
          if (!res) throw new Error("Failed to create property");
          const propertyId = res.id;
          const teamWithoutCreator = homeopsTeam.filter(
            (m) =>
              m && m.id != null && String(m.id) !== String(currentUser?.id),
          );
          if (teamWithoutCreator.length > 0) {
            await addUsersToProperty(
              propertyId,
              prepareTeamForProperty(teamWithoutCreator),
            );
          }
          await persistPendingTeamInvitations(propertyId, homeopsTeam);
          setCreatedPropertyFromModal({
            id: propertyId,
            property_uid: res.property_uid ?? res.id,
          });
          dispatch({
            type: "SET_BANNER",
            payload: {
              open: true,
              type: "success",
              message: t("propertyCreatedSuccessfullyMessage"),
            },
          });
        }}
        onScheduleMaintenance={(prefill) => {
          setScheduleFromAiPrefill(prefill);
          setScheduleFromAiModalOpen(true);
        }}
        onSave={async ({selectedIds, customNames}) => {
          const names = customNames ?? [];
          const prevData = state.formData.systems?.customSystemsData ?? {};
          const nextData = {};
          names.forEach((name) => {
            nextData[name] =
              prevData[name] ??
              Object.fromEntries(
                STANDARD_CUSTOM_SYSTEM_FIELDS.map((f) => [f.key, ""]),
              );
          });
          const predefinedOnly = (selectedIds ?? []).filter(
            (id) => !String(id).startsWith("custom-"),
          );
          const nextSystemsFormData = {
            selectedSystemIds: predefinedOnly,
            customSystemNames: names,
            customSystemsData: nextData,
          };
          let persistedImmediately = false;

          if (createdPropertyFromModal?.id) {
            const systemsPayloads = prepareSystemsForApi(
              {
                selectedSystemIds: predefinedOnly,
                customSystemNames: names,
                customSystemsData: nextData,
              },
              createdPropertyFromModal.id,
            );
            await createSystemsForProperty(
              createdPropertyFromModal.id,
              systemsPayloads,
            );
            persistedImmediately = true;
            const newUid = createdPropertyFromModal.property_uid;
            setCreatedPropertyFromModal(null);
            navigate(`/${accountUrl}/properties/${newUid}`, {
              replace: true,
              state: buildPropertyFormNavStateFromProperties(
                properties,
                newUid,
              ),
            });
          } else if (uid !== "new") {
            const rawId =
              state.property?.identity?.id ?? state.property?.id ?? uid;
            let numericId = null;
            if (typeof rawId === "number") numericId = rawId;
            else if (typeof rawId === "string" && /^\d+$/.test(rawId))
              numericId = parseInt(rawId, 10);
            else if (rawId) {
              try {
                const prop = await getPropertyById(rawId);
                numericId = prop?.id ?? prop?.identity?.id ?? null;
              } catch {
                numericId = null;
              }
            }
            if (numericId) {
              const merged = mergeFormDataFromTabs({
                ...state.formData,
                systems: {
                  ...state.formData.systems,
                  selectedSystemIds: predefinedOnly,
                  customSystemNames: names,
                  customSystemsData: nextData,
                },
              });
              const systemsArray = formSystemsToArray(
                merged,
                numericId,
                state.systems ?? [],
              );
              const systemsRes = await updateSystemsForProperty(
                numericId,
                systemsArray,
              );
              const systemsFromBackend =
                systemsRes?.systems ?? systemsRes ?? [];
              dispatch({type: "SET_SYSTEMS", payload: systemsFromBackend});
              if (systemsRes?.aiSummaryUpdatedAt) {
                dispatch({
                  type: "SET_AI_SUMMARY_UPDATED_AT",
                  payload: systemsRes.aiSummaryUpdatedAt,
                });
              }
              persistedImmediately = true;
              dispatch({
                type: "SET_BANNER",
                payload: {
                  open: true,
                  type: "success",
                  message: t("propertyUpdatedSuccessfullyMessage"),
                },
              });
            }
          }

          dispatch({
            type: persistedImmediately
              ? "SET_SYSTEMS_FORM_DATA_SILENT"
              : "SET_SYSTEMS_FORM_DATA",
            payload: nextSystemsFormData,
          });
          if (!persistedImmediately) {
            dispatch({type: "SET_FORM_CHANGED", payload: true});
          }
        }}
      />
      <ScheduleSystemModal
        isOpen={scheduleFromAiModalOpen}
        onClose={(closed) => {
          setScheduleFromAiModalOpen(false);
          setScheduleFromAiPrefill(null);
        }}
        systemLabel={scheduleFromAiPrefill?.systemLabel ?? "Maintenance"}
        systemType={scheduleFromAiPrefill?.systemType ?? "general"}
        contacts={contacts ?? []}
        onScheduleSuccess={fetchMaintenanceEvents}
        propertyId={
          uid !== "new"
            ? (state.property?.identity?.id ?? state.property?.id ?? uid)
            : null
        }
        propertyData={state.property ?? {}}
        checklistItemId={scheduleFromAiPrefill?.checklistItemId ?? null}
      />
      <div className="fixed top-18 right-0 w-auto sm:w-full z-50">
        <Banner
          type={state.bannerType}
          open={state.bannerOpen}
          setOpen={(open) => {
            if (!open) setMainPhotoUploadError(null);
            dispatch({
              type: "SET_BANNER",
              payload: {
                open,
                type: state.bannerType,
                message: state.bannerMessage,
              },
            });
          }}
          className="transition-opacity duration-300"
        >
          {state.bannerMessage}
        </Banner>
      </div>

      {/* Navigation and Actions */}
      <div className="flex justify-between items-center gap-3 mb-3">
        <button
          className="btn text-neutral-500 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100 mb-2 pl-0 focus:outline-none shadow-none"
          onClick={handleBackToProperties}
        >
          <svg
            className="fill-current shrink-0 mr-1"
            width="18"
            height="18"
            viewBox="0 0 18 18"
          >
            <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z"></path>
          </svg>
          <span className="text-lg">Properties</span>
        </button>
        {!isInvitationView && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative inline-flex">
              <button
                ref={actionsTriggerRef}
                type="button"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-500 dark:text-neutral-400 transition-colors"
                aria-haspopup="true"
                aria-expanded={actionsDropdownOpen}
                onClick={() => setActionsDropdownOpen(!actionsDropdownOpen)}
              >
                <span className="sr-only">Actions</span>
                <Settings className="w-4 h-4" />
              </button>
              <Transition
                show={actionsDropdownOpen}
                tag="div"
                className="origin-top-right z-10 absolute top-full left-0 right-auto min-w-56 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/50 pt-1.5 rounded-xl overflow-hidden mt-1 md:left-auto md:right-0"
                style={{
                  boxShadow:
                    "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                }}
                enter="transition ease-out duration-200 transform"
                enterStart="opacity-0 -translate-y-2"
                enterEnd="opacity-100 translate-y-0"
                leave="transition ease-out duration-200"
                leaveStart="opacity-100"
                leaveEnd="opacity-0"
              >
                <div ref={actionsDropdownRef}>
                  <div className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider pt-1.5 pb-2 px-3">
                    {t("actions")}
                  </div>
                  <ul className="mb-1">
                    <li>
                      <button
                        type="button"
                        className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionsDropdownOpen(false);
                          setSystemsSetupOnlyStep("systems");
                          setSystemsSetupInitialStep("systems");
                          setSystemsSetupModalOpen(true);
                        }}
                      >
                        <Settings className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                        <span className="text-sm font-medium ml-2">
                          {t("configure") || "Configure"}
                        </span>
                      </button>
                    </li>
                    {uid !== "new" && (
                      <li>
                        <button
                          type="button"
                          disabled={
                            attomRefresh.isActive ||
                            attomRefresh.isAtLookupLimit
                          }
                          className="w-full flex items-center justify-start text-left cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-70"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionsDropdownOpen(false);
                            attomRefresh.openConfirm();
                          }}
                        >
                          {attomRefresh.isActive ? (
                            <Loader2 className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400 animate-spin" />
                          ) : attomRefresh.jobStatus === "completed" &&
                            !attomRefresh.jobError ? (
                            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
                          ) : (
                            <RefreshCw className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                          )}
                          <span className="text-sm font-medium ml-2 min-w-0 text-left">
                            {attomRefresh.isAtLookupLimit
                              ? `Lookup limit reached (${attomRefresh.lookupCount}/${attomRefresh.lookupLimit})`
                              : attomRefresh.jobStatus === "queued"
                                ? "Queued…"
                                : attomRefresh.jobStatus === "processing"
                                  ? "Pulling property data…"
                                  : attomRefresh.lookupLimit == null
                                    ? "Pull property data"
                                    : `Pull property data (${attomRefresh.lookupCount}/${attomRefresh.lookupLimit})`}
                          </span>
                        </button>
                      </li>
                    )}
                    {identityDataSource === "rentcast" && (
                      <li>
                        <button
                          type="button"
                          className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionsDropdownOpen(false);
                            const base = `/${accountUrl}/settings/support/data-adjustment`;
                            const params = new URLSearchParams();
                            const pid =
                              state.property?.identity?.id ??
                              state.property?.id ??
                              uid;
                            if (pid) params.set("propertyId", String(pid));
                            navigate(
                              params.toString()
                                ? `${base}?${params.toString()}`
                                : base,
                            );
                          }}
                        >
                          <Lock className="w-5 h-5 shrink-0 text-amber-500 dark:text-amber-400" />
                          <span className="text-sm font-medium ml-2">
                            Request Data Adjustment
                          </span>
                        </button>
                      </li>
                    )}
                    {!inspectionAnalysis && (
                      <li>
                        <button
                          type="button"
                          className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionsDropdownOpen(false);
                            if (!canUseAiFeatures) {
                              setUpgradePromptTitle(
                                "Inspection Analysis not included",
                              );
                              setUpgradePromptMsg(
                                "Your plan doesn't support AI inspection report analysis. Upgrade to analyze inspection reports with AI.",
                              );
                              setUpgradePromptOpen(true);
                            } else {
                              setSystemsSetupOnlyStep("inspection");
                              setSystemsSetupInitialStep("inspection");
                              setSystemsSetupModalOpen(true);
                            }
                          }}
                        >
                          <FileBarChart className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                          <span className="text-sm font-medium ml-2">
                            Analyze report
                          </span>
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              </Transition>
            </div>
            <button
              className="btn btn-primary transition-colors duration-200 shadow-sm disabled:opacity-70 inline-flex items-center gap-1.5 h-9 px-3.5 text-sm font-medium"
              onClick={handleNewProperty}
              disabled={addPropertyChecking}
            >
              <Plus className="w-4 h-4" />
              {addPropertyChecking ? "…" : t("new")}
            </button>
            {uid &&
              uid !== "new" &&
              (() => {
                const navState =
                  buildNavigationState(
                    uid,
                    location.state?.visiblePropertyIds,
                  ) ?? buildNavigationState(uid);

                if (!navState) return null;

                return (
                  <div className="flex items-center gap-0.5 ml-1 pl-3 border-l border-neutral-200 dark:border-neutral-700">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 mr-1.5 tabular-nums">
                      {navState.currentIndex || 1} / {navState.totalItems || 1}
                    </span>
                    <button
                      className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:hover:bg-transparent transition-colors"
                      title="Previous"
                      onClick={() => {
                        if (
                          navState.visiblePropertyIds &&
                          navState.currentIndex > 1
                        ) {
                          const prevIndex = navState.currentIndex - 2;
                          const prevPropertyId =
                            navState.visiblePropertyIds[prevIndex];
                          const prevNavState = buildNavigationState(
                            prevPropertyId,
                            navState.visiblePropertyIds,
                          );
                          navigate(
                            `/${accountUrl}/properties/${prevPropertyId}`,
                            {
                              state: prevNavState || {
                                ...navState,
                                currentIndex: navState.currentIndex - 1,
                              },
                            },
                          );
                        }
                      }}
                      disabled={
                        !navState.currentIndex || navState.currentIndex <= 1
                      }
                    >
                      <svg
                        className={`fill-current shrink-0 ${
                          !navState.currentIndex || navState.currentIndex <= 1
                            ? "text-neutral-200 dark:text-neutral-700"
                            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        }`}
                        width="20"
                        height="20"
                        viewBox="0 0 18 18"
                      >
                        <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z"></path>
                      </svg>
                    </button>
                    <button
                      className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:hover:bg-transparent transition-colors"
                      title="Next"
                      onClick={() => {
                        if (
                          navState.visiblePropertyIds &&
                          navState.currentIndex < navState.totalItems
                        ) {
                          const nextIndex = navState.currentIndex;
                          const nextPropertyId =
                            navState.visiblePropertyIds[nextIndex];
                          const nextNavState = buildNavigationState(
                            nextPropertyId,
                            navState.visiblePropertyIds,
                          );
                          navigate(
                            `/${accountUrl}/properties/${nextPropertyId}`,
                            {
                              state: nextNavState || {
                                ...navState,
                                currentIndex: navState.currentIndex + 1,
                              },
                            },
                          );
                        }
                      }}
                      disabled={
                        !navState.currentIndex ||
                        !navState.totalItems ||
                        navState.currentIndex >= navState.totalItems
                      }
                    >
                      <svg
                        className={`fill-current shrink-0 ${
                          !navState.currentIndex ||
                          !navState.totalItems ||
                          navState.currentIndex >= navState.totalItems
                            ? "text-neutral-200 dark:text-neutral-700"
                            : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                        }`}
                        width="20"
                        height="20"
                        viewBox="0 0 18 18"
                      >
                        <path d="M6.6 13.4L5.2 12l4-4-4-4 1.4-1.4L12 8z"></path>
                      </svg>
                    </button>
                  </div>
                );
              })()}
          </div>
        )}
      </div>

      {/* Persistent pending invitation banner */}
      {isInvitationView && invitationIdFromUrl && (
        <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t("pendingInvitationBanner", {
                defaultValue:
                  "You have a pending invitation for this property. Accept to gain full access.",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                if (invitationActionInProgressRef.current) return;
                invitationActionInProgressRef.current = true;
                setInvitationError(null);
                setInvitationAcceptingId(invitationIdFromUrl);
                try {
                  await AppApi.acceptInvitationInApp(invitationIdFromUrl);
                  await afterPropertyInvitationAcceptedInApp();
                } catch (err) {
                  console.error("Failed to accept invitation:", err);
                  const errMsg = err?.messages?.[0] ?? err?.message ?? "";
                  if (
                    typeof errMsg === "string" &&
                    errMsg.toLowerCase().includes("no longer pending")
                  ) {
                    navigate(`/${accountUrl}/properties/${uid}`, {
                      replace: true,
                    });
                  } else {
                    setInvitationError(
                      typeof errMsg === "string"
                        ? errMsg
                        : "Failed to accept invitation.",
                    );
                  }
                } finally {
                  invitationActionInProgressRef.current = false;
                  setInvitationAcceptingId(null);
                }
              }}
              disabled={!!invitationAcceptingId || !!invitationDecliningId}
              className="btn-sm btn-primary inline-flex items-center gap-1.5 px-3"
            >
              {invitationAcceptingId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {t("accept", {defaultValue: "Accept"})}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (invitationActionInProgressRef.current) return;
                invitationActionInProgressRef.current = true;
                setInvitationError(null);
                setInvitationDecliningId(invitationIdFromUrl);
                try {
                  await AppApi.declineInvitation(invitationIdFromUrl);
                  navigate(`/${accountUrl}/properties`);
                } catch (err) {
                  console.error("Failed to decline invitation:", err);
                  const errMsg = err?.messages?.[0] ?? err?.message ?? "";
                  if (
                    typeof errMsg === "string" &&
                    errMsg.toLowerCase().includes("no longer pending")
                  ) {
                    navigate(`/${accountUrl}/properties`);
                  } else {
                    setInvitationError(
                      typeof errMsg === "string"
                        ? errMsg
                        : "Failed to decline invitation.",
                    );
                  }
                } finally {
                  invitationActionInProgressRef.current = false;
                  setInvitationDecliningId(null);
                }
              }}
              disabled={!!invitationAcceptingId || !!invitationDecliningId}
              className="btn-sm border border-amber-300 dark:border-amber-500/30 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/20 inline-flex items-center gap-1.5 px-3"
            >
              {invitationDecliningId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
              {t("decline", {defaultValue: "Decline"})}
            </button>
          </div>
          {invitationError && (
            <p
              className="text-xs text-red-600 dark:text-red-400 mt-1 w-full"
              role="alert"
            >
              {invitationError}
            </p>
          )}
        </div>
      )}

      <div className="space-y-5">
        {/* Property Passport Header - compact persistent surface */}
        <PropertyPassportHeader
          headerRef={invitationMainCardRef}
          cardData={cardData}
          hasImage={Boolean(heroImageUrl)}
          imagePlaceholder={!heroImageUrl}
          sponsorshipOfferSlot={
            showSponsorshipOfferOnHero ? (
              <button
                type="button"
                onClick={() => setSponsorshipOfferOpen(true)}
                title={t("sponsorship.agentCanCover", {
                  defaultValue: "Your agent can cover this property",
                })}
                aria-label={t("sponsorship.agentCanCover", {
                  defaultValue: "Your agent can cover this property",
                })}
                className="group relative inline-flex items-center justify-center w-11 h-11 rounded-full shrink-0 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/90 dark:from-emerald-950/60 dark:via-neutral-900 dark:to-emerald-900/30 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_6px_18px_-4px_rgba(16,185,129,0.35)] ring-1 ring-emerald-300/70 dark:ring-emerald-600/40 hover:shadow-[0_0_0_1px_rgba(52,211,153,0.55),0_10px_24px_-4px_rgba(16,185,129,0.45)] hover:scale-[1.03] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full bg-emerald-400/10 blur-[1px] group-hover:bg-emerald-400/15 transition-colors"
                />
                <img
                  src={paymentPlanIcon}
                  alt=""
                  className="relative z-10 w-9 h-9 object-contain drop-shadow-sm"
                />
              </button>
            ) : null
          }
          opsymizationSlot={
            !isInvitationView &&
            uid !== "new" &&
            (isAdmin || aiFeaturesEnabled) ? (
              <>
                <style>{`
                  .passport-opsymization-container {
                    position: relative;
                    display: flex;
                  }
                  .passport-opsymization-container::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: 0.5rem;
                    background: rgba(213, 155, 91, 0.35);
                    opacity: 0;
                    filter: blur(3px);
                    transition: opacity 0.3s ease;
                    pointer-events: none;
                  }
                  .passport-opsymization-container:hover::before {
                    opacity: 1;
                  }
                  .passport-opsymization-border {
                    position: relative;
                    padding: 2px;
                    border-radius: 0.5rem;
                    background: rgba(213, 155, 91, 0.5);
                    transition: box-shadow 0.3s ease, background 0.3s ease;
                  }
                  .passport-opsymization-border:hover {
                    background: rgba(213, 155, 91, 0.65);
                    box-shadow: 0 0 3px rgba(213, 155, 91, 0.3), 0 0 6px rgba(213, 155, 91, 0.1);
                  }
                  .passport-opsymization-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.4375rem 1rem;
                    border: none;
                    border-radius: 0.375rem;
                    background: linear-gradient(to bottom, #eac285 0%, transparent 35%), rgba(213, 155, 91, 0.9);
                    color: rgba(255, 250, 235, 0.98);
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    position: relative;
                    overflow: hidden;
                    white-space: nowrap;
                    flex-shrink: 0;
                  }
                  .passport-opsymization-button::after {
                    content: "";
                    position: absolute;
                    top: -50%;
                    bottom: -50%;
                    left: -60px;
                    width: 40px;
                    background: linear-gradient(to right, transparent, rgba(255, 248, 230, 0.35), transparent);
                    transform: rotate(30deg);
                    transform-origin: center center;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                  }
                  .passport-opsymization-button:hover::after {
                    opacity: 1;
                    animation: passport-sheen 5s ease-in-out infinite;
                  }
                  @keyframes passport-sheen {
                    0% { left: -60px; }
                    70% { left: 110%; }
                    100% { left: 110%; }
                  }
                  .passport-opsymization-button:hover {
                    background: linear-gradient(to bottom, #eac285 0%, transparent 35%), rgba(213, 155, 91, 0.95);
                    color: #FFFEF5;
                  }
                  .passport-opsymization-icon {
                    color: rgba(255, 250, 235, 0.95);
                    flex-shrink: 0;
                  }
                `}</style>
                <div className="passport-opsymization-container">
                  <div className="passport-opsymization-border">
                    <button
                      ref={blankModalButtonRef}
                      type="button"
                      onClick={openInspectionAnalysisWithPlanCheck}
                      className="passport-opsymization-button justify-center"
                      title="Passport Opsymization"
                    >
                      <Sparkles
                        className="w-3.5 h-3.5 passport-opsymization-icon"
                        strokeWidth={2}
                      />
                      <span className="text-sm font-semibold whitespace-nowrap">
                        Passport Opsymization
                      </span>
                    </button>
                  </div>
                </div>
              </>
            ) : undefined
          }
          imageSlot={
            isInvitationView ? (
              heroImageUrl ? (
                <img
                  src={heroImageUrl}
                  alt={cardData.address || "Property"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={homePlaceholder}
                  alt=""
                  aria-hidden
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <ImageUploadField
                imageSrc={
                  mainPhotoPreviewUrl ||
                  (state.formData.identity?.mainPhoto !== ""
                    ? cardData.mainPhotoUrl
                    : null) ||
                  (state.formData.identity?.mainPhoto !== ""
                    ? cardData.mainPhoto?.startsWith?.("blob:")
                      ? cardData.mainPhoto
                      : null
                    : null) ||
                  (mainPhotoPresignedKey === mainPhotoKey
                    ? mainPhotoPresignedUrl
                    : null) ||
                  mainPhotoUploadedUrl
                }
                hasImage={
                  !!(
                    state.formData.identity?.mainPhoto ||
                    mainPhotoPreviewUrl ||
                    mainPhotoUploadedUrl ||
                    (state.formData.identity?.mainPhoto !== "" &&
                      (cardData.mainPhoto || cardData.mainPhotoUrl))
                  )
                }
                imageUploading={mainPhotoUploading}
                onUpload={uploadMainPhoto}
                onRemove={() => {
                  clearMainPhotoPreview();
                  clearMainPhotoUploadedUrl();
                  clearMainPhotoPresignedUrl();
                  dispatch({
                    type: "SET_IDENTITY_FORM_DATA",
                    payload: {mainPhoto: ""},
                  });
                  if (state.isInitialLoad) {
                    dispatch({type: "SET_FORM_CHANGED", payload: true});
                  }
                }}
                onPasteUrl={null}
                showRemove={
                  !!(
                    state.formData.identity?.mainPhoto ||
                    mainPhotoPreviewUrl ||
                    mainPhotoUploadedUrl ||
                    (state.formData.identity?.mainPhoto !== "" &&
                      (cardData.mainPhoto || cardData.mainPhotoUrl))
                  )
                }
                imageUploadError={null}
                onDismissError={() => setMainPhotoUploadError(null)}
                size="xl"
                placeholder="generic"
                emptyBackgroundSrc={!heroImageUrl ? homePlaceholder : undefined}
                showEmptyUploadButton={!heroImageUrl}
                alt={cardData.address || "Property"}
                uploadLabel="Upload photo"
                removeLabel="Remove photo"
                fileInputRef={mainPhotoInputRef}
                menuOpen={mainPhotoMenuOpen}
                onMenuToggle={setMainPhotoMenuOpen}
              />
            )
          }
        />

        <SponsorshipOfferModal
          open={sponsorshipOfferOpen}
          eligibility={sponsorshipEligibility}
          onConfirm={handleAcceptSponsorship}
          onClose={() => setSponsorshipOfferOpen(false)}
          onDismiss={handleDismissSponsorshipOffer}
        />

        {/* Overview preview for pending invitations — full overview tab, read-only. */}
        {isInvitationView && (
          <section
            className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900"
            style={{
              boxShadow:
                "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div className="border-b border-neutral-100 dark:border-neutral-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
                Overview
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Preview this property before accepting the invitation.
              </p>
            </div>
            <div className="px-4 md:px-5 pt-4 pb-2">
              {propertyOverviewDashboard(true)}
            </div>
          </section>
        )}

        {!isInvitationView && (
          <>
            {/* Navigation Tabs */}
            <section
              className={`rounded-2xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 ${
                state.formDataChanged || state.isNew
                  ? "rounded-b-none border-b-0"
                  : ""
              }`}
              style={{
                boxShadow:
                  state.formDataChanged || state.isNew
                    ? "0 -1px 12px rgba(0,0,0,0.04)"
                    : "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <div className="border-b border-neutral-100 dark:border-neutral-800 px-4">
                <nav className="flex flex-wrap gap-1">
                  {tabs.map((tab) => {
                    const icons = {
                      overview: Home,
                      identity: FileText,
                      systems: Settings,
                      maintenance: Wrench,
                      documents: FileText,
                      media: ImageIcon,
                      financials: Landmark,
                    };
                    const Icon = icons[tab.id] || FileText;
                    return (
                      <button
                        key={tab.id}
                        onClick={() =>
                          dispatch({type: "SET_ACTIVE_TAB", payload: tab.id})
                        }
                        className={`py-3 px-3.5 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
                          state.activeTab === tab.id
                            ? "border-[#456564] text-[#456564] dark:text-[#5a7a78] dark:border-[#5a7a78]"
                            : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                        {tab.id === "systems" && inspectionAnalysis && (
                          <span
                            className="ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            title={`Inspection analysis completed${
                              inspectionAnalysis.createdAt
                                ? ` ${new Date(inspectionAnalysis.createdAt).toLocaleDateString()}`
                                : ""
                            }`}
                          >
                            AI Updated
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
              <div
                className={`px-4 md:px-5 pt-4 ${state.formDataChanged || state.isNew ? "pb-5" : "pb-6"}`}
              >
                {state.activeTab === "overview" && propertyOverviewDashboard()}

                {state.activeTab === "identity" && (
                  <IdentityTab
                    propertyData={mergedFormData}
                    savedPropertyData={savedMergedPropertyData}
                    handleInputChange={handleChange}
                    errors={state.errors}
                    addressInputRef={identityAddressRef}
                    placesLoaded={identityPlacesLoaded}
                    placesError={identityPlacesError}
                    AutocompleteWrapper={IdentityAutocompleteWrapper}
                    identityDataSource={identityDataSource}
                    supportDataAdjustmentUrl={supportDataAdjustmentUrl}
                    expandSectionId={expandSectionId}
                    formDataChanged={state.formDataChanged}
                    attomRefresh={attomRefresh}
                    onCancelEdit={handleCancelIdentityEdit}
                    isSuperAdmin={
                      (currentUser?.role ?? "").toLowerCase() === "super_admin"
                    }
                  />
                )}

                {state.activeTab === "systems" && (
                  <SystemsTab
                    propertyData={mergedFormData}
                    maintenanceRecords={state.formData.maintenanceRecords ?? []}
                    savedMaintenanceRecords={
                      state.savedMaintenanceRecords ?? []
                    }
                    onMaintenanceRecordsChange={handleMaintenanceRecordsChange}
                    onMaintenanceRecordAdded={() => {
                      setTimeout(() => {
                        saveBarRef.current?.scrollIntoView?.({
                          behavior: "smooth",
                          block: "nearest",
                        });
                      }, 100);
                    }}
                    onFormDirty={(dirty) => {
                      if (dirty)
                        dispatch({type: "SET_FORM_CHANGED", payload: true});
                    }}
                    propertyDocuments={overviewDocuments}
                    propertyIdFallback={uid !== "new" ? uid : undefined}
                    handleInputChange={handleChange}
                    expandSectionId={expandSectionId}
                    onSilentSystemsUpdate={handleSilentSystemsUpdate}
                    onDocumentAnalysisApplied={handleDocumentAnalysisApplied}
                    visibleSystemIds={visibleSystemIds}
                    customSystemsData={
                      state.formData.systems?.customSystemsData ?? {}
                    }
                    systems={state.systems}
                    inspectionAnalysis={inspectionAnalysis}
                    maintenanceEvents={maintenanceEvents}
                    onScheduleSuccess={fetchMaintenanceEvents}
                    propertyId={propertyIdForApi}
                    onOpenInspectionReport={(systemId) => {
                      setInspectionReportSystemId(systemId ?? null);
                      setInspectionReportModalOpen(true);
                      if (propertyIdForApi) {
                        AppApi.getInspectionAnalysisByProperty(propertyIdForApi)
                          .then((res) =>
                            setInspectionAnalysis(res?.analysis ?? null),
                          )
                          .catch(() => {});
                      }
                    }}
                    aiSidebarOpen={aiSidebarOpen}
                    onAiSidebarOpenChange={(open) => {
                      if (open) {
                        openAiAssistantWithPlanCheck();
                        return;
                      }
                      setAiSidebarOpen(false);
                    }}
                    onOpenAIAssistant={(ctx) => {
                      const obj =
                        typeof ctx === "object" && ctx !== null
                          ? ctx
                          : {systemName: ctx};
                      const {initialPrompt, ...systemCtx} = obj;
                      setAiSidebarSystemLabel(obj.systemName ?? ctx ?? null);
                      setAiSidebarSystemContext(
                        typeof ctx === "object" && ctx !== null
                          ? systemCtx
                          : null,
                      );
                      setAiSidebarInitialPrompt(initialPrompt ?? null);
                      openAiAssistantWithPlanCheck();
                    }}
                    aiSidebarSystemLabel={aiSidebarSystemLabel}
                    aiSidebarSystemContext={aiSidebarSystemContext}
                    onSystemsCompletionChange={handleSystemsCompletionChange}
                    onOpenSystemsSetup={handleOpenSystemsSetup}
                    onOpenMaintenanceRecord={handleOpenMaintenanceRecordView}
                  />
                )}

                {state.activeTab === "maintenance" && (
                  <MaintenanceTab
                    propertyData={mergedFormData}
                    maintenanceRecords={state.formData.maintenanceRecords ?? []}
                    savedMaintenanceRecords={
                      state.savedMaintenanceRecords ?? []
                    }
                    onMaintenanceRecordsChange={handleMaintenanceRecordsChange}
                    onMaintenanceRecordAdded={() => {
                      setTimeout(() => {
                        saveBarRef.current?.scrollIntoView?.({
                          behavior: "smooth",
                          block: "nearest",
                        });
                      }, 100);
                    }}
                    onFormDirty={(dirty) => {
                      if (dirty)
                        dispatch({type: "SET_FORM_CHANGED", payload: true});
                    }}
                    contacts={contacts ?? []}
                  />
                )}

                {state.activeTab === "media" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                          Property Media
                        </h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          Photos and visual records for this property
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700">
                        Uploads Coming Soon
                      </span>
                    </div>
                    {(state.formData.identity?.photos ?? []).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {(state.formData.identity?.photos ?? []).map(
                          (photo, index) => (
                            <div
                              key={photo}
                              className="relative overflow-hidden rounded-xl h-44 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50"
                            >
                              <img
                                src={photo}
                                alt={`Property photo ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <EmptyStateCard
                        icon={ImageIcon}
                        title="No media yet"
                        description="Photo and video management for your property is coming soon. Your property's main photo can be set from the passport header."
                        className="py-12"
                      />
                    )}
                  </div>
                )}

                {state.activeTab === "photos" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(state.formData.identity?.photos ?? []).map(
                      (photo, index) => (
                        <div
                          key={photo}
                          className="relative overflow-hidden rounded-xl h-48 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50 border-dashed"
                        >
                          <img
                            src={photo}
                            alt={`Property photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ),
                    )}
                  </div>
                )}

                {state.activeTab === "documents" && (
                  <div data-documents-tab className="min-h-0">
                    <React.Suspense
                      fallback={
                        <div className="flex items-center justify-center py-16 text-gray-500 dark:text-gray-400">
                          <Loader2 className="w-8 h-8 animate-spin mr-2" />
                          Loading documents…
                        </div>
                      }
                    >
                      <DocumentsTab
                        propertyData={mergedFormData}
                        propertySystems={state.systems ?? []}
                        accountUrl={accountUrl}
                        propertyUid={uid}
                        onOpenAIReport={
                          uid !== "new"
                            ? openInspectionAnalysisWithPlanCheck
                            : undefined
                        }
                        openUploadModalForInspectionReport={
                          documentsUploadModalRequested
                        }
                        onUploadModalOpened={() =>
                          setDocumentsUploadModalRequested(false)
                        }
                      />
                    </React.Suspense>
                  </div>
                )}

                {state.activeTab === "financials" && (
                  <FinancialsTab
                    propertyData={mergedFormData}
                    onNavigateTab={(tabId) =>
                      dispatch({type: "SET_ACTIVE_TAB", payload: tabId})
                    }
                  />
                )}
              </div>
            </section>

            {/* Save/Cancel bar — direct child of space-y-5 so its sticky parent
             always has content in the viewport regardless of scroll position.
             -mt-5 collapses the space-y gap to visually attach to the section above.
             z-0 keeps it below tooltips (z-10) and popovers (z-50) on Systems tab. */}
            <div
              ref={saveBarRef}
              className={`${
                state.formDataChanged || state.isNew ? "sticky -mt-5" : "hidden"
              } bottom-0 z-0 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/50 border-t border-t-neutral-100 dark:border-t-neutral-800 px-6 py-4 rounded-b-2xl transition-all duration-200`}
              style={{
                boxShadow:
                  "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
                  onClick={handleCancelChanges}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn transition-colors duration-200 shadow-sm min-w-[100px] btn-primary flex items-center justify-center gap-2"
                  onClick={state.isNew ? handleSubmit : handleUpdate}
                >
                  {state.isSubmitting && (
                    <Loader2
                      className="w-4 h-4 animate-spin shrink-0"
                      aria-hidden
                    />
                  )}
                  {state.isSubmitting
                    ? state.isNew
                      ? "Saving..."
                      : "Updating..."
                    : state.isNew
                      ? "Save"
                      : "Update"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invitation accept/decline modal */}
      {isInvitationView && invitationIdFromUrl && (
        <ModalBlank
          modalOpen={invitationModalOpen}
          setModalOpen={setInvitationModalOpen}
          closeOnClickOutside={false}
          closeOnBackdropClick={false}
          contentClassName="w-full max-w-2xl"
        >
          <div className="p-6 sm:p-8 w-full min-w-0">
            <div className="flex items-center gap-4 mb-4 w-full">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-[#456564]/15 dark:bg-[#5a7a78]/25 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Property invitation
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  You&apos;ve been invited to join this property&apos;s Opsy
                  team.
                </p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6">
              Would you like to accept this invitation and get access to this
              property?
            </p>
            {invitationError && (
              <p
                className="text-sm text-red-600 dark:text-red-400 mb-4"
                role="alert"
              >
                {invitationError}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setInvitationModalOpen(false);
                setInvitationReviewMode(true);
                invitationMainCardRef.current?.scrollIntoView?.({
                  behavior: "smooth",
                  block: "start",
                });
              }}
              className="btn w-full mb-4 border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-center gap-2"
            >
              Review property
            </button>
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={async () => {
                  if (invitationActionInProgressRef.current) return;
                  invitationActionInProgressRef.current = true;
                  setInvitationError(null);
                  setInvitationAcceptingId(invitationIdFromUrl);
                  try {
                    await AppApi.acceptInvitationInApp(invitationIdFromUrl);
                    await afterPropertyInvitationAcceptedInApp();
                  } catch (err) {
                    console.error("Failed to accept invitation:", err);
                    const errMsg = err?.messages?.[0] ?? err?.message ?? "";
                    if (
                      typeof errMsg === "string" &&
                      errMsg.toLowerCase().includes("no longer pending")
                    ) {
                      setInvitationModalOpen(false);
                      setInvitationReviewMode(false);
                      navigate(`/${accountUrl}/properties/${uid}`, {
                        replace: true,
                      });
                    } else {
                      setInvitationError(
                        typeof errMsg === "string"
                          ? errMsg
                          : "Failed to accept invitation.",
                      );
                    }
                  } finally {
                    invitationActionInProgressRef.current = false;
                    setInvitationAcceptingId(null);
                  }
                }}
                disabled={!!invitationAcceptingId || !!invitationDecliningId}
                className="btn flex-1 btn-primary inline-flex items-center justify-center gap-2"
              >
                {invitationAcceptingId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Accept
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (invitationActionInProgressRef.current) return;
                  invitationActionInProgressRef.current = true;
                  setInvitationError(null);
                  setInvitationDecliningId(invitationIdFromUrl);
                  try {
                    await AppApi.declineInvitation(invitationIdFromUrl);
                    setInvitationModalOpen(false);
                    setInvitationReviewMode(false);
                    navigate(`/${accountUrl}/properties`);
                  } catch (err) {
                    console.error("Failed to decline invitation:", err);
                    const errMsg = err?.messages?.[0] ?? err?.message ?? "";
                    if (
                      typeof errMsg === "string" &&
                      errMsg.toLowerCase().includes("no longer pending")
                    ) {
                      setInvitationModalOpen(false);
                      setInvitationReviewMode(false);
                      navigate(`/${accountUrl}/properties`);
                    } else {
                      setInvitationError(
                        typeof errMsg === "string"
                          ? errMsg
                          : "Failed to decline invitation.",
                      );
                    }
                  } finally {
                    invitationActionInProgressRef.current = false;
                    setInvitationDecliningId(null);
                  }
                }}
                disabled={!!invitationAcceptingId || !!invitationDecliningId}
                className="btn flex-1 border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-center gap-2"
              >
                {invitationDecliningId ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <X className="w-4 h-4" />
                )}
                Decline
              </button>
            </div>
          </div>
        </ModalBlank>
      )}

      {/* Invitation corner bar - Accept/Decline when in review mode */}
      {isInvitationView && invitationIdFromUrl && invitationReviewMode && (
        <div className="fixed bottom-6 right-6 z-[200] flex items-center gap-2 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg p-2">
          <button
            type="button"
            onClick={async () => {
              if (invitationActionInProgressRef.current) return;
              invitationActionInProgressRef.current = true;
              setInvitationError(null);
              setInvitationAcceptingId(invitationIdFromUrl);
              try {
                await AppApi.acceptInvitationInApp(invitationIdFromUrl);
                await afterPropertyInvitationAcceptedInApp();
              } catch (err) {
                console.error("Failed to accept invitation:", err);
                const errMsg = err?.messages?.[0] ?? err?.message ?? "";
                if (
                  typeof errMsg === "string" &&
                  errMsg.toLowerCase().includes("no longer pending")
                ) {
                  setInvitationReviewMode(false);
                  navigate(`/${accountUrl}/properties/${uid}`, {
                    replace: true,
                  });
                } else {
                  setInvitationError(
                    typeof errMsg === "string"
                      ? errMsg
                      : "Failed to accept invitation.",
                  );
                  setInvitationReviewMode(false);
                  setInvitationModalOpen(true);
                }
              } finally {
                invitationActionInProgressRef.current = false;
                setInvitationAcceptingId(null);
              }
            }}
            disabled={!!invitationAcceptingId || !!invitationDecliningId}
            className="btn btn-primary inline-flex items-center gap-2 px-4"
          >
            {invitationAcceptingId ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Accept
          </button>
          <button
            type="button"
            onClick={async () => {
              if (invitationActionInProgressRef.current) return;
              invitationActionInProgressRef.current = true;
              setInvitationError(null);
              setInvitationDecliningId(invitationIdFromUrl);
              try {
                await AppApi.declineInvitation(invitationIdFromUrl);
                setInvitationReviewMode(false);
                navigate(`/${accountUrl}/properties`);
              } catch (err) {
                console.error("Failed to decline invitation:", err);
                const errMsg = err?.messages?.[0] ?? err?.message ?? "";
                if (
                  typeof errMsg === "string" &&
                  errMsg.toLowerCase().includes("no longer pending")
                ) {
                  setInvitationReviewMode(false);
                  navigate(`/${accountUrl}/properties`, {
                    replace: true,
                  });
                } else {
                  setInvitationError(
                    typeof errMsg === "string"
                      ? errMsg
                      : "Failed to decline invitation.",
                  );
                  setInvitationReviewMode(false);
                  setInvitationModalOpen(true);
                }
              } finally {
                invitationActionInProgressRef.current = false;
                setInvitationDecliningId(null);
              }
            }}
            disabled={!!invitationAcceptingId || !!invitationDecliningId}
            className="btn border border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 inline-flex items-center gap-2 px-4"
          >
            {invitationDecliningId ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            Decline
          </button>
        </div>
      )}

      <ModalBlank
        modalOpen={invitationAcceptedModalOpen}
        setModalOpen={(open) => {
          if (!open) dismissInvitationAcceptedModal();
        }}
        closeOnClickOutside={false}
        closeOnBackdropClick={false}
        contentClassName="w-full max-w-md"
      >
        <div className="p-6 sm:p-8 w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
            {t("invitations.acceptedTitle") || "Invitation accepted"}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-6">
            {t("invitations.acceptedPropertyBody") ||
              "You're now on this property's team and can access it from your account."}
          </p>
          <button
            type="button"
            onClick={dismissInvitationAcceptedModal}
            className="btn w-full btn-primary"
          >
            {t("invitations.continueToProperty") || "Continue to property"}
          </button>
        </div>
      </ModalBlank>

      {attomRefresh.confirmOpen && (
        <AttomRefreshConfirmDialog
          modalView={attomRefresh.modalView}
          jobStatus={attomRefresh.jobStatus}
          jobError={attomRefresh.jobError}
          populatedKeys={attomRefresh.populatedKeys}
          lookupCount={attomRefresh.lookupCount}
          lookupLimit={attomRefresh.lookupLimit}
          hasUnsavedChanges={state.formDataChanged}
          onCancel={attomRefresh.closeConfirm}
          onConfirm={() => {
            if (state.formDataChanged) {
              attomRefresh.openConfirm();
              return;
            }
            void attomRefresh.startRefresh();
          }}
          onSaveAndPull={handleSaveAndPullAttom}
        />
      )}

      {/* Inspection Report modal (legacy - for Systems/Documents tabs) */}
      {uid !== "new" && (
        <InspectionReportModal
          isOpen={inspectionReportModalOpen}
          onClose={() => {
            setInspectionReportModalOpen(false);
            setTimeout(() => setInspectionReportSystemId(null), 300);
          }}
          analysis={inspectionAnalysis}
          systemId={inspectionReportSystemId}
          systemLabel={
            inspectionReportSystemId
              ? (PROPERTY_SYSTEMS.find((s) => s.id === inspectionReportSystemId)
                  ?.name ??
                (inspectionReportSystemId.startsWith("custom-")
                  ? inspectionReportSystemId.replace(
                      /^custom-(.+?)-\d+$/,
                      "$1",
                    ) || inspectionReportSystemId
                  : inspectionReportSystemId))
              : null
          }
          onChatWithAI={() => {
            const sysLabel = inspectionReportSystemId
              ? (PROPERTY_SYSTEMS.find((s) => s.id === inspectionReportSystemId)
                  ?.name ??
                (inspectionReportSystemId.startsWith("custom-")
                  ? inspectionReportSystemId.replace(
                      /^custom-(.+?)-\d+$/,
                      "$1",
                    ) || inspectionReportSystemId
                  : inspectionReportSystemId))
              : null;
            if (inspectionReportSystemId && sysLabel) {
              setAiSidebarSystemContext({
                systemId: inspectionReportSystemId,
                systemName: sysLabel,
              });
              setAiSidebarSystemLabel(sysLabel);
              setAiSidebarInitialPrompt(
                `Summarize the ${sysLabel} system's inspection findings.`,
              );
            } else {
              setAiSidebarSystemContext(null);
              setAiSidebarSystemLabel(null);
              setAiSidebarInitialPrompt(
                "Summarize the inspection report analysis and key findings.",
              );
            }
            setInspectionReportModalOpen(false);
            openAiAssistantWithPlanCheck();
          }}
          onUploadReport={() => {
            setInspectionReportModalOpen(false);
            dispatch({type: "SET_ACTIVE_TAB", payload: "documents"});
            setDocumentsUploadModalRequested(true);
          }}
        />
      )}

      {/* Large empty modal */}
      <ModalBlank
        modalOpen={blankModalOpen}
        setModalOpen={setBlankModalOpen}
        contentClassName="max-w-6xl min-h-[80vh]"
        ignoreClickRef={blankModalButtonRef}
      >
        <InspectionAnalysisModalContent
          propertyId={
            uid !== "new"
              ? (state.property?.identity?.id ?? state.property?.id ?? uid)
              : null
          }
          isOpen={blankModalOpen}
          onClose={() => {
            setBlankModalOpen(false);
            setInspectionAutoReportMeta(null);
            setInspectionAutoStart(false);
          }}
          onScheduleMaintenance={(prefill) => {
            setScheduleFromAiPrefill(prefill);
            setScheduleFromAiModalOpen(true);
            setBlankModalOpen(false);
          }}
          onTierRestriction={(message) => {
            setUpgradePromptTitle("Upgrade your plan");
            setUpgradePromptMsg(
              message ||
                "You've used all your AI tokens for this month. Upgrade your plan for more.",
            );
            setUpgradePromptOpen(true);
          }}
          onUploadReport={() => {
            if (!canUseAiFeatures) {
              setUpgradePromptTitle(
                isPaidUser && !aiFeaturesEnabled
                  ? "AI inspection analysis not included"
                  : "Inspection Analysis not included",
              );
              setUpgradePromptMsg(
                isPaidUser && !aiFeaturesEnabled
                  ? "Your subscription does not include AI inspection analysis. Upgrade to a plan that includes AI features."
                  : "Your plan doesn't support AI inspection report analysis. Upgrade to analyze inspection reports with AI.",
              );
              setUpgradePromptOpen(true);
              setBlankModalOpen(false);
              return;
            }
            // Route to the Documents tab so the user can manage (delete + re-upload)
            // their inspection report. The backend enforces a single inspection
            // report per property, so SystemsSetupModal's upload-only step would
            // fail when one already exists. The Documents tab handles both cases.
            setBlankModalOpen(false);
            dispatch({type: "SET_ACTIVE_TAB", payload: "documents"});
            setDocumentsUploadModalRequested(true);
          }}
          propertySystems={state.systems ?? []}
          customSystemNames={state.formData.systems?.customSystemNames ?? []}
          onContinueToSystems={(suggested) => {
            setBlankModalOpen(false);
            setInspectionAutoReportMeta(null);
            setInspectionAutoStart(false);
            setExternalSuggestedSystems(suggested);
            setSystemsSetupOnlyStep("systems");
            setSystemsSetupInitialStep("systems");
            setSystemsSetupModalOpen(true);
          }}
          initialReportMeta={inspectionAutoReportMeta}
          autoStartAnalysis={inspectionAutoStart}
          onAutoStartConsumed={() => setInspectionAutoStart(false)}
        />
      </ModalBlank>

      {/* AI Assistant sidebar - available from all tabs */}
      {uid !== "new" && (
        <AIAssistantSidebar
          isOpen={aiSidebarOpen}
          onClose={() => {
            setAiSidebarOpen(false);
            setAiSidebarSystemLabel(null);
            setAiSidebarSystemContext(null);
            setAiSidebarInitialPrompt(null);
          }}
          systemLabel={aiSidebarSystemLabel}
          systemContext={aiSidebarSystemContext}
          propertyId={state.property?.identity?.id ?? state.property?.id ?? uid}
          propertyDisplayName={aiAssistantPropertyHeader.propertyDisplayName}
          propertyAddressLine={aiAssistantPropertyHeader.propertyAddressLine}
          propertySystems={[
            ...PROPERTY_SYSTEMS.filter((s) =>
              (state.formData.systems?.selectedSystemIds?.length
                ? state.formData.systems.selectedSystemIds
                : DEFAULT_SYSTEM_IDS
              ).includes(s.id),
            ),
            ...(state.formData.systems?.customSystemNames ?? []).map(
              (name, i) => ({
                id: `custom-${name}-${i}`,
                name,
              }),
            ),
          ]}
          contacts={contacts ?? []}
          initialPrompt={aiSidebarInitialPrompt}
          onScheduleSuccess={fetchMaintenanceEvents}
          onOpenScheduleModal={
            uid !== "new"
              ? (prefill) => {
                  setScheduleFromAiPrefill(prefill);
                  setScheduleFromAiModalOpen(true);
                }
              : undefined
          }
        />
      )}
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
          "You've reached the limit for your current plan. Upgrade to unlock more."
        }
        upgradeUrl={accountUrl ? `/${accountUrl}/settings/upgrade` : undefined}
        ignoreClickRef={blankModalButtonRef}
      />
      <DemoFeatureUnavailableModal {...aiDemoGate.modalProps} />

      {/* Floating "Invite your Agent" CTA */}
      {showInviteAgentCta && (
        <div
          className="fixed bottom-6 right-6 z-40 animate-[inviteCtaSlideIn_0.4s_ease-out_forwards]"
          style={{opacity: 0, transform: "translateY(16px)"}}
        >
          <style>{`
            @keyframes inviteCtaSlideIn {
              from { opacity: 0; transform: translateY(16px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 pr-10 max-w-xs">
            <button
              type="button"
              onClick={() => setShowInviteAgentCta(false)}
              className="absolute top-2 right-2 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInviteAgentCta(false);
                setInviteAgentBenefitsOpen(true);
              }}
              className="flex items-start gap-3 text-left group w-full"
            >
              <div className="w-10 h-10 rounded-lg bg-[#456564]/15 dark:bg-[#5a7a78]/25 flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#456564] dark:group-hover:text-[#5a7a78] transition-colors">
                  Invite your Agent
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  Add a professional to help manage your property
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                dismissInviteAgentCtaPermanently(uid);
                setShowInviteAgentCta(false);
              }}
              className="mt-3 block w-full text-right text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Do not show this again
            </button>
          </div>
        </div>
      )}

      <InviteAgentBenefitsModal
        modalOpen={inviteAgentBenefitsOpen}
        setModalOpen={setInviteAgentBenefitsOpen}
        onInviteAgent={() => {
          setShareModalInitialTab("agent");
          setShareModalOpen(true);
        }}
      />

      {propertyIdForApi && (
        <DocumentAnalysisOrchestrator
          propertyId={propertyIdForApi}
          systemsToShow={systemsToShowForAnalysis}
          onOpenDocument={async (key) => {
            try {
              const url = await AppApi.getPresignedPreviewUrl(key);
              window.open(url, "_blank", "noopener,noreferrer");
            } catch (err) {
              console.warn("[DocumentAnalysis] preview failed:", err.message);
            }
          }}
          onSystemsUpdated={handleDocumentAnalysisApplied}
        />
      )}
    </div>
  );
}

export default PropertyFormContainer;
