import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
} from "react";
import {Info, Calendar, X, ArrowLeft, Settings2} from "lucide-react";
import {
  STANDARD_CUSTOM_SYSTEM_FIELDS,
  PROPERTY_SYSTEMS,
  DEFAULT_SYSTEM_IDS,
  CUSTOM_SYSTEM_DEFAULT_ICON,
} from "./constants/propertySystems";
import {
  SYSTEM_SECTIONS,
  getSystemProgress,
  countCompletedSystems,
  getAgeFromInstallDate,
  formatAgeFromInstallDate,
  IS_NEW_INSTALL_FIELD_BY_SYSTEM,
} from "./constants/systemSections";
import {NEXT_INSPECTION_FIELD_BY_SYSTEM} from "./constants/systemFieldConfig";
import {
  getResolvedSystemFindings,
  areAllSystemActionItemsComplete,
  resolveEffectiveSystemCondition,
} from "./helpers/inspectionAnalysisHelpers";
import {
  filterSuggestedSystemsNotOnProperty,
  collectAddableSystemsFromAnalysis,
} from "./helpers/suggestedSystemsHelpers";
import {toDisplaySystemName} from "./helpers/aiSystemNormalization";
import { emitOpenDocumentFindings } from "./helpers/documentAnalysisFlow";
import {
  getConditionFieldName,
  getCurrentConditionValue,
  computeSystemServiceSchedule,
} from "./helpers/systemStatusHelpers";
import AppApi from "../../api/api";
import {
  getDisplayNamesWithCounters,
  buildCustomSystemsForUi,
  resolveCustomSystemBackendKey,
  resolveUploadSystemKey,
} from "./helpers/systemKeyUtils";
import ContactContext from "../../context/ContactContext";
import ModalBlank from "../../components/ModalBlank";
import {parseDateInput} from "../../lib/dateOffset";
import Tooltip from "../../utils/Tooltip";
import AIAssistantSidebar from "./partials/AIAssistantSidebar";
import {getPropertyAssistantHeaderLines} from "./helpers/propertyAssistantHeader";
import AIReanalysisAuditModal from "./partials/AIReanalysisAuditModal";
import {useDocumentAnalysisCounts} from "../../hooks/useDocumentAnalysisCounts";
import {
  SystemsOverviewTable,
  SystemsRightRail,
  formatOverviewDate,
} from "./partials/passport/SystemsOverviewPanel";
import {SystemDetailView} from "./partials/systemDetail/SystemDetailView";
import {SystemSuggestedSystemsBanner} from "./partials/systemDetail/SystemSuggestedSystemsBanner";
import EmptyStateCard from "./partials/passport/EmptyStateCard";

/** Form field that stores each standard system's installer (contact id or free text). */
const SYSTEM_INSTALLER_FIELDS = {
  roof: "roofInstaller",
  gutters: "gutterInstaller",
  exterior: "sidingInstaller",
  windows: "windowInstaller",
  heating: "heatingInstaller",
  ac: "acInstaller",
  waterHeating: "waterHeatingInstaller",
  electrical: "electricalInstaller",
  plumbing: "plumbingInstaller",
};

/** Form-field prefix per standard system (e.g. exterior fields are "siding*"). */
const FIELD_PREFIX_BY_SYSTEM = {
  roof: "roof",
  gutters: "gutter",
  foundation: "foundation",
  exterior: "siding",
  windows: "window",
  heating: "heating",
  ac: "ac",
  waterHeating: "waterHeating",
  electrical: "electrical",
  plumbing: "plumbing",
  safety: "safety",
  inspections: "",
};

/** "roofInstallDate" with prefix "roof" -> "Install Date"; handles acronyms (GFCI, CO). */
function humanizeSystemField(field, prefix) {
  let rest =
    prefix && field.startsWith(prefix) ? field.slice(prefix.length) : field;
  if (!rest) rest = field;
  return rest
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/** Group a system form field into one of the read-only detail cards. */
function classifySystemField(field) {
  if (/Issues$/.test(field)) return "issues";
  if (/Inspection$/.test(field)) return "inspection";
  if (/(Condition|Warranty)$/.test(field)) return "condition";
  return "identity";
}

function SystemsTab({
  propertyData,
  maintenanceRecords = [],
  savedMaintenanceRecords = [],
  onMaintenanceRecordsChange,
  onMaintenanceRecordAdded,
  onFormDirty,
  propertyIdFallback,
  handleInputChange,
  onSilentSystemsUpdate,
  onDocumentAnalysisApplied,
  visibleSystemIds,
  customSystemsData = {},
  systems = [],
  inspectionAnalysis,
  maintenanceEvents = [],
  onScheduleSuccess,
  onOpenInspectionReport,
  onSystemsCompletionChange,
  onOpenSystemsSetup,
  onOpenMaintenanceRecord,
  aiSidebarOpen: aiSidebarOpenProp,
  onAiSidebarOpenChange,
  onOpenAIAssistant: onOpenAIAssistantProp,
  aiSidebarSystemLabel: aiSidebarSystemLabelProp,
  aiSidebarSystemContext: aiSidebarSystemContextProp,
  expandSectionId,
  propertyId: propertyIdProp,
  propertyDocuments = [],
}) {
  // Get contacts from context
  const contactContext = useContext(ContactContext);
  const contacts = contactContext?.contacts || [];

  // When visibleSystemIds is provided, only show those sections; otherwise show all.
  // Memoize so we don't create a new array every render when visibleSystemIds is undefined.
  const systemIdsToShow = useMemo(
    () =>
      visibleSystemIds ?? [
        "roof",
        "gutters",
        "foundation",
        "exterior",
        "windows",
        "heating",
        "ac",
        "waterHeating",
        "electrical",
        "plumbing",
        "safety",
        "inspections",
      ],
    [visibleSystemIds],
  );
  /* Master/detail: null shows the systems list; a system id shows that
   * system's detail view (read-only cards + the existing editable section). */
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  const [detailOverviewEditing, setDetailOverviewEditing] = useState(false);

  // Track "new install" state for each system
  const [newInstallStates, setNewInstallStates] = useState({});

  // AI Assistant sidebar (right-side panel) - controlled by parent when onAiSidebarOpenChange provided
  const [aiSidebarOpenLocal, setAiSidebarOpenLocal] = useState(false);
  const aiSidebarOpen = onAiSidebarOpenChange
    ? (aiSidebarOpenProp ?? false)
    : aiSidebarOpenLocal;
  const setAiSidebarOpen = onAiSidebarOpenChange || setAiSidebarOpenLocal;
  const [aiSidebarSystemLabelLocal, setAiSidebarSystemLabelLocal] =
    useState(null);
  const [aiSidebarSystemContextLocal, setAiSidebarSystemContextLocal] =
    useState(null);
  const aiSidebarSystemLabel =
    aiSidebarSystemLabelProp ?? aiSidebarSystemLabelLocal;
  const aiSidebarSystemContext =
    aiSidebarSystemContextProp ?? aiSidebarSystemContextLocal;

  const aiAssistantPropertyHeader = useMemo(
    () =>
      getPropertyAssistantHeaderLines(
        propertyData?.identity ?? propertyData ?? null,
      ),
    [propertyData],
  );

  const propertyId =
    propertyIdProp ??
    propertyData?.id ??
    propertyData?.identity?.id ??
    propertyData?.property_uid ??
    propertyData?.identity?.property_uid ??
    propertyIdFallback;

  const documentAnalysisCounts = useDocumentAnalysisCounts(propertyId);
  const [checklistItems, setChecklistItems] = useState([]);

  const loadChecklistItems = useCallback(async () => {
    if (!propertyId) {
      setChecklistItems([]);
      return;
    }
    try {
      const items = await AppApi.getInspectionChecklist(propertyId, {
        _t: Date.now(),
      });
      setChecklistItems(Array.isArray(items) ? items : []);
    } catch {
      setChecklistItems([]);
    }
  }, [propertyId]);

  useEffect(() => {
    loadChecklistItems();
  }, [loadChecklistItems]);

  useEffect(() => {
    const handleChecklistUpdated = () => loadChecklistItems();
    window.addEventListener(
      "inspection-checklist:updated",
      handleChecklistUpdated,
    );
    return () =>
      window.removeEventListener(
        "inspection-checklist:updated",
        handleChecklistUpdated,
      );
  }, [loadChecklistItems]);

  const handleOpenDocumentFindings = useCallback(
    (systemKey, systemLabel, options = {}) => {
      emitOpenDocumentFindings(propertyId, {
        systemKey,
        systemLabel,
        categoryFilter: options.categoryFilter || null,
        initialCategory: options.initialCategory || options.categoryFilter || "bid",
      });
    },
    [propertyId],
  );

  const [aiAuditModalOpen, setAiAuditModalOpen] = useState(false);
  const [systemEventsModalOpen, setSystemEventsModalOpen] = useState(false);
  const [systemEventsModalEvents, setSystemEventsModalEvents] = useState([]);
  const [systemEventsModalLabel, setSystemEventsModalLabel] = useState("");

  const handleViewSystemEvents = useCallback((events, label) => {
    setSystemEventsModalEvents(events || []);
    setSystemEventsModalLabel(label || "");
    setSystemEventsModalOpen(true);
  }, []);

  const handleOpenAIAssistant = (labelOrContext) => {
    if (onOpenAIAssistantProp) {
      onOpenAIAssistantProp(labelOrContext);
    } else {
      const ctx =
        typeof labelOrContext === "object" && labelOrContext !== null
          ? labelOrContext
          : {systemName: labelOrContext};
      setAiSidebarSystemLabelLocal(ctx.systemName ?? labelOrContext);
      setAiSidebarSystemContextLocal(
        typeof labelOrContext === "object" && labelOrContext !== null
          ? labelOrContext
          : null,
      );
      setAiSidebarOpen(true);
    }
  };

  // Open the system in detail view when navigating from
  // "Complete Outstanding Tasks". Identity section ids are ignored here.
  const lastHandledExpandRef = React.useRef(null);
  useEffect(() => {
    if (!expandSectionId) return;
    if (lastHandledExpandRef.current === expandSectionId) return;
    const isCustom = String(expandSectionId).startsWith("custom-");
    if (!systemIdsToShow.includes(expandSectionId) && !isCustom) return;
    lastHandledExpandRef.current = expandSectionId;
    // Container may pass legacy custom ids (custom-Name-0); resolve to the persisted key.
    const resolved = isCustom
      ? resolveUploadSystemKey(
          expandSectionId,
          systems,
          propertyData?.customSystemNames ?? [],
        )
      : expandSectionId;
    setSelectedSystemId(resolved);
    setDetailOverviewEditing(true);
  }, [expandSectionId, systemIdsToShow, systems, propertyData]);

  const handleNewInstallChange = (systemType, isNew, customDataKey) => {
    setNewInstallStates((prev) => ({
      ...prev,
      [systemType]: isNew,
    }));
    const isNewInstallField =
      customDataKey != null
        ? `customSystem_${customDataKey}::isNewInstall`
        : (IS_NEW_INSTALL_FIELD_BY_SYSTEM[systemType] ??
          `${systemType}IsNewInstall`);
    handleInputChange({
      target: {
        name: isNewInstallField,
        value: isNew,
      },
    });
    // Clear last inspection when marked as new install
    if (isNew) {
      const lastInspectionFields = {
        roof: "roofLastInspection",
        gutters: "gutterLastInspection",
        foundation: "foundationLastInspection",
        exterior: "sidingLastInspection",
        windows: "windowLastInspection",
        heating: "heatingLastInspection",
        ac: "acLastInspection",
        waterHeating: "waterHeatingLastInspection",
        electrical: "electricalLastInspection",
        plumbing: "plumbingLastInspection",
      };
      const fieldName = systemType.startsWith("custom-")
        ? `customSystem_${customDataKey ?? systemType.replace("custom-", "")}::lastInspection`
        : lastInspectionFields[systemType];
      if (fieldName) {
        handleInputChange({
          target: {name: fieldName, value: ""},
        });
      }
    }
  };

  /** Sync next-inspection date after Schedule modal without dirtying the property form.
   * The event is already persisted via createMaintenanceEvent; this only mirrors the date in the Systems UI. */
  const handleScheduleInspection =
    (systemType, nextInspectionField) => (date) => {
      if (!onSilentSystemsUpdate) {
        handleInputChange({
          target: {name: nextInspectionField, value: date},
        });
        return;
      }
      if (nextInspectionField.startsWith("customSystem_")) {
        const rest = nextInspectionField.slice("customSystem_".length);
        const sep = "::";
        const idx = rest.lastIndexOf(sep);
        const customName = idx >= 0 ? rest.slice(0, idx) : rest;
        const fieldKey = idx >= 0 ? rest.slice(idx + sep.length) : "";
        if (customName && fieldKey) {
          const prev = customSystemsData ?? {};
          const prevSystem = prev[customName] ?? {};
          onSilentSystemsUpdate({
            customSystemsData: {
              ...prev,
              [customName]: {...prevSystem, [fieldKey]: date},
            },
          });
        }
        return;
      }
      onSilentSystemsUpdate({[nextInspectionField]: date});
    };

  // Calculate progress for each visible system
  const systemsProgress = useMemo(() => {
    const progress = {};
    systemIdsToShow.forEach((id) => {
      progress[id] = getSystemProgress(propertyData, id);
    });
    return progress;
  }, [propertyData, systemIdsToShow]);

  // Count completed systems and report to parent
  const completedCount = useMemo(
    () => countCompletedSystems(propertyData, systemIdsToShow),
    [propertyData, systemIdsToShow],
  );

  // Report completion changes to parent
  useEffect(() => {
    onSystemsCompletionChange?.(completedCount, systemIdsToShow.length);
  }, [completedCount, systemIdsToShow.length, onSystemsCompletionChange]);

  // Map system_key -> aiCondition from backend systems
  const aiConditionBySystem = useMemo(() => {
    const map = {};
    for (const s of systems) {
      const key = s.system_key ?? s.systemKey;
      if (key && s.aiCondition) map[key] = s.aiCondition;
    }
    return map;
  }, [systems]);

  // Refs for callbacks and propertyData so effects don't need them as deps.
  // handleInputChange is not memoized in the parent; propertyData is always a new object
  // reference (mergeFormDataFromTabs returns a new object every render). Putting either
  // in effect deps would cause the auto-populate effect to run on every render and dispatch
  // on every render where a condition field is empty, producing an infinite loop.
  const onSilentRef = React.useRef(onSilentSystemsUpdate);
  const handleInputRef = React.useRef(handleInputChange);
  const propertyDataRef = React.useRef(propertyData);
  onSilentRef.current = onSilentSystemsUpdate;
  handleInputRef.current = handleInputChange;
  propertyDataRef.current = propertyData;

  // Auto-populate condition fields from inspection analysis when empty.
  // Only runs when aiConditionBySystem changes (i.e. AI data arrives from backend).
  // Reads propertyData via ref so we always have the latest values without the effect
  // re-running on every render due to propertyData's new object reference.
  useEffect(() => {
    const onSilent = onSilentRef.current;
    const handleInput = handleInputRef.current;
    if (!onSilent && !handleInput) return;
    const currentPropertyData = propertyDataRef.current;
    const validStatuses = ["excellent", "good", "fair", "poor"];
    for (const [systemKey, aiCondition] of Object.entries(
      aiConditionBySystem,
    )) {
      if (!aiCondition?.status || !validStatuses.includes(aiCondition.status))
        continue;
      const conditionField = getConditionFieldName(systemKey);
      if (!conditionField) continue;
      const currentVal = getCurrentConditionValue(
        currentPropertyData,
        systemKey,
      );
      if (currentVal !== "") continue;
      const capitalized =
        aiCondition.status.charAt(0).toUpperCase() +
        aiCondition.status.slice(1);
      if (onSilent) {
        onSilent({[conditionField]: capitalized});
      } else {
        handleInput({
          target: {name: conditionField, value: capitalized},
        });
      }
    }
  }, [aiConditionBySystem]);

  // Build systems list for upload modal (matches DocumentsTab: selected + custom, general first)
  const visibleSystemIdsForUpload =
    (propertyData?.selectedSystemIds?.length ?? 0) > 0
      ? propertyData.selectedSystemIds
      : DEFAULT_SYSTEM_IDS;
  const customSystemNames = propertyData?.customSystemNames ?? [];
  const systemsToShow = useMemo(() => {
    const general = {id: "general", label: "General"};
    const selected = PROPERTY_SYSTEMS.filter((s) =>
      visibleSystemIdsForUpload.includes(s.id),
    ).map((s) => ({id: s.id, label: s.name}));
    const custom = buildCustomSystemsForUi(customSystemNames, systems).map(
      ({id, label}) => ({id, label}),
    );
    return [general, ...selected, ...custom].filter(Boolean);
  }, [visibleSystemIdsForUpload, customSystemNames, systems]);

  /** Contact-id installer values resolve to contact names; free text shows as-is. */
  const resolveInstaller = useCallback(
    (value) => {
      if (value == null || String(value).trim() === "") return null;
      const contact = (contacts ?? []).find(
        (c) => c && String(c.id) === String(value),
      );
      if (contact?.name) return contact.name;
      /* Free-text installer values display as-is; unresolved ids are hidden */
      return Number.isNaN(Number(value)) ? String(value) : null;
    },
    [contacts],
  );

  /* ---- Read-only overview table + right-rail data (no behavior changes) ---- */
  const overviewRows = useMemo(() => {
    const buildDates = (sysId) =>
      computeSystemServiceSchedule(
        maintenanceRecords,
        maintenanceEvents,
        sysId,
      );

    const resolveCondition = (sysId, customName, storedCondition, aiStatus) => {
      // The inspection report analysis is the source of truth for a system's
      // condition. A manually stored value is only used when the report has no
      // condition for this system. Completing all action items then improves a
      // Fair/Poor system to Good; Excellent only ever comes from the report.
      const reportCondition = aiStatus
        ? aiStatus.charAt(0).toUpperCase() + aiStatus.slice(1)
        : null;
      const stored = reportCondition || storedCondition || null;
      const systemKey = customName ?? sysId;
      const allComplete = areAllSystemActionItemsComplete(
        systemKey,
        checklistItems,
        maintenanceRecords,
      );
      return resolveEffectiveSystemCondition(stored, allComplete) || null;
    };

    const standard = PROPERTY_SYSTEMS.filter((s) =>
      systemIdsToShow.includes(s.id),
    ).map((s) => {
      const progress = systemsProgress[s.id] ?? {
        percent: 0,
        filled: 0,
        total: 1,
      };
      const aiStatus = aiConditionBySystem[s.id]?.status;
      const condition = resolveCondition(
        s.id,
        null,
        getCurrentConditionValue(propertyData, s.id),
        aiStatus,
      );
      return {
        id: s.id,
        name: s.name,
        icon: s.icon,
        condition: condition || null,
        installer: resolveInstaller(
          propertyData?.[SYSTEM_INSTALLER_FIELDS[s.id]],
        ),
        percent: progress.percent ?? 0,
        filled: progress.filled ?? 0,
        total: progress.total ?? 0,
        ...buildDates(s.id),
      };
    });

    const customNamesForOverview = propertyData?.customSystemNames ?? [];
    const displayNames = getDisplayNamesWithCounters(customNamesForOverview);
    const custom = customNamesForOverview.map((systemName, index) => {
      const sectionId = resolveCustomSystemBackendKey(systemName, systems);
      const systemData = customSystemsData[systemName] ?? {};
      const aiStatus = aiConditionBySystem[sectionId]?.status;
      const condition = resolveCondition(
        sectionId,
        systemName,
        getCurrentConditionValue(propertyData, sectionId),
        aiStatus,
      );
      const trackable = STANDARD_CUSTOM_SYSTEM_FIELDS.filter(
        (f) => f.type !== "computed-age",
      );
      const filled = trackable.filter((f) => {
        const val = systemData[f.key];
        return val != null && String(val).trim() !== "";
      }).length;
      return {
        id: sectionId,
        customName: systemName,
        name: displayNames[index] ?? systemName,
        icon: CUSTOM_SYSTEM_DEFAULT_ICON,
        condition: condition || null,
        installer: resolveInstaller(systemData.installer),
        percent: trackable.length > 0 ? (filled / trackable.length) * 100 : 0,
        filled,
        total: trackable.length,
        ...buildDates(sectionId),
      };
    });

    return [...standard, ...custom];
  }, [
    systemIdsToShow,
    systemsProgress,
    propertyData,
    aiConditionBySystem,
    maintenanceRecords,
    maintenanceEvents,
    checklistItems,
    resolveInstaller,
    customSystemsData,
    systems,
  ]);

  const recentMaintenanceActivity = useMemo(
    () =>
      (maintenanceRecords ?? [])
        .filter((r) => r.date)
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .slice(0, 4)
        .map((r, i) => ({
          key: `activity-${r.id ?? i}`,
          label: r.description || "Maintenance record",
          system:
            PROPERTY_SYSTEMS.find(
              (s) => s.id === String(r.systemId ?? r.system_key ?? ""),
            )?.name ?? String(r.systemId ?? r.system_key ?? ""),
          date: r.date,
        })),
    [maintenanceRecords],
  );

  const suggestedSystemsNotOnProperty = useMemo(() => {
    const raw = collectAddableSystemsFromAnalysis(inspectionAnalysis);
    return filterSuggestedSystemsNotOnProperty(
      raw,
      systems,
      propertyData?.customSystemNames ?? [],
    );
  }, [inspectionAnalysis, systems, propertyData?.customSystemNames]);

  const systemsEmptyState = useMemo(() => {
    const suggestedLabels = suggestedSystemsNotOnProperty.map((s) => {
      if (s._displayName) return s._displayName;
      const id = s._resolvedId ?? s.systemType;
      return (
        PROPERTY_SYSTEMS.find((ps) => ps.id === id)?.name ??
        toDisplaySystemName(id)
      );
    });
    const formatList = (labels) => {
      if (labels.length === 0) return "";
      if (labels.length === 1) return labels[0];
      if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
      return `${labels.slice(0, 2).join(", ")}, and ${labels.length - 2} more`;
    };

    if (suggestedLabels.length > 0) {
      return {
        title: "Systems found in your inspection",
        description: `Your inspection report identified ${formatList(suggestedLabels)} that ${
          suggestedLabels.length === 1 ? "isn't" : "aren't"
        } tracked on this property yet. Add them to start documenting condition and maintenance.`,
        actionLabel: "Add systems",
      };
    }
    return {
      title: "No systems selected",
      description:
        "Choose which home systems to track on this property—roof, HVAC, plumbing, and more.",
      actionLabel: "Select systems",
    };
  }, [suggestedSystemsNotOnProperty]);

  /** Open a system's detail view. Pass {edit: true} to land directly in the editable section. */
  const handleJumpToSystem = useCallback((sectionId) => {
    setSelectedSystemId(sectionId);
    setTimeout(() => {
      document
        .querySelector("[data-systems-detail]")
        ?.scrollIntoView({behavior: "smooth", block: "start"});
    }, 120);
  }, []);

  const handleBackToSystems = useCallback(() => {
    setSelectedSystemId(null);
    setDetailOverviewEditing(false);
  }, []);

  const isNewInstallForSystem = useCallback(
    (systemId) => {
      if (newInstallStates[systemId]) return true;
      const standardField = IS_NEW_INSTALL_FIELD_BY_SYSTEM[systemId];
      if (standardField && propertyData?.[standardField]) return true;
      const customNames = propertyData?.customSystemNames ?? [];
      for (const name of customNames) {
        if (resolveCustomSystemBackendKey(name, systems) === systemId) {
          return Boolean(
            customSystemsData?.[name]?.isNewInstall ||
            newInstallStates[systemId],
          );
        }
      }
      return Boolean(propertyData?.[`${systemId}IsNewInstall`]);
    },
    [newInstallStates, propertyData, customSystemsData, systems],
  );

  const nextInspectionFieldForSystem = useCallback((systemId, customName) => {
    if (customName) return `customSystem_${customName}::nextInspection`;
    return NEXT_INSPECTION_FIELD_BY_SYSTEM[systemId];
  }, []);

  const selectedRow = useMemo(
    () =>
      selectedSystemId
        ? overviewRows.find((r) => String(r.id) === String(selectedSystemId))
        : null,
    [selectedSystemId, overviewRows],
  );
  /* ---- Linked records data for the selected system detail view ---- */
  const systemDetail = useMemo(() => {
    if (!selectedSystemId || !selectedRow) return null;

    const groups = {identity: [], condition: [], inspection: [], issues: []};
    const pushField = (label, value, kind) =>
      groups[kind]?.push({label, value});

    if (selectedRow.customName != null) {
      const data = customSystemsData[selectedRow.customName] ?? {};
      for (const f of STANDARD_CUSTOM_SYSTEM_FIELDS) {
        const kind =
          f.key === "issues"
            ? "issues"
            : f.key === "lastInspection" || f.key === "nextInspection"
              ? "inspection"
              : f.key === "condition" || f.key === "warranty"
                ? "condition"
                : "identity";
        let value;
        if (f.type === "computed-age") {
          value = formatAgeFromInstallDate(
            getAgeFromInstallDate(data.installDate),
          );
        } else {
          value = data[f.key];
          if (f.key === "condition") {
            value = selectedRow.condition ?? value;
          } else if (f.type === "date")
            value = formatOverviewDate(value) ?? value;
          else if (f.type === "installer") value = resolveInstaller(value);
          else if (f.type === "warranty-select")
            value = value === "yes" ? "Yes" : value === "no" ? "No" : value;
        }
        pushField(f.label, value, kind);
      }
    } else {
      const prefix = FIELD_PREFIX_BY_SYSTEM[selectedSystemId] ?? "";
      const fields = SYSTEM_SECTIONS[selectedSystemId]?.fields ?? [];
      let installDateField = null;
      for (const field of fields) {
        let value = propertyData?.[field];
        if (/Condition$/.test(field)) value = selectedRow.condition ?? value;
        else if (/Installer$/.test(field)) value = resolveInstaller(value);
        else if (/(Date|Inspection)$/.test(field))
          value = formatOverviewDate(value) ?? value;
        else if (/Warranty$/.test(field))
          value = value === "yes" ? "Yes" : value === "no" ? "No" : value;
        pushField(
          humanizeSystemField(field, prefix),
          value,
          classifySystemField(field),
        );
        if (/InstallDate$/.test(field)) installDateField = field;
      }
      if (installDateField) {
        pushField(
          "Age",
          formatAgeFromInstallDate(
            getAgeFromInstallDate(propertyData?.[installDateField]),
          ),
          "identity",
        );
      }
    }

    const aiFindings = getResolvedSystemFindings(
      selectedSystemId,
      inspectionAnalysis,
      {checklistItems, maintenanceRecords},
    );
    const maintenanceCount = (maintenanceRecords ?? []).filter(
      (r) =>
        String(r.systemId ?? r.system_key ?? "") === String(selectedSystemId),
    ).length;
    const eventsCount = (maintenanceEvents ?? []).filter(
      (e) =>
        String(e.system_key ?? e.systemKey ?? "") === String(selectedSystemId),
    ).length;
    const docInsightsCount = documentAnalysisCounts[selectedSystemId] ?? 0;

    return {
      groups,
      aiFindings,
      linkedRecords: [
        {label: "Maintenance Records", count: maintenanceCount},
        {label: "Scheduled Events", count: eventsCount},
        {label: "AI Document Insights", count: docInsightsCount},
      ],
    };
  }, [
    selectedSystemId,
    selectedRow,
    customSystemsData,
    propertyData,
    inspectionAnalysis,
    maintenanceRecords,
    maintenanceEvents,
    checklistItems,
    documentAnalysisCounts,
    resolveInstaller,
  ]);

  return (
    <>
      {/* ---- List view: full-width systems table + right rail ---- */}
      {selectedSystemId == null && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_19rem] gap-4 items-start">
          <div className="space-y-4 min-w-0">
            {suggestedSystemsNotOnProperty.length > 0 &&
              onOpenSystemsSetup &&
              overviewRows.length > 0 && (
                <SystemSuggestedSystemsBanner
                  title={systemsEmptyState.title}
                  description={systemsEmptyState.description}
                  actionLabel={systemsEmptyState.actionLabel}
                  onAction={() =>
                    onOpenSystemsSetup(suggestedSystemsNotOnProperty)
                  }
                />
              )}
            {overviewRows.length > 0 ? (
              <SystemsOverviewTable
                rows={overviewRows}
                onJumpToSystem={handleJumpToSystem}
              />
            ) : (
              <EmptyStateCard
                icon={Settings2}
                title={systemsEmptyState.title}
                description={systemsEmptyState.description}
                actionLabel={
                  onOpenSystemsSetup ? systemsEmptyState.actionLabel : undefined
                }
                onAction={
                  onOpenSystemsSetup
                    ? () => onOpenSystemsSetup(suggestedSystemsNotOnProperty)
                    : undefined
                }
                className="py-16 min-h-[280px]"
              />
            )}
            {inspectionAnalysis?.createdAt && propertyId && (
              <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
                <span>
                  Inspection analysis completed{" "}
                  {new Date(inspectionAnalysis.createdAt).toLocaleDateString(
                    undefined,
                    {
                      dateStyle: "medium",
                    },
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setAiAuditModalOpen(true)}
                  className="text-[#456564] dark:text-[#5a7a78] hover:underline"
                >
                  View before vs after
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-neutral-500 dark:text-neutral-400 px-1">
              <div className="flex items-center gap-3">
                {[
                  ["Excellent", "bg-emerald-600"],
                  ["Good", "bg-emerald-400"],
                  ["Fair", "bg-amber-400"],
                  ["Poor", "bg-red-400"],
                ].map(([label, dot]) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4 min-w-0">
            <SystemsRightRail
              rows={overviewRows}
              recentActivity={recentMaintenanceActivity}
              onJumpToSystem={handleJumpToSystem}
              onOpenSystemsSetup={
                onOpenSystemsSetup
                  ? () => onOpenSystemsSetup(suggestedSystemsNotOnProperty)
                  : undefined
              }
              systemsEmptyState={systemsEmptyState}
            />
          </div>
        </div>
      )}

      {/* ---- Detail view: a single system with back navigation ---- */}
      {selectedSystemId != null && (
        <SystemDetailView
          selectedSystemId={selectedSystemId}
          selectedRow={selectedRow}
          propertyData={propertyData}
          propertyId={propertyId}
          contacts={contacts}
          handleInputChange={handleInputChange}
          handleNewInstallChange={handleNewInstallChange}
          handleScheduleInspection={handleScheduleInspection}
          handleBackToSystems={handleBackToSystems}
          maintenanceRecords={maintenanceRecords}
          maintenanceEvents={maintenanceEvents}
          customSystemsData={customSystemsData}
          systems={systems}
          inspectionAnalysis={inspectionAnalysis}
          onScheduleSuccess={onScheduleSuccess}
          onOpenAIAssistant={handleOpenAIAssistant}
          onOpenDocumentFindings={handleOpenDocumentFindings}
          documentAnalysisCounts={documentAnalysisCounts}
          propertyDocuments={propertyDocuments}
          newInstallStates={newInstallStates}
          systemsToShow={systemsToShow}
          isNewInstallForSystem={isNewInstallForSystem}
          nextInspectionFieldForSystem={nextInspectionFieldForSystem}
          systemDetail={systemDetail}
          resolveInstaller={resolveInstaller}
          initialOverviewEditing={detailOverviewEditing}
          onOverviewEditingChange={setDetailOverviewEditing}
          savedMaintenanceRecords={savedMaintenanceRecords}
          onMaintenanceRecordsChange={onMaintenanceRecordsChange}
          onMaintenanceRecordAdded={onMaintenanceRecordAdded}
          onFormDirty={onFormDirty}
          onOpenMaintenanceRecord={onOpenMaintenanceRecord}
          checklistItems={checklistItems}
        />
      )}
      {!onAiSidebarOpenChange && (
        <AIAssistantSidebar
          isOpen={aiSidebarOpen}
          onClose={() => {
            setAiSidebarOpen(false);
            setAiSidebarSystemLabelLocal(null);
            setAiSidebarSystemContextLocal(null);
          }}
          systemLabel={aiSidebarSystemLabel}
          systemContext={aiSidebarSystemContext}
          propertyId={
            propertyData?.identity?.id ?? propertyData?.id ?? propertyIdFallback
          }
          propertyDisplayName={aiAssistantPropertyHeader.propertyDisplayName}
          propertyAddressLine={aiAssistantPropertyHeader.propertyAddressLine}
          propertySystems={systemsToShow
            .filter((s) => s.id !== "general")
            .map((s) => ({id: s.id, name: s.label}))}
          contacts={contacts}
        />
      )}

      <AIReanalysisAuditModal
        isOpen={aiAuditModalOpen}
        onClose={() => setAiAuditModalOpen(false)}
        propertyId={propertyId}
      />

      <ModalBlank
        id="system-events-modal"
        modalOpen={systemEventsModalOpen}
        setModalOpen={setSystemEventsModalOpen}
        contentClassName="max-w-md"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Scheduled Events
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {systemEventsModalLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSystemEventsModalOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {systemEventsModalEvents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No events scheduled for this system.
            </p>
          ) : (
            <div className="space-y-2">
              {systemEventsModalEvents.map((ev) => {
                const d = parseDateInput(ev.scheduled_date ?? ev.scheduledDate);
                const todoTitle =
                  ev.checklist_item_title ?? ev.checklistItemTitle;
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/30"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {todoTitle && (
                        <p className="text-xs font-medium text-[#456564] dark:text-[#7aa3a2] truncate mb-0.5">
                          ToDo: {todoTitle}
                        </p>
                      )}
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {d
                          ? d.toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "No date"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {ev.contractor_name || "No professional assigned"}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex-shrink-0">
                      {ev.status || "scheduled"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalBlank>
    </>
  );
}

export default SystemsTab;
