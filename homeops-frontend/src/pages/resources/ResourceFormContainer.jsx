import React, {useState, useEffect, useCallback, useRef} from "react";
import {createPortal} from "react-dom";
import {useNavigate, useParams} from "react-router-dom";
import {ArrowLeft, BookOpen, FileText, ExternalLink, Search, Loader2, Mail, Smartphone, ImagePlus, Send, Plus, Trash2, Eye, FileUp} from "lucide-react";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import {useAuth} from "../../context/AuthContext";
import AppApi from "../../api/api";
import ModalBlank from "../../components/ModalBlank";
import Banner from "../../partials/containers/Banner";
import {useAutoCloseBanner} from "../../hooks/useAutoCloseBanner";
import {getResourceThumbnailUrl, RESOURCE_THUMBNAIL_PLACEHOLDER} from "../../utils/resourceThumbnail";
import useImageUpload from "../../hooks/useImageUpload";
import PostRichEditor from "../../components/PostRichEditor";

const RESOURCE_TYPES = [
  {value: "post", label: "Post"},
  {value: "web_link", label: "Web link"},
  {value: "video_link", label: "Video Link"},
  {value: "pdf", label: "PDF"},
];

const RECIPIENT_PRESETS = [
  {value: "all_contacts", label: "All contacts", description: "Everyone in your contact list"},
  {value: "specific_contacts", label: "Specific contacts", description: "Choose individual contacts"},
  {value: "all_homeowners", label: "All homeowners", description: "All homeowner users in your account"},
  {value: "all_users", label: "All users", description: "All users (admin only)", adminOnly: true},
  {value: "all_agents", label: "All agents", description: "All agent users (admin only)", adminOnly: true},
  {value: "specific_users", label: "Specific users", description: "Choose individual users (admin only)", adminOnly: true},
];

const DELIVERY_CHANNELS = [
  {value: "email", label: "Email", icon: Mail},
  {value: "in_app", label: "Opsy", icon: Smartphone},
  {value: "both", label: "Email + Opsy", icon: Send},
];

const AUTO_SEND_SUBJECTS = [
  {value: "homeowner", label: "Homeowner"},
  {value: "agent", label: "Agent"},
];

const AUTO_SEND_ACTIONS = [
  {value: "create_account", label: "Create account"},
  {value: "create_property", label: "Create property"},
  {value: "schedule_event", label: "Schedule event"},
];

/** Build trigger string from subject + action */
function toTriggerValue(subject, action) {
  return `${subject}_${action}`;
}

/** Parse trigger string into { subject, action }. Format: "subject_action" (action may contain underscores) */
function fromTriggerValue(value) {
  if (!value || typeof value !== "string") return { subject: "homeowner", action: "create_account" };
  const idx = value.indexOf("_");
  if (idx < 0) return { subject: value || "homeowner", action: "create_account" };
  const subject = value.slice(0, idx);
  const action = value.slice(idx + 1);
  return {
    subject: subject || "homeowner",
    action: action || "create_account",
  };
}

/** Ensure value is an array (handles JSON string, object, null from API) */
function ensureArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Migrate legacy trigger values to new format */
function migrateTrigger(value) {
  const legacy = {
    user_created: "homeowner_create_account",
    new_homeowner: "homeowner_create_account",
    new_agent: "agent_create_account",
    property_created: "homeowner_create_property",
    homeowner_created_property: "homeowner_create_property",
  };
  return legacy[value] || value;
}

/** Link types use "link" format; post uses "html" for rich text */
const LINK_TYPES = ["web_link", "video_link", "pdf"];

/** Form shape for change detection (excludes status) */
function formSnapshot(f) {
  return {
    subject: f.subject || "",
    type: f.type || "post",
    deliveryMode: f.deliveryMode || "send_now",
    recipientMode: f.recipientMode || "",
    recipientIds: [...ensureArray(f.recipientIds)].sort(),
    contentFormat: f.contentFormat || "html",
    bodyText: f.bodyText || "",
    url: f.url || "",
    imageKey: f.imageKey || "",
    pdfKey: f.pdfKey || "",
    deliveryChannel: f.deliveryChannel || "both",
    autoSendTriggers: [...ensureArray(f.autoSendTriggers)].sort(),
  };
}

const initialForm = {
  subject: "",
  type: "post",
  deliveryMode: "send_now",
  recipientMode: "",
  recipientIds: [],
  contentFormat: "html",
  bodyText: "",
  url: "",
  imageKey: "",
  pdfKey: "",
  deliveryChannel: "both",
  autoSendTriggers: [],
  autoSendEnabled: false,
};

const TABS = [
  {id: "delivery", label: "Delivery", icon: Send},
  {id: "content", label: "Content", icon: FileText},
];

const DELIVERY_MODES = [
  {value: "send_now", label: "Send now", description: "Choose recipients and send immediately"},
  {value: "auto_send", label: "Auto-send", description: "Send automatically when events occur"},
];

function ResourceFormContainer() {
  const {id} = useParams();
  const navigate = useNavigate();
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();
  const accountUrl = currentAccount?.url || currentAccount?.name || "";

  const [form, setForm] = useState(initialForm);
  const [activeTab, setActiveTab] = useState("delivery");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [bannerType, setBannerType] = useState("success");
  const [bannerMessage, setBannerMessage] = useState("");
  const [recipientOptions, setRecipientOptions] = useState(null);
  const [estimatedCount, setEstimatedCount] = useState(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const lastSavedFormRef = useRef(null);

  const showBanner = (type, message) => {
    setBannerType(type);
    setBannerMessage(message);
    setBannerOpen(true);
  };

  const isNew = !id || id === "new";
  const isAdmin = ["admin", "super_admin"].includes(currentUser?.role);
  const isSent = form.status === "sent";

  const formHasChanges = !isNew && lastSavedFormRef.current != null &&
    JSON.stringify(formSnapshot(form)) !== JSON.stringify(lastSavedFormRef.current);

  useAutoCloseBanner(bannerOpen, bannerMessage, () => setBannerOpen(false));

  const recipientPresets = RECIPIENT_PRESETS.filter((p) => !p.adminOnly || isAdmin);

  const fetchResource = useCallback(async () => {
    try {
      const resource = await AppApi.getResource(id);
      // Migrate legacy article_link -> web_link
      const type = resource.type === "article_link" ? "web_link" : (resource.type || "post");
      const rawTriggers = ensureArray(resource.autoSendTriggers).map(migrateTrigger);
      const nextForm = {
        subject: resource.subject || "",
        type,
        deliveryMode: rawTriggers.length > 0 ? "auto_send" : "send_now",
        recipientMode: resource.recipientMode || "",
        recipientIds: resource.recipientIds || [],
        contentFormat: resource.contentFormat || "html",
        bodyText: resource.bodyText || "",
        url: resource.url || "",
        imageKey: resource.imageKey || "",
        pdfKey: resource.pdfKey || "",
        deliveryChannel: resource.deliveryChannel || "both",
        autoSendTriggers: rawTriggers,
        autoSendEnabled: resource.autoSendEnabled || false,
        status: resource.status,
      };
      setForm(nextForm);
      lastSavedFormRef.current = formSnapshot(nextForm);
    } catch (err) {
      showBanner("error", err?.message || "Failed to load resource");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const setDeliveryMode = (mode) => {
    setForm((prev) => ({
      ...prev,
      deliveryMode: mode,
      recipientMode: mode === "send_now" ? prev.recipientMode : "",
      recipientIds: mode === "send_now" ? prev.recipientIds : [],
      autoSendTriggers: mode === "auto_send" ? (prev.autoSendTriggers?.length ? prev.autoSendTriggers : [toTriggerValue("homeowner", "create_account")]) : [],
    }));
  };

  const addAutoSendRule = () => {
    setForm((prev) => ({
      ...prev,
      autoSendTriggers: [...(prev.autoSendTriggers || []), toTriggerValue("homeowner", "create_account")],
    }));
  };

  const updateAutoSendRule = (index, field, value) => {
    setForm((prev) => {
      const triggers = [...(prev.autoSendTriggers || [])];
      const parsed = fromTriggerValue(triggers[index]);
      if (field === "subject") {
        triggers[index] = toTriggerValue(value, parsed.action);
      } else {
        triggers[index] = toTriggerValue(parsed.subject, value);
      }
      return {...prev, autoSendTriggers: triggers};
    });
  };

  const removeAutoSendRule = (index) => {
    setForm((prev) => ({
      ...prev,
      autoSendTriggers: (prev.autoSendTriggers || []).filter((_, i) => i !== index),
    }));
  };

  const [imageDisplayUrl, setImageDisplayUrl] = useState(null);
  const [inlineImageUploading, setInlineImageUploading] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const inlineImageInputRef = useRef(null);
  const inlineImageResolveRef = useRef(null);
  const pdfInputRef = useRef(null);
  const {
    uploadImage,
    imagePreviewUrl,
    imageUploading,
    imageUploadError,
    clearPreview,
    accept: imageAccept,
  } = useImageUpload({
    onSuccess: (key) => setForm((prev) => ({...prev, imageKey: key})),
    onError: (msg) => showBanner("error", msg),
  });

  const handleInlineImageSelect = useCallback(() => {
    return new Promise((resolve) => {
      inlineImageResolveRef.current = resolve;
      inlineImageInputRef.current?.click();
    });
  }, []);

  const handleInlineImageFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file?.type?.startsWith("image/")) {
      showBanner("error", "Please select an image file (JPEG, PNG, WebP, GIF)");
      inlineImageResolveRef.current?.(null);
      inlineImageResolveRef.current = null;
      return;
    }
    setInlineImageUploading(true);
    try {
      const doc = await AppApi.uploadDocument(file);
      const key = doc?.key ?? doc?.s3Key ?? doc?.fileKey ?? doc?.objectKey;
      // Use inline-image-url to get presigned URL with ResponseContentType (fixes ERR_BLOCKED_BY_ORB)
      const finalUrl = key ? await AppApi.getInlineImageUrl(key) : null;
      if (finalUrl) {
        inlineImageResolveRef.current?.(finalUrl);
      } else {
        showBanner("error", "Image upload succeeded but no URL was returned");
        inlineImageResolveRef.current?.(null);
      }
    } catch (err) {
      showBanner("error", err?.message || "Image upload failed");
      inlineImageResolveRef.current?.(null);
    } finally {
      inlineImageResolveRef.current = null;
      setInlineImageUploading(false);
    }
  }, []);

  useEffect(() => {
    if (form.imageKey && !imagePreviewUrl) {
      AppApi.getPresignedPreviewUrl(form.imageKey)
        .then(setImageDisplayUrl)
        .catch(() => setImageDisplayUrl(null));
    } else {
      setImageDisplayUrl(null);
    }
  }, [form.imageKey, imagePreviewUrl]);

  useEffect(() => {
    if (isNew) {
      setForm((f) => ({...f, ...initialForm}));
      setLoading(false);
      return;
    }
    fetchResource();
  }, [id, isNew, fetchResource]);

  useEffect(() => {
    AppApi.getResourceRecipientOptions()
      .then(setRecipientOptions)
      .catch(() => setRecipientOptions({contacts: [], homeowners: [], agents: [], allUsers: []}));
  }, []);

  useEffect(() => {
    if (form.deliveryMode !== "send_now" || !form.recipientMode) {
      setEstimatedCount(null);
      return;
    }
    AppApi.estimateResourceRecipients({
      recipientMode: form.recipientMode,
      recipientIds: form.recipientIds,
    })
      .then(setEstimatedCount)
      .catch(() => setEstimatedCount(0));
  }, [form.deliveryMode, form.recipientMode, form.recipientIds]);

  const handleChange = (e) => {
    const {name, value, type, checked} = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toggleRecipientId = (recipientId) => {
    setForm((prev) => {
      const ids = prev.recipientIds || [];
      const next = ids.includes(recipientId)
        ? ids.filter((x) => x !== recipientId)
        : [...ids, recipientId];
      return {...prev, recipientIds: next};
    });
  };

  const buildPayload = (overrides = {}) => {
    const isSendNow = form.deliveryMode === "send_now";
    return {
      subject: form.subject?.trim() || "",
      type: form.type,
      recipientMode: isSendNow ? (form.recipientMode || null) : null,
      recipientIds: isSendNow ? (form.recipientIds || []) : [],
      contentFormat: form.contentFormat,
      bodyText: form.bodyText?.trim() || null,
      url: form.url?.trim() || null,
      imageKey: form.imageKey?.trim() || null,
      pdfKey: form.pdfKey?.trim() || null,
      deliveryChannel: form.deliveryChannel || "both",
      autoSendTriggers: isSendNow ? [] : ensureArray(form.autoSendTriggers),
      status: "draft",
      ...overrides,
    };
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!form.subject?.trim()) {
      showBanner("error", "Subject is required");
      return;
    }
    if (!isDeliveryValid) {
      showBanner("error", "Please complete the Delivery tab before saving. Choose recipients or add auto-send rules.");
      setActiveTab("delivery");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (isNew) {
        const created = await AppApi.createResource(payload);
        showBanner("success", "Draft saved.");
        setTimeout(() => navigate(`/${accountUrl}/resources/${created.id}`), 600);
      } else {
        await AppApi.updateResource(id, payload);
        lastSavedFormRef.current = formSnapshot(form);
        showBanner("success", "Draft updated.");
      }
    } catch (err) {
      showBanner("error", err?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const hasRecipients = form.deliveryMode === "send_now" && form.recipientMode && (estimatedCount ?? 0) > 0;
  const canSendNow = form.deliveryMode === "send_now" && form.recipientMode;
  const hasAutoSendRules = form.deliveryMode === "auto_send" && ensureArray(form.autoSendTriggers).length > 0;
  const isDeliveryValid =
    form.deliveryMode === "send_now"
      ? Boolean(form.recipientMode)
      : hasAutoSendRules;
  const isActivated = form.autoSendEnabled && hasAutoSendRules;

  const handleSend = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!id || id === "new") return;
    setSubmitting(true);
    try {
      if (formHasChanges) {
        await AppApi.updateResource(id, buildPayload());
      }
      if (canSendNow) {
        await AppApi.sendResource(id);
        showBanner("success", (estimatedCount ?? 0) > 0 ? "Communication sent successfully." : "Communication published to Discover.");
      } else if (hasAutoSendRules) {
        await AppApi.activateResource(id);
        showBanner("success", "Communication activated for auto-send. It will be sent when the configured events occur.");
      }
      setSendModalOpen(false);
      await fetchResource();
    } catch (err) {
      showBanner("error", err?.message || "Failed to send");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => navigate(`/${accountUrl}/resources`);

  const handleDuplicate = async () => {
    setSubmitting(true);
    try {
      const created = await AppApi.createResource(buildPayload({
        subject: form.subject ? `${form.subject} (copy)` : "",
      }));
      showBanner("success", "Communication duplicated.");
      navigate(`/${accountUrl}/resources/${created.id}`);
    } catch (err) {
      showBanner("error", err?.message || "Failed to duplicate");
    } finally {
      setSubmitting(false);
    }
  };

  const filterRecipients = (list, search) => {
    if (!search?.trim()) return list || [];
    const q = search.toLowerCase().trim();
    return (list || []).filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q)
    );
  };

  const contactList = filterRecipients(recipientOptions?.contacts, recipientSearch);
  const userList = filterRecipients(recipientOptions?.allUsers, recipientSearch);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex justify-between items-center mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-lg">Communications</span>
        </button>
        <button
          type="button"
          onClick={() => !isNew && navigate(`/${accountUrl}/resources/${id}/preview`)}
          disabled={isNew}
          title={isNew ? "Save draft first to preview" : "Preview in full page"}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eye className="w-4 h-4" />
          Preview
        </button>
      </div>

      <div className="fixed top-18 right-0 w-auto sm:w-full z-50">
        <Banner
          type={bannerType}
          open={bannerOpen}
          setOpen={setBannerOpen}
          className="transition-opacity duration-300"
        >
          {bannerMessage}
        </Banner>
      </div>

      <form onSubmit={handleSaveDraft}>
        {/* Top section: Subject only */}
        <div className="bg-white dark:bg-gray-800 rounded-t-2xl shadow-sm border border-gray-200 dark:border-gray-700 border-b-0 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-6 h-6 text-[#456564]" />
            </div>
            <div className="flex-1 min-w-0">
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={form.subject}
                onChange={handleChange}
                disabled={isSent}
                className="form-input w-full text-lg disabled:opacity-60"
                placeholder="e.g. Winter maintenance tips"
                required
              />
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deliver via
                </label>
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_CHANNELS.map((ch) => {
                    const Icon = ch.icon;
                    const isSelected = (form.deliveryChannel || "both") === ch.value;
                    return (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() => !isSent && setForm((p) => ({...p, deliveryChannel: ch.value}))}
                        disabled={isSent}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors disabled:opacity-60 ${
                          isSelected
                            ? "border-[#456564] bg-[#456564]/10 dark:bg-[#456564]/20 text-[#456564] dark:text-[#5a7a78]"
                            : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs section (like PropertyFormContainer) */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-b-2xl overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-6">
            <nav className="flex flex-wrap gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-4 text-sm font-medium transition border-b-2 flex items-center gap-2 ${
                      activeTab === tab.id
                        ? "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                    style={
                      activeTab === tab.id
                        ? {borderBottomColor: "#456654", color: "#456654"}
                        : {}
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Content tab */}
            {activeTab === "content" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        type: v,
                        contentFormat: "html",
                      }));
                    }}
                    disabled={isSent}
                    className="form-input w-full max-w-xs disabled:opacity-60"
                  >
                    {RESOURCE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {form.type === "post" ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Content
                    </label>
                    <input
                      ref={inlineImageInputRef}
                      type="file"
                      accept={imageAccept}
                      onChange={handleInlineImageFileChange}
                      className="hidden"
                      tabIndex={-1}
                      aria-hidden
                    />
                    <PostRichEditor
                      key={id || "new"}
                      value={form.bodyText || ""}
                      onChange={(html) => setForm((prev) => ({...prev, bodyText: html}))}
                      placeholder="Write your post..."
                      disabled={isSent || inlineImageUploading}
                      onImageSelect={handleInlineImageSelect}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Header image
                      </label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isSent || imageUploading) return;
                          const file = e.dataTransfer?.files?.[0];
                          if (file?.type?.startsWith("image/")) uploadImage(file);
                        }}
                        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                          imageUploading
                            ? "border-[#456564]/50 bg-[#456564]/5 dark:bg-[#456564]/10"
                            : "border-gray-300 dark:border-gray-600 hover:border-[#456564]/50 dark:hover:border-[#456564]/50 hover:bg-gray-50 dark:hover:bg-gray-900/30"
                        }`}
                      >
                        <input
                          type="file"
                          accept={imageAccept}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadImage(file);
                            e.target.value = "";
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          disabled={isSent || imageUploading}
                        />
                        {imagePreviewUrl || form.imageKey ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-40 h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                              <img
                                src={imagePreviewUrl || imageDisplayUrl || RESOURCE_THUMBNAIL_PLACEHOLDER}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.src = RESOURCE_THUMBNAIL_PLACEHOLDER;
                                }}
                              />
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {imageUploading ? "Uploading…" : "Drop a new image or click to replace"}
                            </p>
                            {!isSent && form.imageKey && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  clearPreview();
                                  setForm((p) => ({...p, imageKey: ""}));
                                }}
                                className="text-sm text-red-600 dark:text-red-400 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <ImagePlus className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Drop image here or click to add
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              JPEG, PNG, WebP, GIF (optional)
                            </p>
                          </>
                        )}
                      </div>
                      {imageUploadError && (
                        <p className="text-sm text-red-600 dark:text-red-400">{imageUploadError}</p>
                      )}
                    </div>

                    {/* PDF attachment for Post */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Optional PDF attachment
                      </label>
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept="application/pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file || file.type !== "application/pdf") return;
                          setPdfUploading(true);
                          try {
                            const doc = await AppApi.uploadDocument(file);
                            const key = doc?.key ?? doc?.s3Key ?? doc?.fileKey ?? doc?.objectKey;
                            if (key) setForm((p) => ({...p, pdfKey: key}));
                            else showBanner("error", "PDF upload succeeded but no key was returned");
                          } catch (err) {
                            showBanner("error", err?.message || "PDF upload failed");
                          } finally {
                            setPdfUploading(false);
                          }
                        }}
                        className="hidden"
                      />
                      {form.pdfKey ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50">
                          <FileUp className="w-5 h-5 text-[#456564]" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">PDF attached</span>
                          {!isSent && (
                            <button
                              type="button"
                              onClick={() => setForm((p) => ({...p, pdfKey: ""}))}
                              className="text-sm text-red-600 dark:text-red-400 hover:underline ml-auto"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          disabled={isSent || pdfUploading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#5a7a78] transition-colors disabled:opacity-50"
                        >
                          {pdfUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                          {pdfUploading ? "Uploading…" : "Attach PDF"}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        URL
                      </label>
                      <input
                        name="url"
                        type="url"
                        value={form.url}
                        onChange={handleChange}
                        disabled={isSent}
                        className="form-input w-full disabled:opacity-60"
                        placeholder={form.type === "pdf" ? "https://... (PDF link)" : "https://..."}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Preview image (optional)
                      </label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isSent || imageUploading) return;
                          const file = e.dataTransfer?.files?.[0];
                          if (file?.type?.startsWith("image/")) uploadImage(file);
                        }}
                        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                          imageUploading ? "border-[#456564]/50 bg-[#456564]/5 dark:bg-[#456564]/10" : "border-gray-300 dark:border-gray-600 hover:border-[#456564]/50 dark:hover:border-[#456564]/50 hover:bg-gray-50 dark:hover:bg-gray-900/30"
                        }`}
                      >
                        <input
                          type="file"
                          accept={imageAccept}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadImage(file);
                            e.target.value = "";
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          disabled={isSent || imageUploading}
                        />
                        {(imagePreviewUrl || form.imageKey) ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-40 h-28 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                              <img src={imagePreviewUrl || imageDisplayUrl || RESOURCE_THUMBNAIL_PLACEHOLDER} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.src = RESOURCE_THUMBNAIL_PLACEHOLDER; }} />
                            </div>
                            {!isSent && form.imageKey && (
                              <button type="button" onClick={(e) => { e.preventDefault(); clearPreview(); setForm((p) => ({...p, imageKey: ""})); }} className="text-sm text-red-600 dark:text-red-400 hover:underline">Remove</button>
                            )}
                          </div>
                        ) : (
                          <>
                            <ImagePlus className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop image or click to add preview</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used when the URL has no thumbnail</p>
                          </>
                        )}
                      </div>
                    </div>
                    {form.url?.trim() && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-900/50">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preview</p>
                        {(() => {
                          const thumbUrl = getResourceThumbnailUrl({url: form.url, type: form.type}) || (form.imageKey ? (imagePreviewUrl || imageDisplayUrl) : null);
                          return (
                            <div className="flex gap-4">
                              <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                                <img src={thumbUrl || RESOURCE_THUMBNAIL_PLACEHOLDER} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.src = RESOURCE_THUMBNAIL_PLACEHOLDER; }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <a href={form.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[#456564] hover:underline break-all">
                                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                                  {form.url}
                                </a>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Opens in new tab</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                      <input ref={inlineImageInputRef} type="file" accept={imageAccept} onChange={handleInlineImageFileChange} className="hidden" tabIndex={-1} aria-hidden />
                      <PostRichEditor
                        key={id || "new"}
                        value={form.bodyText || ""}
                        onChange={(html) => setForm((prev) => ({...prev, bodyText: html}))}
                        placeholder="Add a message to accompany the link..."
                        disabled={isSent || inlineImageUploading}
                        onImageSelect={handleInlineImageSelect}
                        minHeight="120px"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Delivery tab */}
            {activeTab === "delivery" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                    How do you want to send this?
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 mb-6">
                    {DELIVERY_MODES.map((mode) => (
                      <label
                        key={mode.value}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          form.deliveryMode === mode.value
                            ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/10"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <input
                          type="radio"
                          name="deliveryMode"
                          value={mode.value}
                          checked={form.deliveryMode === mode.value}
                          onChange={() => !isSent && setDeliveryMode(mode.value)}
                          disabled={isSent}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {mode.label}
                          </span>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {mode.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {form.deliveryMode === "send_now" && (
                  <>
                    <hr className="border-t border-gray-200 dark:border-gray-600 my-6" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                        Who receives this?
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {recipientPresets.map((preset) => (
                      <label
                        key={preset.value}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          form.recipientMode === preset.value
                            ? "border-[#456564] bg-[#456564]/5 dark:bg-[#456564]/10"
                            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <input
                          type="radio"
                          name="recipientMode"
                          value={preset.value}
                          checked={form.recipientMode === preset.value}
                          onChange={handleChange}
                          disabled={isSent}
                          className="mt-1"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {preset.label}
                          </span>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {preset.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {form.recipientMode === "specific_contacts" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select contacts
                    </label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="form-input w-full pl-9"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
                      {contactList.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                          {recipientSearch ? "No contacts match your search." : "No contacts available."}
                        </p>
                      ) : (
                        contactList.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50"
                          >
                            <input
                              type="checkbox"
                              checked={(form.recipientIds || []).includes(c.id)}
                              onChange={() => toggleRecipientId(c.id)}
                              className="rounded"
                            />
                            <span className="text-sm">
                              {c.name || c.email}
                              {c.name && c.email && (
                                <span className="text-gray-500 dark:text-gray-400"> ({c.email})</span>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {form.recipientMode === "specific_users" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select users
                    </label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        placeholder="Search by name or email..."
                        className="form-input w-full pl-9"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
                      {userList.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                          {recipientSearch ? "No users match your search." : "No users available."}
                        </p>
                      ) : (
                        userList.map((u) => (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 cursor-pointer py-1.5 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50"
                          >
                            <input
                              type="checkbox"
                              checked={(form.recipientIds || []).includes(u.id)}
                              onChange={() => toggleRecipientId(u.id)}
                              className="rounded"
                            />
                            <span className="text-sm">
                              {u.name || u.email}
                              {u.name && u.email && (
                                <span className="text-gray-500 dark:text-gray-400"> ({u.email})</span>
                              )}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {form.recipientMode && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Estimated recipients:
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {estimatedCount ?? "…"}
                    </span>
                  </div>
                )}
                  </>
                )}

                {form.deliveryMode === "auto_send" && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                      When to send
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      The resource will be sent to the person who triggers the event. Send when <strong>any</strong> rule matches.
                    </p>
                    <div className="space-y-3">
                      {ensureArray(form.autoSendTriggers).map((triggerValue, index) => {
                        const { subject, action } = fromTriggerValue(triggerValue);
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-900/30"
                          >
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">
                              When
                            </span>
                            <select
                              value={subject}
                              onChange={(e) => !isSent && updateAutoSendRule(index, "subject", e.target.value)}
                              disabled={isSent}
                              className="form-select flex-1 min-w-0 disabled:opacity-60"
                            >
                              {AUTO_SEND_SUBJECTS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <select
                              value={action}
                              onChange={(e) => !isSent && updateAutoSendRule(index, "action", e.target.value)}
                              disabled={isSent}
                              className="form-select flex-1 min-w-0 disabled:opacity-60"
                            >
                              {AUTO_SEND_ACTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            {!isSent && (
                              <button
                                type="button"
                                onClick={() => removeAutoSendRule(index)}
                                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0"
                                title="Remove rule"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      {!isSent && (
                        <button
                          type="button"
                          onClick={addAutoSendRule}
                          className="flex items-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-[#456564]/50 hover:text-[#456564] dark:hover:text-[#5a7a78] transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add rule
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="btn bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-800 dark:text-gray-300 transition-colors duration-200 shadow-sm"
              >
                Cancel
              </button>
              {!isSent && (
                <>
                  {(isNew || formHasChanges) ? (
                    <button
                      type="submit"
                      disabled={submitting || !form.subject?.trim() || !isDeliveryValid}
                      title={!isDeliveryValid ? "Complete the Delivery tab first" : undefined}
                      className="btn text-white transition-colors duration-200 shadow-sm min-w-[100px] bg-[#456564] hover:bg-[#34514f] flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />}
                      {submitting ? (isNew ? "Saving…" : "Updating…") : (isNew ? "Save Draft" : "Update")}
                    </button>
                  ) : !isActivated ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (canSendNow) {
                          handleSend(e);
                        } else if (hasAutoSendRules) {
                          setSendModalOpen(true);
                        }
                      }}
                      disabled={
                        submitting ||
                        !form.subject?.trim() ||
                        !isDeliveryValid ||
                        (!canSendNow && !hasAutoSendRules)
                      }
                      title={
                        !isDeliveryValid
                          ? "Complete the Delivery tab first"
                          : !canSendNow && !hasAutoSendRules
                            ? "Configure recipients or add auto-send rules"
                            : canSendNow
                              ? undefined
                              : "Activate auto-send only (no immediate send)"
                      }
                      className="btn min-w-[100px] flex items-center justify-center gap-2 transition-colors duration-200 shadow-sm bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />}
                      {canSendNow ? "Send Now" : "Activate"}
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 px-3 py-2">
                      Activated
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </form>

      {createPortal(
        <ModalBlank
          id="send-resource-modal"
          modalOpen={sendModalOpen}
          setModalOpen={setSendModalOpen}
        >
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {canSendNow ? "Send" : "Activate Auto-send"}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {canSendNow
                ? (estimatedCount ?? 0) > 0
                  ? `Send to ${estimatedCount} recipients now? It will also appear in the Discover feed.`
                  : "Publish to Discover feed? Homeowners and agents will see it. No notifications will be sent."
                : "Activate for auto-send? It will be sent when the configured events occur."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSendModalOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSend(e);
                }}
                disabled={submitting}
                className="px-4 py-2 bg-[#456564] hover:bg-[#34514f] text-white rounded-lg font-medium disabled:opacity-50"
              >
                {submitting ? (canSendNow ? "Sending…" : "Activating…") : (canSendNow ? "Send" : "Activate")}
              </button>
            </div>
          </div>
        </ModalBlank>,
        document.body
      )}
    </div>
  );
}

export default ResourceFormContainer;
