import React, {useState, useRef, useEffect, useCallback} from "react";
import {useNavigate, useParams} from "react-router-dom";
import UpgradePrompt from "../../../components/UpgradePrompt";
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  Search,
  ExternalLink,
  ChevronDown,
  Wrench,
  UserPlus,
  RotateCcw,
  Database,
} from "lucide-react";
import Transition from "../../../utils/Transition";
import AppApi from "../../../api/api";
import DatePickerInput from "../../../components/DatePickerInput";
import {PROPERTY_SYSTEMS, DEFAULT_SYSTEM_IDS} from "../constants/propertySystems";

function AIAssistantSidebar({
  isOpen,
  onClose,
  systemLabel,
  systemContext,
  propertyId,
  propertySystems,
  contacts = [],
  initialPrompt,
  onScheduleSuccess,
  onOpenScheduleModal,
}) {
  const navigate = useNavigate();
  const {accountUrl} = useParams();
  const professionalsPath = accountUrl ? `/${accountUrl}/professionals` : "/professionals";
  const [messages, setMessages] = useState([]);
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [activeSystemId, setActiveSystemId] = useState(systemContext?.systemId ?? null);
  const [activeSystemName, setActiveSystemName] = useState(systemContext?.systemName ?? systemLabel ?? null);
  const [changeSystemOpen, setChangeSystemOpen] = useState(false);
  const hasSentInitialPromptRef = useRef(false);
  const [contractors, setContractors] = useState([]);
  const [contractorSearch, setContractorSearch] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState(null);
  const [eventType, setEventType] = useState(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(null);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [inspectionDate, setInspectionDate] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const hasLoadedConversationRef = useRef(false);

  useEffect(() => {
    if (scheduleSuccess) {
      const t = setTimeout(() => setScheduleSuccess(null), 5000);
      return () => clearTimeout(t);
    }
  }, [scheduleSuccess]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({behavior: "smooth"});
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && propertyId) {
      inputRef.current?.focus();
    }
  }, [isOpen, propertyId]);

  useEffect(() => {
    if (systemContext?.systemId) {
      setActiveSystemId(systemContext.systemId);
      setActiveSystemName(systemContext.systemName ?? systemLabel ?? null);
    } else {
      setActiveSystemId(null);
      setActiveSystemName(systemLabel ?? null);
    }
  }, [systemContext?.systemId, systemContext?.systemName, systemLabel]);

  const [overrideSystemContext, setOverrideSystemContext] = useState(null);

  const resetLocalState = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setOverrideSystemContext(null);
    setContextLoaded(false);
    setInspectionDate(null);
    hasSentInitialPromptRef.current = false;
    hasLoadedConversationRef.current = false;
  }, []);

  // Load persisted conversation when sidebar opens
  useEffect(() => {
    if (!isOpen) {
      hasLoadedConversationRef.current = false;
      return;
    }
    if (!propertyId || hasLoadedConversationRef.current) return;
    hasLoadedConversationRef.current = true;

    setLoadingHistory(true);
    AppApi.aiLoadConversation(propertyId)
      .then((data) => {
        if (data.conversation && data.messages?.length > 0) {
          setConversationId(data.conversation.id);
          setMessages(
            data.messages
              .filter((m) => m.role !== "system")
              .map((m) => ({
                role: m.role,
                content: m.content,
                uiDirectives: m.uiDirectives,
              }))
          );
          if (data.conversation.systemId) {
            setActiveSystemId(data.conversation.systemId);
          }
          setContextLoaded(true);
        }
        if (data.inspectionAnalysisDate) {
          setInspectionDate(data.inspectionAnalysisDate);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [isOpen, propertyId]);

  const handleChangeSystem = async (sys) => {
    setChangeSystemOpen(false);
    if (sys.id === activeSystemId) return;
    setConversationId(null);
    setMessages([]);
    hasSentInitialPromptRef.current = false;
    try {
      const ctx = await AppApi.getAiSystemContext(propertyId, sys.id);
      const mergedCtx = {
        systemId: ctx.systemId,
        systemName: ctx.systemName,
        systemCondition: ctx.systemCondition,
        lastMaintenanceDate: ctx.lastMaintenanceDate,
        upcomingEvents: ctx.upcomingEvents,
        inspectionFindingsForThisSystemOnly: ctx.inspectionFindingsForThisSystemOnly,
      };
      setOverrideSystemContext(mergedCtx);
      setActiveSystemId(mergedCtx.systemId);
      setActiveSystemName(mergedCtx.systemName);
    } catch {
      // Ignore
    }
  };

  const effectiveSystemContext = overrideSystemContext || systemContext;

  // Systems in the Change dropdown: only those added to this property
  const changeSystemOptions = propertySystems?.length
    ? propertySystems
    : PROPERTY_SYSTEMS.filter((s) => DEFAULT_SYSTEM_IDS.includes(s.id));

  // Auto-send initialPrompt (once per open)
  useEffect(() => {
    if (!isOpen) {
      hasSentInitialPromptRef.current = false;
      return;
    }
    if (!initialPrompt || !propertyId || hasSentInitialPromptRef.current || loading || loadingHistory) return;
    hasSentInitialPromptRef.current = true;
    setMessages((prev) => [...prev, {role: "user", content: initialPrompt}]);
    setLoading(true);
    const ctx = effectiveSystemContext;
    AppApi.aiChat({
      propertyId,
      message: initialPrompt,
      conversationId: conversationId || undefined,
      systemContext: ctx,
    })
      .then((res) => {
        setConversationId(res.conversationId ?? null);
        if (res.contextSwitched && res.systemName) {
          setActiveSystemId(res.systemId ?? null);
          setActiveSystemName(res.systemName);
        }
        if (res.inspectionAnalysisDate) {
          setInspectionDate(res.inspectionAnalysisDate);
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: res.assistantMessage,
            uiDirectives: res.uiDirectives,
          },
        ]);
        if (res.uiDirectives?.type === "SCHEDULE_PROPOSAL") {
          setScheduleDraft({
            actionDraftId: res.uiDirectives.actionDraftId,
            tasks: res.uiDirectives.tasks || [],
          });
          setSelectedContractor(null);
          setEventType(null);
          setScheduledFor("");
          setScheduledTime("");
          setScheduleNotes("");
        }
      })
      .catch((err) => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, something went wrong: ${err?.message || "Please try again."}`,
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, initialPrompt, propertyId, effectiveSystemContext, loadingHistory]);

  useEffect(() => {
    if (!propertyId || !scheduleDraft) return;
    AppApi.getPropertyContractors(propertyId, contractorSearch)
      .then(setContractors)
      .catch(() => setContractors([]));
  }, [propertyId, scheduleDraft, contractorSearch]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !propertyId || loading) return;

    setInput("");
    setMessages((prev) => [...prev, {role: "user", content: text}]);
    setLoading(true);

    try {
      const res = await AppApi.aiChat({
        propertyId,
        message: text,
        conversationId: conversationId || undefined,
        systemContext: effectiveSystemContext,
      });

      setConversationId(res.conversationId ?? null);
      if (res.contextSwitched && res.systemName) {
        setActiveSystemId(res.systemId ?? null);
        setActiveSystemName(res.systemName);
      }
      if (res.inspectionAnalysisDate) {
        setInspectionDate(res.inspectionAnalysisDate);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.assistantMessage,
          uiDirectives: res.uiDirectives,
        },
      ]);

      if (res.uiDirectives?.type === "SCHEDULE_PROPOSAL") {
        setScheduleDraft({
          actionDraftId: res.uiDirectives.actionDraftId,
          tasks: res.uiDirectives.tasks || [],
        });
        setSelectedContractor(null);
        setEventType(null);
        setScheduledFor("");
        setScheduledTime("");
        setScheduleNotes("");
      }
    } catch (err) {
      if (err?.status === 403 && err?.message?.toLowerCase().includes("quota")) {
        setUpgradePromptOpen(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "You've reached your AI usage limit for this month. Upgrade your plan for more.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, something went wrong: ${err?.message || "Please try again."}`,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetConversation = async () => {
    if (!conversationId) {
      resetLocalState();
      return;
    }
    try {
      await AppApi.aiResetConversation(conversationId);
    } catch {
      // proceed with local reset even if server fails
    }
    resetLocalState();
  };

  const handleSelectContractor = async (contractor) => {
    if (!scheduleDraft?.actionDraftId) return;
    setSelectedContractor(contractor);
    try {
      await AppApi.aiSelectContractor(scheduleDraft.actionDraftId, {
        contractorId: contractor.id,
        contractorSource: contractor.source,
        contractorName: contractor.name,
      });
    } catch (err) {
      console.error("Failed to select contractor:", err);
    }
  };

  const handleConfirmSchedule = async () => {
    if (!scheduleDraft?.actionDraftId || !selectedContractor || !eventType || !scheduledFor) return;
    setScheduling(true);
    try {
      const res = await AppApi.aiConfirmSchedule(scheduleDraft.actionDraftId, {
        scheduledFor,
        scheduledTime: scheduledTime?.trim() || undefined,
        eventType,
        notes: scheduleNotes || undefined,
      });
      setScheduleSuccess(res);
      setScheduleDraft(null);
      setSelectedContractor(null);
      onScheduleSuccess?.();
    } catch (err) {
      console.error("Failed to schedule:", err);
    } finally {
      setScheduling(false);
    }
  };

  const filteredContractors = contractorSearch.trim()
    ? contractors.filter(
        (c) =>
          c.name?.toLowerCase().includes(contractorSearch.toLowerCase()) ||
          c.email?.toLowerCase().includes(contractorSearch.toLowerCase())
      )
    : contractors;

  const formatInspectionDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  return (
    <Transition
      show={isOpen}
      tag="div"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl flex flex-col"
      enter="transition ease-out duration-200 transform"
      enterStart="translate-x-full"
      enterEnd="translate-x-0"
      leave="transition ease-in duration-150 transform"
      leaveStart="translate-x-0"
      leaveEnd="translate-x-full"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#456564]" />
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
              AI Assistant
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {(conversationId || messages.length > 0) && (
              <button
                type="button"
                onClick={handleResetConversation}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Reset conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Context indicators */}
        {(contextLoaded || inspectionDate) && (
          <div className="px-4 py-1.5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-2">
            {contextLoaded && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                <Database className="w-3 h-3" />
                Context Loaded
              </span>
            )}
            {inspectionDate && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                Using inspection findings from {formatInspectionDate(inspectionDate)}
              </span>
            )}
          </div>
        )}

        {(activeSystemId || systemContext?.systemId) && (activeSystemName || systemLabel || systemContext?.systemName) && (
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Discussing: <span className="font-medium text-gray-700 dark:text-gray-300">{activeSystemName || systemLabel || systemContext?.systemName} System</span>
            </p>
            <div className="relative">
              <button
                type="button"
                onClick={() => setChangeSystemOpen((o) => !o)}
                className="flex items-center gap-0.5 text-xs text-[#456564] hover:text-[#34514f] dark:text-[#7aa3a2] font-medium"
              >
                Change system <ChevronDown className={`w-3.5 h-3.5 transition-transform ${changeSystemOpen ? "rotate-180" : ""}`} />
              </button>
              {changeSystemOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setChangeSystemOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-full mt-1 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto min-w-[160px]">
                    {changeSystemOptions.map((sys) => (
                      <button
                        key={sys.id}
                        type="button"
                        onClick={() => handleChangeSystem(sys)}
                        className={`w-full text-left px-3 py-1.5 text-xs ${
                          sys.id === (activeSystemId || systemContext?.systemId)
                            ? "bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2] font-medium"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {sys.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {loadingHistory && messages.length === 0 && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-[#456564]" />
            </div>
          )}

          {!loadingHistory && messages.length === 0 && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-6 text-center">
              <Sparkles className="w-10 h-10 text-[#456564] mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Ask anything about your property.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                I can help with maintenance, inspections, and scheduling.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-[#456564] text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.uiDirectives?.type === "SCHEDULE_PROPOSAL" && (
                  <p className="mt-2 text-xs opacity-90">
                    I can help you schedule. Choose the event type, contractor, date, and time below.
                  </p>
                )}
                {msg.role === "assistant" && (activeSystemId || systemContext?.systemId) && idx === messages.length - 1 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {onOpenScheduleModal && (
                      <button
                        type="button"
                        onClick={() => onOpenScheduleModal({ systemId: activeSystemId || systemContext?.systemId, systemLabel: activeSystemName || systemContext?.systemName || activeSystemId, systemType: activeSystemId || systemContext?.systemId, serviceType: "inspection" })}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[#456564]/20 text-[#456564] dark:text-[#7aa3a2] hover:bg-[#456564]/30 border border-[#456564]/30"
                      >
                        <Calendar className="w-3 h-3" />
                        Schedule Inspection
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const base = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
                        const cleanPath = (professionalsPath || "").replace(/^\//, "");
                        window.open(`${base}#/${cleanPath}`, "_blank");
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      <UserPlus className="w-3 h-3" />
                      Find Contractor
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl px-3 py-2 bg-gray-100 dark:bg-gray-700">
                <Loader2 className="w-4 h-4 animate-spin text-[#456564]" />
              </div>
            </div>
          )}

          {scheduleSuccess && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Scheduled!</span>
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                Your maintenance has been added to the calendar.
              </p>
            </div>
          )}

          {scheduleDraft && !scheduleSuccess && (
            <div className="rounded-xl border border-[#456564]/30 dark:border-[#456564]/50 bg-[#456564]/5 p-4 space-y-4">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Schedule (fill in the details below)
              </p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {scheduleDraft.tasks.map((t, i) => (
                  <li key={i}>
                    {t.task} — {t.suggestedWhen}
                  </li>
                ))}
              </ul>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Event type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEventType("inspection")}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      eventType === "inspection"
                        ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2]"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Inspection
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventType("maintenance")}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      eventType === "maintenance"
                        ? "border-[#456564] bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2]"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300"
                    }`}
                  >
                    Maintenance
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  <Users className="w-3.5 h-3.5 inline mr-1" />
                  Select contractor
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={contractorSearch}
                    onChange={(e) => setContractorSearch(e.target.value)}
                    placeholder="Search contacts & professionals..."
                    className="form-input w-full pl-8 text-sm py-1.5"
                  />
                </div>
                <div className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5">
                  {filteredContractors.slice(0, 6).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectContractor(c)}
                      className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 ${
                        selectedContractor?.id === c.id
                          ? "bg-[#456564]/20 text-[#456564] dark:text-[#7aa3a2]"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {selectedContractor?.id === c.id && (
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      {c.name}
                    </button>
                  ))}
                  {filteredContractors.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-gray-500">
                      No contractors found.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          const base = typeof window !== "undefined" ? window.location.href.split("#")[0] : "";
                          const cleanPath = (professionalsPath || "").replace(/^\//, "");
                          window.open(`${base}#/${cleanPath}`, "_blank");
                        }}
                        className="text-[#456564] hover:underline font-medium inline-flex items-center gap-0.5"
                      >
                        Browse professionals directory
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />
                    Date
                  </label>
                  <DatePickerInput
                    name="scheduledFor"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    popoverClassName="z-[300]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    Time (optional)
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="form-input w-full text-sm py-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={scheduleNotes}
                  onChange={(e) => setScheduleNotes(e.target.value)}
                  placeholder="Add any notes..."
                  className="form-input w-full text-sm py-1.5"
                />
              </div>

              <button
                type="button"
                onClick={handleConfirmSchedule}
                disabled={!selectedContractor || !eventType || !scheduledFor || scheduling}
                className="w-full py-2 rounded-lg text-sm font-medium bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {scheduling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  "Confirm schedule"
                )}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {propertyId && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask about your property..."
                className="form-input flex-1 rounded-lg text-sm py-2"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {!propertyId && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Save the property to use the AI assistant.
            </p>
          </div>
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-[-1] md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <UpgradePrompt
        open={upgradePromptOpen}
        onClose={() => setUpgradePromptOpen(false)}
        title="AI usage limit reached"
        message="You've used all your AI tokens for this month. Upgrade your plan for more AI assistant usage."
      />
    </Transition>
  );
}

export default AIAssistantSidebar;
