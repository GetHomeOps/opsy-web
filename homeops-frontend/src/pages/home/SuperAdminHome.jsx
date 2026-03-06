import React, { useContext, useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import PropertyContext from "../../context/PropertyContext";
import UserContext from "../../context/UserContext";
import AppApi from "../../api/api";
import { Loader2 } from "lucide-react";
import { SuperAdminHomeStats, SuperAdminHomeKpiCharts } from "./components";

/*
 * ════════════════════════════════════════════════════════════════════
 * SUPER ADMIN DASHBOARD — Suggested Backend Tables (for later)
 * ════════════════════════════════════════════════════════════════════
 *
 * The metrics below use data derived from existing contexts where
 * possible, and simulated projections otherwise. For full platform
 * analytics, the following tables / views are recommended:
 *
 * 1. platform_metrics_daily (materialised view / cron-built)
 *    - date, total_databases, total_properties, total_users,
 *      new_databases, new_properties, new_users,
 *      active_users (DAU), active_databases
 *
 * 2. subscriptions
 *    - id, database_id, plan (free|starter|pro|enterprise),
 *      status (active|cancelled|past_due|trialing),
 *      billing_cycle (monthly|annual), amount_cents,
 *      started_at, current_period_end, cancelled_at, created_at
 *
 * 3. subscription_events
 *    - id, subscription_id, event_type (created|upgraded|downgraded|
 *      cancelled|renewed|payment_failed), metadata JSONB, created_at
 *
 * 4. platform_engagement_events
 *    - id, user_id, database_id, event_type (login|page_view|
 *      property_created|maintenance_logged|document_uploaded|
 *      user_invited|system_added), metadata JSONB, created_at
 *
 * 5. platform_engagement_daily (materialised / cron-built)
 *    - date, logins, page_views, properties_created,
 *      maintenance_logged, documents_uploaded, users_invited,
 *      avg_session_duration_seconds
 *
 * 6. database_analytics
 *    - database_id, total_properties, total_users, total_systems,
 *      total_maintenance_records, avg_hps_score, last_active_at,
 *      storage_bytes, updated_at
 *
 * 7. revenue_daily (materialised / cron-built)
 *    - date, mrr_cents, new_mrr_cents, churned_mrr_cents,
 *      expansion_mrr_cents, total_paying_customers, arpu_cents
 *
 * These tables enable: growth metrics, MRR tracking, churn analysis,
 * cohort retention, platform engagement trends, feature adoption,
 * and capacity planning.
 * ════════════════════════════════════════════════════════════════════
 */

// ═════════════════════════════════════════════════════════════════════
// SUPER ADMIN HOME — Main Component
// ═════════════════════════════════════════════════════════════════════

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatMonth(ym) {
  if (!ym) return "";
  const [y, m] = String(ym).split("-");
  return MONTH_LABELS[Number(m) - 1] || ym;
}

function SuperAdminHome() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { properties } = useContext(PropertyContext);
  const { users } = useContext(UserContext);

  const [summary, setSummary] = useState(null);
  const [dailyMetrics, setDailyMetrics] = useState([]);
  const [growthAccounts, setGrowthAccounts] = useState([]);
  const [growthProps, setGrowthProps] = useState([]);
  const [growthUsers, setGrowthUsers] = useState([]);
  const [accountAnalytics, setAccountAnalytics] = useState([]);
  const [engagementCounts, setEngagementCounts] = useState([]);
  const [engagementTrend, setEngagementTrend] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [timeframeDays, setTimeframeDays] = useState(7);

  const TIMEFRAME_OPTIONS = [
    { label: "1 Week", value: 7 },
    { label: "2 Weeks", value: 14 },
    { label: "30 Days", value: 30 },
    { label: "60 Days", value: 60 },
    { label: "90 Days", value: 90 },
  ];

  const rawFirstName =
    currentUser?.fullName?.split(" ")[0] ||
    currentUser?.name?.split(" ")[0] ||
    "Admin";
  const adminName = rawFirstName
    ? rawFirstName.charAt(0).toUpperCase() + rawFirstName.slice(1).toLowerCase()
    : rawFirstName;

  const accounts = currentUser?.accounts || [];

  // ─── Fetch platform analytics (real data from backend views) ───────
  useEffect(() => {
    let cancelled = false;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeframeDays);
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);

    Promise.all([
      AppApi.getAnalyticsSummary().catch((e) => (cancelled ? null : (setAnalyticsError(e?.messages?.[0] || "Summary failed"), null))),
      AppApi.getAnalyticsDaily({ startDate: startStr, endDate: endStr }).then((m) => (cancelled ? [] : m || [])).catch(() => []),
      AppApi.getAnalyticsGrowth("accounts", 8).then((g) => (cancelled ? [] : g || [])).catch(() => []),
      AppApi.getAnalyticsGrowth("properties", 8).then((g) => (cancelled ? [] : g || [])).catch(() => []),
      AppApi.getAnalyticsGrowth("users", 8).then((g) => (cancelled ? [] : g || [])).catch(() => []),
      AppApi.getAnalyticsAccounts().then((a) => (cancelled ? [] : a || [])).catch(() => []),
      AppApi.getEngagementCounts({ startDate: startStr, endDate: endStr }).then((c) => (cancelled ? [] : c || [])).catch(() => []),
      AppApi.getEngagementTrend({ startDate: startStr, endDate: endStr }).then((tr) => (cancelled ? [] : tr || [])).catch(() => []),
    ]).then(([s, daily, gAccounts, gProps, gUsers, acctAnalytics, counts, trend]) => {
      if (cancelled) return;
      if (s) setSummary(s);
      setDailyMetrics(Array.isArray(daily) ? daily : []);
      setGrowthAccounts(Array.isArray(gAccounts) ? gAccounts : []);
      setGrowthProps(Array.isArray(gProps) ? gProps : []);
      setGrowthUsers(Array.isArray(gUsers) ? gUsers : []);
      setAccountAnalytics(Array.isArray(acctAnalytics) ? acctAnalytics : []);
      setEngagementCounts(Array.isArray(counts) ? counts : []);
      setEngagementTrend(Array.isArray(trend) ? trend : []);
      setAnalyticsLoading(false);
    });
    return () => { cancelled = true; };
  }, [timeframeDays]);

  // Use summary for platform totals when available; fallback to context
  const totalAccounts = summary?.totalAccounts ?? accounts.length;
  const totalProperties = summary?.totalProperties ?? properties?.length ?? 0;
  const totalUsers = summary?.totalUsers ?? users?.length ?? 0;

  // Role distribution from summary or context
  const roleDistribution = useMemo(() => {
    if (summary?.usersByRole?.length) {
      const dist = { homeowners: 0, agents: 0, admins: 0, superAdmins: 0 };
      summary.usersByRole.forEach(({ role, count }) => {
        const r = (role ?? "").toLowerCase();
        if (r === "homeowner") dist.homeowners = count;
        else if (r === "agent") dist.agents = count;
        else if (r === "admin") dist.admins = count;
        else if (r === "super_admin") dist.superAdmins = count;
      });
      return dist;
    }
    if (!users?.length) return { homeowners: 0, agents: 0, admins: 0, superAdmins: 0 };
    const dist = { homeowners: 0, agents: 0, admins: 0, superAdmins: 0 };
    users.forEach((u) => {
      const r = (u.role ?? "").toLowerCase();
      if (r === "homeowner") dist.homeowners++;
      else if (r === "agent") dist.agents++;
      else if (r === "admin") dist.admins++;
      else if (r === "super_admin") dist.superAdmins++;
    });
    return dist;
  }, [summary, users]);

  // Subscription data from summary or fallback
  const subscriptionData = useMemo(() => {
    if (summary?.subscriptionsByStatus?.length) {
      const segments = summary.subscriptionsByStatus.map(({ status, count }) => ({
        label: status,
        value: count,
        color: status?.toLowerCase() === "active" ? "#456564" : "#94a3b8",
      }));
      const paid = summary.subscriptionsByStatus.reduce((s, { count }) => s + count, 0) || 0;
      return { paid, free: Math.max(0, totalAccounts - paid), segments };
    }
    const paid = Math.max(0, summary?.totalSubscriptions ?? Math.round(totalAccounts * 0.35));
    const free = Math.max(0, totalAccounts - paid);
    return {
      paid,
      free,
      segments: [
        { label: t("superAdminHome.paidPlans") || "Paid", value: paid, color: "#456564" },
        { label: t("superAdminHome.freePlans") || "Free", value: free, color: "#d1d5db" },
      ],
    };
  }, [summary, totalAccounts, t]);

  // Growth chart data from API (month, count)
  const accountGrowth = useMemo(() => {
    if (!growthAccounts?.length) return [];
    return growthAccounts.map(({ month, count }) => ({ label: formatMonth(month), value: count }));
  }, [growthAccounts]);
  const propertyGrowth = useMemo(() => {
    if (!growthProps?.length) return [];
    return growthProps.map(({ month, count }) => ({ label: formatMonth(month), value: count }));
  }, [growthProps]);
  const userGrowth = useMemo(() => {
    if (!growthUsers?.length) return [];
    return growthUsers.map(({ month, count }) => ({ label: formatMonth(month), value: count }));
  }, [growthUsers]);

  // Platform KPIs from summary or computed
  const platformKpis = useMemo(() => {
    return {
      avgPropertiesPerAccount: summary
        ? String(summary.avgPropertiesPerAccount ?? 0)
        : (totalAccounts > 0 ? (totalProperties / totalAccounts).toFixed(1) : "0"),
      avgUsersPerAccount: summary
        ? String(summary.avgUsersPerAccount ?? 0)
        : (totalAccounts > 0 ? (totalUsers / totalAccounts).toFixed(1) : "0"),
      avgHealthScore: summary?.avgHpsScore ?? (properties?.length
        ? Math.round(
            properties.reduce((sum, p) => sum + (p.hps_score ?? p.hpsScore ?? p.health ?? 0), 0) / properties.length,
          )
        : 0),
      activeAccounts: totalAccounts,
    };
  }, [summary, totalAccounts, totalProperties, totalUsers, properties]);

  const roleBarData = useMemo(() => [
    { label: "HO", value: roleDistribution.homeowners },
    { label: "Agent", value: roleDistribution.agents },
    { label: "Admin", value: roleDistribution.admins },
    { label: "SA", value: roleDistribution.superAdmins },
  ], [roleDistribution]);

  // ─── Loading State (only block on initial context load) ────────────
  const isLoading = !properties && !users;

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, maxTicksLimit: 8 } },
      y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" } },
    },
  }), []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Loader2 className="w-10 h-10 text-[#456564] animate-spin mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("superAdminHome.loading") || "Loading platform dashboard..."}
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
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#456564] dark:text-emerald-400">
            {t("superAdminHome.badge") || "Platform Admin"}
          </span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
          {t("welcome")?.replace("!", "")}, {adminName}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          {t("superAdminHome.subtitle") ||
            "Platform-level overview of accounts, properties, users, and engagement."}
        </p>
      </div>

      {/* ============================================ */}
      {/* STAT CARDS                                    */}
      {/* ============================================ */}
      <SuperAdminHomeStats
        t={t}
        totalAccounts={totalAccounts}
        totalProperties={totalProperties}
        totalUsers={totalUsers}
        subscriptionData={subscriptionData}
        platformKpis={platformKpis}
        analyticsLoading={analyticsLoading}
      />

      <SuperAdminHomeKpiCharts
        t={t}
        dailyMetrics={dailyMetrics}
        timeframeDays={timeframeDays}
        setTimeframeDays={setTimeframeDays}
        TIMEFRAME_OPTIONS={TIMEFRAME_OPTIONS}
        chartOptions={chartOptions}
        accountGrowth={accountGrowth}
        propertyGrowth={propertyGrowth}
        userGrowth={userGrowth}
        analyticsLoading={analyticsLoading}
        accountAnalytics={accountAnalytics}
        subscriptionData={subscriptionData}
        roleDistribution={roleDistribution}
        roleBarData={roleBarData}
        platformKpis={platformKpis}
        totalAccounts={totalAccounts}
        engagementTrend={engagementTrend}
        engagementCounts={engagementCounts}
        summary={summary}
      />

    </div>
  );
}

export default SuperAdminHome;
