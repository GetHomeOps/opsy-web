import React, {useState, useEffect, useCallback, useMemo} from "react";
import {useParams, useNavigate} from "react-router-dom";
import Header from "../../partials/Header";
import Sidebar from "../../partials/Sidebar";
import AppApi from "../../api/api";
import {PAGE_LAYOUT} from "../../constants/layout";
import {PROPERTY_SYSTEMS} from "../properties/constants/propertySystems";
import {getSystemLabelFromAiType} from "../properties/helpers/aiSystemNormalization";
import {groupUnifiedChecklistItems} from "./inspectionFindingsGrouping";
import {parseReviewNotes, hasReviewFeedback} from "./reviewFeedbackUtils";
import {
  Loader2,
  ArrowLeft,
  Building2,
  User as UserIcon,
  Mail,
  FileText,
  Download,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
  Save,
  X,
  MessageSquare,
} from "lucide-react";

const CONDITION_BADGES = {
  excellent:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  good: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  fair: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  poor: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  unknown: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const CONDITION_OPTIONS = ["excellent", "good", "fair", "poor", "unknown"];
const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"];
const PRIORITY_OPTIONS = ["urgent", "high", "medium", "low"];

const CHECKLIST_PRIORITY_BADGES = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  medium:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const SYSTEM_SELECT_OPTIONS = [
  {value: "general", label: "General"},
  ...PROPERTY_SYSTEMS.map((s) => ({value: s.id, label: s.name})),
];

/** Hide thumbnail sidebar in embedded PDF viewers (Chrome, etc.). */
function buildPdfEmbedUrl(url) {
  if (!url) return "";
  const params = "navpanes=0&view=FitH";
  return url.includes("#") ? `${url}&${params}` : `${url}#${params}`;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Section({title, icon: Icon, children, right}) {
  return (
    <section className="rounded-xl border border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/50 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          {title}
        </h3>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function inputClass(extra = "") {
  return `w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#456564] ${extra}`;
}

function SectionEditControls({
  section,
  editingSection,
  savingSection,
  canEdit,
  onStart,
  onCancel,
  onSave,
}) {
  if (!canEdit) return null;

  const isEditing = editingSection === section;
  const isBusy = Boolean(savingSection);
  const anotherEditing = editingSection && editingSection !== section;

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={isBusy}
          onClick={onCancel}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80 disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={onSave}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#456564] hover:bg-[#34514f] text-xs font-medium text-white disabled:opacity-50"
        >
          {savingSection === section ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save
        </button>
      </div>
    );
  }

  if (anotherEditing) return null;

  return (
    <button
      type="button"
      disabled={isBusy}
      onClick={() => onStart(section)}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80 disabled:opacity-50"
    >
      <Pencil className="w-3.5 h-3.5" />
      Edit
    </button>
  );
}

function InspectionReviewDetail() {
  const {accountUrl, reviewId} = useParams();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackImprovements, setFeedbackImprovements] = useState("");
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionDraft, setSectionDraft] = useState(null);
  const [savingSection, setSavingSection] = useState(null);
  const [editingChecklistSystemId, setEditingChecklistSystemId] = useState(null);

  const canEdit = review?.reviewStatus !== "approved";

  const fetchReview = useCallback(async () => {
    if (!reviewId) {
      setLoading(false);
      setError("Invalid review link.");
      setReview(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await AppApi.getInspectionReview(reviewId);
      setReview(res);
      const notes = parseReviewNotes(res?.reviewNotes);
      setFeedbackComment(notes.comment);
      setFeedbackImprovements(notes.suggestedImprovements);
    } catch (err) {
      const isNotFound = err?.status === 404;
      setError(
        isNotFound
          ? "This inspection review is no longer available. It may have been replaced by a newer analysis run — open the review queue to find the current ticket."
          : err?.message || "Failed to load review",
      );
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  const backToQueue = () =>
    navigate(`/${accountUrl}/helpdesk/inspection-reviews`);

  const handleApprove = async () => {
    setApproving(true);
    try {
      const approved = await AppApi.approveInspectionReview(reviewId);
      navigate(`/${accountUrl}/helpdesk/inspection-reviews`, {
        state: {
          justApproved: {
            id: review.id,
            propertyAddress: review.propertyAddress,
            customerName: review.customer?.name || "Customer",
            reviewStatus: "approved",
            reviewedAt: approved?.reviewedAt || new Date().toISOString(),
            uploadedAt: review.uploadedAt,
            fileName: review.report?.fileName,
          },
        },
      });
    } catch (err) {
      setError(err?.message || "Failed to approve");
      setApproving(false);
    }
  };

  const openFeedbackForm = () => {
    const notes = parseReviewNotes(review?.reviewNotes);
    setFeedbackComment(notes.comment);
    setFeedbackImprovements(notes.suggestedImprovements);
    setShowFeedbackForm(true);
    setError(null);
  };

  const cancelFeedbackForm = () => {
    const notes = parseReviewNotes(review?.reviewNotes);
    setFeedbackComment(notes.comment);
    setFeedbackImprovements(notes.suggestedImprovements);
    setShowFeedbackForm(false);
  };

  const handleSaveFeedback = async () => {
    if (
      !feedbackComment.trim() &&
      !feedbackImprovements.trim()
    ) {
      setError("Add a comment or suggested improvements before saving.");
      return;
    }
    setSavingFeedback(true);
    setError(null);
    setFeedbackNotice(null);
    try {
      const wasNew = review?.reviewStatus === "pending_review";
      const updated = await AppApi.saveInspectionReviewFeedback(reviewId, {
        comment: feedbackComment,
        suggestedImprovements: feedbackImprovements,
      });
      setReview(updated);
      const notes = parseReviewNotes(updated?.reviewNotes);
      setFeedbackComment(notes.comment);
      setFeedbackImprovements(notes.suggestedImprovements);
      setShowFeedbackForm(false);
      if (updated?.reviewStatus === "revision_requested" && wasNew) {
        setFeedbackNotice(
          "Feedback saved. This ticket has been moved to Further Review.",
        );
      } else {
        setFeedbackNotice("Feedback saved.");
      }
    } catch (err) {
      setError(err?.message || "Failed to save feedback");
    } finally {
      setSavingFeedback(false);
    }
  };

  const savedFeedback = parseReviewNotes(review?.reviewNotes);
  const showSavedFeedback = hasReviewFeedback(review?.reviewNotes);

  const startEditSection = (section) => {
    const analysis = review?.analysis || {};
    switch (section) {
      case "summary":
        setSectionDraft({
          summary: analysis.summary || "",
          conditionRating: analysis.conditionRating || "unknown",
          conditionRationale: analysis.conditionRationale || "",
          conditionConfidence: analysis.conditionConfidence ?? null,
        });
        break;
      case "systems":
        setSectionDraft(
          (analysis.systemsDetected || []).map((s) => ({...s})),
        );
        break;
      case "suggestedSystems":
        setSectionDraft(
          (analysis.suggestedSystemsToAdd || []).map((s) => ({...s})),
        );
        break;
      default:
        return;
    }
    setEditingSection(section);
    setError(null);
  };

  const startEditChecklistSystem = (systemId) => {
    const analysisData = review?.analysis || {};
    setSectionDraft({
      needsAttention: (analysisData.needsAttention || []).map((n) => ({...n})),
      maintenanceSuggestions: (analysisData.maintenanceSuggestions || []).map(
        (m) => ({...m}),
      ),
    });
    setEditingChecklistSystemId(systemId);
    setEditingSection("checklistSystem");
    setError(null);
  };

  const cancelEditSection = () => {
    setEditingSection(null);
    setSectionDraft(null);
    setEditingChecklistSystemId(null);
  };

  const saveSection = async (section) => {
    setSavingSection(section);
    setError(null);
    try {
      let payload = {};
      switch (section) {
        case "summary":
          payload = {
            summary: sectionDraft.summary,
            conditionRating: sectionDraft.conditionRating,
            conditionRationale: sectionDraft.conditionRationale,
            conditionConfidence: sectionDraft.conditionConfidence,
          };
          break;
        case "systems":
          payload = {systemsDetected: sectionDraft};
          break;
        case "checklistSystem":
          payload = {
            needsAttention: sectionDraft.needsAttention,
            maintenanceSuggestions: sectionDraft.maintenanceSuggestions,
          };
          break;
        case "suggestedSystems":
          payload = {suggestedSystemsToAdd: sectionDraft};
          break;
        default:
          return;
      }
      const updated = await AppApi.updateInspectionReviewAnalysis(
        reviewId,
        payload,
      );
      setReview(updated);
      cancelEditSection();
    } catch (err) {
      setError(err?.message || "Failed to save changes");
    } finally {
      setSavingSection(null);
    }
  };

  const analysis = review?.analysis || {};
  const isEditingSummary = editingSection === "summary";
  const isEditingSystems = editingSection === "systems";
  const isEditingChecklistSystem = editingSection === "checklistSystem";
  const isEditingSuggested = editingSection === "suggestedSystems";

  const summaryData = isEditingSummary
    ? sectionDraft
    : {
        summary: analysis.summary || "",
        conditionRating: analysis.conditionRating || "unknown",
        conditionRationale: analysis.conditionRationale || "",
      };

  const systems = isEditingSystems
    ? sectionDraft || []
    : analysis.systemsDetected || [];

  const needsAttention = isEditingChecklistSystem
    ? sectionDraft?.needsAttention || []
    : analysis.needsAttention || [];

  const maintenance = isEditingChecklistSystem
    ? sectionDraft?.maintenanceSuggestions || []
    : analysis.maintenanceSuggestions || [];

  const suggestedSystems = isEditingSuggested
    ? sectionDraft || []
    : analysis.suggestedSystemsToAdd || [];

  const unifiedChecklistBySystem = useMemo(
    () => groupUnifiedChecklistItems(needsAttention, maintenance),
    [needsAttention, maintenance],
  );

  const checklistItemCount = needsAttention.length + maintenance.length;

  const updateFinding = (index, patch) => {
    setSectionDraft((prev) => {
      const next = [...prev.needsAttention];
      next[index] = {...next[index], ...patch};
      return {...prev, needsAttention: next};
    });
  };

  const removeFinding = (index) => {
    setSectionDraft((prev) => ({
      ...prev,
      needsAttention: prev.needsAttention.filter((_, i) => i !== index),
    }));
  };

  const addFinding = (systemType = "general") => {
    setSectionDraft((prev) => ({
      ...prev,
      needsAttention: [
        ...prev.needsAttention,
        {
          systemType,
          title: "",
          suggestedAction: "",
          evidence: "",
          severity: "medium",
        },
      ],
    }));
  };

  const updateMaintenance = (index, patch) => {
    setSectionDraft((prev) => {
      const next = [...prev.maintenanceSuggestions];
      next[index] = {...next[index], ...patch};
      return {...prev, maintenanceSuggestions: next};
    });
  };

  const removeMaintenance = (index) => {
    setSectionDraft((prev) => ({
      ...prev,
      maintenanceSuggestions: prev.maintenanceSuggestions.filter(
        (_, i) => i !== index,
      ),
    }));
  };

  const addMaintenance = (systemType = "general") => {
    setSectionDraft((prev) => ({
      ...prev,
      maintenanceSuggestions: [
        ...prev.maintenanceSuggestions,
        {
          systemType,
          task: "",
          suggestedWhen: "",
          rationale: "",
          priority: "medium",
        },
      ],
    }));
  };

  const updateSystemCondition = (index, conditionValue) => {
    setSectionDraft((prev) => {
      const next = [...prev];
      next[index] = {...next[index], condition: conditionValue};
      return next;
    });
  };

  const addSuggestedSystem = () => {
    setSectionDraft((prev) => [
      ...(prev || []),
      {systemType: "general", name: ""},
    ]);
  };

  const updateSuggestedSystem = (index, patch) => {
    setSectionDraft((prev) => {
      const next = [...prev];
      next[index] = {...next[index], ...patch};
      return next;
    });
  };

  const removeSuggestedSystem = (index) => {
    setSectionDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const sectionControls = (section) => (
    <SectionEditControls
      section={section}
      editingSection={editingSection}
      savingSection={savingSection}
      canEdit={canEdit}
      onStart={startEditSection}
      onCancel={cancelEditSection}
      onSave={() => saveSection(section)}
    />
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className={`${PAGE_LAYOUT.list}`}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div className="flex items-start gap-3 min-w-0">
                <button
                  type="button"
                  onClick={backToQueue}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0 mt-0.5"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-gray-400 shrink-0" />
                    <span className="truncate">
                      {review?.propertyAddress || "Inspection review"}
                    </span>
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Inspection analysis #{review?.id || reviewId} ·{" "}
                    {review?.reviewStatus === "approved"
                      ? "Approved"
                      : review?.reviewStatus === "revision_requested"
                        ? "Further review"
                        : "New"}
                  </p>
                </div>
              </div>
              {review && !loading && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={
                    approving ||
                    savingFeedback ||
                    Boolean(editingSection)
                  }
                  onClick={
                    showFeedbackForm ? cancelFeedbackForm : openFeedbackForm
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700/80 transition-colors disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  {showFeedbackForm
                    ? "Cancel feedback"
                    : showSavedFeedback
                      ? "Edit feedback"
                      : "Leave feedback"}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    disabled={
                      approving ||
                      savingFeedback ||
                      Boolean(editingSection) ||
                      showFeedbackForm
                    }
                    onClick={handleApprove}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#456564] hover:bg-[#34514f] text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                  >
                    {approving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve & release
                  </button>
                )}
              </div>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-[#456564] animate-spin" />
              </div>
            ) : error && !review ? (
              <div className="rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 p-5 text-sm text-red-700 dark:text-red-300">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={backToQueue}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#456564] hover:bg-[#34514f] text-white text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to review queue
                </button>
              </div>
            ) : review ? (
              <>
                {error && (
                  <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                {feedbackNotice && (
                  <div className="mb-4 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
                    {feedbackNotice}
                  </div>
                )}

                {showFeedbackForm && (
                  <div className="mb-5 rounded-xl border border-violet-200 dark:border-violet-800/50 bg-violet-50/50 dark:bg-violet-900/15 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-violet-500" />
                        Reviewer feedback
                      </h3>
                      <button
                        type="button"
                        onClick={cancelFeedbackForm}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Internal notes for the review team. Saving feedback moves
                      the ticket to Further Review unless it is already approved.
                    </p>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                      Comment
                    </label>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      rows={3}
                      placeholder="General observations, context, or notes for other reviewers…"
                      className={inputClass("mb-4")}
                    />
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                      Suggested improvements
                    </label>
                    <textarea
                      value={feedbackImprovements}
                      onChange={(e) =>
                        setFeedbackImprovements(e.target.value)
                      }
                      rows={3}
                      placeholder="What should be improved in this analysis before or after release…"
                      className={inputClass("mb-4")}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={savingFeedback}
                        onClick={cancelFeedbackForm}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingFeedback}
                        onClick={handleSaveFeedback}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        {savingFeedback ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save feedback
                      </button>
                    </div>
                  </div>
                )}

                {showSavedFeedback && !showFeedbackForm && (
                  <div className="mb-5">
                    <Section
                      title="Comments & feedback"
                      icon={MessageSquare}
                      right={
                        <button
                          type="button"
                          onClick={openFeedbackForm}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#456564] hover:underline"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      }
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {savedFeedback.comment && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Comment
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                              {savedFeedback.comment}
                            </p>
                          </div>
                        )}
                        {savedFeedback.suggestedImprovements && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Suggested improvements
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                              {savedFeedback.suggestedImprovements}
                            </p>
                          </div>
                        )}
                      </div>
                      {review.reviewer?.name && (
                        <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                          Last updated by {review.reviewer.name}
                          {review.reviewedAt &&
                            ` · ${formatDate(review.reviewedAt)}`}
                        </p>
                      )}
                    </Section>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-11 gap-5">
                  <div className="space-y-5 xl:col-span-6">
                    <Section title="Property & customer" icon={UserIcon}>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                        <div>
                          <dt className="text-xs text-gray-400">Customer</dt>
                          <dd className="text-gray-800 dark:text-gray-200">
                            {review.customer?.name || "—"}
                          </dd>
                        </div>
                        {review.customer?.email && (
                          <div>
                            <dt className="text-xs text-gray-400">Email</dt>
                            <dd className="text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              {review.customer.email}
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-xs text-gray-400">Uploaded</dt>
                          <dd className="text-gray-800 dark:text-gray-200">
                            {formatDate(review.uploadedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-gray-400">Analyzed</dt>
                          <dd className="text-gray-800 dark:text-gray-200">
                            {formatDate(review.createdAt)}
                          </dd>
                        </div>
                      </dl>
                    </Section>

                    <Section
                      title="Executive summary"
                      icon={Sparkles}
                      right={sectionControls("summary")}
                    >
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs text-gray-400">
                          Property condition:
                        </span>
                        {isEditingSummary ? (
                          <select
                            value={summaryData.conditionRating || "unknown"}
                            onChange={(e) =>
                              setSectionDraft((prev) => ({
                                ...prev,
                                conditionRating: e.target.value,
                              }))
                            }
                            className={inputClass("w-auto")}
                          >
                            {CONDITION_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                              CONDITION_BADGES[summaryData.conditionRating] ||
                              CONDITION_BADGES.unknown
                            }`}
                          >
                            {summaryData.conditionRating}
                          </span>
                        )}
                      </div>
                      {isEditingSummary ? (
                        <>
                          <textarea
                            value={summaryData.summary || ""}
                            onChange={(e) =>
                              setSectionDraft((prev) => ({
                                ...prev,
                                summary: e.target.value,
                              }))
                            }
                            rows={4}
                            placeholder="Executive summary…"
                            className={inputClass("mb-3")}
                          />
                          <textarea
                            value={summaryData.conditionRationale || ""}
                            onChange={(e) =>
                              setSectionDraft((prev) => ({
                                ...prev,
                                conditionRationale: e.target.value,
                              }))
                            }
                            rows={2}
                            placeholder="Condition rationale…"
                            className={inputClass()}
                          />
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {summaryData.summary || "No summary available."}
                          </p>
                          {summaryData.conditionRationale && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                              {summaryData.conditionRationale}
                            </p>
                          )}
                        </>
                      )}
                    </Section>

                    <Section
                      title={`Systems detected (${systems.length})`}
                      icon={Building2}
                      right={sectionControls("systems")}
                    >
                      {systems.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No systems detected.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {systems.map((s, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30 px-3 py-2"
                            >
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {getSystemLabelFromAiType(
                                  s.systemType ?? s.system_key ?? s.name,
                                ) ||
                                  s.name ||
                                  "System"}
                              </p>
                              {isEditingSystems ? (
                                <select
                                  value={s.condition || "unknown"}
                                  onChange={(e) =>
                                    updateSystemCondition(i, e.target.value)
                                  }
                                  className={inputClass("mt-1 text-xs")}
                                >
                                  {CONDITION_OPTIONS.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                s.condition && (
                                  <span
                                    className={`inline-flex mt-1 text-[11px] px-1.5 py-0.5 rounded capitalize ${
                                      CONDITION_BADGES[s.condition] ||
                                      CONDITION_BADGES.unknown
                                    }`}
                                  >
                                    {s.condition}
                                  </span>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Section>

                    <Section
                      title={`Inspection checklist (${checklistItemCount})`}
                      icon={ClipboardList}
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        Grouped as the customer will see after approval — findings and maintenance combined by system.
                      </p>
                      {checklistItemCount === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No checklist items.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {Array.from(unifiedChecklistBySystem.values()).map(
                            ({meta, items: groupItems}) => {
                              const isEditingThisSystem =
                                isEditingChecklistSystem &&
                                editingChecklistSystemId === meta.id;
                              const anotherChecklistEditing =
                                isEditingChecklistSystem &&
                                editingChecklistSystemId !== meta.id;
                              const savingChecklist =
                                savingSection === "checklistSystem";

                              return (
                                <div
                                  key={`checklist-${meta.id}`}
                                  className="rounded-lg border border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30 px-3 py-3"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                      {meta.label}
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                        {groupItems.length} item
                                        {groupItems.length === 1 ? "" : "s"}
                                      </span>
                                      {canEdit && isEditingThisSystem && (
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            disabled={savingChecklist}
                                            onClick={cancelEditSection}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[11px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80 disabled:opacity-50"
                                          >
                                            <X className="w-3 h-3" />
                                            Cancel
                                          </button>
                                          <button
                                            type="button"
                                            disabled={savingChecklist}
                                            onClick={() =>
                                              saveSection("checklistSystem")
                                            }
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#456564] hover:bg-[#34514f] text-[11px] font-medium text-white disabled:opacity-50"
                                          >
                                            {savingChecklist ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <Save className="w-3 h-3" />
                                            )}
                                            Save
                                          </button>
                                        </div>
                                      )}
                                      {canEdit &&
                                        !isEditingThisSystem &&
                                        !anotherChecklistEditing &&
                                        !editingSection && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              startEditChecklistSystem(meta.id)
                                            }
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[11px] font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/80"
                                          >
                                            <Pencil className="w-3 h-3" />
                                            Edit
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                  <ul className="space-y-2">
                                    {groupItems.map((item, idx) => {
                                      const priorityKey = (
                                        item.priority || "medium"
                                      ).toLowerCase();
                                      const realIdx = item.sourceIndex;

                                      return (
                                        <li
                                          key={`${meta.id}-${item.source}-${item.sourceIndex}-${idx}`}
                                          className="rounded-lg border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/60 px-3 py-2.5"
                                        >
                                          {isEditingThisSystem &&
                                          item.source === "needs_attention" ? (
                                            <div className="space-y-2">
                                              <div className="flex items-start gap-2">
                                                <select
                                                  value={item.severity || "medium"}
                                                  onChange={(e) =>
                                                    updateFinding(realIdx, {
                                                      severity: e.target.value,
                                                    })
                                                  }
                                                  className={inputClass(
                                                    "text-xs w-28",
                                                  )}
                                                >
                                                  {SEVERITY_OPTIONS.map((s) => (
                                                    <option key={s} value={s}>
                                                      {s}
                                                    </option>
                                                  ))}
                                                </select>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    removeFinding(realIdx)
                                                  }
                                                  className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                  title="Delete finding"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                              <input
                                                value={needsAttention[realIdx]?.title || ""}
                                                onChange={(e) =>
                                                  updateFinding(realIdx, {
                                                    title: e.target.value,
                                                  })
                                                }
                                                placeholder="Finding title"
                                                className={inputClass()}
                                              />
                                              <input
                                                value={
                                                  needsAttention[realIdx]
                                                    ?.suggestedAction || ""
                                                }
                                                onChange={(e) =>
                                                  updateFinding(realIdx, {
                                                    suggestedAction:
                                                      e.target.value,
                                                  })
                                                }
                                                placeholder="Suggested action"
                                                className={inputClass()}
                                              />
                                              <textarea
                                                value={
                                                  needsAttention[realIdx]
                                                    ?.evidence || ""
                                                }
                                                onChange={(e) =>
                                                  updateFinding(realIdx, {
                                                    evidence: e.target.value,
                                                  })
                                                }
                                                rows={2}
                                                placeholder="Evidence / description"
                                                className={inputClass()}
                                              />
                                            </div>
                                          ) : isEditingThisSystem ? (
                                            <div className="space-y-2">
                                              <div className="flex items-start gap-2">
                                                <select
                                                  value={item.priority || "medium"}
                                                  onChange={(e) =>
                                                    updateMaintenance(realIdx, {
                                                      priority: e.target.value,
                                                    })
                                                  }
                                                  className={inputClass(
                                                    "text-xs w-28",
                                                  )}
                                                >
                                                  {PRIORITY_OPTIONS.map((p) => (
                                                    <option key={p} value={p}>
                                                      {p}
                                                    </option>
                                                  ))}
                                                </select>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    removeMaintenance(realIdx)
                                                  }
                                                  className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                  title="Delete recommendation"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                              <input
                                                value={
                                                  maintenance[realIdx]?.task || ""
                                                }
                                                onChange={(e) =>
                                                  updateMaintenance(realIdx, {
                                                    task: e.target.value,
                                                  })
                                                }
                                                placeholder="Maintenance task"
                                                className={inputClass()}
                                              />
                                              <input
                                                value={
                                                  maintenance[realIdx]
                                                    ?.suggestedWhen || ""
                                                }
                                                onChange={(e) =>
                                                  updateMaintenance(realIdx, {
                                                    suggestedWhen:
                                                      e.target.value,
                                                  })
                                                }
                                                placeholder="Suggested timing"
                                                className={inputClass()}
                                              />
                                              <textarea
                                                value={
                                                  maintenance[realIdx]?.rationale ||
                                                  ""
                                                }
                                                onChange={(e) =>
                                                  updateMaintenance(realIdx, {
                                                    rationale: e.target.value,
                                                  })
                                                }
                                                rows={2}
                                                placeholder="Rationale"
                                                className={inputClass()}
                                              />
                                            </div>
                                          ) : (
                                            <>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                                                    CHECKLIST_PRIORITY_BADGES[
                                                      priorityKey
                                                    ] ||
                                                    CHECKLIST_PRIORITY_BADGES.medium
                                                  }`}
                                                >
                                                  {priorityKey}
                                                </span>
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                  {item.title}
                                                </p>
                                              </div>
                                              {item.description && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                  {item.description}
                                                </p>
                                              )}
                                              {item.suggestedWhen && (
                                                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 italic">
                                                  {item.suggestedWhen}
                                                </p>
                                              )}
                                              {item.evidence && (
                                                <p className="text-[11px] text-gray-400 mt-1 italic">
                                                  {item.evidence}
                                                </p>
                                              )}
                                            </>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {isEditingThisSystem && (
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => addFinding(meta.id)}
                                        className="inline-flex items-center gap-1 text-xs text-[#456564] hover:underline"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Add finding
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => addMaintenance(meta.id)}
                                        className="inline-flex items-center gap-1 text-xs text-[#456564] hover:underline"
                                      >
                                        <Plus className="w-3 h-3" />
                                        Add maintenance
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}
                    </Section>

                    {(suggestedSystems.length > 0 || canEdit) && (
                      <Section
                        title={`Suggested systems to add (${suggestedSystems.length})`}
                        icon={Building2}
                        right={
                          <div className="flex items-center gap-2">
                            {isEditingSuggested && (
                              <button
                                type="button"
                                onClick={addSuggestedSystem}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#456564] hover:underline"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Add system
                              </button>
                            )}
                            {sectionControls("suggestedSystems")}
                          </div>
                        }
                      >
                        {isEditingSuggested ? (
                          suggestedSystems.length === 0 ? (
                            <button
                              type="button"
                              onClick={addSuggestedSystem}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:border-[#456564] hover:text-[#456564]"
                            >
                              <Plus className="w-4 h-4" />
                              Add first system
                            </button>
                          ) : (
                            <div className="space-y-2">
                              {suggestedSystems.map((s, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <select
                                    value={
                                      s.systemType || s.system_key || "general"
                                    }
                                    onChange={(e) =>
                                      updateSuggestedSystem(i, {
                                        systemType: e.target.value,
                                      })
                                    }
                                    className={inputClass("text-xs flex-1")}
                                  >
                                    {SYSTEM_SELECT_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => removeSuggestedSystem(i)}
                                    className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )
                        ) : suggestedSystems.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            No additional systems suggested.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {suggestedSystems.map((s, i) => (
                              <span
                                key={i}
                                className="text-xs px-2.5 py-1 rounded-full bg-[#456564]/10 text-[#456564] dark:text-[#7aa3a2]"
                              >
                                {getSystemLabelFromAiType(
                                  s.systemType ?? s.system_key ?? s.name,
                                ) || s.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </Section>
                    )}
                  </div>

                  <div className="xl:col-span-5">
                    <div className="xl:sticky xl:top-6">
                      <Section
                        title="Inspection report"
                        icon={FileText}
                        right={
                          review.report?.url ? (
                            <div className="flex items-center gap-3">
                              <a
                                href={review.report.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#456564] dark:text-[#7aa3a2] hover:underline"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Open in new tab
                              </a>
                              <a
                                href={review.report.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={review.report.fileName || undefined}
                                className="inline-flex items-center gap-1 text-xs font-medium text-[#456564] dark:text-[#7aa3a2] hover:underline"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </a>
                            </div>
                          ) : null
                        }
                      >
                        {review.report?.url ? (
                          <iframe
                            title={
                              review.report.fileName || "Inspection report"
                            }
                            src={buildPdfEmbedUrl(review.report.url)}
                            className="w-full h-[min(78vh,900px)] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                          />
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Report file unavailable.
                          </p>
                        )}
                        {review.report?.fileName && (
                          <p className="text-xs text-gray-400 mt-2 truncate">
                            {review.report.fileName}
                          </p>
                        )}
                      </Section>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

export default InspectionReviewDetail;
