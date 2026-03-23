import React, {useState, useRef, useEffect, useCallback} from "react";
import {createPortal} from "react-dom";
import {
  X,
  MessageSquare,
  UserPlus,
  Share2,
  Send,
  CheckCircle2,
  Loader2,
  Phone,
  Mail,
} from "lucide-react";
import {AgentAvatar} from "./AgentCard";
import AppApi from "../../../api/api";

const TABS = [
  {id: "message", label: "Message", icon: MessageSquare},
  {id: "request", label: "Request Referral", icon: UserPlus},
  {id: "refer", label: "Refer Agent", icon: Share2},
];

const VALID_TABS = new Set(["message", "request", "refer"]);

function AgentModal({
  agent,
  isOpen,
  onClose,
  initialTab = "message",
  propertyUid,
  accountId,
}) {
  const [activeTab, setActiveTab] = useState("message");
  const panelRef = useRef(null);
  const firstFocusRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const tab = VALID_TABS.has(initialTab) ? initialTab : "message";
      setActiveTab(tab);
      requestAnimationFrame(() => firstFocusRef.current?.focus());
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleOverlayClick = (e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen || !agent) return null;

  return createPortal(
    <div
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Contact ${agent.name}`}
    >
      <div
        className="fixed inset-0 bg-gray-900/30 animate-in fade-in duration-200"
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#3a5857] to-[#2a4241] px-6 pt-6 pb-5">
          <button
            ref={firstFocusRef}
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <AgentAvatar agent={agent} size="lg" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-0.5">
                Your Agent
              </p>
              <h2 className="text-lg font-bold text-white truncate">
                {agent.name}
              </h2>
              {agent.company && (
                <p className="text-sm text-white/50 truncate">{agent.company}</p>
              )}
            </div>
          </div>

          {/* Quick contact links */}
          {(agent.phone || agent.email) && (
            <div className="flex items-center gap-3 mt-4">
              {agent.phone && (
                <a
                  href={`tel:${agent.phone}`}
                  className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {agent.phone}
                </a>
              )}
              {agent.email && (
                <a
                  href={`mailto:${agent.email}`}
                  className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors truncate"
                >
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{agent.email}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <nav className="flex" role="tablist" aria-label="Agent actions">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs sm:text-sm font-medium transition-colors relative ${
                    isActive
                      ? "text-[#3a5857] dark:text-[#6fb5b4]"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#3a5857] dark:bg-[#6fb5b4] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Panels */}
        <div className="max-h-[50vh] overflow-y-auto">
          {activeTab === "message" && (
            <MessagePanel
              agentName={agent.name}
              agentUserId={agent.id}
              propertyUid={propertyUid}
              accountId={accountId}
            />
          )}
          {activeTab === "request" && (
            <RequestReferralPanel
              agentName={agent.name}
              agentUserId={agent.id}
              propertyUid={propertyUid}
              accountId={accountId}
            />
          )}
          {activeTab === "refer" && (
            <ReferAgentPanel
              agentName={agent.name}
              agentUserId={agent.id}
              propertyUid={propertyUid}
              accountId={accountId}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Message Agent ──────────────────────────────────────────────────────────

function MessagePanel({agentName, agentUserId, propertyUid, accountId}) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const textareaRef = useRef(null);
  const canSubmit =
    agentUserId != null && propertyUid != null && accountId != null;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    if (!message.trim() || !canSubmit) return;
    setStatus("sending");
    try {
      await AppApi.submitHomeownerAgentInquiry({
        accountId,
        propertyUid,
        agentUserId,
        kind: "message",
        message: message.trim(),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }, [message, canSubmit, accountId, propertyUid, agentUserId]);

  if (status === "sent") {
    return (
      <div
        id="panel-message"
        role="tabpanel"
        className="px-6 py-10 flex flex-col items-center text-center"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Message sent
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {agentName} will get back to you soon.
        </p>
      </div>
    );
  }

  return (
    <div id="panel-message" role="tabpanel" className="px-6 py-5 space-y-4">
      <div>
        {!canSubmit && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
            We couldn&apos;t load your property or account context. Open this page from your home dashboard with a
            property selected to message your agent.
          </p>
        )}
        <label
          htmlFor="agent-message"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          Send a message to {agentName}
        </label>
        <textarea
          ref={textareaRef}
          id="agent-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Hi, I have a question about..."
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#456564]/40 focus:border-[#456564] dark:focus:ring-[#6fb5b4]/40 dark:focus:border-[#6fb5b4] resize-none transition-colors"
        />
      </div>
      {status === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
      <button
        type="button"
        onClick={handleSend}
        disabled={!message.trim() || status === "sending" || !canSubmit}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3a5857] hover:bg-[#2d4544] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "sending" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        {status === "sending" ? "Sending…" : "Send Message"}
      </button>
    </div>
  );
}

// ─── Request Referral ───────────────────────────────────────────────────────

const REFERRAL_TYPES = [
  "Plumber",
  "Electrician",
  "HVAC Technician",
  "Roofer",
  "Landscaper",
  "General Contractor",
  "Painter",
  "Pest Control",
  "Home Inspector",
  "Other",
];

function RequestReferralPanel({agentName, agentUserId, propertyUid, accountId}) {
  const [referralType, setReferralType] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("idle");
  const canSubmit =
    agentUserId != null && propertyUid != null && accountId != null;

  const handleSubmit = useCallback(async () => {
    if (!referralType || !canSubmit) return;
    setStatus("sending");
    try {
      await AppApi.submitHomeownerAgentInquiry({
        accountId,
        propertyUid,
        agentUserId,
        kind: "referral_request",
        referralType,
        notes: notes.trim(),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }, [referralType, notes, canSubmit, accountId, propertyUid, agentUserId]);

  if (status === "sent") {
    return (
      <div
        id="panel-request"
        role="tabpanel"
        className="px-6 py-10 flex flex-col items-center text-center"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Referral requested
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {agentName} will send you a recommendation soon.
        </p>
      </div>
    );
  }

  return (
    <div id="panel-request" role="tabpanel" className="px-6 py-5 space-y-4">
      {!canSubmit && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          We couldn&apos;t load your property or account context. Open this from your home dashboard with a property
          selected.
        </p>
      )}
      <div>
        <label
          htmlFor="referral-type"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          What type of professional do you need?
        </label>
        <select
          id="referral-type"
          value={referralType}
          onChange={(e) => setReferralType(e.target.value)}
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#456564]/40 focus:border-[#456564] dark:focus:ring-[#6fb5b4]/40 dark:focus:border-[#6fb5b4] transition-colors"
        >
          <option value="">Select a service type…</option>
          {REFERRAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="referral-notes"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          Notes{" "}
          <span className="text-gray-400 dark:text-gray-500 font-normal">
            (optional)
          </span>
        </label>
        <textarea
          id="referral-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any details about the work needed…"
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#456564]/40 focus:border-[#456564] dark:focus:ring-[#6fb5b4]/40 dark:focus:border-[#6fb5b4] resize-none transition-colors"
        />
      </div>
      {status === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!referralType || status === "sending" || !canSubmit}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3a5857] hover:bg-[#2d4544] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "sending" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
        {status === "sending" ? "Submitting…" : "Request Referral"}
      </button>
    </div>
  );
}

// ─── Refer Agent to Someone ─────────────────────────────────────────────────

function ReferAgentPanel({agentName, agentUserId, propertyUid, accountId}) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("idle");
  const [errors, setErrors] = useState({});
  const canSubmit =
    agentUserId != null && propertyUid != null && accountId != null;

  const validate = useCallback(() => {
    const errs = {};
    if (!name.trim()) errs.name = "Name is required";
    if (!contact.trim()) errs.contact = "Email or phone is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, contact]);

  const handleSubmit = useCallback(async () => {
    if (!validate() || !canSubmit) return;
    setStatus("sending");
    try {
      await AppApi.submitHomeownerAgentInquiry({
        accountId,
        propertyUid,
        agentUserId,
        kind: "refer_agent",
        referName: name.trim(),
        referContact: contact.trim(),
        referNote: note.trim(),
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }, [validate, canSubmit, accountId, propertyUid, agentUserId, name, contact, note]);

  if (status === "sent") {
    return (
      <div
        id="panel-refer"
        role="tabpanel"
        className="px-6 py-10 flex flex-col items-center text-center"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">
          Referral sent
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          We'll let {agentName} know about the referral.
        </p>
      </div>
    );
  }

  return (
    <div id="panel-refer" role="tabpanel" className="px-6 py-5 space-y-4">
      {!canSubmit && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          We couldn&apos;t load your property or account context. Open this from your home dashboard with a property
          selected.
        </p>
      )}
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Know someone who could use {agentName}'s help? Refer them below.
      </p>
      <div>
        <label
          htmlFor="refer-name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          Their name
        </label>
        <input
          id="refer-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({...prev, name: ""}));
          }}
          placeholder="Jane Doe"
          className={`w-full rounded-xl border ${errors.name ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"} bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#456564]/40 focus:border-[#456564] dark:focus:ring-[#6fb5b4]/40 dark:focus:border-[#6fb5b4] transition-colors`}
        />
        {errors.name && (
          <p className="text-xs text-red-500 mt-1">{errors.name}</p>
        )}
      </div>
      <div>
        <label
          htmlFor="refer-contact"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          Their email or phone
        </label>
        <input
          id="refer-contact"
          type="text"
          value={contact}
          onChange={(e) => {
            setContact(e.target.value);
            if (errors.contact) setErrors((prev) => ({...prev, contact: ""}));
          }}
          placeholder="jane@example.com or (555) 123-4567"
          className={`w-full rounded-xl border ${errors.contact ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"} bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#456564]/40 focus:border-[#456564] dark:focus:ring-[#6fb5b4]/40 dark:focus:border-[#6fb5b4] transition-colors`}
        />
        {errors.contact && (
          <p className="text-xs text-red-500 mt-1">{errors.contact}</p>
        )}
      </div>
      <div>
        <label
          htmlFor="refer-note"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          Note{" "}
          <span className="text-gray-400 dark:text-gray-500 font-normal">
            (optional)
          </span>
        </label>
        <textarea
          id="refer-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="They're looking for help with…"
          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#456564]/40 focus:border-[#456564] dark:focus:ring-[#6fb5b4]/40 dark:focus:border-[#6fb5b4] resize-none transition-colors"
        />
      </div>
      {status === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400">
          Something went wrong. Please try again.
        </p>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={status === "sending" || !canSubmit}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#3a5857] hover:bg-[#2d4544] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "sending" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        {status === "sending" ? "Sending…" : "Refer Agent"}
      </button>
    </div>
  );
}

export default AgentModal;
