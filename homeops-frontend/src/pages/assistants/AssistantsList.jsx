import React, {useCallback, useEffect, useState} from "react";
import {Link, useNavigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {Loader2, Plus, UserRound} from "lucide-react";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import Banner from "../../partials/containers/Banner";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import {isAdminRole} from "../../utils/roles";
import {PAGE_LAYOUT} from "../../constants/layout";
import useBillingStatus from "../../hooks/useBillingStatus";

function statusLabel(assistant, t) {
  if (assistant.isActive) {
    return t("assistants.statusActive", {defaultValue: "Active"});
  }
  if (assistant.pendingInvitationId) {
    return t("assistants.statusPending", {defaultValue: "Pending invite"});
  }
  return t("assistants.statusInactive", {defaultValue: "Inactive"});
}

function AssistantsList() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const {limits, isAdmin: isBillingAdmin} = useBillingStatus();
  const accountUrl = currentAccount?.url || "";
  const isAdmin = isAdminRole(currentUser?.role);
  const canInvite =
    isBillingAdmin || isAdmin || limits?.assistantsEnabled === true;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [assistants, setAssistants] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [banner, setBanner] = useState({open: false, type: "success", message: ""});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await AppApi.getAssistants();
      setAssistants(res?.assistants || []);
      setUsage(res?.usage || null);
    } catch (err) {
      setError(err?.message || "Failed to load assistants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className={PAGE_LAYOUT.list}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {t("assistants.title", {defaultValue: "Assistants"})}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t("assistants.subtitle", {
                    defaultValue:
                      "Invite team assistants tethered to an agent account. Assistants cannot manage billing.",
                  })}
                </p>
                {usage?.current != null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t("assistants.usageCount", {
                      count: usage.current,
                      defaultValue: "{{count}} assistant(s)",
                    })}
                  </p>
                )}
              </div>
              {canInvite && (
                <button
                  type="button"
                  onClick={() => navigate(`/${accountUrl}/assistants/new`)}
                  className="inline-flex items-center gap-2 btn btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  {t("assistants.invite", {defaultValue: "Invite assistant"})}
                </button>
              )}
            </div>
            {!canInvite && !isAdmin && (
              <p className="mb-4 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                {t("assistants.featureLocked", {
                  defaultValue:
                    "Your plan does not include inviting new assistants. Existing assistants remain active until revoked.",
                })}
              </p>
            )}

            {banner.open && (
              <Banner
                type={banner.type}
                open={banner.open}
                setOpen={(open) => setBanner((b) => ({...b, open}))}
                className="mb-4"
              >
                {banner.message}
              </Banner>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                {t("loading", {defaultValue: "Loading…"})}
              </div>
            ) : error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            ) : assistants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-6 py-12 text-center">
                <UserRound className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-700 dark:text-gray-200 font-medium">
                  {t("assistants.emptyTitle", {
                    defaultValue: "No assistants yet",
                  })}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                  {t("assistants.emptyBody", {
                    defaultValue:
                      "Invite someone to help manage your Opsy workspace.",
                  })}
                </p>
                {canInvite && (
                  <button
                    type="button"
                    onClick={() => navigate(`/${accountUrl}/assistants/new`)}
                    className="btn btn-primary"
                  >
                    {t("assistants.invite", {defaultValue: "Invite assistant"})}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table-auto w-full text-sm">
                    <thead className="text-xs uppercase text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">
                          {t("name")}
                        </th>
                        <th className="px-4 py-3 text-left font-semibold">
                          {t("email")}
                        </th>
                        {isAdmin && (
                          <th className="px-4 py-3 text-left font-semibold">
                            {t("assistants.agent", {defaultValue: "Agent"})}
                          </th>
                        )}
                        <th className="px-4 py-3 text-left font-semibold">
                          {t("status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                      {assistants.map((a) => (
                        <tr
                          key={a.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-900/30"
                        >
                          <td className="px-4 py-3">
                            <Link
                              to={`/${accountUrl}/assistants/${a.id}`}
                              className="font-medium text-[var(--opsy-accent,#456564)] hover:underline"
                            >
                              {a.name || "—"}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {a.email}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                              {a.agentName || a.agentEmail || "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {statusLabel(a, t)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AssistantsList;
