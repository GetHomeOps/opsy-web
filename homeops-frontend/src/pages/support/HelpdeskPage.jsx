import React, {useState, useEffect, useCallback, useMemo} from "react";
import {useParams, useNavigate} from "react-router-dom";
import {motion} from "framer-motion";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";
import {
  Loader2,
  MessageSquare,
  MessageCircle,
  SlidersHorizontal,
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Headset,
} from "lucide-react";
import {
  supportToColumnStatus,
  feedbackToColumnStatus,
  dataAdjustmentToColumnStatus,
} from "./kanbanConfig";

function HelpdeskPage() {
  const {accountUrl} = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const list = await AppApi.getAllSupportTickets();
      setAllTickets(list || []);
    } catch {
      setAllTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const tierToPriority = (tier) => {
    const t = (tier || "").toLowerCase();
    if (["premium", "win"].includes(t)) return "urgent";
    if (["pro", "maintain"].includes(t)) return "high";
    if (["agent", "basic"].includes(t)) return "medium";
    return "low";
  };

  const stats = useMemo(() => {
    const support = allTickets.filter((t) => t.type === "support");
    const feedback = allTickets.filter((t) => t.type === "feedback");
    const dataAdj = allTickets.filter((t) => t.type === "data_adjustment");

    const getStats = (list, toCol, variant) => {
      const total = list.length;
      const newCount = list.filter((t) => toCol(t.status) === "new").length;
      const inProgress = list.filter(
        (t) => toCol(t.status) === "in_progress",
      ).length;
      const completed = list.filter(
        (t) => toCol(t.status) === "completed",
      ).length;
      const urgent =
        variant === "support"
          ? list.filter((t) => tierToPriority(t.subscriptionTier) === "urgent")
              .length
          : 0;
      return {total, newCount, inProgress, completed, urgent};
    };

    return {
      support: getStats(support, supportToColumnStatus, "support"),
      feedback: getStats(feedback, feedbackToColumnStatus, "feedback"),
      data_adjustment: getStats(
        dataAdj,
        dataAdjustmentToColumnStatus,
        "data_adjustment",
      ),
    };
  }, [allTickets]);

  const cards = [
    {
      key: "support",
      title: "Support",
      description: "Customer support tickets and issue resolution",
      icon: MessageSquare,
      path: `/${accountUrl}/helpdesk/support`,
      color: "from-sky-500 to-blue-600",
      lightBg: "bg-sky-50 dark:bg-sky-900/20",
      iconColor: "text-sky-600 dark:text-sky-400",
      ringColor: "ring-sky-200 dark:ring-sky-800",
      stats: stats.support,
    },
    {
      key: "feedback",
      title: "Feedback",
      description: "Product feedback and feature requests",
      icon: MessageCircle,
      path: `/${accountUrl}/helpdesk/feedback`,
      color: "from-violet-500 to-purple-600",
      lightBg: "bg-violet-50 dark:bg-violet-900/20",
      iconColor: "text-violet-600 dark:text-violet-400",
      ringColor: "ring-violet-200 dark:ring-violet-800",
      stats: stats.feedback,
    },
    {
      key: "data_adjustment",
      title: "Data Adjustments",
      description: "RentCast data change and correction requests",
      icon: SlidersHorizontal,
      path: `/${accountUrl}/helpdesk/data-adjustments`,
      color: "from-amber-500 to-orange-600",
      lightBg: "bg-amber-50 dark:bg-amber-900/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      ringColor: "ring-amber-200 dark:ring-amber-800",
      stats: stats.data_adjustment,
    },
  ];

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className={`${PAGE_LAYOUT.list}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20">
                <Headset className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                  Helpdesk
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage support tickets, feedback, and data adjustment requests
                </p>
              </div>
            </div>

            {/* Global KPIs */}
            <div className="flex flex-wrap gap-3 mb-8 mt-6">
              {[
                {
                  label: "Total Open",
                  value: loading
                    ? "—"
                    : stats.support.total +
                      stats.feedback.total +
                      stats.data_adjustment.total,
                  icon: Headset,
                  bg: "bg-slate-50 dark:bg-slate-800/50",
                  ic: "text-slate-500",
                },
                {
                  label: "New",
                  value: loading
                    ? "—"
                    : stats.support.newCount +
                      stats.feedback.newCount +
                      stats.data_adjustment.newCount,
                  icon: Inbox,
                  bg: "bg-blue-50 dark:bg-blue-900/20",
                  ic: "text-blue-500",
                },
                {
                  label: "In Progress",
                  value: loading
                    ? "—"
                    : stats.support.inProgress +
                      stats.feedback.inProgress +
                      stats.data_adjustment.inProgress,
                  icon: Clock,
                  bg: "bg-amber-50 dark:bg-amber-900/20",
                  ic: "text-amber-500",
                },
                {
                  label: "Resolved",
                  value: loading
                    ? "—"
                    : stats.support.completed +
                      stats.feedback.completed +
                      stats.data_adjustment.completed,
                  icon: CheckCircle2,
                  bg: "bg-emerald-50 dark:bg-emerald-900/20",
                  ic: "text-emerald-500",
                },
                {
                  label: "Urgent",
                  value: loading ? "—" : stats.support.urgent,
                  icon: AlertTriangle,
                  bg: "bg-red-50 dark:bg-red-900/20",
                  ic: "text-red-500",
                  hide: !loading && stats.support.urgent === 0,
                },
              ]
                .filter((k) => !k.hide)
                .map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <div
                      key={kpi.label}
                      className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-gray-200/60 dark:border-gray-700/40 ${kpi.bg}`}
                    >
                      <Icon className={`w-4 h-4 ${kpi.ic}`} strokeWidth={2} />
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {kpi.value}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {kpi.label}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Category Cards */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {cards.map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <motion.div
                      key={card.key}
                      initial={{opacity: 0, y: 20}}
                      animate={{opacity: 1, y: 0}}
                      transition={{delay: idx * 0.08, duration: 0.35}}
                    >
                      <button
                        type="button"
                        onClick={() => navigate(card.path)}
                        className="w-full text-left group relative rounded-2xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 dark:focus:ring-offset-gray-900"
                      >
                        {/* Gradient accent strip */}
                        <div
                          className={`h-1.5 bg-gradient-to-r ${card.color}`}
                        />

                        <div className="p-6">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div
                              className={`flex items-center justify-center w-11 h-11 rounded-xl ${card.lightBg}`}
                            >
                              <Icon
                                className={`w-5.5 h-5.5 ${card.iconColor}`}
                                strokeWidth={1.75}
                              />
                            </div>
                            <ArrowRight className="w-4.5 h-4.5 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                          </div>

                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-1">
                            {card.title}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                            {card.description}
                          </p>

                          {/* Mini KPIs */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 px-3 py-2.5 text-center">
                              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                                {card.stats.total}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Total
                              </p>
                            </div>
                            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5 text-center">
                              <p className="text-xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
                                {card.stats.newCount}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                New
                              </p>
                            </div>
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-center">
                              <p className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                                {card.stats.inProgress}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Active
                              </p>
                            </div>
                          </div>

                          {/* Urgent indicator for support only */}
                          {card.key === "support" &&
                            card.stats.urgent > 0 && (
                              <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {card.stats.urgent} urgent{" "}
                                {card.stats.urgent === 1
                                  ? "ticket"
                                  : "tickets"}
                              </div>
                            )}
                        </div>
                      </button>
                    </motion.div>
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

export default HelpdeskPage;
