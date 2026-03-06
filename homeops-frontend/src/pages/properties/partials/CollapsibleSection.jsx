import React, {useMemo} from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Sparkles,
  FileSearch,
  Gauge,
  Wrench,
  AlertOctagon,
} from "lucide-react";
import SystemActionButtons from "./SystemActionButtons";
import Tooltip from "../../../utils/Tooltip";
import {getSystemStatus, getCurrentConditionValue} from "../helpers/systemStatusHelpers";
import {getSystemFindingsFromAnalysis} from "../helpers/inspectionAnalysisHelpers";
import InspectionChecklistPanel from "./InspectionChecklistPanel";

/**
 * Collapsible Section Component with Progress Bar and Action Buttons
 * Used in SystemsTab for expandable system sections
 */
function CollapsibleSection({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  children,
  sectionId,
  showActionButtons = false,
  installerId,
  installerName,
  systemType,
  systemLabel,
  contacts = [],
  isNewInstall = false,
  onNewInstallChange,
  onScheduleInspection,
  onScheduleSuccess,
  progress = {filled: 0, total: 0, percent: 0},
  propertyId,
  propertyData = {},
  systemsToShow = [],
  customSystemsData = {},
  onOpenAIAssistant,
  aiCondition,
  inspectionAnalysis,
  onOpenInspectionReport,
  maintenanceEvents = [],
  maintenanceRecords = [],
}) {
  const formStatus = useMemo(
    () =>
      showActionButtons
        ? getSystemStatus(
            propertyData,
            systemType,
            isNewInstall,
            customSystemsData,
            maintenanceEvents,
          )
        : {needsAttention: false, attentionReasons: [], hasScheduledEvent: false},
    [
      showActionButtons,
      propertyData,
      systemType,
      isNewInstall,
      customSystemsData,
      maintenanceEvents,
    ],
  );

  const systemFindings = useMemo(
    () => getSystemFindingsFromAnalysis(systemType, inspectionAnalysis),
    [systemType, inspectionAnalysis],
  );

  // Unified health: merge form-based reasons with AI findings (both drive "needs attention")
  const {needsAttention, attentionReasons, hasScheduledEvent, scheduledDate} = useMemo(() => {
    const reasons = [...(formStatus.attentionReasons || [])];
    const aiNeeds = systemFindings?.needsAttention ?? [];
    aiNeeds.forEach((n) => {
      const label = n.title || n.suggestedAction || "AI finding";
      if (label && !reasons.includes(label)) reasons.push(label);
    });
    const merged = formStatus.needsAttention || aiNeeds.length > 0;
    return {
      needsAttention: merged,
      attentionReasons: reasons,
      hasScheduledEvent: formStatus.hasScheduledEvent,
      scheduledDate: formStatus.scheduledDate,
    };
  }, [formStatus, systemFindings]);

  const aiInspectionTooltip = useMemo(() => {
    if (!aiCondition) return null;
    const status = (aiCondition.status || "").toLowerCase();
    const conditionColor =
      status === "excellent"
        ? "text-emerald-600 dark:text-emerald-500"
        : status === "good"
          ? "text-emerald-500 dark:text-[#456564]"
          : status === "fair"
            ? "text-amber-600 dark:text-amber-500"
            : "text-red-600 dark:text-red-500";

    const sev = (aiCondition.severity || "").toLowerCase();
    const PriorityIcon =
      sev === "urgent" || sev === "high" || sev === "critical"
        ? AlertOctagon
        : sev === "medium"
          ? AlertTriangle
          : sev === "low"
            ? AlertCircle
            : null;
    const priorityColor =
      sev === "urgent" || sev === "high" || sev === "critical"
        ? "text-red-600 dark:text-red-400"
        : sev === "medium"
          ? "text-amber-600 dark:text-amber-400"
          : "text-gray-500 dark:text-gray-400";

    const c = aiCondition.confidence;
    const confLabel = c >= 0.8 ? "High" : c >= 0.5 ? "Med" : "Low";

    const {needsAttention: needs, maintenanceSuggestions: maint} = systemFindings;

    return (
      <div className="flex flex-col gap-2 min-w-[180px]">
        <div className="flex items-center gap-2">
          <FileSearch className={`w-4 h-4 flex-shrink-0 ${conditionColor}`} strokeWidth={2} />
          <span className="text-xs font-medium">AI Inspection</span>
        </div>
        {PriorityIcon && (
          <div className="flex items-center gap-2">
            <PriorityIcon className={`w-4 h-4 flex-shrink-0 ${priorityColor}`} strokeWidth={2} />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {sev === "urgent" || sev === "high" || sev === "critical" ? "High priority" : sev === "medium" ? "Medium priority" : "Low priority"}
            </span>
          </div>
        )}
        {c != null && (
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 flex-shrink-0 text-gray-500 dark:text-gray-400" strokeWidth={2} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{confLabel} confidence</span>
          </div>
        )}
        {needs.length > 0 && (
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" strokeWidth={2} />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {needs.slice(0, 2).map((n) => n.title || n.suggestedAction || "—").filter(Boolean).join("; ")}
              {needs.length > 2 ? ` +${needs.length - 2} more` : ""}
            </span>
          </div>
        )}
        {maint.length > 0 && (
          <div className="flex items-start gap-2">
            <Wrench className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400" strokeWidth={2} />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {maint.slice(0, 2).map((m) => m.task || "—").filter(Boolean).join("; ")}
              {maint.length > 2 ? ` +${maint.length - 2} more` : ""}
            </span>
          </div>
        )}
      </div>
    );
  }, [aiCondition, systemFindings]);

  const isComplete = progress.percent >= 100;

  return (
    <div
      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 hover:shadow-sm relative"
      data-section-id={sectionId != null ? `system-${sectionId}` : undefined}
    >
      <style>{`
        @keyframes systemCheckPop {
          from {
            opacity: 0;
            transform: scale(0.5);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .scrollbar-sleek {
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
        }
        .dark .scrollbar-sleek {
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }
        .scrollbar-sleek::-webkit-scrollbar {
          height: 4px;
        }
        .scrollbar-sleek::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-sleek::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        .scrollbar-sleek::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
        .dark .scrollbar-sleek::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }
        .dark .scrollbar-sleek::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>

      {/* Progress bar - compresses when complete */}
      <div
        className="absolute top-0 left-0 right-0 bg-gray-200 dark:bg-gray-600 rounded-t-lg overflow-hidden"
        style={{
          height: isComplete ? 0 : 3,
          opacity: isComplete ? 0 : 1,
          transition: "height 0.35s ease-out, opacity 0.25s ease-out",
        }}
      >
        <div
          className="h-full bg-emerald-400 dark:bg-emerald-400/90 transition-all duration-500 ease-out"
          style={{width: `${progress.percent}%`}}
        />
      </div>

      {/* Header - full bar clickable to toggle (use div to avoid button-inside-button) */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full p-4 md:p-5 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-all duration-200 cursor-pointer group text-left"
      >
        {/* Left side: Title and Action Buttons */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Title section */}
          <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
            {Icon && (
              <Icon
                className="h-4 w-4 flex-shrink-0"
                style={{color: "#456654"}}
              />
            )}
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 tracking-tight">
              {title}
            </h3>
            {!isComplete && progress.total > 0 && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({progress.filled}/{progress.total})
              </span>
            )}
          </div>

          {/* Action Buttons - stop propagation so they don't toggle; scroll horizontally on small screens */}
          {showActionButtons && (
            <div
              className="scrollbar-sleek min-w-0 overflow-x-auto overflow-y-hidden flex-shrink"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <SystemActionButtons
                systemType={systemType}
                systemLabel={systemLabel || title}
                installerId={installerId}
                installerName={installerName}
                contacts={contacts}
                isNewInstall={isNewInstall}
                onNewInstallChange={onNewInstallChange}
                onScheduleInspection={onScheduleInspection}
                onScheduleSuccess={onScheduleSuccess}
                propertyId={propertyId}
                propertyData={propertyData}
                systemsToShow={systemsToShow}
              />
            </div>
          )}

          {/* Status Icons - AI Inspection Condition, Needs Attention, Scheduled Event, AI Assistant */}
          {showActionButtons && (
            <div
              className="flex items-center gap-1.5 flex-shrink-0 ml-1"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {aiCondition && (aiCondition.confidence == null || aiCondition.confidence >= 0.5) && aiInspectionTooltip && (
                <Tooltip
                  content={aiInspectionTooltip}
                  position="bottom"
                  size="xl"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInspectionReport?.(systemType);
                    }}
                    className={`inline-flex items-center justify-center w-[18px] h-[18px] transition-colors rounded hover:opacity-80 p-0.5 ${
                      aiCondition.status === "excellent"
                        ? "text-emerald-600 dark:text-emerald-500/90"
                        : aiCondition.status === "good"
                          ? "text-emerald-500 dark:text-[#456564]"
                          : aiCondition.status === "fair"
                            ? "text-amber-600 dark:text-amber-500/90"
                            : aiCondition.status === "poor"
                              ? "text-red-600 dark:text-red-500/90"
                              : "text-gray-500 dark:text-gray-400"
                    }`}
                    aria-label={`AI Inspection: ${aiCondition.status || "unknown"} condition`}
                  >
                    <FileSearch className="w-[18px] h-[18px]" strokeWidth={2} />
                  </button>
                </Tooltip>
              )}
              {needsAttention && (
                <Tooltip
                  content={
                    attentionReasons.length > 0
                      ? attentionReasons.join(" · ")
                      : "Needs attention"
                  }
                  position="bottom"
                  size="lg"
                >
                  <span className="inline-flex items-center justify-center w-[18px] h-[18px] text-amber-600 dark:text-amber-500/90 hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-default">
                    <AlertTriangle className="w-[18px] h-[18px]" strokeWidth={2} />
                  </span>
                </Tooltip>
              )}
              {hasScheduledEvent && (
                <Tooltip
                  content={
                    scheduledDate
                      ? `Scheduled for ${new Date(scheduledDate).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}`
                      : "Scheduled event"
                  }
                  position="bottom"
                >
                  <span className="inline-flex items-center justify-center w-[18px] h-[18px] text-emerald-600 dark:text-emerald-500/90 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-default">
                    <Calendar className="w-[18px] h-[18px]" strokeWidth={2} />
                  </span>
                </Tooltip>
              )}
              {onOpenAIAssistant && (
                <Tooltip content="AI Assistant" position="bottom">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const cond = aiCondition?.status || getCurrentConditionValue(propertyData, systemType) || null;
                      const nextDate = formStatus.scheduledDate;
                      const nextTime = formStatus.scheduledTime;
                      const upcomingForSystem = (maintenanceEvents || []).filter(
                        (e) => (e.system_key ?? e.systemKey) === systemType && (e.scheduled_date ?? e.scheduledDate) >= new Date().toISOString().slice(0, 10)
                      );
                      const findings = getSystemFindingsFromAnalysis(systemType, inspectionAnalysis);
                      const lastInspField = systemType?.startsWith("custom-")
                        ? null
                        : {roof: "roofLastInspection", gutters: "gutterLastInspection", foundation: "foundationLastInspection", exterior: "sidingLastInspection", windows: "windowLastInspection", heating: "heatingLastInspection", ac: "acLastInspection", waterHeating: "waterHeatingLastInspection", electrical: "electricalLastInspection", plumbing: "plumbingLastInspection"}[systemType];
                      const lastMaint = lastInspField ? propertyData?.[lastInspField] : null;
                      onOpenAIAssistant({
                        systemId: systemType,
                        systemName: systemLabel || title,
                        systemCondition: cond ? String(cond).toLowerCase() : null,
                        lastMaintenanceDate: lastMaint || null,
                        upcomingEvents: upcomingForSystem.map((ev) => ({
                          date: ev.scheduled_date ?? ev.scheduledDate,
                          type: ev.system_name ?? ev.system_key,
                          status: ev.status,
                        })),
                        inspectionFindingsForThisSystemOnly: [
                          ...(findings.needsAttention || []).map((n) => ({
                            title: n.title,
                            severity: n.severity,
                            suggestedAction: n.suggestedAction,
                          })),
                          ...(findings.maintenanceSuggestions || []).map((m) => ({
                            title: m.task || m.systemType,
                            severity: m.priority,
                            suggestedAction: m.suggestedWhen || m.rationale,
                          })),
                        ],
                      });
                    }}
                    className="inline-flex items-center justify-center w-[18px] h-[18px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-600/50 p-0.5"
                    aria-label="Open AI Assistant"
                  >
                    <Sparkles className="w-[18px] h-[18px]" strokeWidth={2} />
                  </button>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        {/* Right side: Checkmark and Chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isComplete && (
            <div
              className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-400/20 dark:bg-emerald-400/25 text-emerald-600 dark:text-emerald-400"
              style={{
                animation:
                  "systemCheckPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
              }}
            >
              <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
            </div>
          )}
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" />
          )}
        </div>
      </div>

      {/* Inspection checklist for this system — visible when expanded */}
      {isOpen && showActionButtons && inspectionAnalysis && propertyId && (
        <div className="px-6 pb-2">
          <InspectionChecklistPanel
            propertyId={propertyId}
            systemKey={systemType}
            onScheduleMaintenance={onScheduleInspection ? (data) => onScheduleInspection(data) : undefined}
            maintenanceRecords={maintenanceRecords}
            compact
          />
        </div>
      )}

      {/* Form fields - Only visible when expanded */}
      {isOpen && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

export default CollapsibleSection;
