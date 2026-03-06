import React from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  Building2,
  Users,
  Activity,
  BarChart3,
  Shield,
  Heart,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Eye,
  MousePointerClick,
  Clock,
  UserCircle,
} from "lucide-react";
import "./chartConfig";

function AgentHomeKpiCharts({
  t,
  totalProperties,
  totalUsers,
  totalContacts,
  portfolioBarData,
  portfolioDoughnutData,
  chartOptions,
  healthDoughnutData,
  healthDistribution,
  stats,
  engagementLineOptions,
  engagementCounts,
  engagementTrend,
  engagementLoading,
  healthByPropertyData,
  teamByPropertyData,
  isLoadingTeams,
}) {
  return (
    <>
      {/* Portfolio Analytics */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("agentHome.portfolioAnalytics") || "Portfolio Analytics"}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("agentHome.portfolioOverview") || "Portfolio Overview"}
              </h3>
              <Building2 className="w-4 h-4 text-[#456564]/70" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("agentHome.portfolioOverviewDesc") ||
                "Properties, users, and contacts in your portfolio"}
            </p>
            <div className="h-44">
              <Bar
                data={portfolioBarData}
                options={{
                  ...chartOptions,
                  indexAxis: "y",
                  plugins: {
                    ...chartOptions.plugins,
                    tooltip: {
                      ...chartOptions.plugins?.tooltip,
                      callbacks: { label: (ctx) => `${ctx.raw}` },
                    },
                  },
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#456564]" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {totalProperties} {t("agentHome.totalProperties") || "Properties"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {totalUsers} {t("agentHome.users") || "Users"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {totalContacts} {t("contacts") || "Contacts"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("agentHome.portfolioMix") || "Portfolio Mix"}
              </h3>
              <Activity className="w-4 h-4 text-[#456564]/70" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("agentHome.portfolioMixDesc") ||
                "Distribution across your portfolio"}
            </p>
            {portfolioDoughnutData ? (
              <>
                <div className="h-44 flex items-center justify-center">
                  <Doughnut
                    data={portfolioDoughnutData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: "68%",
                      plugins: {
                        legend: { display: false },
                        tooltip: chartOptions.plugins?.tooltip,
                      },
                    }}
                  />
                </div>
                <div className="flex justify-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {[
                    {
                      key: "properties",
                      value: totalProperties,
                      color: "#456564",
                      icon: Building2,
                    },
                    { key: "users", value: totalUsers, color: "#3b82f6", icon: UserCircle },
                    {
                      key: "contacts",
                      value: totalContacts,
                      color: "#8b5cf6",
                      icon: Users,
                    },
                  ].map(({ key, value, color, icon: Icon }) => (
                    <div key={key} className="flex flex-col items-center gap-1">
                      <Icon className="w-4 h-4 opacity-70" style={{ color }} />
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                <Activity className="w-10 h-10 mb-2 opacity-50" />
                No data yet. Add properties, users, or contacts to see your mix.
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("agentHome.healthDistribution") || "Health Distribution"}
              </h3>
              <Shield className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("agentHome.healthDistributionDescription") ||
                "Property health scores across your portfolio"}
            </p>
            {healthDoughnutData ? (
              <>
                <div className="h-44 flex items-center justify-center">
                  <Doughnut
                    data={healthDoughnutData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: "65%",
                      plugins: {
                        legend: { display: false },
                        tooltip: chartOptions.plugins?.tooltip,
                      },
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {stats.healthyCount} {t("agentHome.healthy") || "healthy"}
                    </span>
                  </div>
                  {stats.needsAttentionCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {stats.needsAttentionCount}{" "}
                        {t("agentHome.needAttention") || "need attention"}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {healthDistribution.map((bucket) => (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right font-mono">
                      {bucket.label}
                    </span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-700"
                        style={{
                          width: `${totalProperties > 0 ? (bucket.value / totalProperties) * 100 : 0}%`,
                          backgroundColor: bucket.color,
                          minWidth: bucket.value > 0 ? "12px" : "0px",
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-6 text-right">
                      {bucket.value}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {stats.healthyCount} {t("agentHome.healthy") || "healthy"}
                    </span>
                  </div>
                  {stats.needsAttentionCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {stats.needsAttentionCount}{" "}
                        {t("agentHome.needAttention") || "need attention"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Engagement Analytics */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("agentHome.engagementAnalytics") || "Engagement Analytics"}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("agentHome.engagementTrend") || "Engagement Trend"}
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {t("agentHome.last30Days") || "Last 30 days"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("agentHome.engagementTrendDesc") ||
                "Daily engagement events across your portfolio"}
            </p>
            {engagementLoading && !engagementTrend.length ? (
              <div className="h-44 flex items-center justify-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : engagementTrend.length > 0 ? (
              <div className="h-44">
                <Line
                  data={{
                    labels: engagementTrend.map((d) => d.date?.slice(5, 10) ?? d.date),
                    datasets: [
                      {
                        label: "Events",
                        data: engagementTrend.map((d) => d.count ?? 0),
                        borderColor: "#456564",
                        backgroundColor: "rgba(69, 101, 100, 0.15)",
                        fill: true,
                        tension: 0.3,
                        pointRadius: 2,
                      },
                    ],
                  }}
                  options={engagementLineOptions}
                />
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                <Activity className="w-8 h-8 mb-2 opacity-40" />
                {t("agentHome.noEngagementData") ||
                  "No engagement events yet. Events appear as homeowners interact with their properties."}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="text-center">
                <Eye className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {engagementCounts.reduce((s, c) => s + (c.count ?? 0), 0)}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {t("agentHome.totalEvents") || "Total events"}
                </p>
              </div>
              <div className="text-center">
                <MousePointerClick className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {engagementCounts.length}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {t("agentHome.eventTypes") || "Event types"}
                </p>
              </div>
              <div className="text-center">
                <Clock className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {engagementTrend.length}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {t("agentHome.daysWithData") || "Days with data"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("agentHome.eventsByType") || "Events by Type"}
              </h3>
              <BarChart3 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("agentHome.eventsByTypeDesc") ||
                "Breakdown of engagement event types"}
            </p>
            {engagementLoading && !engagementCounts.length ? (
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
                      cutout: "60%",
                      plugins: {
                        legend: {
                          position: "right",
                          labels: { boxWidth: 10, padding: 8, font: { size: 11 } },
                        },
                      },
                    }}
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  {engagementCounts.slice(0, 5).map((c) => (
                    <div
                      key={c.eventType ?? c.event_type}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600 dark:text-gray-400 truncate">
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
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
                {t("agentHome.noEventTypes") || "No events by type yet."}
              </div>
            )}
          </div>
        </div>

        {/* Health by Property & Team Size */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("agentHome.healthByProperty") || "Health Score by Property"}
              </h3>
              <Heart className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("agentHome.healthByPropertyDesc") ||
                "Individual property health scores across your portfolio"}
            </p>
            {healthByPropertyData ? (
              <div className="h-48">
                <Bar
                  data={healthByPropertyData}
                  options={{
                    ...chartOptions,
                    indexAxis: "y",
                    scales: {
                      x: { ...chartOptions.scales?.x, max: 100 },
                      y: {
                        ...chartOptions.scales?.y,
                        grid: { display: false },
                        ticks: { font: { size: 10 } },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                <Heart className="w-8 h-8 mb-2 opacity-40" />
                {t("agentHome.noHealthData") || "Add properties to see health scores."}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/60 dark:border-gray-700/50 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t("agentHome.teamByProperty") || "Team Size by Property"}
              </h3>
              <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t("agentHome.teamByPropertyDesc") ||
                "Number of team members assigned per property"}
            </p>
            {teamByPropertyData ? (
              <div className="h-48">
                <Bar
                  data={teamByPropertyData}
                  options={{
                    ...chartOptions,
                    indexAxis: "y",
                    scales: {
                      x: { ...chartOptions.scales?.x, ticks: { stepSize: 1 } },
                      y: {
                        ...chartOptions.scales?.y,
                        grid: { display: false },
                        ticks: { font: { size: 10 } },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-sm border border-dashed border-gray-200 dark:border-gray-600 rounded-lg">
                <Users className="w-8 h-8 mb-2 opacity-40" />
                {isLoadingTeams
                  ? "Loading team data..."
                  : t("agentHome.noTeamData") || "No team data yet."}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default AgentHomeKpiCharts;
