import React, {useCallback, useEffect, useRef, useState} from "react";
import {useLocation, useNavigate, useParams} from "react-router-dom";
import {
  AlertCircle,
  Calculator,
  FileText,
  Home,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  Upload,
  Wrench,
} from "lucide-react";
import AppApi, {getApiErrorMessage} from "../../api/api";
import {useAuth} from "../../context/AuthContext";
import useCurrentAccount from "../../hooks/useCurrentAccount";
import SectionCard from "../properties/partials/passport/SectionCard";
import EmptyStateCard from "../properties/partials/passport/EmptyStateCard";
import AIAssistantSidebar from "../properties/partials/AIAssistantSidebar";
import PrePurchaseShell from "./PrePurchaseShell";
import PrePurchaseToolbar from "./PrePurchaseToolbar";
import PrePurchaseAnalysisHeader from "./PrePurchaseAnalysisHeader";
import PrePurchaseProcessing from "./PrePurchaseProcessing";
import OverviewTab from "./tabs/OverviewTab";
import IdentityTab from "./tabs/IdentityTab";
import SystemsTab from "./tabs/SystemsTab";
import IssuesTab from "./tabs/IssuesTab";
import RecommendationsTab from "./tabs/RecommendationsTab";
import DocumentsTab from "./tabs/DocumentsTab";
import TrueCostTab from "./tabs/TrueCostTab";
import PrePurchaseUploadModal from "./PrePurchaseUploadModal";
import PresentationModeModal from "./PresentationModeModal";
import ScoutNotesCard from "./components/ScoutNotesCard";
import ScoutNotesModal from "./components/ScoutNotesModal";
import {generateScoutReportPdf} from "./generateScoutReportPdf";
import {formatAddress, formatDisplayName} from "./prePurchaseUtils";

const TABS = [
  {id: "overview", label: "Overview", icon: LayoutDashboard},
  {id: "identity", label: "Identity", icon: Home},
  {id: "systems", label: "Systems", icon: Wrench},
  {id: "issues", label: "Issues", icon: AlertCircle},
  {id: "recommendations", label: "Recommendations", icon: Lightbulb},
  {id: "documents", label: "Documents", icon: FileText},
  {id: "true-cost", label: "True Cost", icon: Calculator},
];

const RUNNING_STATUSES = [
  "extracting",
  "identifying_systems",
  "detecting_issues",
  "generating_recommendations",
];

export default function PrePurchaseAnalysisPage() {
  const {accountUrl, analysisId} = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {currentAccount} = useCurrentAccount();
  const {currentUser} = useAuth();

  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [linkedPropertyUid, setLinkedPropertyUid] = useState(null);
  const [analysisIds, setAnalysisIds] = useState([]);
  const [tabFocus, setTabFocus] = useState({});
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(null);
  const [aiSystemLabel, setAiSystemLabel] = useState(null);
  const [aiSystemContext, setAiSystemContext] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [presentationOpen, setPresentationOpen] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesStartComposing, setNotesStartComposing] = useState(false);

  const startInFlightRef = useRef(false);
  const autoResumeDoneRef = useRef(null);

  useEffect(() => {
    const restoreTab = location.state?.tab;
    if (!restoreTab) return;
    if (!TABS.some((t) => t.id === restoreTab)) return;
    setTab(restoreTab);
  }, [location.state]);

  const load = useCallback(
    async ({silent = false} = {}) => {
      if (!analysisId) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await AppApi.getPrePurchaseAnalysis(analysisId);
        setAnalysis(data);
        if (
          RUNNING_STATUSES.includes(data?.status) ||
          data?.status === "completed"
        ) {
          setError(null);
        }
      } catch (err) {
        if (!silent) {
          setError(getApiErrorMessage(err, "Failed to load analysis."));
          setAnalysis(null);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [analysisId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    autoResumeDoneRef.current = null;
  }, [analysisId]);

  // Load sibling analyses for pager
  useEffect(() => {
    let cancelled = false;
    async function loadIds() {
      if (!currentAccount?.id) return;
      try {
        const res = await AppApi.getPrePurchaseAnalyses({
          accountId: currentAccount.id,
          limit: 200,
          offset: 0,
        });
        if (cancelled) return;
        const ids = (res.analyses || []).map((a) => a.id).filter(Boolean);
        setAnalysisIds(ids);
      } catch {
        if (!cancelled) setAnalysisIds([]);
      }
    }
    loadIds();
    return () => {
      cancelled = true;
    };
  }, [currentAccount?.id]);

  // Poll while AI job is running (not for stuck legacy "uploading")
  useEffect(() => {
    if (!analysis || !RUNNING_STATUSES.includes(analysis.status))
      return undefined;
    const id = setInterval(() => {
      load({silent: true});
    }, 2000);
    return () => clearInterval(id);
  }, [analysis?.status, load]);

  const handleStartOrRefresh = useCallback(async () => {
    if (!analysisId || startInFlightRef.current) return;
    startInFlightRef.current = true;
    setRefreshing(true);
    setError(null);
    try {
      await AppApi.startPrePurchaseAnalysis(analysisId);
      setTab("overview");
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not start analysis."));
    } finally {
      await load({silent: true});
      setRefreshing(false);
      startInFlightRef.current = false;
    }
  }, [analysisId, load]);

  // Auto-resume legacy stuck "uploading" rows that have documents
  useEffect(() => {
    if (!analysis || !analysisId) return;
    if (analysis.status !== "uploading") return;
    const docs = analysis.documents || [];
    if (!docs.length) return;
    if (autoResumeDoneRef.current === analysisId) return;
    autoResumeDoneRef.current = analysisId;
    handleStartOrRefresh();
  }, [analysis, analysisId, handleStartOrRefresh]);

  async function handleRetry() {
    setRetrying(true);
    setError(null);
    try {
      await AppApi.retryPrePurchaseAnalysis(analysisId);
      await load({silent: true});
    } catch (err) {
      setError(getApiErrorMessage(err, "Retry failed."));
    } finally {
      setRetrying(false);
    }
  }

  async function handleConvertToProperty() {
    if (!analysisId || converting) return;
    setConverting(true);
    setError(null);
    try {
      const res = await AppApi.convertPrePurchaseToProperty(analysisId);
      const uid = res.property?.propertyUid || res.property?.id;
      if (res.analysis) setAnalysis(res.analysis);
      if (uid) {
        setLinkedPropertyUid(String(uid));
        navigate(`/${accountUrl}/properties/${uid}`);
      } else {
        setError("Property was created but no property id was returned.");
        setConverting(false);
      }
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Could not convert to property. If an inspection report was uploaded, it may not have been moved — try again."
        )
      );
      setConverting(false);
    }
  }

  const showResults = analysis?.status === "completed";
  // Fallback when analysis was started outside the setup wizard (Documents tab,
  // retry, legacy upload resume) or the user left the wizard early.
  const showProcessing =
    analysis &&
    (RUNNING_STATUSES.includes(analysis.status) ||
      analysis.status === "failed" ||
      analysis.status === "uploading");
  const documents = analysis?.documents || [];
  const hasDocuments = documents.length > 0;

  const hasAddress = Boolean(analysis?.street || analysis?.displayName);
  const propertyId = analysis?.propertyId;
  const viewPropertyPath = propertyId
    ? `/${accountUrl}/properties/${linkedPropertyUid || propertyId}`
    : null;

  const canStartAnalysis =
    analysis?.status === "draft" ||
    analysis?.status === "failed" ||
    analysis?.status === "uploading" ||
    analysis?.status === "completed";

  function openUploadModal() {
    setUploadModalOpen(true);
  }

  const handleNavigateTab = useCallback((nextTab, focus = {}) => {
    setTabFocus(focus || {});
    setTab(nextTab);
  }, []);

  const handleAskAI = useCallback((finding) => {
    if (!finding || !analysis) return;
    const prompt = `Regarding the Opsy Scout inspection finding: "${finding.title}"${
      finding.description ? ` — ${finding.description}` : ""
    }. What should I know about this issue, how urgent is it, and what should I do next?`;
    const systemName = finding.systemLabel || finding.systemKey || null;
    setAiSystemLabel(systemName);
    setAiSystemContext(
      finding.systemKey
        ? {systemId: finding.systemKey, systemName: systemName || finding.systemKey}
        : null,
    );
    setAiPrompt(prompt);
    setAiOpen(true);
  }, [analysis]);

  const handleTabClick = useCallback((tabId) => {
    setTabFocus({});
    setTab(tabId);
  }, []);

  const handlePresentationMode = useCallback(() => {
    if (analysis?.status !== "completed") return;
    setPresentationOpen(true);
  }, [analysis?.status]);

  const handleDownloadReport = useCallback(() => {
    if (!analysis || analysis.status !== "completed") return;
    setReportError(null);
    setDownloadingReport(true);
    try {
      generateScoutReportPdf(analysis);
    } catch (err) {
      setReportError(
        err?.message || "Could not generate the PDF report. Please try again."
      );
    } finally {
      setDownloadingReport(false);
    }
  }, [analysis]);

  const refreshNotes = useCallback(() => {
    if (!analysisId) {
      setNotes([]);
      return;
    }
    setNotesLoading(true);
    AppApi.getPrePurchaseNotes(analysisId)
      .then((list) => setNotes(list ?? []))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false));
  }, [analysisId]);

  useEffect(() => {
    refreshNotes();
  }, [refreshNotes]);

  const openNotesModal = useCallback((compose = false) => {
    setNotesStartComposing(Boolean(compose));
    setNotesModalOpen(true);
  }, []);

  const handleAddNote = useCallback(
    async (body) => {
      if (!analysisId) return;
      setNotesSaving(true);
      try {
        const note = await AppApi.createPrePurchaseNote(analysisId, body);
        setNotes((prev) => [note, ...prev]);
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to save note."));
      } finally {
        setNotesSaving(false);
      }
    },
    [analysisId],
  );

  const handleUpdateNote = useCallback(
    async (noteId, body) => {
      if (!analysisId) return;
      setNotesSaving(true);
      try {
        const updated = await AppApi.updatePrePurchaseNote(
          analysisId,
          noteId,
          body,
        );
        setNotes((prev) => {
          const next = prev.map((n) => (n.id === noteId ? updated : n));
          next.sort((a, b) => {
            const ta = new Date(a.updatedAt || a.updated_at || 0).getTime();
            const tb = new Date(b.updatedAt || b.updated_at || 0).getTime();
            return tb - ta;
          });
          return next;
        });
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to update note."));
      } finally {
        setNotesSaving(false);
      }
    },
    [analysisId],
  );

  const handleDeleteNote = useCallback(
    async (noteId) => {
      if (!analysisId) return;
      setNotesSaving(true);
      try {
        await AppApi.deletePrePurchaseNote(analysisId, noteId);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      } catch (err) {
        setError(getApiErrorMessage(err, "Failed to delete note."));
      } finally {
        setNotesSaving(false);
      }
    },
    [analysisId],
  );

  return (
    <PrePurchaseShell>
      <div className="space-y-4">
        <PrePurchaseToolbar
          accountUrl={accountUrl}
          analysisIds={analysisIds}
          currentId={analysisId}
          propertyId={propertyId}
          viewPropertyPath={viewPropertyPath}
          hasAddress={hasAddress}
          hasDocuments={hasDocuments}
          canStartAnalysis={canStartAnalysis}
          converting={converting}
          starting={refreshing}
          downloadingReport={downloadingReport}
          onConvertToProperty={handleConvertToProperty}
          onStartOrRefreshAnalysis={handleStartOrRefresh}
          onPresentationMode={handlePresentationMode}
          onDownloadReport={handleDownloadReport}
          analysisStatus={analysis?.status}
        />

        {reportError ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 px-4 py-3 flex items-start justify-between gap-3 text-sm text-red-800 dark:text-red-200"
            role="alert"
          >
            <p>{reportError}</p>
            <button
              type="button"
              className="text-xs font-semibold underline shrink-0"
              onClick={() => setReportError(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-neutral-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden />
            Loading analysis…
          </div>
        ) : error && !analysis ? (
          <SectionCard>
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 py-6">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-medium">Could not load analysis</p>
                <p className="text-sm mt-1">{error}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    className="btn-sm border"
                    onClick={() => load()}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    className="btn-sm border"
                    onClick={() => navigate(`/${accountUrl}/pre-purchase`)}
                  >
                    Back to list
                  </button>
                </div>
              </div>
            </div>
          </SectionCard>
        ) : analysis ? (
          <>
            <PrePurchaseAnalysisHeader
              analysis={analysis}
              onPhotoChanged={(updated) => {
                if (updated) setAnalysis((prev) => ({...prev, ...updated}));
              }}
            />

            {error && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div
              className="flex gap-1 overflow-x-auto border-b border-neutral-200 dark:border-neutral-700 -mx-1 px-1"
              role="tablist"
              aria-label="Analysis sections"
            >
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`pre-purchase-tab-${t.id}`}
                    aria-selected={active}
                    aria-controls={`pre-purchase-panel-${t.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => handleTabClick(t.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      active
                        ? "border-[#456564] text-[#456564]"
                        : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div
              role="tabpanel"
              id={`pre-purchase-panel-${tab}`}
              aria-labelledby={`pre-purchase-tab-${tab}`}
            >
              {tab === "overview" && (
                <>
                  {showResults ? (
                    <OverviewTab
                      analysis={analysis}
                      onNavigateTab={handleNavigateTab}
                      notes={notes}
                      notesLoading={notesLoading}
                      onAddNote={() => openNotesModal(true)}
                      onOpenNotes={() => openNotesModal(false)}
                    />
                  ) : showProcessing ? (
                    <div className="space-y-4">
                      <PrePurchaseProcessing
                        analysis={analysis}
                        onRetry={
                          analysis.status === "failed" ? handleRetry : undefined
                        }
                        retrying={retrying}
                      />
                      <ScoutNotesCard
                        notes={notes}
                        loading={notesLoading}
                        onAddNote={() => openNotesModal(true)}
                        onOpenNotes={() => openNotesModal(false)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <EmptyStateCard
                        icon={Upload}
                        title="Upload an inspection report to start analysis"
                        description="Add a home inspection PDF or related documents, then analysis will run in the background."
                        actionLabel="Add inspection report"
                        onAction={openUploadModal}
                      />
                      <ScoutNotesCard
                        notes={notes}
                        loading={notesLoading}
                        onAddNote={() => openNotesModal(true)}
                        onOpenNotes={() => openNotesModal(false)}
                      />
                    </div>
                  )}
                </>
              )}

              {tab === "identity" && <IdentityTab analysis={analysis} />}

              {tab === "systems" &&
                (showResults ? (
                  <SystemsTab
                    analysis={analysis}
                    onNavigateTab={handleNavigateTab}
                  />
                ) : (
                  <EmptyStateCard
                    icon={Wrench}
                    title="No systems yet"
                    description={
                      hasDocuments
                        ? "Systems appear here after analysis completes."
                        : "Upload an inspection report to detect property systems."
                    }
                    actionLabel={
                      hasDocuments ? undefined : "Add inspection report"
                    }
                    onAction={hasDocuments ? undefined : openUploadModal}
                  />
                ))}

              {tab === "issues" &&
                (showResults ? (
                  <IssuesTab
                    analysis={analysis}
                    initialSystemKey={tabFocus.systemKey}
                    highlightFindingId={tabFocus.findingId}
                    navigationFrom={tabFocus.from}
                    onNavigateTab={handleNavigateTab}
                    onAskAI={handleAskAI}
                  />
                ) : (
                  <EmptyStateCard
                    icon={AlertCircle}
                    title="No issues yet"
                    description={
                      hasDocuments
                        ? "Findings appear here after analysis completes."
                        : "Upload an inspection report to detect issues."
                    }
                    actionLabel={
                      hasDocuments ? undefined : "Add inspection report"
                    }
                    onAction={hasDocuments ? undefined : openUploadModal}
                  />
                ))}

              {tab === "recommendations" &&
                (showResults ? (
                  <RecommendationsTab
                    analysis={analysis}
                    initialSystemKey={tabFocus.systemKey}
                    onNavigateTab={handleNavigateTab}
                  />
                ) : (
                  <EmptyStateCard
                    icon={Lightbulb}
                    title="No recommendations yet"
                    description={
                      hasDocuments
                        ? "Recommendations appear here after analysis completes."
                        : "Upload an inspection report to generate recommendations."
                    }
                    actionLabel={
                      hasDocuments ? undefined : "Add inspection report"
                    }
                    onAction={hasDocuments ? undefined : openUploadModal}
                  />
                ))}

              {tab === "documents" && (
                <DocumentsTab
                  analysis={analysis}
                  onChanged={() => load({silent: true})}
                  onRefreshAnalysis={handleStartOrRefresh}
                  refreshing={refreshing}
                />
              )}

              {tab === "true-cost" && <TrueCostTab analysis={analysis} />}
            </div>
          </>
        ) : null}
      </div>

      {analysis ? (
        <AIAssistantSidebar
          isOpen={aiOpen}
          onClose={() => {
            setAiOpen(false);
            setAiPrompt(null);
            setAiSystemLabel(null);
            setAiSystemContext(null);
          }}
          analysisId={analysis.id}
          propertyId={propertyId || null}
          propertyDisplayName={formatDisplayName(analysis)}
          propertyAddressLine={formatAddress(analysis)}
          systemLabel={aiSystemLabel}
          systemContext={aiSystemContext}
          initialPrompt={aiPrompt}
        />
      ) : null}

      <PrePurchaseUploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        analysisId={analysisId}
        onUploaded={() => load({silent: true})}
      />

      <PresentationModeModal
        open={presentationOpen}
        onClose={() => setPresentationOpen(false)}
        analysis={analysis}
      />

      <ScoutNotesModal
        open={notesModalOpen}
        onClose={() => {
          setNotesModalOpen(false);
          setNotesStartComposing(false);
        }}
        title="Notes"
        subtitle={analysis ? formatDisplayName(analysis) : undefined}
        notes={notes}
        loading={notesLoading}
        saving={notesSaving}
        currentUserId={currentUser?.id}
        startComposing={notesStartComposing}
        onAddNote={handleAddNote}
        onUpdateNote={handleUpdateNote}
        onDeleteNote={handleDeleteNote}
      />
    </PrePurchaseShell>
  );
}
