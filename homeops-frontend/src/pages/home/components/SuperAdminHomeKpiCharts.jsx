import React from "react";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import {
  Database,
  Building2,
  Users,
  CreditCard,
  TrendingUp,
  Activity,
  Globe,
  Shield,
  Eye,
  MousePointerClick,
  Clock,
  UserCheck,
  UserPlus,
  Layers,
  Sparkles,
  PieChart,
  BarChart3,
} from "lucide-react";
import MiniBarChart from "./MiniBarChart";
import DonutChart from "./DonutChart";
import MetricRow from "./MetricRow";
import "./chartConfig";

/**
 * All KPI chart sections for the SuperAdmin dashboard: daily metrics, growth, account analytics,
 * subscriptions & users, platform engagement.
 */
function SuperAdminHomeKpiCharts({
  t,
  dailyMetrics,
  timeframeDays,
  setTimeframeDays,
  TIMEFRAME_OPTIONS,
  chartOptions,
  accountGrowth,
  propertyGrowth,
  userGrowth,
  analyticsLoading,
  accountAnalytics,
  subscriptionData,
  roleDistribution,
  roleBarData,
  platformKpis,
  totalAccounts,
  engagementTrend,
  engagementCounts,
  summary,
}) {
  return (
    <>
      {/* Daily Platform Metrics */}
      {dailyMetrics?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.dailyPlatformMetrics") ||
                  "Daily Platform Metrics"}
              </h2>
            </div>
            <select
              value={timeframeDays}
              onChange={(e) => setTimeframeDays(Number(e.target.value))}
              className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#456564]/40 transition-colors cursor-pointer"
            >
              {TIMEFRAME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Cumulative totals (users, accounts, properties) over the last{" "}
              {TIMEFRAME_OPTIONS.find((o) => o.value === timeframeDays)?.label?.toLowerCase() ||
                `${timeframeDays} days`}{" "}
              from platform data.
            </p>
            <div className="h-64">
              <Line
                data={{
                  labels: dailyMetrics.map((d) => d.date?.slice(0, 10) ?? d.date),
                  datasets: [
                    {
                      label: "Users",
                      data: dailyMetrics.map((d) => d.total_users ?? 0),
                      borderColor: "#8b5cf6",
                      backgroundColor: "rgba(139, 92, 246, 0.1)",
                      fill: true,
                      tension: 0.3,
                    },
                    {
                      label: "Accounts",
                      data: dailyMetrics.map((d) => d.total_accounts ?? 0),
                      borderColor: "#456564",
                      backgroundColor: "rgba(69, 101, 100, 0.1)",
                      fill: true,
                      tension: 0.3,
                    },
                    {
                      label: "Properties",
                      data: dailyMetrics.map((d) => d.total_properties ?? 0),
                      borderColor: "#3b82f6",
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                      fill: true,
                      tension: 0.3,
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </section>
      )}

      {/* Growth Charts */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("superAdminHome.growthMetrics") || "Growth Metrics"}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.accountGrowth") || "Accounts"}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {t("superAdminHome.last8Months") || "Last 8 months"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              New accounts created per month
            </p>
            {analyticsLoading && !accountGrowth.length ? (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : accountGrowth.length > 0 ? (
              <div className="h-32">
                <Bar
                  data={{
                    labels: accountGrowth.map((d) => d.label),
                    datasets: [
                      {
                        label: "Accounts",
                        data: accountGrowth.map((d) => d.value),
                        backgroundColor: "#456564",
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            ) : (
              <MiniBarChart data={accountGrowth} barColor="#456564" />
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.propertyGrowth") || "Properties"}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {t("superAdminHome.last8Months") || "Last 8 months"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              New properties created per month
            </p>
            {analyticsLoading && !propertyGrowth.length ? (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : propertyGrowth.length > 0 ? (
              <div className="h-32">
                <Bar
                  data={{
                    labels: propertyGrowth.map((d) => d.label),
                    datasets: [
                      {
                        label: "Properties",
                        data: propertyGrowth.map((d) => d.value),
                        backgroundColor: "#3b82f6",
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            ) : (
              <MiniBarChart data={propertyGrowth} barColor="#3b82f6" />
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.userGrowth") || "Users"}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {t("superAdminHome.last8Months") || "Last 8 months"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              New users registered per month
            </p>
            {analyticsLoading && !userGrowth.length ? (
              <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : userGrowth.length > 0 ? (
              <div className="h-32">
                <Bar
                  data={{
                    labels: userGrowth.map((d) => d.label),
                    datasets: [
                      {
                        label: "Users",
                        data: userGrowth.map((d) => d.value),
                        backgroundColor: "#8b5cf6",
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            ) : (
              <MiniBarChart data={userGrowth} barColor="#8b5cf6" />
            )}
          </div>
        </div>
      </section>

      {/* Account Analytics */}
      {accountAnalytics?.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("superAdminHome.accountAnalytics") || "Account Analytics"}
            </h2>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm overflow-x-auto">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Per-account rollup: properties, users, systems, maintenance
              records, avg HPS score.
            </p>
            <div className="h-64 min-w-[400px]">
              <Bar
                data={{
                  labels: accountAnalytics
                    .slice(0, 10)
                    .map((d) => d.account_name || "DB " + d.account_id),
                  datasets: [
                    {
                      label: "Properties",
                      data: accountAnalytics
                        .slice(0, 10)
                        .map((d) => d.total_properties ?? 0),
                      backgroundColor: "#3b82f6",
                    },
                    {
                      label: "Users",
                      data: accountAnalytics
                        .slice(0, 10)
                        .map((d) => d.total_users ?? 0),
                      backgroundColor: "#8b5cf6",
                    },
                    {
                      label: "Maintenance",
                      data: accountAnalytics
                        .slice(0, 10)
                        .map((d) => d.total_maintenance_records ?? 0),
                      backgroundColor: "#f59e0b",
                    },
                  ],
                }}
                options={{
                  ...chartOptions,
                  scales: {
                    ...chartOptions.scales,
                    x: { stacked: false },
                    y: { ...chartOptions.scales?.y, stacked: false },
                  },
                }}
              />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
              {accountAnalytics.slice(0, 5).map((row) => (
                <div
                  key={row.account_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]"
                    title={row.account_name}
                  >
                    {row.account_name}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {row.total_properties ?? 0} props · {row.total_users ?? 0}{" "}
                    users · {row.total_maintenance_records ?? 0} maint · HPS{" "}
                    {row.avg_hps_score ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Subscriptions & User Breakdown */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("superAdminHome.subscriptionsAndUsers") ||
              "Subscriptions & Users"}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.subscriptionBreakdown") ||
                  "Subscription Breakdown"}
              </h3>
              <CreditCard className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
              {t("superAdminHome.subscriptionDescription") ||
                "Paid vs free plans across all accounts"}
            </p>
            <DonutChart segments={subscriptionData.segments} />
            <div className="flex justify-center gap-6 mt-5">
              {subscriptionData.segments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {seg.label}
                  </span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {seg.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.usersByRole") || "Users by Role"}
              </h3>
              <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("superAdminHome.usersByRoleDescription") ||
                "Platform user distribution across all roles"}
            </p>
            <MiniBarChart data={roleBarData} barColor="#8b5cf6" height={100} />
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-0">
              <MetricRow
                label={t("superAdminHome.homeowners") || "Homeowners"}
                value={roleDistribution.homeowners}
                icon={UserCheck}
                color="text-blue-400"
              />
              <MetricRow
                label={t("superAdminHome.agents") || "Agents"}
                value={roleDistribution.agents}
                icon={UserPlus}
                color="text-emerald-400"
              />
              <MetricRow
                label={t("superAdminHome.admins") || "Admins"}
                value={roleDistribution.admins}
                icon={Shield}
                color="text-amber-400"
              />
              <MetricRow
                label={t("superAdminHome.superAdmins") || "Super Admins"}
                value={roleDistribution.superAdmins}
                icon={Sparkles}
                color="text-purple-400"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.platformKpis") || "Platform KPIs"}
              </h3>
              <Layers className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("superAdminHome.platformKpisDescription") ||
                "Key performance indicators at a glance"}
            </p>
            <div className="space-y-0 divide-y divide-gray-100 dark:divide-gray-700">
              <MetricRow
                label={
                  t("superAdminHome.avgPropertiesPerAccount") ||
                  "Avg Properties / Account"
                }
                value={platformKpis.avgPropertiesPerDb}
                icon={Building2}
                color="text-blue-400"
              />
              <MetricRow
                label={
                  t("superAdminHome.avgUsersPerAccount") || "Avg Users / Account"
                }
                value={platformKpis.avgUsersPerDb}
                icon={Users}
                color="text-purple-400"
              />
              <MetricRow
                label={
                  t("superAdminHome.platformAvgHealth") || "Platform Avg Health"
                }
                value={`${platformKpis.avgHealthScore}%`}
                icon={Activity}
                color={
                  platformKpis.avgHealthScore >= 60
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              />
              <MetricRow
                label={
                  t("superAdminHome.activeAccounts") || "Active Accounts"
                }
                value={`${platformKpis.activeAccounts} / ${totalAccounts}`}
                icon={Database}
                color="text-[#456564]"
              />
              <MetricRow
                label={
                  t("superAdminHome.paidConversionRate") || "Paid Conversion"
                }
                value={`${totalAccounts > 0 ? Math.round((subscriptionData.paid / totalAccounts) * 100) : 0}%`}
                icon={CreditCard}
                color="text-emerald-400"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Platform Engagement */}
      <section className="pb-8">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("superAdminHome.engagementAnalytics") || "Platform Engagement"}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.engagementTrend") || "Engagement Trend"}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Daily events (
                {TIMEFRAME_OPTIONS.find((o) => o.value === timeframeDays)?.label?.toLowerCase() ||
                  `last ${timeframeDays} days`}
                )
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Event count per day from platform_engagement_events
            </p>
            {analyticsLoading && !engagementTrend.length ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : engagementTrend.length > 0 ? (
              <div className="h-40">
                <Line
                  data={{
                    labels: engagementTrend.map(
                      (d) => d.date?.slice(0, 10) ?? d.date
                    ),
                    datasets: [
                      {
                        label: "Events",
                        data: engagementTrend.map((d) => d.count ?? 0),
                        borderColor: "#456564",
                        backgroundColor: "rgba(69, 101, 100, 0.15)",
                        fill: true,
                        tension: 0.3,
                      },
                    ],
                  }}
                  options={chartOptions}
                />
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                No engagement events yet. Events appear when users log in and
                perform actions.
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="text-center">
                <Eye className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {engagementCounts.reduce((s, c) => s + (c.count ?? 0), 0)}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Total events
                </p>
              </div>
              <div className="text-center">
                <MousePointerClick className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {engagementCounts.length}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Event types
                </p>
              </div>
              <div className="text-center">
                <Clock className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {engagementTrend.length}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  Days with data
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("superAdminHome.engagementByType") || "Events by Type"}
              </h3>
              <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Counts from platform_engagement_events (login, page_view,
              property_created, etc.)
            </p>
            {analyticsLoading && !engagementCounts.length ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : engagementCounts.length > 0 ? (
              <>
                <div className="h-48 flex items-center justify-center">
                  <Doughnut
                    data={{
                      labels: engagementCounts.map(
                        (c) => c.eventType ?? c.event_type ?? "—"
                      ),
                      datasets: [
                        {
                          data: engagementCounts.map((c) => c.count ?? 0),
                          backgroundColor: [
                            "#456564",
                            "#3b82f6",
                            "#8b5cf6",
                            "#f59e0b",
                            "#10b981",
                            "#94a3b8",
                            "#ec4899",
                          ],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: "right" } },
                    }}
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  {engagementCounts.slice(0, 6).map((c) => (
                    <div
                      key={c.eventType ?? c.event_type}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600 dark:text-gray-400">
                        {c.eventType ?? c.event_type}
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {c.count ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                No events by type yet.
              </div>
            )}
          </div>
        </div>

        {/* Platform Activity Summary */}
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            {t("superAdminHome.platformActivity") || "Platform Activity"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label:
                  t("superAdminHome.newUsersLast30") || "New users (30d)",
                value: summary?.newUsersLast30d ?? "—",
                color: "bg-purple-500",
                icon: UserPlus,
              },
              {
                label:
                  t("superAdminHome.newAccountsLast30") ||
                  "New accounts (30d)",
                value: summary?.newAccountsLast30d ?? "—",
                color: "bg-[#456564]",
                icon: Database,
              },
              {
                label:
                  t("superAdminHome.newPropertiesLast30") ||
                  "New properties (30d)",
                value: summary?.newPropertiesLast30d ?? "—",
                color: "bg-blue-500",
                icon: Building2,
              },
              {
                label:
                  t("superAdminHome.totalMaintenanceRecords") ||
                  "Maintenance records",
                value: summary?.totalMaintenanceRecords ?? "—",
                color: "bg-amber-500",
                icon: Activity,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}
                >
                  <item.icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {item.label}
                  </p>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default SuperAdminHomeKpiCharts;
