import React, {
  useReducer,
  useRef,
  useContext,
  useState,
  useEffect,
  useCallback,
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
import SystemsTab from "./SystemsTab";
import MaintenanceTab from "./MaintenanceTab";
import IdentityTab from "./IdentityTab";
import DocumentsTab from "./DocumentsTab";
import CircularProgress from "../../partials/propertyFeatures/CircularProgress";
import ScoreCard from "./ScoreCard";
import HomeOpsTeam from "./partials/HomeOpsTeam";
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
  mapPropertyFromBackend,
} from "./helpers/preparePropertyValues";
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
import {formSystemsToArray} from "./helpers/formSystemsToArray";
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
} from "./constants/identitySections";
import {
  isSystemComplete,
  isCustomSystemComplete,
} from "./constants/systemSections";
import Banner from "../../partials/containers/Banner";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import {
  Bed,
  Bath,
  Ruler,
  Calendar,
  FileText,
  Settings,
  Wrench,
  Image as ImageIcon,
  ClipboardList,
  Home,
  MapPin,
  Building,
  Zap,
  Droplet,
  Shield,
  AlertTriangle,
  FileCheck,
  ChevronDown,
  ChevronUp,
  FileBarChart,
  Loader2,
  Sparkles,
  X,
  Check,
  UserPlus,
} from "lucide-react";
import AIAssistantSidebar from "./partials/AIAssistantSidebar";
import InspectionReportModal from "./partials/InspectionReportModal";
import ModalBlank from "../../components/ModalBlank";
import InspectionAnalysisModalContent from "./partials/InspectionAnalysisModalContent";
import useImageUpload from "../../hooks/useImageUpload";
import usePresignedPreview from "../../hooks/usePresignedPreview";
import useGooglePlacesAutocomplete from "../../hooks/useGooglePlacesAutocomplete";
import ImageUploadField from "../../components/ImageUploadField";
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
  return {
    id: currentUser.id,
    name: currentUser.name ?? "User",
    role: displayRole,
    image: currentUser.image ?? currentUser.avatar,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_FORM_DATA": {
      const p = action.payload ?? {};
      const hasTabbed =
        "identity" in p || "systems" in p || "maintenanceRecords" in p;
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
        isInitialLoad: false,
        errors: {},
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
  {id: "identity", label: "Identity"},
  {id: "systems", label: "Systems"},
  {id: "maintenance", label: "Maintenance"},
  {id: "documents", label: "Documents"},
  {id: "media", label: "Media"},
];

const formatCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/* Property Form Container */
function PropertyFormContainer() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const navigate = useNavigate();
  const location = useLocation();
  const {uid, accountUrl: accountUrlParam} = useParams();
  const [searchParams] = useSearchParams();
  const invitationIdFromUrl =
    searchParams.get("invitation")?.trim?.() || searchParams.get("invitation");
  const isInvitationView = Boolean(invitationIdFromUrl && uid !== "new");
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
    updateProperty,
    updateTeam,
    getSystemsByPropertyId,
    updateSystemsForProperty,
    getMaintenanceRecordsByPropertyId,
    createMaintenanceRecords,
    updateMaintenanceRecord,
    deleteMaintenanceRecord,
  } = useContext(PropertyContext);

  const {users} = useContext(UserContext);
  const {contacts} = useContext(ContactContext);
  const {currentUser} = useAuth();
  const accountUrl =
    accountUrlParam || currentAccount?.url || currentAccount?.name || "";
  const [homeopsTeam, setHomeopsTeam] = useState([]);
  const [systemsSetupModalOpen, setSystemsSetupModalOpen] = useState(false);
  const [systemsSetupInitialStep, setSystemsSetupInitialStep] = useState(null);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [upgradePromptTitle, setUpgradePromptTitle] = useState("Upgrade your plan");
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
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalInitialTab, setShareModalInitialTab] = useState("owner");
  const [blankModalOpen, setBlankModalOpen] = useState(false);
  const [documentsUploadModalRequested, setDocumentsUploadModalRequested] =
    useState(false);
  const [invitationModalOpen, setInvitationModalOpen] = useState(false);
  const [invitationAcceptingId, setInvitationAcceptingId] = useState(null);
  const [invitationDecliningId, setInvitationDecliningId] = useState(null);
  const [invitationError, setInvitationError] = useState(null);
  const [mainPhotoMenuOpen, setMainPhotoMenuOpen] = useState(false);
  const mainPhotoInputRef = useRef(null);
  const actionsTriggerRef = useRef(null);
  const actionsDropdownRef = useRef(null);
  const saveBarRef = useRef(null);
  const blankModalButtonRef = useRef(null);
  const originalMaintenanceRecordIdsRef = useRef(new Set());
  const [expandSectionId, setExpandSectionId] = useState(null);

  // Merged formData – declared early so callbacks can reference it
  const mergedFormData = mergeFormDataFromTabs(state.formData);

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

  /* Google Places Autocomplete for Identity tab address field */
  const handleIdentityPlaceSelected = useCallback((parsed) => {
    dispatch({
      type: "SET_IDENTITY_FORM_DATA",
      payload: {
        address: parsed.formattedAddress,
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

  /* Open systems setup modal on load when creating a new property */
  useEffect(() => {
    if (uid === "new") {
      setSystemsSetupModalOpen(true);
    }
  }, [uid]);

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
        state: {
          currentIndex: properties.length + 1,
          totalItems: properties.length + 1,
          visiblePropertyIds: [
            ...properties.map((p) => p.property_uid ?? p.id),
            newUid,
          ],
        },
      });
    }
  }, [systemsSetupModalOpen, createdPropertyFromModal]);

  /* Open AI sidebar when navigating from property card with openAiSidebar */
  useEffect(() => {
    if (uid !== "new" && location.state?.openAiSidebar) {
      setAiSidebarOpen(true);
      const {openAiSidebar: _, ...restState} = location.state ?? {};
      navigate(location.pathname, {replace: true, state: restState});
    }
  }, [uid]);

  /* Open invitation modal when viewing property from invitation notification */
  useEffect(() => {
    if (isInvitationView && state.property && invitationIdFromUrl) {
      setInvitationModalOpen(true);
    }
  }, [isInvitationView, state.property, invitationIdFromUrl]);

  /* Fetch inspection analysis for hero card pill and report context */
  const propertyIdForApi =
    state.property?.identity?.id ??
    state.property?.id ??
    (uid !== "new" ? uid : null);
  useEffect(() => {
    if (!propertyIdForApi) return;
    AppApi.getInspectionAnalysisByProperty(propertyIdForApi)
      .then((a) => setInspectionAnalysis(a))
      .catch(() => setInspectionAnalysis(null));
  }, [propertyIdForApi]);

  /* Get property by ID and its systems */
  useEffect(() => {
    async function loadPropertyAndSystems() {
      if (uid === "new") return;
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
      try {
        const property = await getPropertyById(uid);
        const systemsRes = await getSystemsByPropertyId(property.id);
        const systemsArr = systemsRes?.systems ?? systemsRes ?? [];
        if (systemsRes?.aiSummaryUpdatedAt) {
          dispatch({
            type: "SET_AI_SUMMARY_UPDATED_AT",
            payload: systemsRes.aiSummaryUpdatedAt,
          });
        }
        const rawRecords = await getMaintenanceRecordsByPropertyId(property.id);
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
      .then((events) => setMaintenanceEvents(events ?? []))
      .catch(() => setMaintenanceEvents([]));
  }, [effectivePropertyId]);
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

  /* Reset form when navigating TO new from another property (not on initial mount); clear 403 when uid changes */
  const prevUidRef = useRef(null);
  useEffect(() => {
    if (uid === "new") {
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
    async function setDefaultHomeopsTeam() {
      if (uid === "new") return;
      const team = await getPropertyTeam(uid);
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
          image_url: m.image_url ?? u?.image_url,
          image: m.image ?? u?.image,
        };
      });
      setHomeopsTeam(enriched);
    }
    setDefaultHomeopsTeam();
  }, [uid, currentUser?.id, state.property]);

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
            currentIndex: properties.length + 1,
            totalItems: properties.length + 1,
            visiblePropertyIds: [
              ...properties.map((p) => p.property_uid ?? p.id),
              newUid,
            ],
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
  const handleNewProperty = () => navigate(`/${accountUrl}/properties/new`);

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
        setExpandSectionId(null);
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

      // All sections complete
      dispatch({type: "SET_ACTIVE_TAB", payload: "identity"});
      setExpandSectionId(null);
      runScrollToSection("identity", "__all_complete__");
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
      const propertyId = state.property?.identity?.id ?? state.property?.id;
      const merged = mergeFormDataFromTabs(state.formData);
      const identityPayload = prepareIdentityForUpdate(
        state.formData.identity ?? {},
      );
      identityPayload.hps_score = computeHpsScore(merged);
      const res = await updateProperty(propertyId, identityPayload);
      if (res) {
        await updateTeam(res.id, prepareTeamForProperty(homeopsTeam));

        const teamAfterUpdate = await getPropertyTeam(uid);
        const propertyUsers = teamAfterUpdate?.property_users ?? [];

        /* Only redirect if current user removed themselves (no longer on team). Skip for super_admin – they have platform-wide access and should stay on the property to see the success message. */
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
        /* Sync local team with server so UI matches after save */
        const enriched = propertyUsers.map((m) => {
          const u = users?.find(
            (us) => us && m?.id != null && Number(us.id) === Number(m.id),
          );
          return {
            ...m,
            role: m.role,
            property_role: m.property_role ?? "editor",
            image_url: m.image_url ?? u?.image_url,
            image: m.image ?? u?.image,
          };
        });
        setHomeopsTeam(enriched);

        const systemsArray = formSystemsToArray(
          mergeFormDataFromTabs(state.formData) ?? {},
          res.id,
          state.systems ?? [],
        );
        await updateSystemsForProperty(res.id, systemsArray);

        /* Maintenance records sync */
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
        const syncPlan = computeMaintenanceSyncPlan(
          currentRecords,
          originalMaintenanceRecordIdsRef.current,
          res.id,
        );

        if (syncPlan.toDelete.length > 0) {
          await Promise.all(
            syncPlan.toDelete.map((id) => deleteMaintenanceRecord(id)),
          );
        }
        if (syncPlan.toCreate.length > 0) {
          await createMaintenanceRecords(res.id, syncPlan.toCreate);
        }
        if (syncPlan.toUpdate.length > 0) {
          await Promise.all(
            syncPlan.toUpdate.map(({id, payload}) =>
              updateMaintenanceRecord(id, payload),
            ),
          );
        }

        const refreshed = await getPropertyById(uid);
        const rawRecords = await getMaintenanceRecordsByPropertyId(res.id);
        const maintenanceRecords = mapMaintenanceRecordsFromBackend(
          rawRecords ?? [],
        );
        setMaintenanceRecords(maintenanceRecords);
        originalMaintenanceRecordIdsRef.current = new Set(
          maintenanceRecords
            .filter((r) => !isNewMaintenanceRecord(r))
            .map((r) => r.id),
        );
        const systemsResAfter = await getSystemsByPropertyId(res.id);
        const systemsFromBackend =
          systemsResAfter?.systems ?? systemsResAfter ?? [];
        if (systemsResAfter?.aiSummaryUpdatedAt) {
          dispatch({
            type: "SET_AI_SUMMARY_UPDATED_AT",
            payload: systemsResAfter.aiSummaryUpdatedAt,
          });
        }

        const scrollEl = document.querySelector(".flex-1.overflow-y-auto");
        const scrollPos = scrollEl?.scrollTop ?? window.scrollY ?? 0;

        dispatch({
          type: "REFRESH_PROPERTY_AFTER_SAVE",
          payload: {
            ...buildPropertyPayloadFromRefresh(
              refreshed,
              systemsFromBackend ?? [],
              res,
            ),
            maintenanceRecords: maintenanceRecords ?? [],
          },
        });
        dispatch({type: "SET_SYSTEMS", payload: systemsFromBackend ?? []});
        dispatch({type: "SET_FORM_CHANGED", payload: false});
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: true,
            type: "success",
            message: t("propertyUpdatedSuccessfullyMessage"),
          },
        });

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.querySelector(".flex-1.overflow-y-auto");
            if (el) el.scrollTop = scrollPos;
            else if (scrollPos) window.scrollTo(0, scrollPos);
          });
        });
      } else {
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

  const buildNavigationState = (propertyUid) => {
    // Sort by passport_id ascending to match PropertiesList default order
    const sortedProperties = [...properties].sort((a, b) =>
      (a.passport_id || "").localeCompare(b.passport_id || ""),
    );
    const propertyIndex = sortedProperties.findIndex(
      (p) => (p.property_uid ?? p.id) === propertyUid,
    );
    if (propertyIndex === -1) return null;
    return {
      currentIndex: propertyIndex + 1,
      totalItems: sortedProperties.length,
      visiblePropertyIds: sortedProperties.map((p) => p.property_uid ?? p.id),
    };
  };

  // Card shows saved property data only; updates after load or save, not while typing
  const cardData = state.property
    ? mergeFormDataFromTabs(state.property)
    : mergedFormData;

  // HPS score: use backend value when present, otherwise compute from current data so score shows on first load
  const backendScore = cardData.hpsScore ?? cardData.hps_score;
  const hasBackendScore =
    backendScore != null && Number.isFinite(Number(backendScore));
  const displayHpsScore = hasBackendScore
    ? Math.round(Number(backendScore))
    : computeHpsScore(
        state.property ? mergeFormDataFromTabs(state.property) : mergedFormData,
      );

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
        <div className="text-gray-500 dark:text-gray-400">
          Loading property...
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
        propertyId={
          uid !== "new"
            ? (state.property?.identity?.id ?? state.property?.id ?? uid)
            : null
        }
        systems={state.formData.systems}
        onUpdateAgentPermissions={(memberId, permissions) => {
          const next = homeopsTeam.map((m) =>
            String(m.id) === String(memberId)
              ? {...m, permissions: permissions ?? {}}
              : m,
          );
          handleTeamChange(next);
        }}
        onTransferOwnership={(newOwnerId) => {
          const currentUserId = currentUser?.id;
          const next = homeopsTeam.map((m) => {
            if (String(m.id) === String(newOwnerId)) {
              return {...m, property_role: "owner"};
            }
            if (
              currentUserId != null &&
              String(m.id) === String(currentUserId)
            ) {
              return {...m, property_role: "editor"};
            }
            return m;
          });
          handleTeamChange(next);
        }}
        onInvite={async ({
          email: inviteEmail,
          role,
          homeownerInviteType,
          permissions,
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
          const displayRoleMap = {
            agent: "Agent",
            homeowner: "Homeowner",
            insurance: "Insurer",
            mortgage: "Mortgage Partner",
          };
          const displayRole = displayRoleMap[role] ?? "Homeowner";
          const pendingMember = {
            email: inviteEmail,
            name: inviteEmail,
            role: displayRole,
            property_role: intendedRole,
            permissions: permissions ?? {},
            _pending: true,
          };
          if (
            propertyId &&
            currentAccount?.id &&
            typeof AppApi.createInvitation === "function"
          ) {
            const res = await AppApi.createInvitation({
              type: "property",
              inviteeEmail: inviteEmail,
              accountId: currentAccount.id,
              propertyId,
              intendedRole,
            });
            if (res?.invitation?.id) {
              pendingMember.invitationId = res.invitation.id;
            }
            handleTeamChange([...homeopsTeam, pendingMember]);
          } else {
            handleTeamChange([...homeopsTeam, pendingMember]);
          }
        }}
      />
      <SystemsSetupModal
        modalOpen={systemsSetupModalOpen}
        setModalOpen={(open) => {
          if (!open) setSystemsSetupInitialStep(null);
          setSystemsSetupModalOpen(open);
        }}
        initialStep={systemsSetupInitialStep}
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
          dispatch({
            type: "SET_SYSTEMS_FORM_DATA",
            payload: {
              selectedSystemIds: predefinedOnly,
              customSystemNames: names,
              customSystemsData: nextData,
            },
          });
          dispatch({type: "SET_FORM_CHANGED", payload: true});

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
            const newUid = createdPropertyFromModal.property_uid;
            setCreatedPropertyFromModal(null);
            navigate(`/${accountUrl}/properties/${newUid}`, {
              replace: true,
              state: {
                currentIndex: properties.length + 1,
                totalItems: properties.length + 1,
                visiblePropertyIds: [
                  ...properties.map((p) => p.property_uid ?? p.id),
                  newUid,
                ],
              },
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
              await updateSystemsForProperty(numericId, systemsArray);
              const systemsResAfter = await getSystemsByPropertyId(numericId);
              const systemsFromBackend =
                systemsResAfter?.systems ?? systemsResAfter ?? [];
              dispatch({type: "SET_SYSTEMS", payload: systemsFromBackend});
              if (systemsResAfter?.aiSummaryUpdatedAt) {
                dispatch({
                  type: "SET_AI_SUMMARY_UPDATED_AT",
                  payload: systemsResAfter.aiSummaryUpdatedAt,
                });
              }
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
      <div className="flex justify-between items-center mb-4">
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
          <div className="flex items-center gap-3">
            <div className="relative inline-flex">
              <button
                ref={actionsTriggerRef}
                type="button"
                className="btn px-2.5 bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-600 text-neutral-500 dark:text-neutral-400"
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
                    <li>
                      <button
                        type="button"
                        className="w-full flex items-center cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionsDropdownOpen(false);
                          setBlankModalOpen(true);
                        }}
                      >
                        <FileBarChart className="w-5 h-5 shrink-0 text-neutral-500 dark:text-neutral-400" />
                        <span className="text-sm font-medium ml-2">
                          Analyze report
                        </span>
                      </button>
                    </li>
                  </ul>
                </div>
              </Transition>
            </div>
            <button
              className="btn bg-[#456564] hover:bg-[#34514f] text-white transition-colors duration-200 shadow-sm"
              onClick={handleNewProperty}
            >
              {t("new")}
            </button>
          </div>
        )}
      </div>

      {!isInvitationView && (
        <div className="flex justify-between items-center mb-2">
          {/* Analysis and AI Assistant buttons - Left aligned */}
          <div className="flex items-center gap-3 sm:ml-4">
            {uid !== "new" && (
              <>
                <button
                  ref={blankModalButtonRef}
                  type="button"
                  onClick={() => setBlankModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-transparent border border-neutral-200/80 dark:border-neutral-600/50 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-all duration-200"
                  title="Inspection report analysis"
                >
                  <FileCheck className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-semibold">
                    Inspection Analysis
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiSidebarOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-transparent border border-neutral-200/80 dark:border-neutral-600/50 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 hover:border-neutral-300 dark:hover:border-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-all duration-200"
                  title="AI Assistant"
                >
                  <Sparkles className="w-4 h-4 flex-shrink-0 text-[#456564]" />
                  <span className="text-sm font-semibold">AI Assistant</span>
                </button>
              </>
            )}
          </div>

          {/* Property Navigation */}
          <div className="flex items-center">
            {uid &&
              uid !== "new" &&
              (() => {
                // Use location.state if available, otherwise build from properties
                const navState = location.state || buildNavigationState(uid);

                if (!navState) return null;

                return (
                  <>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 mr-2">
                      {navState.currentIndex || 1} / {navState.totalItems || 1}
                    </span>
                    <button
                      className="btn shadow-none p-1"
                      title="Previous"
                      onClick={() => {
                        if (
                          navState.visiblePropertyIds &&
                          navState.currentIndex > 1
                        ) {
                          const prevIndex = navState.currentIndex - 2;
                          const prevPropertyId =
                            navState.visiblePropertyIds[prevIndex];
                          const prevNavState =
                            buildNavigationState(prevPropertyId);
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
                        width="24"
                        height="24"
                        viewBox="0 0 18 18"
                      >
                        <path d="M9.4 13.4l1.4-1.4-4-4 4-4-1.4-1.4L4 8z"></path>
                      </svg>
                    </button>

                    <button
                      className="btn shadow-none p-1"
                      title="Next"
                      onClick={() => {
                        if (
                          navState.visiblePropertyIds &&
                          navState.currentIndex < navState.totalItems
                        ) {
                          const nextIndex = navState.currentIndex;
                          const nextPropertyId =
                            navState.visiblePropertyIds[nextIndex];
                          const nextNavState =
                            buildNavigationState(nextPropertyId);
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
                        width="24"
                        height="24"
                        viewBox="0 0 18 18"
                      >
                        <path d="M6.6 13.4L5.2 12l4-4-4-4 1.4-1.4L12 8z"></path>
                      </svg>
                    </button>
                  </>
                );
              })()}
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* Property Passport Card - clean premium surface */}
        <section
          className="rounded-2xl overflow-hidden border border-neutral-200/80 bg-white dark:border-neutral-700/50 dark:bg-neutral-900"
          style={{
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {/* Brand accent - subtle top glow */}
          <div
            className="h-0.5 w-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(16,185,129,0.08), rgba(16,185,129,0.04), transparent)",
            }}
            aria-hidden
          />

          {/* Hero - clean neutral surface (no background image) */}
          <div className="relative min-h-[280px] lg:min-h-[320px]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100/80 backdrop-blur-sm border border-neutral-200/60 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-neutral-700" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-white tracking-tight mb-0.5 antialiased">
                    Home Passport
                  </h2>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 font-medium tracking-wide">
                    Digital Property Record
                  </p>
                </div>
                {inspectionAnalysis?.conditionRating && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                      inspectionAnalysis.conditionRating === "good"
                        ? "bg-emerald-500/15 text-emerald-700 border border-emerald-400/30"
                        : inspectionAnalysis.conditionRating === "fair"
                          ? "bg-amber-500/15 text-amber-700 border border-amber-400/30"
                          : inspectionAnalysis.conditionRating === "poor"
                            ? "bg-red-500/15 text-red-700 border border-red-400/30"
                            : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                    }`}
                  >
                    {(
                      inspectionAnalysis.conditionRating || ""
                    ).toLowerCase() === "unknown"
                      ? "Not specified"
                      : inspectionAnalysis.conditionRating}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.12em] mb-1 opacity-70">
                    Health Score
                  </div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-white tabular-nums">
                    {displayHpsScore}/100
                  </div>
                </div>
                <div
                  className={`relative ${
                    displayHpsScore >= 70
                      ? "[box-shadow:0_0_20px_rgba(16,185,129,0.22)]"
                      : displayHpsScore >= 40
                        ? "[box-shadow:0_0_20px_rgba(245,158,11,0.22)]"
                        : "[box-shadow:0_0_20px_rgba(239,68,68,0.22)]"
                  } rounded-full`}
                >
                  <CircularProgress
                    percentage={displayHpsScore}
                    size={72}
                    strokeWidth={6}
                    innerTextClass="text-neutral-900 dark:text-white"
                    colorClass={
                      displayHpsScore >= 70
                        ? "text-emerald-500"
                        : displayHpsScore >= 40
                          ? "text-amber-500"
                          : "text-red-500"
                    }
                  />
                </div>
              </div>
            </div>

            {/* Body content */}
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 px-6 pt-6 pb-6">
              {/* Property Image */}
              <div className="w-full lg:w-2/5 flex-shrink-0">
                <div
                  className={`relative h-52 lg:h-72 rounded-xl overflow-hidden border transition-all duration-300 ${
                    heroImageUrl
                      ? "border-neutral-200/80 dark:border-neutral-600/50 bg-neutral-50/50 dark:bg-neutral-800/30 shadow-sm"
                      : "border-2 border-dashed border-neutral-200 dark:border-neutral-600 bg-neutral-50/30 dark:bg-neutral-800/20"
                  }`}
                >
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
                    emptyLabel="Add image"
                    alt={cardData.address || "Property"}
                    uploadLabel="Upload photo"
                    removeLabel="Remove photo"
                    fileInputRef={mainPhotoInputRef}
                    menuOpen={mainPhotoMenuOpen}
                    onMenuToggle={setMainPhotoMenuOpen}
                  />
                </div>
              </div>

              {/* Property Information */}
              <div className="flex-1 space-y-5">
                {/* Property Identity */}
                <div>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-[18px] h-[18px] text-neutral-400" />
                        <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.12em] opacity-70 antialiased">
                          Property Location
                        </span>
                      </div>
                      {cardData.propertyName && (
                        <h1 className="text-2xl md:text-[2rem] lg:text-[2.25rem] font-bold text-neutral-900 dark:text-white mb-1 tracking-tight leading-tight antialiased">
                          {cardData.propertyName}
                        </h1>
                      )}
                      <p
                        className={`${cardData.propertyName ? "text-[15px] text-neutral-600 dark:text-neutral-400 leading-snug opacity-90" : "text-2xl md:text-[2rem] lg:text-[2.25rem] font-bold text-neutral-900 dark:text-white tracking-tight leading-tight antialiased"} leading-tight`}
                      >
                        {cardData.fullAddress ||
                          cardData.address ||
                          [cardData.city, cardData.state, cardData.zip]
                            .filter(Boolean)
                            .join(", ") ||
                          "—"}
                      </p>
                    </div>
                  </div>

                  {/* Passport ID */}
                  <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCheck className="w-[18px] h-[18px] text-neutral-400" />
                      <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.12em] opacity-70 antialiased">
                        Passport ID
                      </span>
                    </div>
                    <p className="text-sm font-mono text-neutral-800 dark:text-neutral-200 font-semibold tabular-nums">
                      {cardData.passportId ?? cardData.passport_id ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Property Specifications */}
                <div className="pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Building className="w-[18px] h-[18px] text-neutral-400" />
                    <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.12em] opacity-70 antialiased">
                      Property Specifications
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Bed className="w-[18px] h-[18px] text-neutral-400 shrink-0" />
                        <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                          {cardData.rooms ?? cardData.bedCount ?? "—"}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-[0.1em] ml-6 opacity-70">
                        Bedrooms
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Bath className="w-[18px] h-[18px] text-neutral-400 shrink-0" />
                        <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                          {cardData.bathrooms ?? cardData.bathCount ?? "—"}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-[0.1em] ml-6 opacity-70">
                        Bathrooms
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Ruler className="w-[18px] h-[18px] text-neutral-400 shrink-0" />
                        <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                          {(cardData.squareFeet ?? cardData.sqFtTotal) != null
                            ? Number(
                                cardData.squareFeet ?? cardData.sqFtTotal,
                              ).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-[0.1em] ml-6 opacity-70">
                        Square Feet
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Calendar className="w-[18px] h-[18px] text-neutral-400 shrink-0" />
                        <span className="text-lg font-bold text-neutral-900 dark:text-white tabular-nums">
                          {cardData.yearBuilt ?? "—"}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-[0.1em] ml-6 opacity-70">
                        Year Built
                      </span>
                    </div>
                  </div>
                </div>

                {/* Property Value */}
                {cardData.price != null && cardData.price !== "" && (
                  <div className="pt-5 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-[0.12em] block mb-0.5 opacity-70 antialiased">
                          Estimated Value
                        </span>
                        <p className="text-xl font-semibold text-neutral-900 dark:text-white tabular-nums">
                          {formatCurrency.format(cardData.price)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* HomeOps Team */}
        <HomeOpsTeam
          teamMembers={homeopsTeam}
          onOpenShareModal={
            isInvitationView
              ? undefined
              : () => {
                  setShareModalInitialTab("owner");
                  setShareModalOpen(true);
                }
          }
          onMemberClick={
            isInvitationView
              ? undefined
              : (tab) => {
                  setShareModalInitialTab(tab);
                  setShareModalOpen(true);
                }
          }
          hideAddButton={isInvitationView}
        />

        {!isInvitationView && (
          <>
            {/* Property Health & Completeness */}
            <section
              data-section-id="health-status"
              className="rounded-2xl overflow-hidden border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 p-5 md:p-6"
              style={{
                boxShadow:
                  "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              <ScoreCard
                propertyData={mergedFormData}
                onCompleteOutstandingTasks={handleCompleteOutstandingTasks}
              />
            </section>

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
              <div className="border-b border-neutral-100 dark:border-neutral-800 px-6">
                <nav className="flex flex-wrap gap-1">
                  {tabs.map((tab) => {
                    const icons = {
                      identity: FileText,
                      systems: Settings,
                      maintenance: Wrench,
                      documents: FileText,
                      media: ImageIcon,
                    };
                    const Icon = icons[tab.id] || FileText;
                    return (
                      <button
                        key={tab.id}
                        onClick={() =>
                          dispatch({type: "SET_ACTIVE_TAB", payload: tab.id})
                        }
                        className={`py-4 px-4 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
                          state.activeTab === tab.id
                            ? "border-[#456564] text-[#456564] dark:text-[#5a7a78] dark:border-[#5a7a78]"
                            : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                        {tab.id === "systems" && state.aiSummaryUpdatedAt && (
                          <span
                            className="ml-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            title={`AI analysis updated ${new Date(state.aiSummaryUpdatedAt).toLocaleDateString()}`}
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
                className={`px-6 pt-6 ${state.formDataChanged || state.isNew ? "pb-6" : "pb-2"}`}
              >
                {state.activeTab === "identity" && (
                  <IdentityTab
                    propertyData={mergedFormData}
                    handleInputChange={handleChange}
                    errors={state.errors}
                    addressInputRef={identityAddressRef}
                    placesLoaded={identityPlacesLoaded}
                    placesError={identityPlacesError}
                    AutocompleteWrapper={IdentityAutocompleteWrapper}
                  />
                )}

                {state.activeTab === "systems" && (
                  <SystemsTab
                    propertyData={mergedFormData}
                    maintenanceRecords={state.formData.maintenanceRecords ?? []}
                    propertyIdFallback={uid !== "new" ? uid : undefined}
                    handleInputChange={handleChange}
                    expandSectionId={expandSectionId}
                    onSilentSystemsUpdate={handleSilentSystemsUpdate}
                    visibleSystemIds={visibleSystemIds}
                    customSystemsData={
                      state.formData.systems?.customSystemsData ?? {}
                    }
                    systems={state.systems}
                    inspectionAnalysis={inspectionAnalysis}
                    maintenanceEvents={maintenanceEvents}
                    onScheduleSuccess={fetchMaintenanceEvents}
                    aiSummaryUpdatedAt={state.aiSummaryUpdatedAt}
                    propertyId={
                      state.property?.id ?? (uid && uid !== "new" ? uid : null)
                    }
                    onOpenInspectionReport={(systemId) => {
                      setInspectionReportSystemId(systemId ?? null);
                      setInspectionReportModalOpen(true);
                    }}
                    aiSidebarOpen={aiSidebarOpen}
                    onAiSidebarOpenChange={setAiSidebarOpen}
                    onOpenAIAssistant={(ctx) => {
                      const obj =
                        typeof ctx === "object" && ctx !== null
                          ? ctx
                          : {systemName: ctx};
                      setAiSidebarSystemLabel(obj.systemName ?? ctx ?? null);
                      setAiSidebarSystemContext(
                        typeof ctx === "object" && ctx !== null ? ctx : null,
                      );
                      setAiSidebarOpen(true);
                    }}
                    aiSidebarSystemLabel={aiSidebarSystemLabel}
                    aiSidebarSystemContext={aiSidebarSystemContext}
                    onSystemsCompletionChange={handleSystemsCompletionChange}
                  />
                )}

                {state.activeTab === "maintenance" && (
                  <MaintenanceTab
                    propertyData={mergedFormData}
                    maintenanceRecords={state.formData.maintenanceRecords ?? []}
                    savedMaintenanceRecords={
                      state.savedMaintenanceRecords ?? []
                    }
                    onMaintenanceRecordsChange={(records) =>
                      dispatch({
                        type: "SET_MAINTENANCE_FORM_DATA",
                        payload: records,
                      })
                    }
                    onMaintenanceRecordAdded={() => {
                      setTimeout(() => {
                        saveBarRef.current?.scrollIntoView?.({
                          behavior: "smooth",
                          block: "nearest",
                        });
                      }, 100);
                    }}
                    contacts={contacts ?? []}
                  />
                )}

                {state.activeTab === "media" && (
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
                        Media Content
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {(state.formData.identity?.photos ?? []).map(
                          (photo, index) => (
                            <div
                              key={photo}
                              className="relative overflow-hidden rounded-xl h-48 bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50"
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
                    </div>
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
                        onOpenAIAssistant={
                          uid !== "new"
                            ? () => setAiSidebarOpen(true)
                            : undefined
                        }
                        onOpenAIReport={
                          uid !== "new"
                            ? () =>
                                requestAnimationFrame(() =>
                                  setBlankModalOpen(true)
                                )
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
              </div>
            </section>

            {/* Save/Cancel bar — direct child of space-y-8 so its sticky parent
             always has content in the viewport regardless of scroll position.
             -mt-8 collapses the space-y gap to visually attach to the section above.
             z-0 keeps it below tooltips (z-10) and popovers (z-50) on Systems tab. */}
            <div
              ref={saveBarRef}
              className={`${
                state.formDataChanged || state.isNew ? "sticky -mt-8" : "hidden"
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
                  className="btn text-white transition-colors duration-200 shadow-sm min-w-[100px] bg-[#456564] hover:bg-[#34514f] flex items-center justify-center gap-2"
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
        >
          <div className="p-6 max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#456564]/15 dark:bg-[#5a7a78]/25 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <div>
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
            <div className="flex gap-3">
              <button
                type="button"
                onClick={async () => {
                  setInvitationError(null);
                  setInvitationAcceptingId(invitationIdFromUrl);
                  try {
                    await AppApi.acceptInvitationInApp(invitationIdFromUrl);
                    setInvitationModalOpen(false);
                    const team = await getPropertyTeam(uid);
                    const raw = team?.property_users ?? [];
                    const enriched = raw.map((m) => {
                      const u = users?.find(
                        (us) =>
                          us && m?.id != null && Number(us.id) === Number(m.id),
                      );
                      return {
                        ...m,
                        role: m.role,
                        property_role: m.property_role ?? "editor",
                        image_url: m.image_url ?? u?.image_url,
                        image: m.image ?? u?.image,
                      };
                    });
                    setHomeopsTeam(enriched);
                    navigate(`/${accountUrl}/properties/${uid}`, {
                      replace: true,
                    });
                  } catch (err) {
                    console.error("Failed to accept invitation:", err);
                    const msg =
                      err?.messages?.[0] ??
                      err?.message ??
                      "Failed to accept invitation.";
                    setInvitationError(
                      typeof msg === "string"
                        ? msg
                        : "Failed to accept invitation.",
                    );
                  } finally {
                    setInvitationAcceptingId(null);
                  }
                }}
                disabled={!!invitationAcceptingId || !!invitationDecliningId}
                className="btn flex-1 bg-[#456564] hover:bg-[#34514f] text-white inline-flex items-center justify-center gap-2"
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
                  setInvitationError(null);
                  setInvitationDecliningId(invitationIdFromUrl);
                  try {
                    await AppApi.declineInvitation(invitationIdFromUrl);
                    setInvitationModalOpen(false);
                    navigate(`/${accountUrl}/properties`);
                  } catch (err) {
                    console.error("Failed to decline invitation:", err);
                    const msg =
                      err?.messages?.[0] ??
                      err?.message ??
                      "Failed to decline invitation.";
                    setInvitationError(
                      typeof msg === "string"
                        ? msg
                        : "Failed to decline invitation.",
                    );
                  } finally {
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

      {/* Inspection Report modal (legacy - for Systems/Documents tabs) */}
      {uid !== "new" && (
        <InspectionReportModal
          isOpen={inspectionReportModalOpen}
          onClose={() => {
            setInspectionReportModalOpen(false);
            setInspectionReportSystemId(null);
          }}
          analysis={inspectionAnalysis}
          systemId={inspectionReportSystemId}
          systemLabel={
            inspectionReportSystemId
              ? (PROPERTY_SYSTEMS.find((s) => s.id === inspectionReportSystemId)
                ?.name ??
                (inspectionReportSystemId.startsWith("custom-")
                  ? inspectionReportSystemId.replace(/^custom-(.+?)-\d+$/, "$1") || inspectionReportSystemId
                  : inspectionReportSystemId))
              : null
          }
          onChatWithAI={() => {
            const sysLabel = inspectionReportSystemId
              ? (PROPERTY_SYSTEMS.find((s) => s.id === inspectionReportSystemId)
                ?.name ??
                (inspectionReportSystemId.startsWith("custom-")
                  ? inspectionReportSystemId.replace(/^custom-(.+?)-\d+$/, "$1") || inspectionReportSystemId
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
            setAiSidebarOpen(true);
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
        contentClassName="max-w-5xl min-h-[60vh]"
        ignoreClickRef={blankModalButtonRef}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-700">
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Inspection Report Analysis
          </span>
          <button
            type="button"
            onClick={() => setBlankModalOpen(false)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <InspectionAnalysisModalContent
          propertyId={
            uid !== "new"
              ? (state.property?.identity?.id ?? state.property?.id ?? uid)
              : null
          }
          isOpen={blankModalOpen}
          onScheduleMaintenance={(prefill) => {
            setScheduleFromAiPrefill(prefill);
            setScheduleFromAiModalOpen(true);
            setBlankModalOpen(false);
          }}
          onTierRestriction={(message) => {
            setUpgradePromptTitle("Upgrade your plan");
            setUpgradePromptMsg(
              message ||
              "You've used all your AI tokens for this month. Upgrade your plan for more."
            );
            setUpgradePromptOpen(true);
          }}
          onUploadReport={
            uid !== "new"
              ? () => {
                  setBlankModalOpen(false);
                  dispatch({type: "SET_ACTIVE_TAB", payload: "documents"});
                  setDocumentsUploadModalRequested(true);
                }
              : undefined
          }
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
          propertySystems={[
            ...PROPERTY_SYSTEMS.filter((s) =>
              (state.formData.systems?.selectedSystemIds?.length
                ? state.formData.systems.selectedSystemIds
                : DEFAULT_SYSTEM_IDS
              ).includes(s.id)
            ),
            ...(state.formData.systems?.customSystemNames ?? []).map((name, i) => ({
              id: `custom-${name}-${i}`,
              name,
            })),
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
      />

      {/* Floating AI Assistant button - bottom right */}
      {uid && uid !== "new" && (
        <button
          type="button"
          onClick={() => setAiSidebarOpen(true)}
          className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-[#456564] hover:bg-[#34514f] text-white shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#456564] focus:ring-offset-2"
          title="AI Assistant"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

export default PropertyFormContainer;
