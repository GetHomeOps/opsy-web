import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  Zap,
  Image as ImageIcon,
} from "lucide-react";

import Banner from "../../partials/containers/Banner";
import AppApi from "../../api/api";
import {useAuth} from "../../context/AuthContext";
import {PAGE_LAYOUT, SETTINGS_CARD} from "../../constants/layout";
import ModalBlank from "../../components/ModalBlank";
import EmailTestSendModal from "./EmailTestSendModal";
import RichTextEditor from "./RichTextEditor";
import EmailCustomerIoIconSlot from "./EmailCustomerIoIconSlot";

const PROVIDER_LABELS = {
  ses: "AWS SES",
  customer_io: "Customer.io",
  inherit: "Inherit default",
};

const STATUS_LABELS = {
  ready: "Ready",
  ses_not_configured: "SES not configured",
  customer_io_not_configured: "Customer.io not configured",
  missing_transactional_id: "Missing transactional ID",
  missing_event_name: "Missing event name",
  missing_customer_io_config: "Missing Customer.io config",
};

function statusBadgeClass(status) {
  if (status === "ready") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  }
  return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
}

/** Liquid references for merge keys Opsy sends in Customer.io track `data` / transactional `message_data`. */
function customerIoLiquidSnippet(mode, mergeKey) {
  const key = mergeKey.trim();
  if (mode === "transactional") {
    return `{{trigger.${key}}}`;
  }
  return `{{event.${key}}}`;
}

/** Mirrors GET /templates/:emailType hydration so cancel can restore pristine form. */
function buildFormFromDetailResponse(res) {
  if (!res?.template) return {};
  const t = res.template;
  return {
    provider: t.provider,
    sesSubject: res.rawTemplate?.subject ?? t.sesSubject ?? "",
    sesHtmlBody: res.rawTemplate?.body ?? t.sesHtmlBody ?? "",
    showFooter: t.showFooter !== false,
    footerImageUrl: t.footerImageUrl ?? "",
    customerIoMode: t.customerIoMode || "event",
    customerIoTransactionalId: t.customerIoTransactionalId ?? "",
    customerIoEventName: t.customerIoEventName || "",
    customerIoIcons: t.customerIoIcons ?? {},
  };
}

function templateFormEquals(a, b) {
  if (!a || !b) return a === b;
  return (
    a.provider === b.provider &&
    a.sesSubject === b.sesSubject &&
    a.sesHtmlBody === b.sesHtmlBody &&
    !!a.showFooter === !!b.showFooter &&
    (a.footerImageUrl || "") === (b.footerImageUrl || "") &&
    String(a.customerIoTransactionalId ?? "") ===
      String(b.customerIoTransactionalId ?? "") &&
    (a.customerIoEventName || "") === (b.customerIoEventName || "") &&
    (a.customerIoMode || "event") === (b.customerIoMode || "event") &&
    JSON.stringify(a.customerIoIcons || {}) ===
      JSON.stringify(b.customerIoIcons || {})
  );
}

function EmailDeliveryPage() {
  const {currentUser} = useAuth();
  const subjectInputRef = useRef(null);
  const subjectVariableMenuRef = useRef(null);
  const [subjectVariableMenuOpen, setSubjectVariableMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  /** "ses" = normal test send; "customer_io" = Track API event for journey testing */
  const [testSendKind, setTestSendKind] = useState("ses");
  const [settingsMeta, setSettingsMeta] = useState(null);
  const [settings, setSettings] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState({});
  /** Bumps TipTap when discarding edits so HTML resets even if updatedAt unchanged. */
  const [rteResetNonce, setRteResetNonce] = useState(0);
  const [editorMode, setEditorMode] = useState("edit");
  const [discardModalOpen, setDiscardModalOpen] = useState(false);
  const [banner, setBanner] = useState({
    open: false,
    type: "success",
    message: "",
  });

  const showBanner = useCallback((type, message) => {
    setBanner({open: true, type, message});
  }, []);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, templatesRes] = await Promise.all([
        AppApi.getEmailDeliverySettings(),
        AppApi.getEmailDeliveryTemplates(),
      ]);
      setSettingsMeta(settingsRes);
      setSettings(settingsRes.settings);
      setTemplates(templatesRes.templates || []);
    } catch (err) {
      showBanner(
        "error",
        err.message || "Failed to load email delivery settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [showBanner]);

  const loadDetail = useCallback(
    async (emailType) => {
      if (!emailType) return;
      setDetailLoading(true);
      try {
        const res = await AppApi.getEmailDeliveryTemplate(emailType);
        setDetail(res);
        setEditorMode("edit");
        setForm(buildFormFromDetailResponse(res));
      } catch (err) {
        showBanner("error", err.message || "Failed to load template.");
      } finally {
        setDetailLoading(false);
      }
    },
    [showBanner],
  );

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (selectedType) {
      loadDetail(selectedType);
    } else {
      setDetail(null);
      setForm({});
    }
  }, [selectedType, loadDetail]);

  useEffect(() => {
    if (!subjectVariableMenuOpen) return undefined;
    function handlePointerDown(e) {
      if (
        subjectVariableMenuRef.current &&
        !subjectVariableMenuRef.current.contains(e.target)
      ) {
        setSubjectVariableMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [subjectVariableMenuOpen]);

  useEffect(() => {
    setDiscardModalOpen(false);
  }, [selectedType]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.emailType === selectedType) || null,
    [templates, selectedType],
  );

  const effectiveProvider =
    form.provider && form.provider !== "inherit"
      ? form.provider
      : selectedTemplate?.activeProvider || settings?.defaultProvider || "ses";
  const isCustomerIoActive = effectiveProvider === "customer_io";
  const savedActiveProvider =
    selectedTemplate?.activeProvider || settings?.defaultProvider || "ses";
  const savedProviderIsCustomerIo = savedActiveProvider === "customer_io";

  const mergeVariables = useMemo(
    () => detail?.template?.mergeVariables || [],
    [detail],
  );

  const customerIoIconSlots = useMemo(
    () => detail?.customerIoIconSlots ?? [],
    [detail],
  );

  const handleCustomerIoIconChange = useCallback(
    async (slotKey, url) => {
      if (!selectedType) return;
      const nextIcons = {...(form.customerIoIcons || {})};
      if (url) {
        nextIcons[slotKey] = url;
      } else {
        delete nextIcons[slotKey];
      }
      setForm((f) => ({...f, customerIoIcons: nextIcons}));
      setSaving(true);
      try {
        await AppApi.updateEmailDeliveryTemplate(selectedType, {
          customerIoIcons: nextIcons,
        });
        await loadDetail(selectedType);
        showBanner("success", url ? "Icon saved to S3." : "Icon removed.");
      } catch (err) {
        showBanner("error", err.message || "Failed to save icon.");
      } finally {
        setSaving(false);
      }
    },
    [form.customerIoIcons, loadDetail, selectedType, showBanner],
  );

  const savedTemplateForm = useMemo(
    () => (detail ? buildFormFromDetailResponse(detail) : null),
    [detail],
  );

  const templateHasUnsavedChanges = useMemo(
    () => !!(savedTemplateForm && !templateFormEquals(savedTemplateForm, form)),
    [savedTemplateForm, form],
  );

  const providerHasUnsavedChanges = useMemo(
    () =>
      !!savedTemplateForm &&
      (savedTemplateForm.provider || "inherit") !==
        (form.provider || "inherit"),
    [savedTemplateForm, form.provider],
  );

  const savedCustomerIoEventName = (
    detail?.template?.customerIoEventName || ""
  ).trim();
  const canTestCustomerIoEvent =
    !!settingsMeta?.customerIoConfigured && !!savedCustomerIoEventName;

  function openDiscardTemplateConfirm() {
    setDiscardModalOpen(true);
  }

  function applyDiscardTemplateChanges() {
    if (!detail) return;
    setForm(buildFormFromDetailResponse(detail));
    setSubjectVariableMenuOpen(false);
    setRteResetNonce((n) => n + 1);
    setDiscardModalOpen(false);
  }

  async function handleSaveSettings(defaultProvider) {
    setSaving(true);
    try {
      const res = await AppApi.updateEmailDeliverySettings({defaultProvider});
      setSettings(res.settings);
      await loadOverview();
      if (selectedType) await loadDetail(selectedType);
      showBanner("success", "Default email provider updated.");
    } catch (err) {
      showBanner("error", err.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTemplate(e) {
    e.preventDefault();
    if (!selectedType) return;
    setSaving(true);
    try {
      const payload = {
        provider: form.provider,
        sesSubject: form.sesSubject,
        sesHtmlBody: form.sesHtmlBody,
        showFooter: !!form.showFooter,
        footerImageUrl: form.footerImageUrl ? form.footerImageUrl : null,
        customerIoMode: form.customerIoMode,
        customerIoEventName: form.customerIoEventName || null,
        customerIoTransactionalId:
          form.customerIoTransactionalId === "" ||
          form.customerIoTransactionalId == null
            ? null
            : Number(form.customerIoTransactionalId),
        customerIoIcons: form.customerIoIcons ?? {},
      };
      await AppApi.updateEmailDeliveryTemplate(selectedType, payload);
      await loadOverview();
      await loadDetail(selectedType);
      showBanner("success", "Template settings saved.");
    } catch (err) {
      showBanner("error", err.message || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetTemplate() {
    if (!selectedType) return;
    if (!window.confirm("Reset this template back to the default content?"))
      return;
    setSaving(true);
    try {
      await AppApi.resetEmailDeliveryTemplate(selectedType);
      await loadDetail(selectedType);
      showBanner("success", "Template reset to defaults.");
    } catch (err) {
      showBanner("error", err.message || "Failed to reset template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSend(to) {
    if (!selectedType) return;
    setTesting(true);
    try {
      if (testSendKind === "customer_io") {
        const res = await AppApi.testEmailDeliveryCustomerIoEvent(
          selectedType,
          {to},
        );
        setTestModalOpen(false);
        showBanner(
          "success",
          `Customer.io fired "${res.eventName}" for ${res.sentTo}. Check your journey in Customer.io.`,
        );
      } else {
        const res = await AppApi.testEmailDeliveryTemplate(selectedType, {to});
        setTestModalOpen(false);
        showBanner("success", `Test email sent to ${res.sentTo}.`);
      }
    } catch (err) {
      showBanner("error", err.message || "Test send failed.");
    } finally {
      setTesting(false);
    }
  }

  function insertSubjectVariable(key) {
    const token = `{{${key}}}`;
    const input = subjectInputRef.current;
    if (!input) {
      setForm((f) => ({...f, sesSubject: (f.sesSubject || "") + token}));
      return;
    }
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = `${input.value.slice(0, start)}${token}${input.value.slice(end)}`;
    setForm((f) => ({...f, sesSubject: next}));
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + token.length;
      input.setSelectionRange(pos, pos);
    });
  }

  return (
    <>
            <main className={PAGE_LAYOUT.settingsWide}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Mail className="w-7 h-7 text-[#456564]" strokeWidth={1.75} />
              Email Delivery
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Choose AWS SES or Customer.io per email type. Edit SES templates
              with the rich editor; design Customer.io templates in your
              Customer.io workspace.
            </p>
          </div>

          <Banner
            open={banner.open}
            type={banner.type}
            setOpen={(open) => setBanner((b) => ({...b, open}))}
          >
            {banner.message}
          </Banner>

          {loading ? (
            <div className={`${SETTINGS_CARD.card} p-8 flex items-center justify-center`}>
              <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <section className={SETTINGS_CARD.card}>
                <div className={SETTINGS_CARD.header}>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    Default provider
                  </h2>
                </div>
                <div className={`${SETTINGS_CARD.body} space-y-4`}>
                  <div className="flex flex-wrap gap-3">
                    {["ses", "customer_io"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        disabled={saving}
                        onClick={() => handleSaveSettings(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          settings?.defaultProvider === p
                            ? "btn-segment-active"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:border-[#456564]"
                        }`}
                      >
                        {PROVIDER_LABELS[p]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      SES:{" "}
                      {settingsMeta?.sesConfigured ? (
                        <span className="text-emerald-600">configured</span>
                      ) : (
                        <span className="text-amber-600">not configured</span>
                      )}
                    </span>
                    <span>
                      Customer.io:{" "}
                      {settingsMeta?.customerIoConfigured ? (
                        <span className="text-emerald-600">configured</span>
                      ) : (
                        <span className="text-amber-600">not configured</span>
                      )}
                    </span>
                    {settingsMeta?.customerIoWorkspaceUrl && (
                      <a
                        href={settingsMeta.customerIoWorkspaceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#456564] hover:underline"
                      >
                        Open Customer.io
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <section className={`lg:col-span-2 ${SETTINGS_CARD.card}`}>
                  <div className={SETTINGS_CARD.header}>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      Email types
                    </h2>
                  </div>
                  <div className={`${SETTINGS_CARD.body} p-0`}>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                      {templates.map((t) => (
                        <li key={t.emailType}>
                          <button
                            type="button"
                            onClick={() => {
                              if (t.emailType !== selectedType) {
                                setDetailLoading(true);
                              }
                              setSelectedType(t.emailType);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${
                              selectedType === t.emailType
                                ? "bg-[#456564]/10 border-l-4 border-[#456564]"
                                : ""
                            }`}
                          >
                            <div className="font-medium text-gray-800 dark:text-gray-100 text-sm">
                              {t.label}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-gray-500">
                                {PROVIDER_LABELS[t.activeProvider] ||
                                  t.activeProvider}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full ${statusBadgeClass(t.status)}`}
                              >
                                {STATUS_LABELS[t.status] || t.status}
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className={`lg:col-span-3 ${SETTINGS_CARD.card}`}>
                  <div className={SETTINGS_CARD.header}>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {selectedTemplate
                        ? selectedTemplate.label
                        : "Select an email type"}
                    </h2>
                  </div>
                  <div className={SETTINGS_CARD.body}>
                    {selectedTemplate && providerHasUnsavedChanges ? (
                      <div
                        role="alert"
                        className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-800 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200"
                      >
                        Email Provider not yet saved.
                      </div>
                    ) : null}
                    {!selectedTemplate ? (
                      <p className="text-sm text-gray-500">
                        Choose an email type to configure its provider and
                        templates.
                      </p>
                    ) : (
                      <form onSubmit={handleSaveTemplate} className="space-y-5">
                        {selectedTemplate.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {selectedTemplate.description}
                          </p>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Provider for this email
                          </label>
                          <select
                            value={form.provider || "inherit"}
                            onChange={(e) =>
                              setForm((f) => ({...f, provider: e.target.value}))
                            }
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                          >
                            <option value="inherit">
                              Inherit default (
                              {PROVIDER_LABELS[settings?.defaultProvider]})
                            </option>
                            <option value="ses">AWS SES</option>
                            <option value="customer_io">Customer.io</option>
                          </select>
                        </div>

                        {isCustomerIoActive ? (
                          <div className="space-y-4 rounded-lg border border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Design email content and follow-up journeys in
                              Customer.io. Opsy sends identify + event (or
                              transactional) calls with the merge variables
                              listed below.
                            </p>
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Mode
                              </label>
                              <select
                                value={form.customerIoMode || "event"}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    customerIoMode: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                              >
                                <option value="event">
                                  Event-triggered (journeys)
                                </option>
                                <option value="transactional">
                                  Transactional message
                                </option>
                                <option value="both">
                                  Both event + transactional
                                </option>
                              </select>
                            </div>
                            {(form.customerIoMode === "event" ||
                              form.customerIoMode === "both") && (
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  Event name
                                </label>
                                <input
                                  type="text"
                                  value={form.customerIoEventName || ""}
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      customerIoEventName: e.target.value,
                                    }))
                                  }
                                  placeholder="e.g. property_invitation_sent"
                                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono"
                                />
                              </div>
                            )}
                            {(form.customerIoMode === "transactional" ||
                              form.customerIoMode === "both") && (
                              <div>
                                <label className="block text-sm font-medium mb-1">
                                  Transactional message ID
                                </label>
                                <input
                                  type="number"
                                  value={form.customerIoTransactionalId ?? ""}
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      customerIoTransactionalId: e.target.value,
                                    }))
                                  }
                                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                                />
                              </div>
                            )}

                            <div className="pt-4 border-t border-gray-200 dark:border-gray-600 space-y-2">
                              <div>
                                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                  Variables sent to Customer.io
                                </h3>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                  Opsy sends the same merge keys whether you
                                  choose event, transactional, or both—the keys
                                  are duplicated on the triggering event payload
                                  and transactional{" "}
                                  <code className="text-[11px]">
                                    message_data
                                  </code>
                                  . Use{" "}
                                  <code className="text-[11px]">{`{{event.variableName}}`}</code>{" "}
                                  in journey / campaign templates and{" "}
                                  <code className="text-[11px]">{`{{trigger.variableName}}`}</code>{" "}
                                  in transactional templates.
                                  {form.customerIoMode === "both" ? (
                                    <span className="block mt-1">
                                      With{" "}
                                      <strong className="font-medium">
                                        both
                                      </strong>
                                      , match the prefix to each template type
                                      in Customer.io.
                                    </span>
                                  ) : null}
                                </p>
                              </div>
                              {mergeVariables.length === 0 ? (
                                <p className="text-xs text-gray-500">
                                  No variable list defined for this email type.
                                </p>
                              ) : (
                                <ul className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900/40 text-sm">
                                  {mergeVariables.map((v) => {
                                    const ciMode =
                                      form.customerIoMode || "event";
                                    const desc =
                                      typeof v.description === "string"
                                        ? v.description
                                        : "";
                                    return (
                                      <li
                                        key={v.key}
                                        className="px-3 py-2.5 space-y-1.5"
                                      >
                                        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                          <div className="min-w-0">
                                            <code className="text-[13px] text-[#456564] dark:text-emerald-300 break-all">
                                              {v.key}
                                            </code>
                                            {desc ? (
                                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                                {desc}
                                              </p>
                                            ) : null}
                                          </div>
                                        </div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug space-y-0.5 font-mono">
                                          {ciMode === "both" ? (
                                            <>
                                              <div>
                                                <span className="text-gray-400 uppercase tracking-wide mr-1.5">
                                                  Journey:
                                                </span>
                                                <span className="text-gray-700 dark:text-gray-200">{`{{event.${String(v.key).trim()}}}`}</span>
                                              </div>
                                              <div>
                                                <span className="text-gray-400 uppercase tracking-wide mr-1.5">
                                                  Transactional:
                                                </span>
                                                <span className="text-gray-700 dark:text-gray-200">{`{{trigger.${String(v.key).trim()}}}`}</span>
                                              </div>
                                            </>
                                          ) : (
                                            <div className="text-gray-700 dark:text-gray-200">
                                              {customerIoLiquidSnippet(
                                                ciMode,
                                                String(v.key),
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                                On send, Opsy also identifies the person by
                                email; when{" "}
                                <code className="text-[11px]">inviteeName</code>{" "}
                                or <code className="text-[11px]">userName</code>{" "}
                                is present they are sent as Customer.io
                                attributes (e.g. you can use{" "}
                                <code className="text-[11px]">{`{{customer.name}}`}</code>{" "}
                                /{" "}
                                <code className="text-[11px]">{`{{customer.email}}`}</code>
                                ).
                              </p>

                              {customerIoIconSlots.length > 0 ? (
                                <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-600 space-y-2">
                                  <div className="flex items-center gap-1.5">
                                    <ImageIcon className="w-3.5 h-3.5 text-[#456564]" />
                                    <h4 className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                                      Template icons (S3)
                                    </h4>
                                  </div>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                                    20×20 PNGs; merge fields like{" "}
                                    <code className="text-[10px]">
                                      {`{{event.${customerIoIconSlots[0]?.key || "emailIconPlace"}}}`}
                                    </code>
                                    . Bucket must allow public read (or
                                    CloudFront).
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {customerIoIconSlots.map((slot) => (
                                      <EmailCustomerIoIconSlot
                                        key={slot.key}
                                        emailType={selectedType}
                                        slot={slot}
                                        imageUrl={
                                          form.customerIoIcons?.[slot.key] || ""
                                        }
                                        disabled={saving}
                                        onUrlChange={handleCustomerIoIconChange}
                                        onError={(msg) =>
                                          showBanner("error", msg)
                                        }
                                      />
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              {[
                                {id: "edit", label: "Edit template"},
                                {id: "preview", label: "Preview"},
                              ].map(({id, label}) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setEditorMode(id)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                    editorMode === id
                                      ? "btn-segment-active"
                                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600"
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>

                            {editorMode === "edit" ? (
                              <>
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium">
                                      Subject
                                    </label>
                                    {mergeVariables.length > 0 && (
                                      <div
                                        className="relative"
                                        ref={subjectVariableMenuRef}
                                      >
                                        <button
                                          type="button"
                                          aria-expanded={
                                            subjectVariableMenuOpen
                                          }
                                          aria-haspopup="listbox"
                                          onMouseDown={(e) =>
                                            e.preventDefault()
                                          }
                                          onClick={() =>
                                            setSubjectVariableMenuOpen(
                                              (open) => !open,
                                            )
                                          }
                                          className="cursor-pointer text-xs text-[#456564] hover:underline"
                                        >
                                          Insert variable
                                        </button>
                                        {subjectVariableMenuOpen && (
                                          <div
                                            role="listbox"
                                            aria-label="Insert merge variable in subject"
                                            className="absolute right-0 z-20 mt-1 w-64 max-h-72 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-1"
                                          >
                                            {mergeVariables.map((v) => (
                                              <button
                                                key={v.key}
                                                role="option"
                                                type="button"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  insertSubjectVariable(v.key);
                                                  setSubjectVariableMenuOpen(
                                                    false,
                                                  );
                                                }}
                                                className="w-full text-left px-2 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 text-xs"
                                              >
                                                <code className="text-[#456564]">{`{{${v.key}}}`}</code>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <input
                                    ref={subjectInputRef}
                                    type="text"
                                    value={form.sesSubject || ""}
                                    onChange={(e) =>
                                      setForm((f) => ({
                                        ...f,
                                        sesSubject: e.target.value,
                                      }))
                                    }
                                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium mb-1">
                                    Email body
                                  </label>
                                  <RichTextEditor
                                    value={form.sesHtmlBody}
                                    documentKey={`${selectedType}-${detail?.template?.updatedAt}-${rteResetNonce}`}
                                    isLoading={detailLoading}
                                    onChange={(html) =>
                                      setForm((f) => ({
                                        ...f,
                                        sesHtmlBody: html,
                                      }))
                                    }
                                    mergeVariables={mergeVariables}
                                    placeholder="Write your email body…"
                                  />
                                  <p className="mt-1 text-xs text-gray-500">
                                    Merge variables like{" "}
                                    <code className="text-[#456564]">{`{{inviteeName}}`}</code>{" "}
                                    are replaced when the email is sent.
                                  </p>
                                </div>

                                <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ImageIcon className="w-4 h-4 text-[#456564]" />
                                      <span className="text-sm font-medium">
                                        Opsy footer banner
                                      </span>
                                    </div>
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!form.showFooter}
                                        onChange={(e) =>
                                          setForm((f) => ({
                                            ...f,
                                            showFooter: e.target.checked,
                                          }))
                                        }
                                        className="rounded border-gray-300 text-[#456564] focus:ring-[#456564]"
                                      />
                                      <span className="text-sm text-gray-700 dark:text-gray-200">
                                        Show footer
                                      </span>
                                    </label>
                                  </div>
                                  {form.showFooter && (
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                                        Custom footer image URL (optional)
                                      </label>
                                      <input
                                        type="text"
                                        value={form.footerImageUrl || ""}
                                        onChange={(e) =>
                                          setForm((f) => ({
                                            ...f,
                                            footerImageUrl: e.target.value,
                                          }))
                                        }
                                        placeholder="https://example.com/banner.png  (leave blank for default)"
                                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono"
                                      />
                                      <p className="mt-1 text-xs text-gray-500">
                                        Paste a public image URL to override the
                                        default Opsy banner.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : (
                              <PreviewPane
                                subject={detail?.preview?.subject || ""}
                                html={detail?.preview?.html || ""}
                              />
                            )}

                            <button
                              type="button"
                              onClick={handleResetTemplate}
                              disabled={saving}
                              className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-[#456564]"
                            >
                              <RefreshCw className="w-4 h-4" />
                              Reset to default template
                            </button>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3 pt-2">
                          {templateHasUnsavedChanges && (
                            <>
                              <button
                                type="submit"
                                disabled={saving}
                                className="px-4 py-2 rounded-lg btn-primary text-sm font-medium disabled:opacity-50"
                              >
                                {saving ? "Saving…" : "Save changes"}
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={openDiscardTemplateConfirm}
                                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setTestSendKind("ses");
                              setTestModalOpen(true);
                            }}
                            disabled={testing || saving}
                            title={
                              savedProviderIsCustomerIo
                                ? "Sends a real test of the Customer.io template with sample merge data."
                                : "Delivers via the saved provider using sample merge data."
                            }
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium hover:border-[#456564] disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                            Send test email
                          </button>
                          {savedProviderIsCustomerIo &&
                            settingsMeta?.customerIoConfigured && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTestSendKind("customer_io");
                                  setTestModalOpen(true);
                                }}
                                disabled={
                                  testing || saving || !canTestCustomerIoEvent
                                }
                                title={
                                  !canTestCustomerIoEvent
                                    ? "Configure and save a Customer.io event name for this email type, then try again. Uses the saved value, not unsaved edits."
                                    : savedCustomerIoEventName
                                      ? `Fires "${savedCustomerIoEventName}" with sample merge data.`
                                      : undefined
                                }
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium hover:border-[#456564] disabled:opacity-50"
                              >
                                <Zap className="w-4 h-4" />
                                Test Customer.io event
                              </button>
                            )}
                        </div>
                      </form>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      <EmailTestSendModal
        modalOpen={testModalOpen}
        setModalOpen={setTestModalOpen}
        defaultEmail={currentUser?.email || ""}
        onSend={handleTestSend}
        sending={testing}
        variant={testSendKind === "customer_io" ? "customer_io" : "ses"}
      />
      <ModalBlank
        modalOpen={discardModalOpen}
        setModalOpen={setDiscardModalOpen}
        contentClassName="max-w-md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Discard changes?
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Unsaved edits to this template will be lost. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setDiscardModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={applyDiscardTemplateChanges}
              className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Discard changes
            </button>
          </div>
        </div>
      </ModalBlank>
    </>
  );
}

function PreviewPane({subject, html}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Subject
        </span>
        <p className="mt-1 text-sm text-gray-800 dark:text-gray-100">
          {subject || "—"}
        </p>
      </div>
      <div
        className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 overflow-auto"
        style={{maxHeight: 600}}
      >
        <div dangerouslySetInnerHTML={{__html: html}} />
      </div>
      <p className="text-xs text-gray-500">
        Preview uses sample merge data so recipients see actual names, links,
        etc.
      </p>
    </div>
  );
}

export default EmailDeliveryPage;
