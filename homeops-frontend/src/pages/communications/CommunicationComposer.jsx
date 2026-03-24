import React, {useState, useEffect, useCallback, useRef} from "react";
import {createPortal} from "react-dom";
import {useNavigate, useParams} from "react-router-dom";
import Sidebar from "../../partials/Sidebar";
import Header from "../../partials/Header";
import AppApi from "../../api/api";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAuth} from "../../context/AuthContext";
import ModalBlank from "../../components/ModalBlank";
import Banner from "../../partials/containers/Banner";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import PostRichEditor from "../../components/PostRichEditor";
import useImageUpload from "../../hooks/useImageUpload";
import {PAGE_LAYOUT} from "../../constants/layout";
import ComposeSection from "./partials/ComposeSection";
import AudienceSection from "./partials/AudienceSection";
import DeliverySection from "./partials/DeliverySection";
import LivePreview from "./partials/LivePreview";
import Transition from "../../utils/Transition";
import {
  ArrowLeft,
  Send,
  Clock,
  Save,
  Loader2,
  Eye,
  Copy,
  Plus,
  Settings,
} from "lucide-react";

const INITIAL_FORM = {
  subject: "",
  content: {body: ""},
  imageKey: null,
  templateId: null,
  recipientMode: "",
  recipientIds: [],
  deliveryChannel: "in_app",
  deliveryMode: "send_now",
  scheduledAt: "",
  attachments: [],
  rules: [],
};

function CommunicationComposer() {
  const {id} = useParams();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";
  const accountId = currentAccount?.id;

  const isNew = !id || id === "new";
  const isAdmin = ["admin", "super_admin"].includes(currentUser?.role);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerType, setBannerType] = useState("success");
  const [bannerMessage, setBannerMessage] = useState("");
  const [recipientOptions, setRecipientOptions] = useState(null);
  const [estimatedCount, setEstimatedCount] = useState(null);
  const [template, setTemplate] = useState(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const lastSavedRef = useRef(null);
  const sendButtonRef = useRef(null);
  const actionsTriggerRef = useRef(null);
  const actionsDropdownRef = useRef(null);

  const showBanner = (type, msg) => {
    setBannerType(type);
    setBannerMessage(msg);
    setBannerOpen(true);
  };

  useAutoCloseBanner(bannerOpen, bannerMessage, () => setBannerOpen(false));

  useEffect(() => {
    const clickHandler = ({target}) => {
      if (
        !actionsDropdownOpen ||
        actionsDropdownRef.current?.contains(target) ||
        actionsTriggerRef.current?.contains(target)
      )
        return;
      setActionsDropdownOpen(false);
    };
    document.addEventListener("click", clickHandler);
    return () => document.removeEventListener("click", clickHandler);
  }, [actionsDropdownOpen]);

  useEffect(() => {
    const keyHandler = ({keyCode}) => {
      if (!actionsDropdownOpen || keyCode !== 27) return;
      setActionsDropdownOpen(false);
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [actionsDropdownOpen]);

  const isSent = form.status === "sent";
  const isScheduled = form.status === "scheduled";

  // Load template
  useEffect(() => {
    if (!accountId) return;
    AppApi.getCommDefaultTemplate(accountId)
      .then(setTemplate)
      .catch(() => setTemplate(null));
  }, [accountId]);

  // Load recipient options
  useEffect(() => {
    AppApi.getCommRecipientOptions()
      .then(setRecipientOptions)
      .catch(() => setRecipientOptions({homeowners: [], agents: []}));
  }, []);

  // Load existing comm
  const fetchComm = useCallback(async () => {
    try {
      const res = await AppApi.getCommunication(id);
      const c = res.communication;
      const hasRules = res.rules?.length > 0;
      const allowedTriggers = new Set([
        "user_created",
        "property_invitation_accepted",
      ]);
      setForm({
        subject: c.subject || "",
        content: c.content || {body: ""},
        imageKey: c.imageKey || null,
        templateId: c.templateId,
        recipientMode: c.recipientMode || "",
        recipientIds: c.recipientIds || [],
        deliveryChannel: "in_app",
        deliveryMode: hasRules
          ? "auto_send"
          : c.scheduledAt
            ? "schedule"
            : "send_now",
        scheduledAt: c.scheduledAt
          ? new Date(c.scheduledAt).toISOString().slice(0, 16)
          : "",
        attachments: res.attachments || [],
        rules: (res.rules || [])
          .filter((r) => allowedTriggers.has(r.triggerEvent))
          .map((r) => ({...r, triggerRole: "homeowner"})),
        status: c.status,
      });
      lastSavedRef.current = JSON.stringify(c);
    } catch (err) {
      showBanner("error", err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isNew) {
      setForm({...INITIAL_FORM});
      setLoading(false);
      return;
    }
    fetchComm();
  }, [id, isNew, fetchComm]);

  // Estimate recipients
  useEffect(() => {
    if (!form.recipientMode || form.deliveryMode === "auto_send") {
      setEstimatedCount(null);
      return;
    }
    AppApi.estimateCommRecipients({
      recipientMode: form.recipientMode,
      recipientIds: form.recipientIds,
    })
      .then(setEstimatedCount)
      .catch(() => setEstimatedCount(0));
  }, [form.recipientMode, form.recipientIds, form.deliveryMode]);

  const updateForm = (patch) => setForm((prev) => ({...prev, ...patch}));

  const buildPayload = (overrides = {}) => ({
    accountId,
    subject: form.subject?.trim() || "",
    content: form.content,
    imageKey: form.imageKey || null,
    templateId: form.templateId || template?.id || null,
    recipientMode:
      form.deliveryMode === "auto_send" ? null : form.recipientMode || null,
    recipientIds:
      form.deliveryMode === "auto_send" ? [] : form.recipientIds || [],
    deliveryChannel: "in_app",
    attachments: form.attachments || [],
    rules: form.deliveryMode === "auto_send" ? form.rules || [] : [],
    ...overrides,
  });

  const handleSaveDraft = async () => {
    if (!form.subject?.trim()) {
      showBanner("error", "Subject is required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const res = await AppApi.createCommunication(payload);
        showBanner("success", "Draft saved.");
        setTimeout(
          () =>
            navigate(`/${accountUrl}/communications/${res.communication.id}`),
          500,
        );
      } else {
        await AppApi.updateCommunication(id, payload);
        showBanner("success", "Draft updated.");
        lastSavedRef.current = "saved";
      }
    } catch (err) {
      showBanner("error", err?.message || "Failed to save.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async () => {
    if (!form.subject?.trim()) {
      showBanner("error", "Subject is required.");
      return;
    }
    setSubmitting(true);
    try {
      let commId = id;
      const payload = buildPayload();
      if (isNew) {
        const res = await AppApi.createCommunication(payload);
        commId = res.communication.id;
      } else {
        await AppApi.updateCommunication(id, payload);
      }

      if (form.deliveryMode === "schedule" && form.scheduledAt) {
        await AppApi.scheduleCommunication(commId, form.scheduledAt);
        showBanner("success", "Communication scheduled.");
      } else if (form.deliveryMode === "auto_send") {
        await AppApi.sendCommunication(commId);
        showBanner("success", "Auto-send rules are now active.");
      } else {
        await AppApi.sendCommunication(commId);
        showBanner("success", `Sent to ${estimatedCount ?? 0} recipients.`);
      }
      setSendModalOpen(false);
      setTimeout(() => navigate(`/${accountUrl}/communications`), 800);
    } catch (err) {
      showBanner("error", err?.message || "Failed to send.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async () => {
    setSubmitting(true);
    try {
      const payload = buildPayload({subject: `${form.subject} (copy)`});
      const res = await AppApi.createCommunication(payload);
      showBanner("success", "Duplicated.");
      navigate(`/${accountUrl}/communications/${res.communication.id}`);
    } catch (err) {
      showBanner("error", err?.message || "Duplicate failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSend =
    form.subject?.trim() &&
    (form.deliveryMode === "auto_send"
      ? form.rules?.length > 0
      : form.recipientMode);

  if (loading) {
    return (
      <div className="flex h-[100dvh] overflow-hidden">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
          <main className="flex-1 overflow-y-auto flex justify-center items-center">
            <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading…</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto">
          <div className={PAGE_LAYOUT.form}>
            {/* Top bar */}
            <div className="flex items-center justify-between mb-8">
              <button
                type="button"
                onClick={() => navigate(`/${accountUrl}/communications`)}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-lg font-medium">Communications</span>
              </button>
              <div className="flex items-center gap-2">
                {!isNew && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/${accountUrl}/communications/new`)
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      New
                    </button>
                    <div className="relative inline-flex">
                      <button
                        ref={actionsTriggerRef}
                        type="button"
                        className="inline-flex items-center justify-center px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        aria-haspopup="true"
                        aria-expanded={actionsDropdownOpen}
                        onClick={() =>
                          setActionsDropdownOpen(!actionsDropdownOpen)
                        }
                      >
                        <span className="sr-only">Actions</span>
                        <Settings className="w-4 h-4 shrink-0" />
                      </button>
                      <Transition
                        show={actionsDropdownOpen}
                        tag="div"
                        className="origin-top-right z-10 absolute top-full left-0 right-auto min-w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pt-1.5 rounded-xl overflow-hidden mt-1 md:left-auto md:right-0"
                        style={{
                          boxShadow:
                            "0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                        }}
                        enter="transition ease-out duration-200 transform"
                        enterStart="opacity-0 -translate-y-2"
                        enterEnd="opacity-100 translate-y-0"
                        leave="transition ease-out duration-200"
                        leaveStart="opacity-100"
                        leaveEnd="opacity-0"
                      >
                        <div ref={actionsDropdownRef}>
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1.5 pb-2 px-3">
                            Actions
                          </div>
                          <ul className="mb-1">
                            <li>
                              <button
                                type="button"
                                className="w-full flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/80 px-3 py-2 disabled:opacity-50"
                                disabled={submitting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionsDropdownOpen(false);
                                  handleDuplicate();
                                }}
                              >
                                <Copy className="w-5 h-5 shrink-0 text-gray-500 dark:text-gray-400" />
                                <span className="text-sm font-medium ml-2 text-gray-800 dark:text-gray-200">
                                  Duplicate
                                </span>
                              </button>
                            </li>
                          </ul>
                        </div>
                      </Transition>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowPreview((p) => !p)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    showPreview
                      ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#5a7a78]"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>
            </div>

            {/* Banner */}
            <div className="fixed top-18 right-0 w-auto sm:w-full z-50">
              <Banner
                type={bannerType}
                open={bannerOpen}
                setOpen={setBannerOpen}
              >
                {bannerMessage}
              </Banner>
            </div>

            {/* Main layout: form + preview */}
            <div className={`flex gap-6 ${showPreview ? "" : ""}`}>
              {/* Left: Sections */}
              <div
                className={`flex-1 min-w-0 space-y-6 ${showPreview ? "max-w-[60%]" : ""}`}
              >
                {/* 1. Compose */}
                <ComposeSection
                  form={form}
                  updateForm={updateForm}
                  disabled={isSent}
                  template={template}
                  setTemplate={setTemplate}
                  accountId={accountId}
                />

                {/* 2. Audience */}
                <AudienceSection
                  form={form}
                  updateForm={updateForm}
                  disabled={isSent}
                  isAdmin={isAdmin}
                  recipientOptions={recipientOptions}
                  estimatedCount={estimatedCount}
                />

                {/* 3. Delivery */}
                <DeliverySection
                  form={form}
                  updateForm={updateForm}
                  disabled={isSent}
                />

                {/* Action bar */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {isSent && "This communication has been sent."}
                      {isScheduled &&
                        `Scheduled for ${new Date(form.scheduledAt).toLocaleString()}`}
                    </div>
                    <div className="flex items-center gap-3">
                      {!isSent && !isScheduled && (
                        <>
                          <button
                            type="button"
                            onClick={handleSaveDraft}
                            disabled={submitting || !form.subject?.trim()}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            {submitting ? "Saving…" : "Save Draft"}
                          </button>
                          <button
                            ref={sendButtonRef}
                            type="button"
                            onClick={() => setSendModalOpen(true)}
                            disabled={submitting || !canSend}
                            title={
                              !canSend
                                ? "Add a subject and select an audience to send"
                                : undefined
                            }
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {form.deliveryMode === "schedule" ? (
                              <>
                                <Clock className="w-4 h-4" />
                                Schedule
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                Send Now
                              </>
                            )}
                          </button>
                        </>
                      )}
                      {isScheduled && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await AppApi.cancelScheduleCommunication(id);
                              showBanner("success", "Schedule cancelled.");
                              fetchComm();
                            } catch (err) {
                              showBanner("error", err?.message || "Failed");
                            }
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
                        >
                          Cancel Schedule
                        </button>
                      )}
                      {isSent && (
                        <button
                          type="button"
                          onClick={handleDuplicate}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <Copy className="w-4 h-4" />
                          Duplicate & Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Live preview */}
              {showPreview && (
                <div className="w-[40%] min-w-[320px] shrink-0 sticky top-0 self-start">
                  <LivePreview form={form} template={template} />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Send confirmation modal */}
      {createPortal(
        <ModalBlank
          id="send-comm-modal"
          modalOpen={sendModalOpen}
          setModalOpen={setSendModalOpen}
          ignoreClickRef={sendButtonRef}
        >
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {form.deliveryMode === "schedule"
                ? "Schedule Communication"
                : "Send Communication"}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-5">
              {form.deliveryMode === "schedule"
                ? `This will be sent at ${form.scheduledAt ? new Date(form.scheduledAt).toLocaleString() : "the scheduled time"}.`
                : form.deliveryMode === "auto_send"
                  ? "This will be activated for auto-send based on the configured rules."
                  : `Send to ${estimatedCount ?? 0} recipient${(estimatedCount ?? 0) !== 1 ? "s" : ""} now?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSendModalOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={submitting}
                className="px-5 py-2 bg-[#456564] hover:bg-[#34514f] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting
                  ? "Processing…"
                  : form.deliveryMode === "schedule"
                    ? "Schedule"
                    : "Send"}
              </button>
            </div>
          </div>
        </ModalBlank>,
        document.body,
      )}
    </div>
  );
}

export default CommunicationComposer;
