import React, {useEffect, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowLeft, Loader2} from "lucide-react";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import Banner from "../../partials/containers/Banner";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import {isAdminRole} from "../../utils/roles";
import {PAGE_LAYOUT} from "../../constants/layout";
import useBillingStatus from "../../hooks/useBillingStatus";

function AssistantFormContainer() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {id} = useParams();
  const isNew = !id || id === "new";
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const {limits, isAdmin: isBillingAdmin} = useBillingStatus();
  const accountUrl = currentAccount?.url || "";
  const isAdmin = isAdminRole(currentUser?.role);
  const canInvite =
    isBillingAdmin || isAdmin || limits?.assistantsEnabled === true;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [agents, setAgents] = useState([]);
  const [assistant, setAssistant] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    agentUserId: "",
  });
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState({
    open: false,
    type: "success",
    message: "",
  });

  useEffect(() => {
    if (isNew && !canInvite) {
      navigate(`/${accountUrl}/assistants`, {replace: true});
    }
  }, [isNew, canInvite, accountUrl, navigate]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isAdmin) {
        try {
          const list = await AppApi.getAgents();
          if (!cancelled) setAgents(Array.isArray(list) ? list : []);
        } catch (_) {
          if (!cancelled) setAgents([]);
        }
      }
      if (!isNew) {
        setLoading(true);
        try {
          const res = await AppApi.getAssistant(id);
          if (cancelled) return;
          const a = res?.assistant;
          if (!a) throw new Error("Assistant not found");
          setAssistant(a);
          setForm({
            name: a.name || "",
            email: a.email || "",
            phone: a.phone || "",
            agentUserId: a.assistantOfUserId
              ? String(a.assistantOfUserId)
              : "",
          });
        } catch (err) {
          if (!cancelled) {
            setBanner({
              open: true,
              type: "error",
              message: err?.message || "Failed to load assistant",
            });
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, isAdmin]);

  function validate() {
    const next = {};
    if (!form.name.trim()) {
      next.name = t("assistants.nameRequired", {defaultValue: "Name is required."});
    }
    if (isNew && !form.email.trim()) {
      next.email = t("assistants.emailRequired", {
        defaultValue: "Email is required.",
      });
    }
    if (isNew && isAdmin && !form.agentUserId) {
      next.agentUserId = t("assistants.agentRequired", {
        defaultValue: "Select an agent to tether this assistant to.",
      });
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isNew) {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
        };
        if (isAdmin) payload.agentUserId = Number(form.agentUserId);
        const res = await AppApi.createAssistant(payload);
        setBanner({
          open: true,
          type: "success",
          message: t("assistants.created", {
            defaultValue: "Assistant invited. An email has been sent.",
          }),
        });
        const newId = res?.assistant?.id;
        if (newId) {
          navigate(`/${accountUrl}/assistants/${newId}`, {replace: true});
        } else {
          navigate(`/${accountUrl}/assistants`);
        }
      } else {
        await AppApi.updateAssistant(id, {
          name: form.name.trim(),
          phone: form.phone.trim() || null,
        });
        setBanner({
          open: true,
          type: "success",
          message: t("assistants.updated", {
            defaultValue: "Assistant updated.",
          }),
        });
        const res = await AppApi.getAssistant(id);
        setAssistant(res?.assistant || null);
      }
    } catch (err) {
      setBanner({
        open: true,
        type: "error",
        message: err?.message || "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleResend() {
    setSaving(true);
    try {
      await AppApi.resendAssistantInvite(id);
      setBanner({
        open: true,
        type: "success",
        message: t("assistants.inviteResent", {
          defaultValue: "Invitation email resent.",
        }),
      });
    } catch (err) {
      setBanner({
        open: true,
        type: "error",
        message: err?.message || "Failed to resend invite",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke() {
    if (
      !window.confirm(
        t("assistants.revokeConfirm", {
          defaultValue:
            "Revoke this assistant? They will lose access to the agent account.",
        }),
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await AppApi.revokeAssistant(id);
      navigate(`/${accountUrl}/assistants`);
    } catch (err) {
      setBanner({
        open: true,
        type: "error",
        message: err?.message || "Failed to revoke assistant",
      });
      setSaving(false);
    }
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="grow">
          <div className={PAGE_LAYOUT.form}>
            <button
              type="button"
              onClick={() => navigate(`/${accountUrl}/assistants`)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("assistants.backToList", {defaultValue: "Back to assistants"})}
            </button>

            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
              {isNew
                ? t("assistants.invite", {defaultValue: "Invite assistant"})
                : t("assistants.edit", {defaultValue: "Edit assistant"})}
            </h1>

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
              <div className="flex items-center py-12 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {t("loading", {defaultValue: "Loading…"})}
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700/60 p-5"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("name")}
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({...f, name: e.target.value}))
                    }
                    className="form-input w-full"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("email")}
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    disabled={!isNew}
                    onChange={(e) =>
                      setForm((f) => ({...f, email: e.target.value}))
                    }
                    className="form-input w-full disabled:opacity-60"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("phone")}
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({...f, phone: e.target.value}))
                    }
                    className="form-input w-full"
                  />
                </div>

                {isNew && isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t("assistants.agent", {defaultValue: "Agent"})}
                    </label>
                    <select
                      value={form.agentUserId}
                      onChange={(e) =>
                        setForm((f) => ({...f, agentUserId: e.target.value}))
                      }
                      className="form-select w-full"
                    >
                      <option value="">
                        {t("assistants.selectAgent", {
                          defaultValue: "Select agent…",
                        })}
                      </option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} ({agent.email})
                        </option>
                      ))}
                    </select>
                    {errors.agentUserId && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.agentUserId}
                      </p>
                    )}
                  </div>
                )}

                {!isNew && assistant && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("assistants.tetheredTo", {
                      name: assistant.agentName || assistant.agentEmail || "—",
                      defaultValue: "Tethered to {{name}}",
                    })}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn bg-[#456564] hover:bg-[#3a5554] text-white disabled:opacity-50"
                  >
                    {saving && (
                      <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                    )}
                    {isNew
                      ? t("assistants.sendInvite", {
                          defaultValue: "Send invitation",
                        })
                      : t("save", {defaultValue: "Save"})}
                  </button>
                  {!isNew && !assistant?.isActive && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleResend}
                      className="btn border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                    >
                      {t("assistants.resendInvite", {
                        defaultValue: "Resend invitation",
                      })}
                    </button>
                  )}
                  {!isNew && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleRevoke}
                      className="btn border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300"
                    >
                      {t("assistants.revoke", {defaultValue: "Revoke access"})}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AssistantFormContainer;
