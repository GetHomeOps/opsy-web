import React from "react";
import { Building2, Heart, Users, Activity } from "lucide-react";
import StatCard from "./StatCard";

/**
 * Stat cards section for the Agent dashboard (Properties, Avg Health, Homeowners, Engagement).
 */
function AgentHomeStats({
  t,
  totalProperties,
  stats,
  loading = false,
  propertiesLoading = false,
  onHomeownersClick,
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Building2}
        label={t("agentHome.totalProperties") || "Properties"}
        value={totalProperties}
        subtitle={
          stats.pendingCount > 0
            ? `${stats.pendingCount} ${t("agentHome.pendingInvitations") || "pending"}`
            : `${stats.healthyCount} ${t("agentHome.healthy") || "healthy"}`
        }
        color="bg-[#456564]"
        loading={propertiesLoading}
      />
      <StatCard
        icon={Heart}
        label={t("agentHome.avgHealth") || "Avg Health Score"}
        value={`${stats.avgHealth}%`}
        subtitle={
          stats.needsAttentionCount > 0
            ? `${stats.needsAttentionCount} ${t("agentHome.needAttention") || "need attention"}`
            : t("agentHome.allOnTrack") || "All on track"
        }
        color={stats.avgHealth >= 60 ? "bg-emerald-500" : "bg-amber-500"}
        loading={propertiesLoading}
      />
      <StatCard
        icon={Users}
        label={t("agentHome.homeowners") || "Homeowners"}
        value={stats.totalHomeowners}
        subtitle={t("agentHome.activeClients") || "Active clients"}
        color="bg-blue-500"
        loading={loading}
        onClick={onHomeownersClick}
        ariaLabel="View accepted homeowners and their properties"
      />
      <StatCard
        icon={Activity}
        label={t("agentHome.engagement") || "Engagement"}
        value={`${Math.min(100, Math.round((stats.healthyCount / Math.max(stats.acceptedCount ?? totalProperties, 1)) * 100))}%`}
        subtitle={t("agentHome.propertyCompletion") || "Portfolio health rate"}
        color="bg-purple-500"
        loading={propertiesLoading}
      />
    </div>
  );
}

export default AgentHomeStats;
