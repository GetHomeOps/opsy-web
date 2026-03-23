import React, {
  useEffect,
  useState,
  useContext,
  useRef,
  useCallback,
} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../../context/AuthContext";
import PropertyContext from "../../context/PropertyContext";
import UserContext from "../../context/UserContext";
import AppApi from "../../api/api";
import {
  getResourceThumbnailUrl,
  RESOURCE_THUMBNAIL_PLACEHOLDER,
  DEFAULT_HEADER_IMAGE,
} from "../../utils/resourceThumbnail";
import {computeHpsScoreBreakdown} from "../properties/helpers/computeHpsScore";
import {buildPropertyPayloadFromRefresh} from "../properties/helpers/buildPropertyPayloadFromRefresh";
import {mergeFormDataFromTabs} from "../properties/helpers/formDataByTabs";
import {mapMaintenanceRecordsFromBackend} from "../properties/helpers/maintenanceRecordMapping";
import {PROPERTY_SYSTEMS} from "../properties/constants/propertySystems";
import ModalBlank from "../../components/ModalBlank";
import CalendarScheduleModal from "../calendar/CalendarScheduleModal";
import UploadDocumentModal from "../properties/partials/UploadDocumentModal";
import UpgradePrompt from "../../components/UpgradePrompt";
import useAddPropertyWithLimitCheck from "../../hooks/useAddPropertyWithLimitCheck";
import {
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Home,
  Wrench,
  ChevronRight,
  ArrowRight,
  Shield,
  Lock,
  FileText,
  Star,
  AlertTriangle,
  MapPin,
  BookOpen,
  Hammer,
  Settings,
  ChevronLeft,
  X,
  MoreVertical,
  Search,
  Upload,
  Plus,
} from "lucide-react";
import OpsyMascot from "../../images/opsy2.png";
import AgentCard from "./components/AgentCard";
import AgentModal from "./components/AgentModal";

// ─── Skeleton components for loading states ─────
function CardSkeleton({lines = 3}) {
  return (
    <div className="space-y-2">
      {Array.from({length: lines}).map((_, i) => (
        <div
          key={i}
          className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
          aria-hidden
        />
      ))}
    </div>
  );
}

function ResourceCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="aspect-[16/10] bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    </div>
  );
}

function ProfessionalCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-64 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="flex-1 space-y-1">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
      <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>
  );
}

function HomeownerHome() {
  const {t} = useTranslation();
  const {currentUser} = useAuth();
  const navigate = useNavigate();
  const {
    properties,
    getPropertyTeam,
    getPropertyById,
    getSystemsByPropertyId,
    getMaintenanceRecordsByPropertyId,
    currentAccount,
  } = useContext(PropertyContext);
  const {users} = useContext(UserContext);

  const [activeIndex, setActiveIndex] = useState(0);
  const [propertyTeams, setPropertyTeams] = useState({});
  const [presignedUrls, setPresignedUrls] = useState({});
  const [scoreBreakdown, setScoreBreakdown] = useState(null);
  const fetchedKeysRef = useRef(new Set());
  const fetchedTeamUidsRef = useRef(new Set());

  const [activeTab, setActiveTab] = useState("all");
  const [remindersModalOpen, setRemindersModalOpen] = useState(false);
  const [reminderFilter, setReminderFilter] = useState("all");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadNoPropertyOpen, setUploadNoPropertyOpen] = useState(false);
  const [propertyLimitUpgradeOpen, setPropertyLimitUpgradeOpen] =
    useState(false);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [agentModalTab, setAgentModalTab] = useState("message");

  const [homeEvents, setHomeEvents] = useState(null);
  const [resources, setResources] = useState(null);
  const [communications, setCommunications] = useState(null);
  const [savedProfessionals, setSavedProfessionals] = useState(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [communicationsLoading, setCommunicationsLoading] = useState(true);
  const [professionalsLoading, setProfessionalsLoading] = useState(true);

  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const rawFirstName =
    currentUser?.fullName?.split(" ")[0] ||
    currentUser?.name?.split(" ")[0] ||
    "Homeowner";
  const homeownerName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase()
    : rawFirstName;

  const totalProperties = properties?.length || 0;
  const activeProperty = totalProperties > 0 ? properties[activeIndex] : null;

  // Close overlays on user switch
  useEffect(() => {
    setRemindersModalOpen(false);
    setReminderFilter("all");
  }, [currentUser?.id]);

  // ─── Fetch home events (reminders, scheduled work, next alert) ───
  useEffect(() => {
    if (!currentUser?.id) return;
    setEventsLoading(true);
    AppApi.getHomeEvents()
      .then((data) => setHomeEvents(data))
      .catch(() =>
        setHomeEvents({
          events: [],
          reminders: [],
          scheduledWork: [],
          nextAlert: null,
        }),
      )
      .finally(() => setEventsLoading(false));
  }, [currentUser?.id]);

  // ─── Fetch published resources for Discover ───
  useEffect(() => {
    if (!currentUser?.id) return;
    setResourcesLoading(true);
    AppApi.getResources()
      .then((list) => setResources(list))
      .catch(() => setResources([]))
      .finally(() => setResourcesLoading(false));
  }, [currentUser?.id]);

  // ─── Fetch communications sent to user for Discover ───
  useEffect(() => {
    if (!currentUser?.id) return;
    setCommunicationsLoading(true);
    AppApi.getCommunicationsForRecipient()
      .then((list) => setCommunications(list))
      .catch(() => setCommunications([]))
      .finally(() => setCommunicationsLoading(false));
  }, [currentUser?.id]);

  // ─── Fetch presigned URLs for resources with imageKey ───
  const [resourcePresignedUrls, setResourcePresignedUrls] = useState({});
  const fetchedResourceKeysRef = useRef(new Set());
  useEffect(() => {
    if (!resources?.length) return;
    resources.forEach((r) => {
      const key = r.imageKey;
      if (
        !key ||
        key.startsWith("http") ||
        fetchedResourceKeysRef.current.has(key)
      )
        return;
      fetchedResourceKeysRef.current.add(key);
      AppApi.getPresignedPreviewUrl(key)
        .then((url) =>
          setResourcePresignedUrls((prev) => ({...prev, [key]: url})),
        )
        .catch(() => fetchedResourceKeysRef.current.delete(key));
    });
  }, [resources]);

  // ─── Presigned URLs for communication preview images ───
  const [commPresignedUrls, setCommPresignedUrls] = React.useState({});
  const fetchedCommKeysRef = useRef(new Set());
  useEffect(() => {
    if (!communications?.length) return;
    communications.forEach((c) => {
      const key = c.imageKey;
      if (!key || key.startsWith("http") || fetchedCommKeysRef.current.has(key))
        return;
      fetchedCommKeysRef.current.add(key);
      AppApi.getPresignedPreviewUrl(key)
        .then((url) => setCommPresignedUrls((prev) => ({...prev, [key]: url})))
        .catch(() => fetchedCommKeysRef.current.delete(key));
    });
  }, [communications]);

  // ─── Merged Discover feed: resources + communications, sorted by sentAt ───
  const discoverItems = React.useMemo(() => {
    const resourcesWithType = (resources || []).map((r) => ({
      ...r,
      _feedType: "resource",
    }));
    const commsWithType = (communications || []).map((c) => ({
      ...c,
      _feedType: "communication",
    }));
    return [...resourcesWithType, ...commsWithType].sort((a, b) => {
      const aAt = a.sentAt || a.sent_at || a.createdAt || 0;
      const bAt = b.sentAt || b.sent_at || b.createdAt || 0;
      return new Date(bAt) - new Date(aAt);
    });
  }, [resources, communications]);

  // ─── Fetch saved professionals ───
  useEffect(() => {
    if (!currentUser?.id) return;
    setProfessionalsLoading(true);
    AppApi.getSavedProfessionals()
      .then((list) => setSavedProfessionals(list))
      .catch(() => setSavedProfessionals([]))
      .finally(() => setProfessionalsLoading(false));
  }, [currentUser?.id]);

  // Reset active index when properties change
  useEffect(() => {
    if (activeIndex >= totalProperties && totalProperties > 0) {
      setActiveIndex(0);
    }
  }, [totalProperties, activeIndex]);

  // ─── Fetch teams for all properties ──────────────────────────────────────────
  useEffect(() => {
    if (!properties?.length || !getPropertyTeam) return;
    properties.forEach((prop) => {
      const uid = prop.property_uid ?? prop.id;
      if (!uid || fetchedTeamUidsRef.current.has(uid)) return;
      fetchedTeamUidsRef.current.add(uid);
      getPropertyTeam(uid)
        .then((team) => {
          const members = (team?.property_users ?? []).map((m) => ({
            ...m,
            // API: m.role is global user role (e.g. agent); property_role is owner/editor/viewer.
            // Keep both — overwriting role with property_role hides agents from getAgent().
            userRole: m.role,
            role: m.property_role ?? m.role,
          }));
          setPropertyTeams((prev) => ({...prev, [uid]: members}));
        })
        .catch(() => {
          fetchedTeamUidsRef.current.delete(uid);
        });
    });
  }, [properties, getPropertyTeam]);

  // ─── Fetch presigned URLs for property main photos (only when backend didn't provide one) ──
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

  // ─── Fetch full property data for score breakdown (Identity, Systems, Maintenance) ───
  useEffect(() => {
    if (
      !activeProperty ||
      !getPropertyById ||
      !getSystemsByPropertyId ||
      !getMaintenanceRecordsByPropertyId
    ) {
      setScoreBreakdown(null);
      return;
    }
    const uid = activeProperty.property_uid ?? activeProperty.id;
    let cancelled = false;
    (async () => {
      try {
        const property = await getPropertyById(uid);
        if (cancelled) return;
        const systemsRes = await getSystemsByPropertyId(property.id);
        const systemsArr = systemsRes?.systems ?? systemsRes ?? [];
        if (cancelled) return;
        const rawRecords = await getMaintenanceRecordsByPropertyId(property.id);
        if (cancelled) return;
        const maintenanceRecords = mapMaintenanceRecordsFromBackend(
          rawRecords ?? [],
        );
        const payload = buildPropertyPayloadFromRefresh(
          property,
          systemsArr ?? [],
          property,
        );
        const payloadWithRecords = {
          ...payload,
          maintenanceRecords,
        };
        const merged = mergeFormDataFromTabs(payloadWithRecords);
        const breakdown = computeHpsScoreBreakdown(merged, maintenanceRecords);
        if (!cancelled) setScoreBreakdown(breakdown);
      } catch {
        if (!cancelled) setScoreBreakdown(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    activeProperty,
    getPropertyById,
    getSystemsByPropertyId,
    getMaintenanceRecordsByPropertyId,
  ]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getMainPhotoUrl = useCallback(
    (property) => {
      if (!property) return null;
      const backendUrl = property.main_photo_url || property.mainPhotoUrl;
      if (backendUrl) return backendUrl;
      const key = property.main_photo || property.mainPhoto;
      if (!key) return null;
      if (key.startsWith("http") || key.startsWith("blob:")) return key;
      return presignedUrls[key] || null;
    },
    [presignedUrls],
  );

  const getAgent = useCallback(
    (property) => {
      if (!property) return null;
      const uid = property.property_uid ?? property.id;
      const team = propertyTeams[uid] ?? [];
      const agent = team.find((m) => {
        const global = String(m.userRole ?? "").toLowerCase();
        const onProperty = String(
          m.property_role ?? m.role ?? "",
        ).toLowerCase();
        // Agents on a property use property_role owner/editor/viewer, not "agent".
        return global === "agent" || onProperty === "agent";
      });
      if (!agent) return null;
      const userFromCtx = users?.find(
        (u) => u && agent.id != null && Number(u.id) === Number(agent.id),
      );
      return {
        ...agent,
        name: agent.name ?? userFromCtx?.name ?? "Agent",
        phone: agent.phone ?? userFromCtx?.phone ?? null,
        email: agent.email ?? userFromCtx?.email ?? null,
        image:
          agent.image_url ??
          agent.image ??
          userFromCtx?.image_url ??
          userFromCtx?.image ??
          null,
        company: agent.company ?? userFromCtx?.company ?? null,
      };
    },
    [propertyTeams, users],
  );

  const getHpsScore = (property) => {
    if (!property) return 0;
    return property.hps_score ?? property.hpsScore ?? property.health ?? 0;
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Attention";
  };

  const getScoreGradient = (score) => {
    if (score >= 80) return ["#10b981", "#059669"];
    if (score >= 60) return ["#f59e0b", "#d97706"];
    return ["#64748b", "#475569"];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getDaysUntil = (dateString) => {
    const diffTime = new Date(dateString) - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // ─── Navigation ──────────────────────────────────────────────────────────────
  const goToPrev = () => setActiveIndex((prev) => Math.max(0, prev - 1));
  const goToNext = () =>
    setActiveIndex((prev) => Math.min(totalProperties - 1, prev + 1));
  const goToProperty = () => {
    if (!activeProperty) return;
    const uid = activeProperty.property_uid ?? activeProperty.id;
    navigate(`/${accountUrl}/properties/${uid}`);
  };

  // ─── Computed values for active property ─────────────────────────────────────
  const currentPhotoUrl = getMainPhotoUrl(activeProperty);
  const currentAgent = getAgent(activeProperty);
  const currentScore = getHpsScore(activeProperty);
  const currentScoreLabel = getScoreLabel(currentScore);
  const [gradientStart, gradientEnd] = getScoreGradient(currentScore);
  const currentAddress = activeProperty?.address ?? "";

  const hasProperties = properties && totalProperties > 0;

  const {handleAddProperty, isChecking: addPropertyChecking} =
    useAddPropertyWithLimitCheck({
      accountId: currentAccount?.id,
      accountUrl,
      onLimitReached: () => setPropertyLimitUpgradeOpen(true),
    });

  const quickActions = [
    {
      icon: Plus,
      label: t("homeownerHome.addNewProperty") || "Add New Property",
      onClick: () => (accountUrl ? handleAddProperty() : navigate("/")),
    },
    {
      icon: CalendarClock,
      label: t("homeownerHome.scheduleEvent") || "Schedule Event",
      onClick: () => {
        // Defer open to avoid the opening click being treated as outside-click
        setTimeout(() => setScheduleModalOpen(true), 0);
      },
    },
    {
      icon: Search,
      label: t("homeownerHome.findProfessional") || "Find a Professional",
      onClick: () => navigate(`/${accountUrl}/professionals/search`),
    },
    {
      icon: Upload,
      label: t("homeownerHome.uploadDocument") || "Upload Document",
      onClick: () => {
        if (hasProperties && activeProperty) {
          setTimeout(() => setUploadModalOpen(true), 0);
        } else {
          setTimeout(() => setUploadNoPropertyOpen(true), 0);
        }
      },
    },
  ];

  return (
    <div className="space-y-6 -mt-8 min-w-0 max-w-full">
      {/* ============================================ */}
      {/* HERO SECTION - Property Image with Carousel or Empty State */}
      {/* ============================================ */}
      <div className="relative">
        {/* Background Image / Fallback Gradient */}
        <div className="relative h-[340px] sm:h-[420px] lg:h-[480px] overflow-hidden">
          {hasProperties && currentPhotoUrl ? (
            <img
              key={activeProperty?.property_uid ?? activeProperty?.id}
              src={currentPhotoUrl}
              alt={currentAddress || "Your home"}
              className="w-full h-full object-cover transition-opacity duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-teal-800 via-teal-900 to-slate-900 flex flex-col items-center justify-center gap-4">
              {!hasProperties && (
                <div className="text-center px-4 max-w-md flex flex-col items-center gap-4">
                  <img
                    src={OpsyMascot}
                    alt="Opsy"
                    className="w-28 h-28 object-contain"
                  />
                  <h2 className="text-2xl font-bold text-white">
                    {t("welcome")} {homeownerName}
                  </h2>
                  <p className="text-white/70 text-sm">
                    {t("homeownerHome.emptyStateSubtext")}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      accountUrl ? handleAddProperty() : navigate("/")
                    }
                    disabled={addPropertyChecking}
                    className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-[#d49b5b] hover:bg-[#c18a4a] border border-[#c18a4a] text-white text-base font-semibold transition-colors shadow-lg hover:shadow-xl disabled:opacity-70"
                  >
                    {addPropertyChecking
                      ? "…"
                      : t("homeownerHome.getOpsymized")}
                  </button>
                  <div className="relative inline-flex items-center justify-center w-10 h-10 mt-1 text-[#d49b5b]">
                    <Shield className="w-8 h-8 absolute" />
                    <Lock className="w-4 h-4 relative z-10" />
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Gradient overlays - only when we have a property image; avoid blocking empty-state button */}
          {hasProperties && currentPhotoUrl && (
            <>
              {/* Bottom-heavy vignette; keep top lighter so agent card reads clearly */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/[0.04]" />
              {/* Softer left fade: weaker at top-left, a bit stronger toward bottom-left for welcome text */}
              <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.14)_42%,transparent_68%)]" />
            </>
          )}
        </div>

        {/* Property Navigation Arrows */}
        {hasProperties && totalProperties > 1 && (
          <>
            <button
              onClick={goToPrev}
              disabled={activeIndex === 0}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all z-10"
              aria-label="Previous property"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToNext}
              disabled={activeIndex === totalProperties - 1}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 disabled:opacity-20 disabled:cursor-not-allowed transition-all z-10"
              aria-label="Next property"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Hero Content Overlay - only when we have properties */}
        {hasProperties && (
          <div className="absolute inset-0 flex flex-col">
            {/* Top Section - Agent Card (only if agent exists) */}
            <div className="px-3 sm:px-4 lg:px-5 xxl:px-12 pt-5 flex justify-start">
              <AgentCard
                agent={currentAgent}
                onOpenModal={(tab) => {
                  setAgentModalTab(tab);
                  setAgentModalOpen(true);
                }}
              />
            </div>

            {/* Middle Section - Spacer */}
            <div className="flex-1" />

            {/* Bottom Section - Welcome, Name & Address */}
            <div className="pl-5 pr-3 sm:px-4 lg:px-5 xxl:px-12 pt-4 sm:pt-0 pb-28 sm:pb-40 lg:pb-36 text-left flex flex-col items-start">
              <p className="text-white/70 text-sm leading-tight">Welcome,</p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 leading-tight">
                {homeownerName}
              </h1>
              <div className="flex items-center gap-2 text-white/90 max-w-full">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm sm:text-base truncate">
                  {currentAddress || "—"}
                </span>
              </div>
              {/* Property dot indicators */}
              {totalProperties > 1 && (
                <div className="flex items-center gap-2 mt-3">
                  {properties.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveIndex(idx)}
                      className={`rounded-full transition-all duration-300 ${
                        idx === activeIndex
                          ? "bg-white w-6 h-2"
                          : "bg-white/40 hover:bg-white/60 w-2 h-2"
                      }`}
                      aria-label={`Go to property ${idx + 1}`}
                    />
                  ))}
                  <span className="text-white/60 text-xs ml-2">
                    {activeIndex + 1} / {totalProperties}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* FLOATING SCORE CARD - only when we have properties */}
        {/* ============================================ */}
        {hasProperties && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-1/2 px-4 sm:px-0">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-5 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                  {/* Score Display */}
                  <div className="flex items-center gap-3 sm:gap-5">
                    {/* Score Circle */}
                    <div className="relative w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 flex-shrink-0">
                      <svg
                        className="w-full h-full transform -rotate-90"
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-gray-200 dark:text-gray-700"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          stroke="url(#scoreGradient)"
                          strokeWidth="8"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={264}
                          strokeDashoffset={264 - (currentScore / 100) * 264}
                          className="transition-all duration-1000"
                        />
                        <defs>
                          <linearGradient
                            id="scoreGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor={gradientStart} />
                            <stop offset="100%" stopColor={gradientEnd} />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                          {currentScore}
                        </span>
                      </div>
                    </div>
                    {/* Score Info */}
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Home Passport Score
                      </span>
                      <p
                        className="text-base sm:text-lg font-semibold"
                        style={{color: gradientEnd}}
                      >
                        {currentScoreLabel}
                      </p>
                      {activeProperty?.passport_id && (
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono truncate">
                          {activeProperty.passport_id}
                        </p>
                      )}
                    </div>
                    {/* Mobile inline CTA */}
                    <button
                      onClick={goToProperty}
                      className="sm:hidden flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium text-xs hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                    >
                      Go
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="hidden lg:block w-px h-16 bg-gray-200 dark:bg-gray-700" />

                  {/* Quick Stats */}
                  <div className="flex-1 grid grid-cols-3 gap-3 sm:gap-4">
                    {[
                      {
                        label: "Identity",
                        value: scoreBreakdown?.identityScore ?? currentScore,
                        icon: Shield,
                      },
                      {
                        label: "Systems",
                        value: scoreBreakdown?.systemsScore ?? currentScore,
                        icon: Settings,
                      },
                      {
                        label: "Maintenance",
                        value: scoreBreakdown?.maintenanceScore ?? currentScore,
                        icon: Wrench,
                      },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <div className="flex items-center justify-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1">
                          <stat.icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 dark:text-gray-500" />
                          <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            {stat.label}
                          </span>
                        </div>
                        <div className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">
                          {Math.round(stat.value)}%
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 sm:h-1.5 mt-1 sm:mt-1.5">
                          <div
                            className={`h-1 sm:h-1.5 rounded-full ${stat.value >= 80 ? "bg-emerald-500" : stat.value >= 60 ? "bg-amber-500" : "bg-slate-500"}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, stat.value))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop CTA */}
                  <button
                    onClick={goToProperty}
                    className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    {t("goToProperty") || "View Property"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {/* Tablet CTA (hidden on phone and desktop) */}
                <div className="hidden sm:block lg:hidden mt-4">
                  <button
                    onClick={goToProperty}
                    className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                  >
                    {t("goToProperty") || "View Property"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spacer for floating card */}
      <div className="h-20 sm:h-36 lg:h-16" />

      {/* ============================================ */}
      {/* QUICK ACTIONS - 4 consistent shortcut buttons */}
      {/* ============================================ */}
      <div className="px-4 sm:px-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              onClick={action.onClick}
              className="group flex flex-col items-center gap-2.5 px-4 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-[#456564]/40 dark:hover:border-[#456564]/40 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 bg-[#456564]/10 dark:bg-[#456564]/20 rounded-xl flex items-center justify-center group-hover:bg-[#456564]/20 dark:group-hover:bg-[#456564]/30 transition-colors">
                <action.icon className="w-5 h-5 text-[#456564] dark:text-[#6b9695]" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ============================================ */}
      {/* NEXT UP - Urgent Action Banner (real data) */}
      {/* ============================================ */}
      {!eventsLoading && homeEvents?.nextAlert && (
        <div className="px-4 sm:px-0">
          <div className="bg-white dark:bg-gray-800/60 border border-gray-200/60 dark:border-gray-700/50 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 dark:bg-amber-500/20 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {homeEvents.nextAlert.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {homeEvents.nextAlert.isOverdue
                    ? "Overdue"
                    : `Due in ${homeEvents.nextAlert.daysUntilDue} days`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const uid = homeEvents.nextAlert.propertyUid;
                if (uid) navigate(`/${accountUrl}/properties/${uid}`);
              }}
              className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
            >
              Take Action
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* YOUR PROPERTY - Tasks & Maintenance */}
      {/* ============================================ */}
      <section className="px-4 sm:px-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Reminders */}
          <div className="relative bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                  <Bell className="w-[18px] h-[18px] text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Reminders
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {eventsLoading
                      ? "…"
                      : `${homeEvents?.reminders?.length ?? 0} pending`}
                  </p>
                </div>
              </div>
            </div>
            {eventsLoading ? (
              <CardSkeleton lines={3} />
            ) : (homeEvents?.reminders?.length ?? 0) > 0 ? (
              <>
                <div className="space-y-2">
                  {(homeEvents.reminders || []).slice(0, 3).map((item) => {
                    const isUrgent =
                      item.daysUntilDue <= 7 && item.daysUntilDue > 0;
                    const isOverdue = item.isOverdue;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80 dark:bg-gray-700/30 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        onClick={() =>
                          item.propertyUid &&
                          navigate(
                            `/${accountUrl}/properties/${item.propertyUid}`,
                          )
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          item.propertyUid &&
                          navigate(
                            `/${accountUrl}/properties/${item.propertyUid}`,
                          )
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            isOverdue
                              ? "bg-red-500"
                              : isUrgent
                                ? "bg-amber-500"
                                : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(item.dueAt)}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-md ${
                            isOverdue
                              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                              : isUrgent
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {isOverdue ? "Overdue" : `${item.daysUntilDue}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRemindersModalOpen(true);
                  }}
                  className="mt-4 w-full py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  View all reminders
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="py-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  No reminders yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
                  Add systems to your property to get maintenance reminders
                </p>
                <button
                  type="button"
                  onClick={() =>
                    hasProperties &&
                    activeProperty &&
                    navigate(
                      `/${accountUrl}/properties/${activeProperty.property_uid ?? activeProperty.id}`,
                    )
                  }
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                  {hasProperties ? "View property" : "Add your first property"}
                </button>
              </div>
            )}
          </div>

          {/* Scheduled Work */}
          <div className="relative bg-white dark:bg-gray-800/60 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                  <Calendar className="w-[18px] h-[18px] text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Scheduled Work
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {eventsLoading
                      ? "…"
                      : `${homeEvents?.scheduledWork?.length ?? 0} upcoming`}
                  </p>
                </div>
              </div>
            </div>
            {eventsLoading ? (
              <CardSkeleton lines={3} />
            ) : (homeEvents?.scheduledWork?.length ?? 0) > 0 ? (
              <>
                <div className="space-y-2">
                  {(homeEvents.scheduledWork || []).map((item) => {
                    const dateObj = new Date(item.dueAt);
                    const month = dateObj.toLocaleDateString("en-US", {
                      month: "short",
                    });
                    const day = dateObj.getDate();
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80 dark:bg-gray-700/30 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        onClick={() =>
                          item.propertyUid &&
                          navigate(
                            `/${accountUrl}/properties/${item.propertyUid}`,
                          )
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          item.propertyUid &&
                          navigate(
                            `/${accountUrl}/properties/${item.propertyUid}`,
                          )
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center">
                          <span className="text-[9px] font-semibold uppercase text-gray-500 dark:text-gray-400 leading-none">
                            {month}
                          </span>
                          <span className="text-base font-bold text-gray-900 dark:text-white leading-tight">
                            {day}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {item.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {item.professionalName || "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirmed</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/${accountUrl}/calendar`)}
                  className="mt-4 w-full py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                >
                  View calendar
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <div className="py-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  No scheduled work
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
                  Schedule maintenance from your property or calendar
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/${accountUrl}/calendar`)}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
                >
                  View calendar
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* DISCOVER - Resources feed (real data) */}
      {/* ============================================ */}
      <section className="px-4 sm:px-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white shrink-0 min-w-0">
            Discover
          </h2>
          {!resourcesLoading &&
            !communicationsLoading &&
            discoverItems.length > 0 && (
              <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0 whitespace-nowrap">
                {discoverItems.length} item
                {discoverItems.length !== 1 ? "s" : ""}
              </span>
            )}
        </div>

        {/* Cards - Horizontal Scroll */}
        {resourcesLoading || communicationsLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {[1, 2, 3].map((i) => (
              <ResourceCardSkeleton key={i} />
            ))}
          </div>
        ) : discoverItems.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {discoverItems.map((post) => {
              const isComm = post._feedType === "communication";
              const title = post.subject || post.title || "Resource";
              const rawBody =
                post.bodyText ||
                post.shortDescription ||
                post.content?.body ||
                "";
              const shortDesc = (
                typeof rawBody === "string"
                  ? rawBody.replace(/<[^>]*>/g, "").trim()
                  : ""
              ).slice(0, 120);
              const thumbnailUrl = isComm
                ? null
                : getResourceThumbnailUrl(post);
              const imageUrl = isComm
                ? post.imageKey
                  ? commPresignedUrls[post.imageKey]
                  : null
                : post.imageUrl ||
                  resourcePresignedUrls[post.imageKey] ||
                  thumbnailUrl ||
                  DEFAULT_HEADER_IMAGE;
              const hasImage = !!imageUrl;
              const viewPath = isComm
                ? `/${accountUrl}/communications/${post.id}/view`
                : `/${accountUrl}/resources/${post.id}/view`;
              const typeLabel = isComm
                ? null
                : post.type?.replace("_", " ") || "Post";
              return (
                <article
                  key={isComm ? `comm-${post.id}` : `res-${post.id}`}
                  onClick={() => navigate(viewPath)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(viewPath)}
                  role="button"
                  tabIndex={0}
                  className="flex-shrink-0 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden group snap-start hover:shadow-lg transition-shadow cursor-pointer"
                >
                  {hasImage && (
                    <div className="aspect-[16/10] overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          if (e.target.src !== RESOURCE_THUMBNAIL_PLACEHOLDER) {
                            e.target.src = RESOURCE_THUMBNAIL_PLACEHOLDER;
                          }
                        }}
                      />
                    </div>
                  )}
                  <div className="p-4 min-w-0">
                    {typeLabel && (
                      <div className="flex items-center gap-2 mb-2 min-w-0">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 truncate">
                          {typeLabel}
                        </span>
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 break-words group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {title}
                    </h3>
                    {shortDesc && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 break-words">
                        {shortDesc}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="py-12 px-4 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No resources yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 break-words">
              Sent resources and communications will appear here
            </p>
          </div>
        )}
      </section>

      {/* ============================================ */}
      {/* SAVED PROFESSIONALS - Real data */}
      {/* ============================================ */}
      <section className="px-4 sm:px-0 pb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Hammer className="w-5 h-5 text-gray-700 dark:text-gray-300 shrink-0" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              Saved Professionals
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/${accountUrl}/professionals`)}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:text-blue-700 shrink-0 whitespace-nowrap"
          >
            View Directory <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {professionalsLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {[1, 2, 3, 4].map((i) => (
              <ProfessionalCardSkeleton key={i} />
            ))}
          </div>
        ) : (savedProfessionals?.length ?? 0) > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {(savedProfessionals || []).slice(0, 8).map((pro) => {
              const displayName =
                pro.company_name ||
                [pro.first_name, pro.last_name].filter(Boolean).join(" ") ||
                "Professional";
              const category = pro.category_name || pro.subcategory_name || "—";
              const location =
                [pro.city, pro.state].filter(Boolean).join(", ") || null;
              return (
                <div
                  key={pro.id}
                  className="flex-shrink-0 w-64 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 snap-start hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                  onClick={() =>
                    navigate(`/${accountUrl}/professionals/${pro.id}`)
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    navigate(`/${accountUrl}/professionals/${pro.id}`)
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0">
                        {pro.profile_photo_url ? (
                          <img
                            src={pro.profile_photo_url}
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm font-semibold">
                            {(displayName || "P").charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {displayName}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {category}
                        </p>
                        {location && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {location}
                          </p>
                        )}
                      </div>
                    </div>
                    {pro.is_verified && (
                      <Shield className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    {pro.rating != null && (
                      <>
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {Number(pro.rating).toFixed(1)}
                        </span>
                        {pro.review_count != null && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({pro.review_count})
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/${accountUrl}/professionals/${pro.id}`);
                    }}
                    className="w-full text-sm font-medium text-blue-600 dark:text-blue-400 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    View profile
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 px-4 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <Hammer className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No saved professionals
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4 break-words">
              Save professionals from the Directory to quick-access them here
            </p>
            <button
              type="button"
              onClick={() => navigate(`/${accountUrl}/professionals`)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700"
            >
              Browse Directory
            </button>
          </div>
        )}
      </section>

      {/* ============================================ */}
      {/* REMINDERS MODAL */}
      {/* ============================================ */}
      <ModalBlank
        id="reminders-modal"
        modalOpen={remindersModalOpen}
        setModalOpen={setRemindersModalOpen}
      >
        <div className="flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                All Reminders
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {(homeEvents?.reminders?.length ?? 0) +
                  (homeEvents?.scheduledWork?.length ?? 0)}{" "}
                total
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRemindersModalOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                {
                  id: "all",
                  label: "All",
                  count: homeEvents?.reminders?.length ?? 0,
                },
                {
                  id: "overdue",
                  label: "Overdue",
                  count:
                    homeEvents?.reminders?.filter((r) => r.isOverdue)?.length ??
                    0,
                },
                {
                  id: "urgent",
                  label: "Urgent",
                  count:
                    homeEvents?.reminders?.filter(
                      (r) => !r.isOverdue && r.daysUntilDue <= 7,
                    )?.length ?? 0,
                },
                {
                  id: "upcoming",
                  label: "Upcoming",
                  count:
                    homeEvents?.reminders?.filter((r) => r.daysUntilDue > 7)
                      ?.length ?? 0,
                },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setReminderFilter(filter.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    reminderFilter === filter.id
                      ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                      : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                  }`}
                >
                  {filter.label}
                  <span
                    className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                      reminderFilter === filter.id
                        ? "bg-white/20 dark:bg-gray-900/20"
                        : "bg-gray-100 dark:bg-gray-600"
                    }`}
                  >
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Reminders List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {(homeEvents?.reminders ?? [])
                .filter((item) => {
                  if (reminderFilter === "all") return true;
                  if (reminderFilter === "overdue") return item.isOverdue;
                  if (reminderFilter === "urgent")
                    return !item.isOverdue && item.daysUntilDue <= 7;
                  if (reminderFilter === "upcoming")
                    return item.daysUntilDue > 7;
                  return true;
                })
                .map((item) => {
                  const isOverdue = item.isOverdue;
                  const isUrgent =
                    !isOverdue &&
                    item.daysUntilDue <= 7 &&
                    item.daysUntilDue > 0;
                  const Icon =
                    item.systemType === "maintenance" ? Wrench : FileText;

                  return (
                    <div
                      key={item.id}
                      className={`group flex items-start gap-4 p-4 rounded-xl transition-all hover:shadow-md ${
                        isOverdue
                          ? "bg-red-50/50 dark:bg-red-950/20"
                          : isUrgent
                            ? "bg-amber-50/50 dark:bg-amber-950/20"
                            : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          isOverdue
                            ? "bg-red-100 dark:bg-red-900/30"
                            : isUrgent
                              ? "bg-amber-100 dark:bg-amber-900/30"
                              : "bg-gray-100 dark:bg-gray-700"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 ${
                            isOverdue
                              ? "text-red-600 dark:text-red-400"
                              : isUrgent
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-gray-600 dark:text-gray-400"
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {item.title}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {item.category === "maintenance"
                                ? "Maintenance"
                                : "Inspection"}{" "}
                              &bull; Due {formatDate(item.dueAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                              isOverdue
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : isUrgent
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {isOverdue
                              ? "Overdue"
                              : isUrgent
                                ? `Due in ${item.daysUntilDue} days`
                                : `${item.daysUntilDue} days left`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {(homeEvents?.reminders ?? []).filter((item) => {
              if (reminderFilter === "all") return true;
              if (reminderFilter === "overdue") return item.isOverdue;
              if (reminderFilter === "urgent")
                return !item.isOverdue && item.daysUntilDue <= 7;
              if (reminderFilter === "upcoming") return item.daysUntilDue > 7;
              return true;
            }).length === 0 && (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  No reminders found
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Try selecting a different filter
                </p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRemindersModalOpen(false);
                  if (hasProperties && activeProperty) {
                    navigate(
                      `/${accountUrl}/properties/${activeProperty.property_uid ?? activeProperty.id}`,
                    );
                  }
                }}
                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                {hasProperties ? "Add maintenance" : "Add your first property"}
              </button>
            </div>
          </div>
        </div>
      </ModalBlank>

      {/* Schedule Event Modal - rendered via portal to escape layout overflow */}
      {createPortal(
        <CalendarScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          onScheduled={() => setScheduleModalOpen(false)}
        />,
        document.body,
      )}

      {/* Upload Document Modal - portaled like Schedule Event for consistent behavior */}
      {hasProperties &&
        activeProperty &&
        createPortal(
          <UploadDocumentModal
            isOpen={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            propertyId={activeProperty.property_uid ?? activeProperty.id}
            onSuccess={() => setUploadModalOpen(false)}
            systemsToShow={PROPERTY_SYSTEMS}
          />,
          document.body,
        )}

      {/* Upload requires property - prompt modal */}
      <ModalBlank
        id="upload-no-property"
        modalOpen={uploadNoPropertyOpen}
        setModalOpen={setUploadNoPropertyOpen}
        contentClassName="max-w-sm"
      >
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-800/40 flex items-center justify-center">
              <Upload className="w-5 h-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("homeownerHome.uploadRequiresProperty") ||
                  "Create a property first"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("homeownerHome.uploadRequiresPropertyDesc") ||
                  "Add your property to upload documents, warranties, and receipts."}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setUploadNoPropertyOpen(false)}
              className="btn border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {t("common.cancel") || "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadNoPropertyOpen(false);
                if (accountUrl) handleAddProperty();
                else navigate("/");
              }}
              disabled={addPropertyChecking}
              className="btn bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-70"
            >
              <Plus className="w-4 h-4 inline mr-1.5" />
              {addPropertyChecking ? "…" : t("homeownerHome.createProperty")}
            </button>
          </div>
        </div>
      </ModalBlank>

      <UpgradePrompt
        open={propertyLimitUpgradeOpen}
        onClose={() => setPropertyLimitUpgradeOpen(false)}
        title="Property limit reached"
        message="You've used all properties on your current plan. Upgrade to add more."
        upgradeUrl={accountUrl ? `/${accountUrl}/settings/upgrade` : undefined}
      />

      <AgentModal
        agent={currentAgent}
        isOpen={agentModalOpen}
        initialTab={agentModalTab}
        propertyUid={
          activeProperty ? activeProperty.property_uid ?? activeProperty.id : null
        }
        accountId={
          activeProperty?.account_id ??
          activeProperty?.accountId ??
          currentAccount?.id ??
          null
        }
        onClose={() => {
          setAgentModalOpen(false);
          setAgentModalTab("message");
        }}
      />
    </div>
  );
}

export default HomeownerHome;
