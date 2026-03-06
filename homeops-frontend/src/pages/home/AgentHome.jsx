import React, { useEffect, useState, useContext, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PropertyContext from "../../context/PropertyContext";
import UserContext from "../../context/UserContext";
import ContactContext from "../../context/ContactContext";
import AppApi from "../../api/api";
import {
  Building2,
  Users,
  Heart,
  ChevronRight,
  ArrowRight,
  MapPin,
  Activity,
  Home,
  Loader2,
  Sparkles,
  Newspaper,
  MessageSquarePlus,
  BellRing,
  BookOpen,
  Plus,
} from "lucide-react";
import { getResourceThumbnailUrl, RESOURCE_THUMBNAIL_PLACEHOLDER, DEFAULT_HEADER_IMAGE } from "../../utils/resourceThumbnail";
import {
  HealthBadge,
  AgentHomeStats,
  AgentHomeKpiCharts,
} from "./components";

/*
 * ════════════════════════════════════════════════════════════════════
 * ENGAGEMENT ANALYTICS — Suggested Backend Tables (for later)
 * ════════════════════════════════════════════════════════════════════
 *
 * The charts below use data derived from existing properties. For full
 * engagement tracking, the following tables are recommended:
 *
 * 1. agent_newsletters
 *    - id, agent_id, title, body, sent_at, created_at
 *
 * 2. agent_posts
 *    - id, agent_id, title, body, media_url, published_at, created_at
 *
 * 3. agent_notifications
 *    - id, agent_id, recipient_user_id, property_id, title, body,
 *      notification_type (maintenance|update|general), sent_at, read_at
 *
 * 4. homeowner_engagement_events
 *    - id, user_id, property_id, event_type (login|view_property|
 *      complete_maintenance|open_notification|read_newsletter|view_post),
 *      metadata JSONB, created_at
 *
 * 5. engagement_analytics_daily (materialised / cron-built)
 *    - date, agent_id, logins, property_views, maintenance_completions,
 *      notification_opens, newsletter_opens, post_views
 *
 * These tables enable: open rates, click-through rates, homeowner
 * activity trends, notification effectiveness, and content engagement.
 * ════════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════════
// AGENT HOME — Main Component
// ═════════════════════════════════════════════════════════════════════

function AgentHome() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const {
    properties,
    getPropertyTeam,
    currentAccount,
  } = useContext(PropertyContext);
  const { users } = useContext(UserContext);
  const { contacts } = useContext(ContactContext);

  const [propertyTeams, setPropertyTeams] = useState({});
  const [presignedUrls, setPresignedUrls] = useState({});
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const fetchedKeysRef = useRef(new Set());
  const fetchedTeamUidsRef = useRef(new Set());

  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const rawFirstName =
    currentUser?.fullName?.split(" ")[0] ||
    currentUser?.name?.split(" ")[0] ||
    "Agent";
  const agentName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase()
    : rawFirstName;

  const totalProperties = properties?.length || 0;
  const totalUsers = users?.length || 0;
  const totalContacts = contacts?.length || 0;

  // ─── Engagement analytics state ─────────────────────────────────
  const [engagementCounts, setEngagementCounts] = useState([]);
  const [engagementTrend, setEngagementTrend] = useState([]);
  const [engagementLoading, setEngagementLoading] = useState(true);

  // ─── Resources (sent/published) for engagement section ─────────────
  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setEngagementLoading(true);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    Promise.all([
      AppApi.getEngagementCounts({ startDate: startStr, endDate: endStr }).then((c) => (cancelled ? [] : c || [])).catch(() => []),
      AppApi.getEngagementTrend({ startDate: startStr, endDate: endStr }).then((tr) => (cancelled ? [] : tr || [])).catch(() => []),
    ]).then(([counts, trend]) => {
      if (cancelled) return;
      setEngagementCounts(Array.isArray(counts) ? counts : []);
      setEngagementTrend(Array.isArray(trend) ? trend : []);
      setEngagementLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    setResourcesLoading(true);
    AppApi.getResources()
      .then((list) => setResources(list || []))
      .catch(() => setResources([]))
      .finally(() => setResourcesLoading(false));
  }, [currentUser?.id]);

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

  // ─── Engagement chart data ────────────────────────────────────
  const engagementLineOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false, backgroundColor: "rgba(17, 24, 39, 0.9)", padding: 12, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, maxTicksLimit: 8 } },
      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
    },
  }), []);

  const getHpsScore = (property) => {
    if (!property) return 0;
    return property.hps_score ?? property.hpsScore ?? property.health ?? 0;
  };

  // Health scores per property for bar chart
  const healthByPropertyData = useMemo(() => {
    if (!properties?.length) return null;
    const sorted = [...properties]
      .map((p) => ({
        label: p.address || p.passport_id || "Property",
        score: getHpsScore(p),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    return {
      labels: sorted.map((p) => p.label.length > 18 ? p.label.slice(0, 16) + "…" : p.label),
      datasets: [{
        label: "Health Score",
        data: sorted.map((p) => p.score),
        backgroundColor: sorted.map((p) =>
          p.score >= 80 ? "#10b981" : p.score >= 60 ? "#f59e0b" : "#ef4444"
        ),
        borderRadius: 6,
        borderSkipped: false,
      }],
    };
  }, [properties]);

  // Team size per property for bar chart
  const teamByPropertyData = useMemo(() => {
    if (!properties?.length || !Object.keys(propertyTeams).length) return null;
    const data = properties
      .map((p) => {
        const uid = p.property_uid ?? p.id;
        const team = propertyTeams[uid] ?? [];
        return { label: p.address || p.passport_id || "Property", size: team.length };
      })
      .filter((d) => d.size > 0)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    if (!data.length) return null;
    return {
      labels: data.map((d) => d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label),
      datasets: [{
        label: "Team Members",
        data: data.map((d) => d.size),
        backgroundColor: "#3b82f6",
        borderRadius: 6,
        borderSkipped: false,
      }],
    };
  }, [properties, propertyTeams]);

  // ─── Chart data for agent portfolio (properties, users, contacts) ─
  const portfolioBarData = useMemo(() => ({
    labels: [
      t("agentHome.totalProperties") || "Properties",
      t("agentHome.users") || "Users",
      t("contacts") || "Contacts",
    ],
    datasets: [{
      label: t("agentHome.portfolioCount") || "Count",
      data: [totalProperties, totalUsers, totalContacts],
      backgroundColor: ["#456564", "#3b82f6", "#8b5cf6"],
      borderRadius: 8,
      borderSkipped: false,
    }],
  }), [totalProperties, totalUsers, totalContacts, t]);

  const portfolioDoughnutData = useMemo(() => {
    const total = totalProperties + totalUsers + totalContacts;
    if (total === 0) return null;
    return {
      labels: [
        t("agentHome.totalProperties") || "Properties",
        t("agentHome.users") || "Users",
        t("contacts") || "Contacts",
      ],
      datasets: [{
        data: [totalProperties, totalUsers, totalContacts],
        backgroundColor: ["#456564", "#3b82f6", "#8b5cf6"],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    };
  }, [totalProperties, totalUsers, totalContacts, t]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: "rgba(17, 24, 39, 0.9)", padding: 12, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0 } },
      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.04)" } },
    },
  }), []);

  // ─── Fetch teams for all properties ─────────────────────────────
  useEffect(() => {
    if (!properties?.length || !getPropertyTeam) {
      setIsLoadingTeams(false);
      return;
    }

    let pending = 0;
    properties.forEach((prop) => {
      const uid = prop.property_uid ?? prop.id;
      if (!uid || fetchedTeamUidsRef.current.has(uid)) return;
      fetchedTeamUidsRef.current.add(uid);
      pending++;
      getPropertyTeam(uid)
        .then((team) => {
          const members = (team?.property_users ?? []).map((m) => ({
            ...m,
            role: m.property_role ?? m.role,
          }));
          setPropertyTeams((prev) => ({ ...prev, [uid]: members }));
        })
        .catch(() => {
          fetchedTeamUidsRef.current.delete(uid);
        })
        .finally(() => {
          pending--;
          if (pending <= 0) setIsLoadingTeams(false);
        });
    });

    if (pending === 0) setIsLoadingTeams(false);
  }, [properties, getPropertyTeam]);

  // ─── Fetch presigned URLs for property photos ───────────────────
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
          setPresignedUrls((prev) => ({ ...prev, [key]: url }));
        })
        .catch(() => {
          fetchedKeysRef.current.delete(key);
        });
    });
  }, [properties]);

  // ─── Helpers ────────────────────────────────────────────────────
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

  const getTeamMembers = useCallback(
    (property) => {
      if (!property) return [];
      const uid = property.property_uid ?? property.id;
      return propertyTeams[uid] ?? [];
    },
    [propertyTeams],
  );

  const getHomeowners = useCallback(
    (property) => {
      const team = getTeamMembers(property);
      return team.filter((m) => {
        const r = (m.property_role ?? m.role ?? "").toLowerCase();
        return r === "homeowner";
      });
    },
    [getTeamMembers],
  );

  // ─── Computed Stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!properties?.length) {
      return { avgHealth: 0, totalHomeowners: 0, healthyCount: 0, needsAttentionCount: 0 };
    }

    const scores = properties.map(getHpsScore);
    const avgHealth = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const healthyCount = scores.filter((s) => s >= 60).length;
    const needsAttentionCount = scores.filter((s) => s < 60).length;

    // Count unique homeowners across all properties
    const homeownerIds = new Set();
    properties.forEach((prop) => {
      getHomeowners(prop).forEach((h) => {
        if (h.id) homeownerIds.add(h.id);
      });
    });

    return {
      avgHealth,
      totalHomeowners: homeownerIds.size,
      healthyCount,
      needsAttentionCount,
    };
  }, [properties, getHomeowners]);

  const healthDistribution = useMemo(() => {
    if (!properties?.length) return [];
    const buckets = [
      { label: "0-20", min: 0, max: 20, count: 0, color: "#ef4444" },
      { label: "21-40", min: 21, max: 40, count: 0, color: "#f97316" },
      { label: "41-60", min: 41, max: 60, count: 0, color: "#f59e0b" },
      { label: "61-80", min: 61, max: 80, count: 0, color: "#22c55e" },
      { label: "81-100", min: 81, max: 100, count: 0, color: "#10b981" },
    ];
    properties.forEach((p) => {
      const s = getHpsScore(p);
      const bucket = buckets.find((b) => s >= b.min && s <= b.max);
      if (bucket) bucket.count++;
    });
    return buckets.map((b) => ({ label: b.label, value: b.count, color: b.color }));
  }, [properties]);

  const healthDoughnutData = useMemo(() => {
    if (!healthDistribution?.length) return null;
    const buckets = healthDistribution.filter((b) => b.value > 0);
    if (!buckets.length) return null;
    return {
      labels: buckets.map((b) => b.label),
      datasets: [{
        data: buckets.map((b) => b.value),
        backgroundColor: buckets.map((b) => b.color),
        borderWidth: 0,
        hoverOffset: 6,
      }],
    };
  }, [healthDistribution]);

  // ─── Navigation ─────────────────────────────────────────────────
  const goToProperty = (property) => {
    if (!property) return;
    const uid = property.property_uid ?? property.id;
    navigate(`/${accountUrl}/properties/${uid}`);
  };

  // ─── Loading State ──────────────────────────────────────────────
  const isLoading = !properties;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Loader2 className="w-10 h-10 text-[#456564] animate-spin mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading your dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ============================================ */}
      {/* WELCOME HEADER                               */}
      {/* ============================================ */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
          {t("welcome")?.replace("!", "")}, {agentName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          {t("agentHome.subtitle") ||
            "Here's an overview of your properties and homeowner engagement."}
        </p>
      </div>

      {/* ============================================ */}
      {/* STAT CARDS                                    */}
      {/* ============================================ */}
      <AgentHomeStats
        t={t}
        totalProperties={totalProperties}
        stats={stats}
      />

      {/* ============================================ */}
      {/* AGENT PROPERTIES — Responsive Grid           */}
      {/* ============================================ */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("agentHome.yourProperties") || "Your Properties"}
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              {totalProperties}
            </span>
          </div>
          <button
            onClick={() => navigate(`/${accountUrl}/properties`)}
            className="text-sm font-medium text-[#456564] dark:text-emerald-400 flex items-center gap-1 hover:text-[#3a5554] dark:hover:text-emerald-300 transition-colors"
          >
            {t("agentHome.viewAll") || "View all"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {totalProperties === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-8 px-6 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <Building2 className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">
                {t("agentHome.noProperties") || "No properties"}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 max-w-sm text-center">
                {t("agentHome.emptyState") ||
                  "No properties assigned yet. Create your first property to get started."}
              </p>
              <button
                onClick={() => navigate(`/${accountUrl}/properties/new`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#456564] text-white rounded-xl font-medium text-sm hover:bg-[#3a5554] transition-colors"
              >
                {t("agentHome.createProperty") || "Create property"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
          properties.map((property) => {
            const uid = property.property_uid ?? property.id;
            const photoUrl = getMainPhotoUrl(property);
            const score = getHpsScore(property);
            const team = getTeamMembers(property);
            const homeowners = team.filter((m) => {
              const r = (m.property_role ?? m.role ?? "").toLowerCase();
              return r === "homeowner";
            });
            const address = [property.address, property.city, property.state]
              .filter(Boolean)
              .join(", ");

            return (
              <div
                key={uid}
                onClick={() => goToProperty(property)}
                className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 overflow-hidden shadow-sm hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all cursor-pointer"
              >
                {/* Photo */}
                <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-700">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={address || "Property"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                      <Home className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  {/* Health score overlay badge */}
                  <div className="absolute top-3 right-3">
                    <div
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold backdrop-blur-sm shadow-sm ${
                        score >= 80
                          ? "bg-emerald-500/90 text-white"
                          : score >= 60
                            ? "bg-amber-500/90 text-white"
                            : "bg-red-500/90 text-white"
                      }`}
                    >
                      {score}%
                    </div>
                  </div>
                  {/* Passport ID overlay */}
                  {property.passport_id && (
                    <div className="absolute bottom-3 left-3">
                      <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm text-white/90">
                        {property.passport_id}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  {/* Address */}
                  <div className="flex items-start gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-[#456564] dark:group-hover:text-emerald-400 transition-colors">
                        {property.address || "—"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {[property.city, property.state, property.zip]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Health Score Bar */}
                  <div className="mb-3">
                    <HealthBadge score={score} />
                  </div>

                  {/* Team */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* Avatar stack */}
                      <div className="flex -space-x-2">
                        {team.slice(0, 3).map((member, idx) => (
                          <div
                            key={member.id || idx}
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 overflow-hidden bg-gradient-to-br from-[#456564] to-[#34514f] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            title={member.name || "Team member"}
                          >
                            {member.image_url || member.image ? (
                              <img
                                src={member.image_url || member.image}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              (member.name || "?")
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2)
                            )}
                          </div>
                        ))}
                        {team.length > 3 && (
                          <div className="w-7 h-7 rounded-full border-2 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-medium text-gray-500 dark:text-gray-400 flex-shrink-0">
                            +{team.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {team.length} {team.length === 1 ? "member" : "members"}
                      </span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#456564] dark:group-hover:text-emerald-400 transition-colors" />
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>
      </section>

      <AgentHomeKpiCharts
        t={t}
        totalProperties={totalProperties}
        totalUsers={totalUsers}
        totalContacts={totalContacts}
        portfolioBarData={portfolioBarData}
        portfolioDoughnutData={portfolioDoughnutData}
        chartOptions={chartOptions}
        healthDoughnutData={healthDoughnutData}
        healthDistribution={healthDistribution}
        stats={stats}
        engagementLineOptions={engagementLineOptions}
        engagementCounts={engagementCounts}
        engagementTrend={engagementTrend}
        engagementLoading={engagementLoading}
        healthByPropertyData={healthByPropertyData}
        teamByPropertyData={teamByPropertyData}
        isLoadingTeams={isLoadingTeams}
      />

      {/* RESOURCES (sent/published) + Create your own ───────────────── */}
      <section className="pb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Resources
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/${accountUrl}/resources/new`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#456564] hover:bg-[#34514f] text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your own resource
          </button>
        </div>

        {resourcesLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="aspect-[16/10] bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (resources?.length ?? 0) > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {resources.map((post) => {
              const title = post.subject || post.title || "Resource";
              const shortDesc = (post.bodyText || post.shortDescription || "").slice(0, 120);
              const thumbnailUrl = getResourceThumbnailUrl(post);
              const imageUrl =
                post.imageUrl || resourcePresignedUrls[post.imageKey] || thumbnailUrl || DEFAULT_HEADER_IMAGE;
              return (
                <article
                  key={post.id}
                  onClick={() => navigate(`/${accountUrl}/resources/${post.id}/view`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/${accountUrl}/resources/${post.id}/view`)}
                  role="button"
                  tabIndex={0}
                  className="flex-shrink-0 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden group snap-start hover:shadow-lg transition-shadow cursor-pointer"
                >
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
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        {post.type?.replace("_", " ") || "Post"}
                      </span>
                    </div>
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
            {/* Create your own resource card */}
            <div
              className="flex-shrink-0 w-72 sm:w-80 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 overflow-hidden snap-start flex flex-col items-center justify-center min-h-[200px] cursor-pointer hover:border-[#456564]/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              onClick={() => navigate(`/${accountUrl}/resources/new`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/${accountUrl}/resources/new`)}
              role="button"
              tabIndex={0}
            >
              <div className="w-12 h-12 rounded-xl bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center mb-3">
                <Plus className="w-6 h-6 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Create your own resource
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Share tips, links, or content with homeowners
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4">
            <div
              className="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 flex flex-col items-center justify-center min-h-[180px] cursor-pointer hover:border-[#456564]/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              onClick={() => navigate(`/${accountUrl}/resources/new`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/${accountUrl}/resources/new`)}
              role="button"
              tabIndex={0}
            >
              <div className="w-14 h-14 rounded-xl bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center mb-4">
                <Plus className="w-7 h-7 text-[#456564] dark:text-[#5a7a78]" />
              </div>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                Create your own resource
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center max-w-xs">
                Share tips, links, or content with homeowners. Sent resources appear here and in their Discover feed.
              </p>
              <span className="mt-4 text-sm font-medium text-[#456564] dark:text-[#5a7a78] flex items-center gap-1">
                Get started <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ENGAGEMENT ACTIONS                           */}
      {/* ============================================ */}
      <section className="pb-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("agentHome.engagementActions") || "Engagement Actions"}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Create Newsletter */}
          <button
            type="button"
            className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm hover:shadow-md hover:border-[#456564]/40 dark:hover:border-emerald-500/30 transition-all text-left"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-100/30 to-indigo-100/30 dark:from-blue-900/10 dark:to-indigo-900/10 blur-2xl rounded-bl-3xl" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mb-4 group-hover:bg-blue-500/20 dark:group-hover:bg-blue-500/30 transition-colors">
                <Newspaper className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {t("agentHome.createNewsletter") || "Create Newsletter"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                {t("agentHome.newsletterDescription") ||
                  "Share updates, tips, and market insights with your homeowners."}
              </p>
              <div className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
                <span>{t("agentHome.getStarted") || "Get started"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Create Post */}
          <button
            type="button"
            className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm hover:shadow-md hover:border-[#456564]/40 dark:hover:border-emerald-500/30 transition-all text-left"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-100/30 to-pink-100/30 dark:from-purple-900/10 dark:to-pink-900/10 blur-2xl rounded-bl-3xl" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 dark:group-hover:bg-purple-500/30 transition-colors">
                <MessageSquarePlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {t("agentHome.createPost") || "Create Post"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                {t("agentHome.postDescription") ||
                  "Publish content about home maintenance, seasonal tips, or community news."}
              </p>
              <div className="flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 group-hover:gap-2 transition-all">
                <span>{t("agentHome.getStarted") || "Get started"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          {/* Send Notification */}
          <button
            type="button"
            className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm hover:shadow-md hover:border-[#456564]/40 dark:hover:border-emerald-500/30 transition-all text-left"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-100/30 to-orange-100/30 dark:from-amber-900/10 dark:to-orange-900/10 blur-2xl rounded-bl-3xl" />
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center mb-4 group-hover:bg-amber-500/20 dark:group-hover:bg-amber-500/30 transition-colors">
                <BellRing className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {t("agentHome.sendNotification") || "Send Notification"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                {t("agentHome.notificationDescription") ||
                  "Send maintenance reminders, updates, or alerts to specific homeowners."}
              </p>
              <div className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 group-hover:gap-2 transition-all">
                <span>{t("agentHome.getStarted") || "Get started"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}

export default AgentHome;
