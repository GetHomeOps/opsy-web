import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useContext,
} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Loader2, Sparkles} from "lucide-react";

import PaginationClassic from "../../components/PaginationClassic";
import SearchInput from "../../components/SearchInput";
import DataTable from "../../components/DataTable";
import DataTableItem from "../../components/DataTableItem";
import ModalBlank from "../../components/ModalBlank";
import Banner from "../../partials/containers/Banner";
import ListDropdown from "../../partials/buttons/ListDropdown";
import FilterDropdown from "../../components/FilterDropdown";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import useAddPropertyWithLimitCheck from "../../hooks/useAddPropertyWithLimitCheck";
import useDemoFeatureGate from "../../hooks/useDemoFeatureGate";
import DemoFeatureUnavailableModal from "../../components/DemoFeatureUnavailableModal";
import propertyContext from "../../context/PropertyContext";
import {useAuth} from "../../context/AuthContext";
import AppApi, {getApiErrorMessage} from "../../api/api";
import UpgradePrompt from "../../components/UpgradePrompt";
import BulkInviteModal from "./partials/BulkInviteModal";
import SendPendingInvitationsModal from "./partials/SendPendingInvitationsModal";
import homePlaceholder from "../../images/home_placeholder.png";
import usePersistListUiSession, {
  HYDRATE_LIST_UI,
} from "../../hooks/usePersistListUiSession";
import {getPropertyStreetLine} from "./helpers/preparePropertyValues";
import {buildPropertyDetailPath} from "./helpers/pendingInvitation";
import {
  INVITED_USER_FILTER_TYPE,
  buildInvitedUserFilterData,
  propertyMatchesInvitedUserFilter,
} from "./helpers/invitedUserFilter";
import PendingInvitationBadge from "./partials/PendingInvitationBadge";
import {
  HOMEAVERSARY_FILTER_TYPE,
  formatSaleDate,
  matchesHomeaversaryFilter,
  propertyLastSaleDate,
  saleDateSortValue,
} from "./helpers/homeaversaryFilter";
import HomeaversaryFilterPanel from "./partials/HomeaversaryFilterPanel";

const PAGE_STORAGE_KEY = "properties_list_page";

const FILTER_CATEGORIES = [
  {type: "city", labelKey: "city"},
  {type: "state", labelKey: "state"},
  {type: "owner", labelKey: "owner"},
  {type: "agent", labelKey: "agent"},
  {type: "agency", labelKey: "agency"},
  {type: "invitationStatus", labelKey: "invitationStatus"},
  {type: INVITED_USER_FILTER_TYPE, labelKey: INVITED_USER_FILTER_TYPE},
  {type: "health", labelKey: "healthStatus"},
  {type: "agentAssignment", labelKey: "filterAgentAssignment"},
];

const HOMEAVERSARY_CATEGORY = {
  type: HOMEAVERSARY_FILTER_TYPE,
  labelKey: "homeaversary",
};

const CHIP_FILTER_CATEGORIES = [...FILTER_CATEGORIES, HOMEAVERSARY_CATEGORY];

const HEALTH_RANGES = [
  {value: "healthy", labelKey: "healthy", min: 75, max: 100, color: "#22c55e"},
  {value: "moderate", labelKey: "moderate", min: 40, max: 74, color: "#eab308"},
  {value: "at_risk", labelKey: "atRisk", min: 25, max: 39, color: "#f97316"},
  {value: "critical", labelKey: "critical", min: 0, max: 24, color: "#ef4444"},
];

const AGENT_ASSIGNMENT_FILTERS = [
  {value: "with_agent", labelKey: "filterWithAgentAssigned"},
  {value: "without_agent", labelKey: "filterWithoutAgent"},
];

const INVITATION_STATUS_FILTERS = [
  {value: "pending", labelKey: "invitationPending"},
  {value: "accepted", labelKey: "invitationAccepted"},
  {value: "none", labelKey: "invitationNone"},
];

const INVITATION_STATUS_SORT_RANK = {pending: 2, accepted: 1, none: 0};

/** Opsy list payload includes has_opsy_agent when the team has a platform role=`agent` user.
 *  admin/super_admin (HomeOps internal users) don't count as the property's agent. */
function propertyHasOpsyAgent(property) {
  return (
    property?.has_opsy_agent === true || property?.hasOpsyAgent === true
  );
}

function getPropertyInvitationStatus(property) {
  if (property?._pendingInvitation === true) return "pending";
  const raw = property?.invitation_status ?? property?.invitationStatus;
  if (raw === "pending" || raw === "accepted") return raw;
  return "none";
}

/** Sort values aligned with table column render fallbacks (snake_case + camelCase). */
function getPropertyColumnSortValue(property, key) {
  if (!property || typeof property !== "object") return "";
  switch (key) {
    case "property_name":
      return (
        property.property_name ??
        property.propertyName ??
        property.nickname ??
        ""
      );
    case "address":
      return getPropertyStreetLine(property);
    case "owner_user_name":
      return property.owner_user_name ?? property.ownerUserName ?? "";
    case "agent_user_name":
      return property.agent_user_name ?? property.agentUserName ?? "";
    case "agency_name":
      return property.agency_name ?? property.agencyName ?? "";
    case "health":
      return property.health ?? property.hps_score ?? property.hpsScore ?? 0;
    case "invitation_status":
      return INVITATION_STATUS_SORT_RANK[getPropertyInvitationStatus(property)] ?? 0;
    case "last_sale_date":
      return saleDateSortValue(propertyLastSaleDate(property));
    default:
      return property[key] ?? "";
  }
}

function comparePropertyRowsForSort(a, b, {key, direction}) {
  const multiplier = direction === "asc" ? 1 : -1;
  const rawA = getPropertyColumnSortValue(a, key);
  const rawB = getPropertyColumnSortValue(b, key);

  let cmp = 0;
  if (key === "last_sale_date") {
    const strA = String(rawA).trim();
    const strB = String(rawB).trim();
    if (!strA && !strB) {
      cmp = 0;
    } else if (!strA) {
      return 1;
    } else if (!strB) {
      return -1;
    } else {
      cmp = strA.localeCompare(strB);
    }
  } else if (key === "health" || key === "invitation_status") {
    const numA = Number(rawA);
    const numB = Number(rawB);
    if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) {
      cmp = numA < numB ? -1 : 1;
    }
  } else {
    const strA = String(rawA).trim().toLowerCase();
    const strB = String(rawB).trim().toLowerCase();
    cmp = strA.localeCompare(strB);
  }

  if (cmp !== 0) return cmp * multiplier;

  const tieA = String(a.passport_id ?? a.passportId ?? "");
  const tieB = String(b.passport_id ?? b.passportId ?? "");
  return tieA.localeCompare(tieB) * multiplier;
}

const initialState = {
  currentPage: 1,
  itemsPerPage: 10,
  searchTerm: "",
  activeFilters: [],
  sidebarOpen: false,
  isSubmitting: false,
  dangerModalOpen: false,
  bannerOpen: false,
  bannerType: "success",
  bannerMessage: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET_CURRENT_PAGE":
      return {...state, currentPage: action.payload};
    case "SET_ITEMS_PER_PAGE":
      return {...state, itemsPerPage: action.payload};
    case "SET_SEARCH_TERM":
      return {...state, searchTerm: action.payload};
    case "ADD_FILTER": {
      const exists = state.activeFilters.some(
        (f) =>
          f.type === action.payload.type && f.value === action.payload.value,
      );
      if (exists) return state;
      return {
        ...state,
        activeFilters: [...state.activeFilters, action.payload],
        currentPage: 1,
      };
    }
    case "REMOVE_FILTER":
      return {
        ...state,
        activeFilters: state.activeFilters.filter(
          (f) =>
            !(
              f.type === action.payload.type && f.value === action.payload.value
            ),
        ),
        currentPage: 1,
      };
    case "REPLACE_FILTER_TYPE": {
      const next = action.payload;
      if (!next?.type) return state;
      return {
        ...state,
        activeFilters: [
          ...state.activeFilters.filter((f) => f.type !== next.type),
          next,
        ],
        currentPage: 1,
      };
    }
    case "REMOVE_FILTERS_OF_TYPE":
      return {
        ...state,
        activeFilters: state.activeFilters.filter(
          (f) => f.type !== action.payload,
        ),
        currentPage: 1,
      };
    case "CLEAR_FILTERS":
      return {...state, activeFilters: [], currentPage: 1};
    case "SET_ACTIVE_FILTERS":
      return {
        ...state,
        activeFilters: Array.isArray(action.payload) ? action.payload : [],
        currentPage: 1,
      };
    case "SET_SIDEBAR_OPEN":
      return {...state, sidebarOpen: action.payload};
    case "SET_SUBMITTING":
      return {...state, isSubmitting: action.payload};
    case "SET_DANGER_MODAL":
      return {...state, dangerModalOpen: action.payload};
    case "SET_BANNER":
      return {
        ...state,
        bannerOpen: action.payload.open,
        bannerType: action.payload.type,
        bannerMessage: action.payload.message,
      };
    case HYDRATE_LIST_UI: {
      const p = action.payload || {};
      const next = {...state};
      if (typeof p.searchTerm === "string") next.searchTerm = p.searchTerm;
      if (Array.isArray(p.activeFilters)) next.activeFilters = p.activeFilters;
      if (Number.isFinite(Number(p.itemsPerPage)))
        next.itemsPerPage = Number(p.itemsPerPage);
      if (Number.isFinite(Number(p.currentPage)))
        next.currentPage = Number(p.currentPage);
      return next;
    }
    default:
      return state;
  }
}

/* ─── Shared tiny components ─────────────────────────────────── */

const HEALTH_BAR_GREEN = "#16a34a"; /* darker green for pill and health bars */

const getHealthColor = (value) => {
  if (value >= 75) return "#22c55e";
  if (value >= 40) return "#eab308";
  if (value >= 25) return "#f97316";
  return "#ef4444";
};

const HealthBar = ({value}) => (
  <div className="flex items-center gap-3">
    <div className="w-32 h-2 rounded-full bg-gray-200 dark:bg-gray-700/60">
      <div
        className="h-2 rounded-full transition-all duration-300"
        style={{width: `${value}%`, backgroundColor: HEALTH_BAR_GREEN}}
      />
    </div>
    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
      {value}%
    </span>
  </div>
);

/* ─── Property Grid Card ─────────────────────────────────────── */

const PropertyCard = ({
  property,
  onClick,
  isSelected,
  onSelect,
  getMainPhotoUrl,
  t,
  onOpenAIAssistant,
}) => {
  const isPending = property._pendingInvitation;
  const health =
    property.health ?? property.hps_score ?? property.hpsScore ?? 0;
  const resolved = getMainPhotoUrl?.(property);
  const photoUrl =
    resolved || property.main_photo_url || property.mainPhotoUrl || null;

  return (
    <>

    <div
      role="button"
      tabIndex={0}
      onClick={() => onClick(property)}
      onKeyDown={(e) => e.key === "Enter" && onClick(property)}
      className={`group bg-white dark:bg-gray-800 rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-all cursor-pointer ${
        isPending
          ? "border-amber-300 dark:border-amber-500/50 ring-1 ring-amber-200 dark:ring-amber-500/20"
          : "border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <div className="relative aspect-[16/10] bg-gray-100 dark:bg-gray-700/40 overflow-hidden">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isPending ? "opacity-75" : ""}`}
          />
        ) : (
          <img
            src={homePlaceholder}
            alt=""
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isPending ? "opacity-75" : ""}`}
          />
        )}
        {!isPending && (
          <div
            className="absolute top-2.5 left-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="inline-flex">
              <span className="sr-only">Select</span>
              <input
                type="checkbox"
                className="form-checkbox rounded"
                checked={isSelected}
                onChange={() => onSelect(property.id)}
              />
            </label>
          </div>
        )}
        {isPending && (
          <div className="absolute top-2.5 left-2.5">
            <PendingInvitationBadge
              label={t("pendingInvitation", {defaultValue: "Pending Invitation"})}
            />
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
          {!isPending && onOpenAIAssistant && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAIAssistant(property);
              }}
              className="p-1.5 rounded-full bg-white/90 hover:bg-white text-[#456564] shadow-sm transition-colors"
              title="Opsy Assistant"
              aria-label="Open Opsy Assistant"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
          {!isPending && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{backgroundColor: HEALTH_BAR_GREEN}}
            >
              {health}%
            </span>
          )}
        </div>
      </div>
      <div className="p-3.5">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
          {property.property_name ||
            property.propertyName ||
            property.nickname ||
            property.address ||
            property.passport_id ||
            t("property")}
        </div>
        {property.passport_id && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {property.passport_id}
          </div>
        )}
        {(property.address || property.city) && (
          <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
            <svg
              className="w-3 h-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="truncate">
              {[property.address, property.city, property.state]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}
      </div>
    </div>
  
    </>
  );
};

/* ─── Main Component ─────────────────────────────────────────── */

function PropertiesList() {
  const navigate = useNavigate();
  const location = useLocation();
  const {t} = useTranslation();
  const {currentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const canImportProperties = ["super_admin", "admin"].includes(
    currentUser?.role,
  );
  const canFilterHomeaversary =
    Boolean(currentUser?.role) && currentUser.role !== "homeowner";
  const [propertyLimitUpgradeOpen, setPropertyLimitUpgradeOpen] =
    useState(false);
  const [propertyLimitMessage, setPropertyLimitMessage] = useState("");
  const {handleAddProperty, isChecking: addPropertyChecking} =
    useAddPropertyWithLimitCheck({
      accountId: currentAccount?.id,
      accountUrl,
      onLimitReached: () => setPropertyLimitUpgradeOpen(true),
    });
  const aiDemoGate = useDemoFeatureGate("ai");
  /* Surface the upgrade prompt when redirected here because the new-property
   * flow hit the plan limit (otherwise the redirect looks like a silent reload). */
  useEffect(() => {
    if (!location.state?.propertyLimitReached) return;
    setPropertyLimitMessage(location.state.propertyLimitMessage || "");
    setPropertyLimitUpgradeOpen(true);
    const {
      propertyLimitReached: _ignored,
      propertyLimitMessage: _ignoredMsg,
      ...rest
    } = location.state;
    navigate(location.pathname, {replace: true, state: rest});
  }, [location.state, location.pathname, navigate]);
  const [selectedProperties, setSelectedProperties] = useState([]);
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [sendPendingInvitesOpen, setSendPendingInvitesOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "passport_id",
    direction: "asc",
  });

  const [state, dispatch] = useReducer(reducer, initialState, (baseState) => ({
    ...baseState,
    currentPage:
      Number(localStorage.getItem(PAGE_STORAGE_KEY)) || baseState.currentPage,
  }));

  const {
    properties,
    propertiesLoading,
    setProperties,
    refreshProperties,
    viewMode,
    setViewMode,
    deleteProperty,
  } = useContext(propertyContext);

  const [uidScopeOverride, setUidScopeOverride] = useState(() => {
    const uids = location.state?.filterPropertyUids;
    return Array.isArray(uids) && uids.length > 0 ? uids : null;
  });
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [invitationsStatus, setInvitationsStatus] = useState("idle");

  const profileAgentUidFilter = useMemo(() => {
    const uids = uidScopeOverride ?? location.state?.filterPropertyUids;
    if (!Array.isArray(uids) || uids.length === 0) return null;
    return new Set(uids.map((u) => String(u)));
  }, [uidScopeOverride, location.state?.filterPropertyUids]);

  const filterPropertyMessage = location.state?.filterPropertyMessage;
  const hasInvitedUserFilter = state.activeFilters.some(
    (f) => f.type === INVITED_USER_FILTER_TYPE,
  );

  const listScopeId = accountUrl ? `properties:${accountUrl}` : "";
  usePersistListUiSession(listScopeId, {
    dispatch,
    searchTerm: state.searchTerm,
    activeFilters: state.activeFilters,
    itemsPerPage: state.itemsPerPage,
    currentPage: state.currentPage,
    sortConfig,
    setSortConfig,
  });

  const clearUidScope = useCallback(() => {
    setUidScopeOverride(null);
    if (
      !location.state?.filterPropertyUids &&
      !location.state?.filterPropertyMessage
    ) {
      return;
    }
    const {
      filterPropertyUids: _ignoredUids,
      filterPropertyMessage: _ignoredMessage,
      ...rest
    } = location.state || {};
    navigate(location.pathname, {replace: true, state: rest});
  }, [location.pathname, location.state, navigate]);

  useLayoutEffect(() => {
    const incoming = location.state?.applyFilters;
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    dispatch({type: "SET_ACTIVE_FILTERS", payload: incoming});
    const {applyFilters: _ignored, ...rest} = location.state;
    navigate(location.pathname, {replace: true, state: rest});
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    const accountId = currentAccount?.id;
    if (!accountId) {
      setPendingInvitations([]);
      setInvitationsStatus("idle");
      return undefined;
    }
    let cancelled = false;
    setInvitationsStatus("loading");
    AppApi.getAccountInvitations(accountId, {status: "pending"})
      .then((list) => {
        if (cancelled) return;
        setPendingInvitations(Array.isArray(list) ? list : []);
        setInvitationsStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPendingInvitations([]);
        setInvitationsStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [currentAccount?.id]);

  const invitedUserFilterData = useMemo(
    () => buildInvitedUserFilterData(pendingInvitations),
    [pendingInvitations],
  );

  useEffect(() => {
    if (invitationsStatus !== "ready") return;
    const invitedEmails = state.activeFilters
      .filter((f) => f.type === INVITED_USER_FILTER_TYPE)
      .map((f) => String(f.value || "").trim().toLowerCase())
      .filter(Boolean);
    if (invitedEmails.length === 0) return;
    const mapReady = invitedEmails.every((email) =>
      invitedUserFilterData.uidsByEmail.has(email),
    );
    if (!mapReady) return;
    if (!uidScopeOverride && !location.state?.filterPropertyUids) return;
    clearUidScope();
  }, [
    invitationsStatus,
    state.activeFilters,
    invitedUserFilterData.uidsByEmail,
    uidScopeOverride,
    location.state?.filterPropertyUids,
    clearUidScope,
  ]);

  useEffect(() => {
    if (currentUser?.role !== "homeowner") return;
    if (
      !state.activeFilters.some((f) => f.type === HOMEAVERSARY_FILTER_TYPE)
    ) {
      return;
    }
    dispatch({
      type: "REMOVE_FILTERS_OF_TYPE",
      payload: HOMEAVERSARY_FILTER_TYPE,
    });
  }, [currentUser?.role, state.activeFilters]);

  /* ─── Derive filter options from data ──────────────────────── */

  const uniqueCities = useMemo(() => {
    const cities = [
      ...new Set(properties.map((p) => (p.city || "").trim()).filter(Boolean)),
    ];
    return cities.sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const uniqueStates = useMemo(() => {
    const states = [
      ...new Set(properties.map((p) => (p.state || "").trim()).filter(Boolean)),
    ];
    return states.sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const uniqueOwners = useMemo(() => {
    const owners = [
      ...new Set(
        properties
          .map((p) => (p.owner_user_name ?? p.ownerUserName ?? "").trim())
          .filter(Boolean),
      ),
    ];
    return owners.sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const uniqueAgents = useMemo(() => {
    const agents = [
      ...new Set(
        properties
          .map((p) => (p.agent_user_name ?? p.agentUserName ?? "").trim())
          .filter(Boolean),
      ),
    ];
    return agents.sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const uniqueAgencies = useMemo(() => {
    const agencies = [
      ...new Set(
        properties
          .map((p) => (p.agency_name ?? p.agencyName ?? "").trim())
          .filter(Boolean),
      ),
    ];
    return agencies.sort((a, b) => a.localeCompare(b));
  }, [properties]);

  const filterOptions = useMemo(
    () => ({
      city: uniqueCities.map((c) => ({value: c, label: c})),
      state: uniqueStates.map((s) => ({value: s, label: s})),
      owner: uniqueOwners.map((o) => ({value: o, label: o})),
      agent: uniqueAgents.map((a) => ({value: a, label: a})),
      agency: uniqueAgencies.map((a) => ({value: a, label: a})),
      health: HEALTH_RANGES.map((h) => ({
        value: h.value,
        label: t(h.labelKey),
        dot: h.color,
      })),
      agentAssignment: AGENT_ASSIGNMENT_FILTERS.map((a) => ({
        value: a.value,
        label: t(a.labelKey),
      })),
      invitationStatus: INVITATION_STATUS_FILTERS.map((a) => ({
        value: a.value,
        label: t(a.labelKey),
      })),
      [INVITED_USER_FILTER_TYPE]: invitedUserFilterData.options,
    }),
    [
      uniqueCities,
      uniqueStates,
      uniqueOwners,
      uniqueAgents,
      uniqueAgencies,
      invitedUserFilterData.options,
      t,
    ],
  );

  const filterCategories = useMemo(
    () =>
      canFilterHomeaversary
        ? [...FILTER_CATEGORIES, HOMEAVERSARY_CATEGORY]
        : FILTER_CATEGORIES,
    [canFilterHomeaversary],
  );

  const customCategoryPanels = useMemo(() => {
    if (!canFilterHomeaversary) return undefined;
    return {
      [HOMEAVERSARY_FILTER_TYPE]: ({activeFilters: filters, t: translate, close}) => (
        <HomeaversaryFilterPanel
          activeFilters={filters}
          t={translate}
          onSelect={(filter) => {
            dispatch({type: "REPLACE_FILTER_TYPE", payload: filter});
            close();
          }}
        />
      ),
    };
  }, [canFilterHomeaversary]);

  /* ─── Presigned photo URLs ─────────────────────────────────── */

  const [presignedUrls, setPresignedUrls] = useState({});
  const fetchedKeysRef = useRef(new Set());

  useEffect(() => {
    if (!properties?.length) return;
    properties.forEach((prop) => {
      const backendUrl = prop.main_photo_url || prop.mainPhotoUrl;
      if (backendUrl) return;
      const key = prop.main_photo || prop.mainPhoto;
      if (
        !key ||
        key.startsWith("http") ||
        key.startsWith("blob:") ||
        fetchedKeysRef.current.has(key)
      )
        return;
      fetchedKeysRef.current.add(key);
      AppApi.getPresignedPreviewUrl(key)
        .then((url) => {
          setPresignedUrls((prev) => ({...prev, [key]: url}));
        })
        .catch(() => {
          fetchedKeysRef.current.delete(key);
        });
    });
  }, [properties]);

  const getMainPhotoUrl = useCallback(
    (property) => {
      if (!property) return null;
      const backendUrl = property.main_photo_url || property.mainPhotoUrl;
      if (backendUrl) return backendUrl;
      const key = property.main_photo || property.mainPhoto;
      if (!key) return null;
      if (key.startsWith("http") || key.startsWith("blob:")) return key;
      return presignedUrls[key] ?? null;
    },
    [presignedUrls],
  );

  /* ─── Data fetch / lifecycle ───────────────────────────────── */

  useEffect(() => {
    refreshProperties?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(PAGE_STORAGE_KEY, state.currentPage);
  }, [state.currentPage]);

  useEffect(() => {
    if (state.bannerOpen) {
      const timer = setTimeout(() => {
        dispatch({
          type: "SET_BANNER",
          payload: {
            open: false,
            type: state.bannerType,
            message: state.bannerMessage,
          },
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.bannerOpen, state.bannerType, state.bannerMessage]);

  /* ─── Filtering (Odoo-style: OR within same type, AND across types) */

  const filteredProperties = useMemo(() => {
    const filtersByType = {};
    state.activeFilters.forEach((f) => {
      if (!filtersByType[f.type]) filtersByType[f.type] = [];
      filtersByType[f.type].push(f.value);
    });

    const baseList =
      profileAgentUidFilter && profileAgentUidFilter.size > 0
        ? properties.filter((property) => {
            const uid = String(
              property.property_uid ??
                property.propertyUid ??
                property.id ??
                "",
            );
            return profileAgentUidFilter.has(uid);
          })
        : properties;

    return baseList.filter((property) => {
      const term = (state.searchTerm || "").toLowerCase();
      if (term) {
        const matchesSearch =
          (property.passport_id || "").toLowerCase().includes(term) ||
          (property.property_name || property.propertyName || property.nickname || "")
            .toLowerCase()
            .includes(term) ||
          (property.address || "").toLowerCase().includes(term) ||
          (property.city || "").toLowerCase().includes(term) ||
          (property.state || "").toLowerCase().includes(term);
        if (!matchesSearch) return false;
      }

      if (filtersByType.city) {
        const city = (property.city || "").trim();
        if (!filtersByType.city.includes(city)) return false;
      }

      if (filtersByType.state) {
        const st = (property.state || "").trim();
        if (!filtersByType.state.includes(st)) return false;
      }

      if (filtersByType.owner) {
        const owner = (
          property.owner_user_name ??
          property.ownerUserName ??
          ""
        ).trim();
        if (!filtersByType.owner.includes(owner)) return false;
      }

      if (filtersByType.agent) {
        const agent = (
          property.agent_user_name ??
          property.agentUserName ??
          ""
        ).trim();
        if (!filtersByType.agent.includes(agent)) return false;
      }

      if (filtersByType.agency) {
        const agency = (
          property.agency_name ??
          property.agencyName ??
          ""
        ).trim();
        if (!filtersByType.agency.includes(agency)) return false;
      }

      if (filtersByType.health) {
        const health =
          property.health ?? property.hps_score ?? property.hpsScore ?? 0;
        const matchesAny = filtersByType.health.some((hv) => {
          const range = HEALTH_RANGES.find((r) => r.value === hv);
          return range && health >= range.min && health <= range.max;
        });
        if (!matchesAny) return false;
      }

      if (filtersByType.agentAssignment) {
        const hasAgent = propertyHasOpsyAgent(property);
        const matchesAny = filtersByType.agentAssignment.some((hv) => {
          if (hv === "with_agent") return hasAgent;
          if (hv === "without_agent") return !hasAgent;
          return false;
        });
        if (!matchesAny) return false;
      }

      if (filtersByType.invitationStatus) {
        const status = getPropertyInvitationStatus(property);
        if (!filtersByType.invitationStatus.includes(status)) return false;
      }

      if (filtersByType[INVITED_USER_FILTER_TYPE]) {
        const invitedEmails = filtersByType[INVITED_USER_FILTER_TYPE];
        const mapReady =
          invitationsStatus === "ready" &&
          invitedEmails.every((email) =>
            invitedUserFilterData.uidsByEmail.has(
              String(email || "").trim().toLowerCase(),
            ),
          );
        if (
          mapReady &&
          !propertyMatchesInvitedUserFilter(
            property,
            invitedEmails,
            invitedUserFilterData.uidsByEmail,
          )
        ) {
          return false;
        }
      }

      if (filtersByType[HOMEAVERSARY_FILTER_TYPE]) {
        if (
          !matchesHomeaversaryFilter(
            propertyLastSaleDate(property),
            filtersByType[HOMEAVERSARY_FILTER_TYPE],
          )
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    properties,
    state.searchTerm,
    state.activeFilters,
    profileAgentUidFilter,
    invitationsStatus,
    invitedUserFilterData.uidsByEmail,
  ]);

  const sortedProperties = useMemo(() => {
    const sortable = [...filteredProperties];
    sortable.sort((a, b) => comparePropertyRowsForSort(a, b, sortConfig));
    return sortable;
  }, [filteredProperties, sortConfig]);

  const paginatedProperties = useMemo(() => {
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    return sortedProperties.slice(startIndex, startIndex + state.itemsPerPage);
  }, [sortedProperties, state.currentPage, state.itemsPerPage]);

  useEffect(() => {
    if (sortedProperties.length === 0) return;
    const lastValidPage = Math.max(
      1,
      Math.ceil(sortedProperties.length / state.itemsPerPage),
    );
    if (state.currentPage > lastValidPage) {
      dispatch({type: "SET_CURRENT_PAGE", payload: 1});
    }
  }, [sortedProperties.length, state.itemsPerPage, state.currentPage]);

  /* ─── Grid view: use grid-specific page sizes (8,12,16,24), default 12 ─ */
  const GRID_PAGE_SIZE_OPTIONS = [8, 12, 16, 24];
  const LIST_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

  useEffect(() => {
    const opts =
      viewMode === "grid" ? GRID_PAGE_SIZE_OPTIONS : LIST_PAGE_SIZE_OPTIONS;
    if (!opts.includes(state.itemsPerPage)) {
      const fallback = viewMode === "grid" ? 12 : 10;
      dispatch({type: "SET_ITEMS_PER_PAGE", payload: fallback});
      dispatch({type: "SET_CURRENT_PAGE", payload: 1});
    }
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Handlers ─────────────────────────────────────────────── */

  const handleSearchChange = (event) => {
    dispatch({type: "SET_SEARCH_TERM", payload: event.target.value});
    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
  };

  const handleRemoveFilter = (filter) => {
    dispatch({type: "REMOVE_FILTER", payload: filter});
    if (filter?.type !== INVITED_USER_FILTER_TYPE) return;
    const stillHasInvitedUser = state.activeFilters.some(
      (f) =>
        f.type === INVITED_USER_FILTER_TYPE &&
        !(f.type === filter.type && f.value === filter.value),
    );
    if (!stillHasInvitedUser) clearUidScope();
  };

  const handleClearFilters = () => {
    dispatch({type: "CLEAR_FILTERS"});
    clearUidScope();
  };

  const listLoading =
    propertiesLoading ||
    (hasInvitedUserFilter &&
      invitationsStatus !== "ready" &&
      invitationsStatus !== "error" &&
      !profileAgentUidFilter);

  const handleItemsPerPageChange = (value) => {
    dispatch({type: "SET_ITEMS_PER_PAGE", payload: Number(value)});
    dispatch({type: "SET_CURRENT_PAGE", payload: 1});
  };

  const handlePageChange = (page) => {
    dispatch({type: "SET_CURRENT_PAGE", payload: page});
  };

  const handleNewProperty = () => handleAddProperty();
  const handleOpenAIAssistant = (property) => {
    if (aiDemoGate.blocked) {
      aiDemoGate.showModal();
      return;
    }
    const uid = property.property_uid ?? property.id;
    const propertyIndex = sortedProperties.findIndex(
      (p) => (p.property_uid ?? p.id) === uid,
    );
    navigate(buildPropertyDetailPath(accountUrl, property, uid), {
      state: {
        openAiSidebar: true,
        currentIndex: propertyIndex + 1,
        totalItems: sortedProperties.length,
        visiblePropertyIds: sortedProperties.map((p) => p.property_uid ?? p.id),
        property,
      },
    });
  };
  const handlePropertyClick = (property) => {
    const propertyIndex = sortedProperties.findIndex(
      (p) => (p.property_uid ?? p.id) === property.property_uid,
    );
    navigate(buildPropertyDetailPath(accountUrl, property), {
      state: {
        currentIndex: propertyIndex + 1,
        totalItems: sortedProperties.length,
        visiblePropertyIds: sortedProperties.map((p) => p.property_uid ?? p.id),
        property,
      },
    });
  };

  const handleSort = (columnKey) => {
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return {key: columnKey, direction: "asc"};
    });
  };

  const handleToggleSelect = (ids, shouldSelect = null) => {
    if (Array.isArray(ids)) {
      if (shouldSelect) {
        const merged = new Set(selectedProperties);
        ids.forEach((id) => merged.add(id));
        setSelectedProperties(Array.from(merged));
      } else {
        setSelectedProperties((prev) => prev.filter((id) => !ids.includes(id)));
      }
      return;
    }
    setSelectedProperties((prev) =>
      prev.includes(ids) ? prev.filter((id) => id !== ids) : [...prev, ids],
    );
  };

  /* ─── Table config ─────────────────────────────────────────── */

  const columns = [
    {key: "passport_id", label: "Passport ID", sortable: true},
    {
      key: "property_name",
      label: "Property Name",
      sortable: true,
      render: (value, item) =>
        value ?? item?.propertyName ?? item?.nickname ?? "—",
    },
    {
      key: "address",
      label: "address",
      sortable: true,
      render: (_value, item) => getPropertyStreetLine(item) || "—",
    },
    {key: "city", label: "city", sortable: true},
    {key: "state", label: "state", sortable: true},
    {
      key: "last_sale_date",
      label: "homeaversary",
      sortable: true,
      render: (_value, item) =>
        formatSaleDate(propertyLastSaleDate(item)) || "—",
    },
    {
      key: "owner_user_name",
      label: "owner",
      sortable: true,
      render: (value, item) => value ?? item?.ownerUserName ?? "—",
    },
    {
      key: "agent_user_name",
      label: "agent",
      sortable: true,
      render: (value, item) => value ?? item?.agentUserName ?? "—",
    },
    {
      key: "agency_name",
      label: "agency",
      sortable: true,
      render: (value, item) => value ?? item?.agencyName ?? "—",
    },
    {
      key: "invitation_status",
      label: "invitationStatus",
      sortable: true,
      render: (_value, item) => {
        const status = getPropertyInvitationStatus(item);
        if (status === "pending") {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              {t("invitationPending", {defaultValue: "Pending"})}
            </span>
          );
        }
        if (status === "accepted") {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300">
              {t("invitationAccepted", {defaultValue: "Accepted"})}
            </span>
          );
        }
        return (
          <span className="text-gray-400 dark:text-gray-500">
            {t("invitationNone", {defaultValue: "None"})}
          </span>
        );
      },
    },
    {
      key: "health",
      label: "healthStatus",
      sortable: true,
      render: (value, item) =>
        item?._pendingInvitation ? (
          <PendingInvitationBadge
            label={t("pendingInvitation", {defaultValue: "Pending Invitation"})}
          />
        ) : (
          <HealthBar value={value ?? 0} />
        ),
    },
  ];

  const renderPropertyRow = (
    item,
    handleSelect,
    selectedItems,
    onItemClick,
  ) => (
    <DataTableItem
      item={item}
      columns={columns}
      onSelect={handleSelect}
      isSelected={selectedItems.includes(item.id)}
      onItemClick={() => onItemClick(item)}
    />
  );

  const propertiesLoadingCard = (
    <div className="bg-white dark:bg-gray-800 shadow-xs rounded-xl border border-gray-200 dark:border-gray-700/60">
      <div
        className="flex justify-center items-center py-16 px-6 min-h-[220px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2
          className="w-10 h-10 text-[#456564] animate-spin shrink-0"
          aria-hidden
        />
      </div>
    </div>
  );

  const allSelected =
    paginatedProperties.length > 0 &&
    paginatedProperties.every((property) =>
      selectedProperties.includes(property.id),
    );

  /* ─── Bulk actions ─────────────────────────────────────────── */

  function handleDeleteClick() {
    if (selectedProperties.length === 0) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: t("selectItemsToDelete", {
            defaultValue: "Please select at least one property to delete",
          }),
        },
      });
      return;
    }
    dispatch({type: "SET_DANGER_MODAL", payload: true});
  }

  function handleBulkInvite() {
    if (selectedProperties.length === 0) {
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message: "Please select at least one property to invite a user",
        },
      });
      return;
    }
    setBulkInviteOpen(true);
  }

  const bulkInviteProperties = useMemo(
    () => properties.filter((p) => selectedProperties.includes(p.id)),
    [properties, selectedProperties],
  );

  async function handleDelete() {
    if (selectedProperties.length === 0) return;
    dispatch({type: "SET_DANGER_MODAL", payload: false});
    dispatch({type: "SET_SUBMITTING", payload: true});
    const deletedIds = [...selectedProperties];
    try {
      setSelectedProperties((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );
      for (const id of deletedIds) {
        await deleteProperty(id);
      }
      const remainingItems = sortedProperties.length - deletedIds.length;
      if (
        state.currentPage > 1 &&
        remainingItems <= (state.currentPage - 1) * state.itemsPerPage
      ) {
        dispatch({type: "SET_CURRENT_PAGE", payload: state.currentPage - 1});
      }
      const n = deletedIds.length;
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "success",
          message: `${n} ${n === 1 ? "property" : "properties"} deleted successfully`,
        },
      });
    } catch (error) {
      setSelectedProperties((prev) => [...new Set([...prev, ...deletedIds])]);
      const forbiddenMessage = t("propertyDeleteForbiddenMessage", {
        defaultValue:
          "Only property owners can delete properties. Agents and other team members do not have permission.",
      });
      const genericMessage = t("propertyDeleteErrorMessage", {
        defaultValue: "Error deleting properties. Please try again.",
      });
      dispatch({
        type: "SET_BANNER",
        payload: {
          open: true,
          type: "error",
          message:
            error?.status === 403
              ? forbiddenMessage
              : getApiErrorMessage(error, genericMessage),
        },
      });
    } finally {
      dispatch({type: "SET_SUBMITTING", payload: false});
    }
  }

  /* ─── Render ───────────────────────────────────────────────── */

  return (
    <>

            <div className="fixed right-0 w-auto sm:w-full z-50">
          <Banner
            type={state.bannerType}
            open={state.bannerOpen}
            setOpen={(open) =>
              dispatch({
                type: "SET_BANNER",
                payload: {
                  open,
                  type: state.bannerType,
                  message: state.bannerMessage,
                },
              })
            }
            className={`transition-opacity duration-600 ${
              state.bannerOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            {state.bannerMessage}
          </Banner>
        </div>

        <div className="m-1.5">
          <ModalBlank
            id="property-danger-modal"
            modalOpen={state.dangerModalOpen}
            setModalOpen={(open) =>
              dispatch({type: "SET_DANGER_MODAL", payload: open})
            }
            contentClassName="max-w-lg"
          >
            <div className="p-5 flex space-x-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700">
                <svg
                  className="shrink-0 fill-current text-red-500"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 12c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm1-3H7V4h2v5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  <div className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    Delete {selectedProperties.length}{" "}
                    {selectedProperties.length === 1
                      ? "property"
                      : "properties"}
                    ?
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  {t("propertyDeleteConfirmationMessage", {
                    count: selectedProperties.length,
                    defaultValue:
                      selectedProperties.length === 1
                        ? "Are you sure you want to delete the selected property?"
                        : "Are you sure you want to delete the selected properties?",
                  })}{" "}
                  {t("actionCantBeUndone")}
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className="btn-sm border-gray-200 dark:border-gray-700/60 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({type: "SET_DANGER_MODAL", payload: false});
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-sm bg-red-500 hover:bg-red-600 text-white"
                    onClick={handleDelete}
                    disabled={state.isSubmitting}
                  >
                    {state.isSubmitting ? "Deleting..." : "Accept"}
                  </button>
                </div>
              </div>
            </div>
          </ModalBlank>
        </div>

        <main className="grow">
          <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 py-8 w-full max-w-[96rem] mx-auto">
            {/* ─── Header row ─────────────────────────────────── */}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-5">
              <h1 className="text-2xl md:text-3xl text-gray-800 dark:text-gray-100 font-bold">
                {t("properties")}
              </h1>
              <div className="flex items-center gap-2">
                {(canImportProperties || selectedProperties.length > 0) && (
                  <ListDropdown
                    align="right"
                    hasSelection={selectedProperties.length > 0}
                    onImport={
                      canImportProperties
                        ? () =>
                            navigate(`/${accountUrl}/properties/import`)
                        : undefined
                    }
                    onBulkOnboard={
                      canImportProperties
                        ? () =>
                            navigate(`/${accountUrl}/properties/bulk-onboard`)
                        : undefined
                    }
                    onSendPendingInvitations={
                      canImportProperties
                        ? () => setSendPendingInvitesOpen(true)
                        : undefined
                    }
                    onInviteUser={
                      canImportProperties ? handleBulkInvite : undefined
                    }
                    onDelete={handleDeleteClick}
                  />
                )}
                <button
                  className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-70"
                  onClick={handleNewProperty}
                  disabled={addPropertyChecking}
                >
                  <svg
                    className="fill-current shrink-0 xs:hidden"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                  >
                    <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                  </svg>
                  <span className="max-xs:sr-only">{t("addProperty")}</span>
                </button>
              </div>
            </div>

            {profileAgentUidFilter &&
              profileAgentUidFilter.size > 0 &&
              !hasInvitedUserFilter && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#456564]/30 bg-[#456564]/5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300">
                <span>
                  {filterPropertyMessage ||
                    "Showing properties where this user is on the team as agent (editor or viewer)."}
                </span>
                <button
                  type="button"
                  className="shrink-0 font-medium text-[#456564] dark:text-[#8fa3a2] hover:underline"
                  onClick={() => {
                    setUidScopeOverride(null);
                    navigate(`/${accountUrl}/properties`, {
                      replace: true,
                      state: {},
                    });
                  }}
                >
                  Show all properties
                </button>
              </div>
            )}

            {/* ─── Search + Filter + View toggle ──────────────── */}
            <div className="mb-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                {/* Search */}
                <SearchInput
                  placeholder={t("searchPropertiesPlaceholder")}
                  value={state.searchTerm}
                  onChange={handleSearchChange}
                />

                {/* Filter button + View toggle (right of search) */}
                <div className="flex items-center gap-2 shrink-0">
                  <FilterDropdown
                    filterCategories={filterCategories}
                    filterOptions={filterOptions}
                    activeFilters={state.activeFilters}
                    onAdd={(f) => dispatch({type: "ADD_FILTER", payload: f})}
                    onRemove={handleRemoveFilter}
                    customCategoryPanels={customCategoryPanels}
                    t={t}
                  />
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`px-2.5 py-2 ${
                        viewMode === "grid"
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      } transition-colors`}
                      title={t("gridView")}
                      aria-label={t("gridView")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`px-2.5 py-2 ${
                        viewMode === "list"
                          ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          : "bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      } transition-colors`}
                      title={t("listView")}
                      aria-label={t("listView")}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 6h16M4 10h16M4 14h16M4 18h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── Active filter chips ────────────────────────── */}
              {state.activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {state.activeFilters.map((f) => (
                    <span
                      key={`${f.type}-${f.value}`}
                      className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                    >
                      <span className="text-emerald-400 dark:text-emerald-500 font-normal">
                        {t(
                          CHIP_FILTER_CATEGORIES.find((c) => c.type === f.type)
                            ?.labelKey ?? f.type,
                        )}
                        :
                      </span>
                      {f.label}
                      <button
                        type="button"
                        onClick={() => handleRemoveFilter(f)}
                        className="ml-0.5 p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-colors"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >
                    {t("clearAll", {defaultValue: "Clear all"})}
                  </button>
                </div>
              )}
            </div>

            {/* ─── Content: Table or Grid ─────────────────────── */}
            {viewMode === "list" ? (
              listLoading ? (
                propertiesLoadingCard
              ) : (
                <DataTable
                  items={paginatedProperties}
                  columns={columns}
                  onItemClick={handlePropertyClick}
                  onSelect={handleToggleSelect}
                  selectedItems={selectedProperties}
                  totalItems={sortedProperties.length}
                  title="properties"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  renderItem={renderPropertyRow}
                  allSelected={allSelected}
                />
              )
            ) : (
              <div>
                {listLoading ? (
                  propertiesLoadingCard
                ) : paginatedProperties.length === 0 ? (
                  <div className="bg-white dark:bg-gray-800 shadow-xs rounded-xl border border-gray-200 dark:border-gray-700/60">
                    <div className="text-center py-16 px-6">
                      {properties.length === 0 ? (
                        <>
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700/60 mb-4">
                            <svg
                              className="w-8 h-8 text-gray-400 dark:text-gray-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
                              />
                            </svg>
                          </div>
                          <p className="text-gray-600 dark:text-gray-300 font-medium mb-2">
                            {t("propertiesGrid.emptyState")}
                          </p>
                          <button
                            type="button"
                            onClick={handleNewProperty}
                            disabled={addPropertyChecking}
                            className="btn bg-gray-900 text-gray-100 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-800 dark:hover:bg-white disabled:opacity-70"
                          >
                            <svg
                              className="fill-current shrink-0"
                              width="16"
                              height="16"
                              viewBox="0 0 16 16"
                            >
                              <path d="M15 7H9V1c0-.6-.4-1-1-1S7 .4 7 1v6H1c-.6 0-1 .4-1 1s.4 1 1 1h6v6c0 .6.4 1 1 1s1-.4 1-1V9h6c.6 0 1-.4 1-1s-.4-1-1-1z" />
                            </svg>
                            <span className="ml-2">{t("addProperty")}</span>
                          </button>
                        </>
                      ) : (
                        <p className="text-gray-600 dark:text-gray-300 font-medium">
                          {t("noItemsFound")}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    {paginatedProperties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        onClick={handlePropertyClick}
                        isSelected={selectedProperties.includes(property.id)}
                        onSelect={handleToggleSelect}
                        getMainPhotoUrl={getMainPhotoUrl}
                        t={t}
                        onOpenAIAssistant={handleOpenAIAssistant}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {sortedProperties.length > 0 &&
              sortedProperties.length > state.itemsPerPage && (
                <div className="mt-8">
                  <PaginationClassic
                    currentPage={state.currentPage}
                    totalItems={sortedProperties.length}
                    itemsPerPage={state.itemsPerPage}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    pageSizeOptions={
                      viewMode === "grid"
                        ? [8, 12, 16, 24]
                        : [5, 10, 20, 50]
                    }
                  />
                </div>
              )}
          </div>
        </main>

        <SendPendingInvitationsModal
          modalOpen={sendPendingInvitesOpen}
          setModalOpen={setSendPendingInvitesOpen}
          currentAccount={currentAccount}
        />
      </>
    );
}

export default PropertiesList;
