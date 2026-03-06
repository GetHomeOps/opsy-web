import React, {useEffect, useState, useContext, useRef, useCallback} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../../context/AuthContext";
import PropertyContext from "../../context/PropertyContext";
import UserContext from "../../context/UserContext";
import AppApi from "../../api/api";
import { getResourceThumbnailUrl, RESOURCE_THUMBNAIL_PLACEHOLDER, DEFAULT_HEADER_IMAGE } from "../../utils/resourceThumbnail";
import {computeHpsScoreBreakdown} from "../properties/helpers/computeHpsScore";
import {buildPropertyPayloadFromRefresh} from "../properties/helpers/buildPropertyPayloadFromRefresh";
import {mergeFormDataFromTabs} from "../properties/helpers/formDataByTabs";
import {mapMaintenanceRecordsFromBackend} from "../properties/helpers/maintenanceRecordMapping";
import ModalBlank from "../../components/ModalBlank";
import {
  Bell,
  Calendar,
  CheckCircle2,
  Home,
  Wrench,
  ChevronRight,
  ArrowRight,
  Shield,
  FileText,
  Star,
  AlertTriangle,
  MapPin,
  BookOpen,
  Hammer,
  Camera,
  ClipboardList,
  Settings,
  ChevronLeft,
  X,
  MoreVertical,
  Phone,
  Mail,
} from "lucide-react";

// ─── Skeleton components for loading states ─────
function CardSkeleton({ lines = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
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
      .catch(() => setHomeEvents({ events: [], reminders: [], scheduledWork: [], nextAlert: null }))
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
      if (!key || key.startsWith("http") || fetchedResourceKeysRef.current.has(key)) return;
      fetchedResourceKeysRef.current.add(key);
      AppApi.getPresignedPreviewUrl(key)
        .then((url) => setResourcePresignedUrls((prev) => ({ ...prev, [key]: url })))
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
      if (!key || key.startsWith("http") || fetchedCommKeysRef.current.has(key)) return;
      fetchedCommKeysRef.current.add(key);
      AppApi.getPresignedPreviewUrl(key)
        .then((url) => setCommPresignedUrls((prev) => ({ ...prev, [key]: url })))
        .catch(() => fetchedCommKeysRef.current.delete(key));
    });
  }, [communications]);

  // ─── Merged Discover feed: resources + communications, sorted by sentAt ───
  const discoverItems = React.useMemo(() => {
    const resourcesWithType = (resources || []).map((r) => ({ ...r, _feedType: "resource" }));
    const commsWithType = (communications || []).map((c) => ({ ...c, _feedType: "communication" }));
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
            role: m.property_role ?? m.role,
          }));
          setPropertyTeams((prev) => ({...prev, [uid]: members}));
        })
        .catch(() => {
          fetchedTeamUidsRef.current.delete(uid);
        });
    });
  }, [properties, getPropertyTeam]);

  // ─── Fetch presigned URLs for property main photos ───────────────────────────
  useEffect(() => {
    if (!properties?.length) return;
    properties.forEach((prop) => {
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
        const r = (m.property_role ?? m.role ?? "").toLowerCase();
        return r === "agent";
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
    return ["#ef4444", "#dc2626"];
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
  const currentAddress = activeProperty
    ? [activeProperty.address, activeProperty.city, activeProperty.state]
        .filter(Boolean)
        .join(", ")
    : "";

  const quickActions = [
    {icon: ClipboardList, label: "Log Maintenance", color: "bg-blue-500"},
    {icon: Camera, label: "Add Photos", color: "bg-purple-500"},
    {icon: FileText, label: "Documents", color: "bg-emerald-500"},
    {icon: Settings, label: "Settings", color: "bg-gray-500"},
  ];

  // When no properties, show dashboard with empty state (no early return)
  const hasProperties = properties && totalProperties > 0;

  return (
    <div className="space-y-6 -mx-4 sm:-mx-6 lg:-mx-8 -mt-8">
      {/* ============================================ */}
      {/* HERO SECTION - Property Image with Carousel or Empty State */}
      {/* ============================================ */}
      <div className="relative">
        {/* Background Image / Fallback Gradient */}
        <div className="relative h-[420px] lg:h-[480px] overflow-hidden">
          {hasProperties && currentPhotoUrl ? (
            <img
              key={activeProperty?.property_uid ?? activeProperty?.id}
              src={currentPhotoUrl}
              alt={currentAddress || "Your home"}
              className="w-full h-full object-cover transition-opacity duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex flex-col items-center justify-center gap-4">
              <Home className="w-24 h-24 text-white/10" />
              {!hasProperties && (
                <div className="text-center px-4 max-w-md">
                  <h2 className="text-xl font-semibold text-white mb-2">
                    {t("welcome")}, {homeownerName}
                  </h2>
                  <p className="text-white/70 text-sm mb-4">
                    {t("homeownerHome.emptyState")}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(accountUrl ? `/${accountUrl}/properties/new` : "/")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
                  >
                    {t("homeownerHome.createProperty")}
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
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
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 pt-6 flex justify-start">
            {currentAgent ? (
              <div className="relative overflow-hidden bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-xl p-3 sm:p-4 shadow-xl border border-gray-200/80 dark:border-gray-700/80 w-full lg:w-[360px] min-h-[80px] sm:min-h-[90px] lg:h-auto">
                {/* Subtle gradient accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100/40 to-indigo-100/40 dark:from-blue-900/20 dark:to-indigo-900/20 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-100/30 to-cyan-100/30 dark:from-emerald-900/10 dark:to-cyan-900/10 blur-2xl" />

                <div className="relative flex items-center gap-3 sm:gap-4 h-full">
                  {/* Agent Photo */}
                  <div className="relative flex-shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 dark:from-slate-600 dark:via-slate-700 dark:to-slate-800 opacity-40 dark:opacity-50 blur-xl scale-x-[1.4] scale-y-110" />
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-500/50 via-indigo-500/40 to-purple-500/50 dark:from-blue-400/40 dark:via-indigo-400/35 dark:to-purple-400/40" />
                    <div className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] lg:w-20 lg:h-20 rounded-full overflow-hidden ring-2 ring-white/50 dark:ring-gray-800/50 shadow-lg">
                      {currentAgent.image ? (
                        <img
                          src={currentAgent.image}
                          alt={currentAgent.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#456564] to-[#34514f] flex items-center justify-center text-white text-lg font-bold">
                          {currentAgent.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase() || "A"}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Agent Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[8px] sm:text-[9px] font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">
                      Your Agent
                    </p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-0.5">
                      {currentAgent.name}
                    </p>
                    {currentAgent.company && (
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 sm:mb-1.5">
                        {currentAgent.company}
                      </p>
                    )}
                    {/* Contact Info */}
                    <div className="flex flex-row items-center gap-1.5 flex-wrap">
                      {currentAgent.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          <a
                            href={`tel:${currentAgent.phone}`}
                            className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors whitespace-nowrap"
                          >
                            {currentAgent.phone}
                          </a>
                        </div>
                      )}
                      {currentAgent.phone && currentAgent.email && (
                        <span className="text-gray-400 dark:text-gray-500 text-[9px] sm:text-[10px]">
                          |
                        </span>
                      )}
                      {currentAgent.email && (
                        <div className="flex items-center gap-1 min-w-0">
                          <Mail className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          <a
                            href={`mailto:${currentAgent.email}`}
                            className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors truncate"
                          >
                            {currentAgent.email}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* No agent - empty spacer to keep layout consistent */
              <div />
            )}
          </div>

          {/* Middle Section - Spacer */}
          <div className="flex-1" />

          {/* Bottom Section - Welcome, Name & Address */}
          <div className="px-0 sm:px-4 lg:px-5 xxl:px-12 pb-32 lg:pb-36">
            <p className="text-white/70 text-sm leading-tight">
              Welcome,
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2 leading-tight">
              {homeownerName}
            </h1>
            <div className="flex items-center gap-2 text-white/90">
              <MapPin className="w-4 h-4" />
              <span className="text-base">{currentAddress || "—"}</span>
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
        <div className="absolute bottom-0 left-0 right-0 translate-y-1/2 px-0 sm:px-4 lg:px-5 xxl:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200/50 dark:border-gray-700/50 p-5 lg:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Score Display */}
                <div className="flex items-center gap-5">
                  {/* Score Circle */}
                  <div className="relative w-20 h-20 lg:w-24 lg:h-24 flex-shrink-0">
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
                      <span className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                        {currentScore}
                      </span>
                    </div>
                  </div>
                  {/* Score Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Home Passport Score
                      </span>
                    </div>
                    <p
                      className="text-lg font-semibold"
                      style={{color: gradientEnd}}
                    >
                      {currentScoreLabel}
                    </p>
                    {activeProperty?.passport_id && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                        {activeProperty.passport_id}
                      </p>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="hidden lg:block w-px h-16 bg-gray-200 dark:bg-gray-700" />

                {/* Quick Stats - Three bars (Identity, Systems, Maintenance) from ScoreCard */}
                <div className="flex-1 grid grid-cols-3 gap-4">
                  {[
                    {
                      label: "Identity",
                      value:
                        scoreBreakdown?.identityScore ?? currentScore,
                      icon: Shield,
                    },
                    {
                      label: "Systems",
                      value:
                        scoreBreakdown?.systemsScore ?? currentScore,
                      icon: Settings,
                    },
                    {
                      label: "Maintenance",
                      value:
                        scoreBreakdown?.maintenanceScore ?? currentScore,
                      icon: Wrench,
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <stat.icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {stat.label}
                        </span>
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">
                        {Math.round(stat.value)}%
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1.5">
                        <div
                          className={`h-1.5 rounded-full ${stat.value >= 80 ? "bg-emerald-500" : stat.value >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{width: `${Math.min(100, Math.max(0, stat.value))}%`}}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <button
                  onClick={goToProperty}
                  className="hidden lg:flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-medium text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                >
                  {t("goToProperty") || "View Property"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              {/* Mobile CTA */}
              <div className="lg:hidden mt-4">
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
      <div className="h-20 lg:h-16" />

      {/* ============================================ */}
      {/* QUICK ACTIONS - Horizontal Scroll */}
      {/* ============================================ */}
      <div className="px-0 sm:px-4 lg:px-5 xxl:px-12">
        <div className="flex items-center gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {quickActions.map((action, idx) => (
            <button
              key={idx}
              className="flex items-center gap-2.5 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex-shrink-0"
            >
              <div
                className={`w-8 h-8 ${action.color} rounded-lg flex items-center justify-center`}
              >
                <action.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
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
        <div className="px-0 sm:px-4 lg:px-5 xxl:px-12">
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
      <section className="px-0 sm:px-4 lg:px-5 xxl:px-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Your Property
          </h2>
          <a
            href="#"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:text-blue-700"
          >
            View all <ChevronRight className="w-4 h-4" />
          </a>
        </div>

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
                    const isUrgent = item.daysUntilDue <= 7 && item.daysUntilDue > 0;
                    const isOverdue = item.isOverdue;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80 dark:bg-gray-700/30 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        onClick={() =>
                          item.propertyUid &&
                          navigate(`/${accountUrl}/properties/${item.propertyUid}`)
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          item.propertyUid &&
                          navigate(`/${accountUrl}/properties/${item.propertyUid}`)
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            isOverdue ? "bg-red-500" : isUrgent ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"
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
                    navigate(`/${accountUrl}/properties/${activeProperty.property_uid ?? activeProperty.id}`)
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
                    const month = dateObj.toLocaleDateString("en-US", { month: "short" });
                    const day = dateObj.getDate();
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gray-50/80 dark:bg-gray-700/30 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        onClick={() =>
                          item.propertyUid &&
                          navigate(`/${accountUrl}/properties/${item.propertyUid}`)
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          item.propertyUid &&
                          navigate(`/${accountUrl}/properties/${item.propertyUid}`)
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
      <section className="px-0 sm:px-4 lg:px-5 xxl:px-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Discover
          </h2>
          {!resourcesLoading && !communicationsLoading && discoverItems.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {discoverItems.length} item{discoverItems.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Cards - Horizontal Scroll */}
        {resourcesLoading || communicationsLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[1, 2, 3].map((i) => (
              <ResourceCardSkeleton key={i} />
            ))}
          </div>
        ) : discoverItems.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide">
            {discoverItems.map((post) => {
              const isComm = post._feedType === "communication";
              const title = post.subject || post.title || "Resource";
              const rawBody = post.bodyText || post.shortDescription || post.content?.body || "";
              const shortDesc = (typeof rawBody === "string"
                ? rawBody.replace(/<[^>]*>/g, "").trim()
                : ""
              ).slice(0, 120);
              const thumbnailUrl = isComm ? null : getResourceThumbnailUrl(post);
              const imageUrl = isComm
                ? (post.imageKey ? commPresignedUrls[post.imageKey] : null)
                : (post.imageUrl || resourcePresignedUrls[post.imageKey] || thumbnailUrl || DEFAULT_HEADER_IMAGE);
              const hasImage = !!imageUrl;
              const viewPath = isComm
                ? `/${accountUrl}/communications/${post.id}/view`
                : `/${accountUrl}/resources/${post.id}/view`;
              const typeLabel = isComm ? null : (post.type?.replace("_", " ") || "Post");
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
                  <div className="p-4">
                    {typeLabel && (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          {typeLabel}
                        </span>
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {title}
                    </h3>
                    {shortDesc && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {shortDesc}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No resources yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Sent resources and communications will appear here
            </p>
          </div>
        )}
      </section>

      {/* ============================================ */}
      {/* SAVED PROFESSIONALS - Real data */}
      {/* ============================================ */}
      <section className="px-0 sm:px-4 lg:px-5 xxl:px-12 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Hammer className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Saved Professionals
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/${accountUrl}/professionals`)}
            className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:text-blue-700"
          >
            View Directory <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {professionalsLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[1, 2, 3, 4].map((i) => (
              <ProfessionalCardSkeleton key={i} />
            ))}
          </div>
        ) : (savedProfessionals?.length ?? 0) > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide">
            {(savedProfessionals || []).slice(0, 8).map((pro) => {
              const displayName =
                pro.company_name || [pro.first_name, pro.last_name].filter(Boolean).join(" ") || "Professional";
              const category = pro.category_name || pro.subcategory_name || "—";
              const location = [pro.city, pro.state].filter(Boolean).join(", ") || null;
              return (
                <div
                  key={pro.id}
                  className="flex-shrink-0 w-64 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 snap-start hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                  onClick={() => navigate(`/${accountUrl}/professionals/${pro.id}`)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && navigate(`/${accountUrl}/professionals/${pro.id}`)
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
          <div className="py-12 text-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <Hammer className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              No saved professionals
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-4">
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
                {(homeEvents?.reminders?.length ?? 0) + (homeEvents?.scheduledWork?.length ?? 0)} total
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
                  count: homeEvents?.reminders?.filter((r) => r.isOverdue)?.length ?? 0,
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
                    homeEvents?.reminders?.filter(
                      (r) => r.daysUntilDue > 7,
                    )?.length ?? 0,
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
                  if (reminderFilter === "upcoming") return item.daysUntilDue > 7;
                  return true;
                })
                .map((item) => {
                  const isOverdue = item.isOverdue;
                  const isUrgent =
                    !isOverdue && item.daysUntilDue <= 7 && item.daysUntilDue > 0;
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
    </div>
  );
}

export default HomeownerHome;
