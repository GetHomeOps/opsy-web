import React, {useState, useEffect, useCallback} from "react";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  UserPlus,
  MessageSquare,
  Eye,
  Users,
  RefreshCw,
} from "lucide-react";

function AgentAnalytics() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAgents, setExpandedAgents] = useState(new Set());

  const fetchAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await AppApi.getAgentAnalytics();
      setAgents(list || []);
    } catch (err) {
      setError(err?.messages?.[0] || err?.message || "Failed to load agent analytics");
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const toggleAgent = (agentId) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex flex-col flex-1 min-h-0 overflow-auto">
          <div className={`${PAGE_LAYOUT.listPaddingX} py-6`}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  Agent Analytics
                </h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Agent users, their properties, homeowner counts, invitations, communications, and engagement.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAgents}
                disabled={loading}
                className="flex items-center gap-2 btn bg-[#456564] text-white hover:bg-[#3a5554] disabled:opacity-50 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {loading && agents.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-gray-500 dark:text-gray-400">Loading agent analytics...</p>
              </div>
            ) : agents.length === 0 ? (
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No agent users found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {agents.map((agent) => {
                  const isExpanded = expandedAgents.has(agent.agentId);
                  const accounts = Array.isArray(agent.accounts) ? agent.accounts : [];
                  const properties = agent.properties || [];

                  return (
                    <div
                      key={agent.agentId}
                      className="rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleAgent(agent.agentId)}
                        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {agent.agentName || agent.agentEmail || `Agent #${agent.agentId}`}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {agent.agentEmail}
                          </p>
                          {accounts.length > 0 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {accounts.map((a) => a.name).join(", ")}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                            <Building2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {agent.propertiesCount ?? 0} properties
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                            <UserPlus className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {agent.invitationsSent ?? 0} invited
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                            <MessageSquare className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {agent.communicationsSent ?? 0} comms
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 px-2.5 py-1">
                            <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {agent.pageViews ?? 0} visits
                            </span>
                          </div>
                        </div>
                      </button>

                      {isExpanded && properties.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 px-5 py-4">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Properties & Homeowners
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                                  <th className="pb-2 pr-4">Property</th>
                                  <th className="pb-2 pr-4">Address</th>
                                  <th className="pb-2 text-right">Homeowners</th>
                                </tr>
                              </thead>
                              <tbody>
                                {properties.map((prop) => (
                                  <tr
                                    key={prop.propertyId}
                                    className="border-b border-gray-100 dark:border-gray-700/60 last:border-0"
                                  >
                                    <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">
                                      {prop.propertyName || `Property #${prop.propertyId}`}
                                    </td>
                                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                                      {[prop.address, prop.city, prop.state]
                                        .filter(Boolean)
                                        .join(", ") || "—"}
                                    </td>
                                    <td className="py-2 text-right">
                                      <span className="inline-flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5" />
                                        {prop.homeownersCount ?? 0}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {isExpanded && properties.length === 0 && (
                        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No properties for this agent.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AgentAnalytics;
