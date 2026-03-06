import React, {useState, useEffect, useMemo, useContext} from "react";
import {
  Building,
  Droplet,
  Home,
  Zap,
  Shield,
  FileCheck,
  Settings,
  Info,
} from "lucide-react";
import {
  STANDARD_CUSTOM_SYSTEM_FIELDS,
  PROPERTY_SYSTEMS,
  DEFAULT_SYSTEM_IDS,
} from "./constants/propertySystems";
import {
  getSystemProgress,
  countCompletedSystems,
  getAgeFromInstallDate,
  formatAgeFromInstallDate,
} from "./constants/systemSections";
import {
  getConditionFieldName,
  getCurrentConditionValue,
} from "./helpers/systemStatusHelpers";
import {getDisplayNamesWithCounters} from "./helpers/systemKeyUtils";
import DatePickerInput from "../../components/DatePickerInput";
import ContactContext from "../../context/ContactContext";
import CollapsibleSection from "./partials/CollapsibleSection";
import InstallerSelect from "./partials/InstallerSelect";
import Tooltip from "../../utils/Tooltip";
import AIAssistantSidebar from "./partials/AIAssistantSidebar";
import AIReanalysisAuditModal from "./partials/AIReanalysisAuditModal";

function SystemsTab({
  propertyData,
  maintenanceRecords = [],
  propertyIdFallback,
  handleInputChange,
  onSilentSystemsUpdate,
  visibleSystemIds,
  customSystemsData = {},
  systems = [],
  inspectionAnalysis,
  maintenanceEvents = [],
  onScheduleSuccess,
  onOpenInspectionReport,
  onSystemsCompletionChange,
  aiSidebarOpen: aiSidebarOpenProp,
  onAiSidebarOpenChange,
  onOpenAIAssistant: onOpenAIAssistantProp,
  aiSidebarSystemLabel: aiSidebarSystemLabelProp,
  aiSidebarSystemContext: aiSidebarSystemContextProp,
  expandSectionId,
  aiSummaryUpdatedAt,
  propertyId: propertyIdProp,
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
  const isVisible = (id) => systemIdsToShow.includes(id);

  const [expandedSections, setExpandedSections] = useState({
    roof: false,
    gutters: false,
    foundation: false,
    exterior: false,
    windows: false,
    heating: false,
    ac: false,
    waterHeating: false,
    electrical: false,
    plumbing: false,
    safety: false,
    inspections: false,
  });

  // Track "new install" state for each system
  const [newInstallStates, setNewInstallStates] = useState({});

  // AI Assistant sidebar (right-side panel) - controlled by parent when onAiSidebarOpenChange provided
  const [aiSidebarOpenLocal, setAiSidebarOpenLocal] = useState(false);
  const aiSidebarOpen = onAiSidebarOpenChange ? (aiSidebarOpenProp ?? false) : aiSidebarOpenLocal;
  const setAiSidebarOpen = onAiSidebarOpenChange || setAiSidebarOpenLocal;
  const [aiSidebarSystemLabelLocal, setAiSidebarSystemLabelLocal] = useState(null);
  const [aiSidebarSystemContextLocal, setAiSidebarSystemContextLocal] = useState(null);
  const aiSidebarSystemLabel = aiSidebarSystemLabelProp ?? aiSidebarSystemLabelLocal;
  const aiSidebarSystemContext = aiSidebarSystemContextProp ?? aiSidebarSystemContextLocal;

  const propertyId =
    propertyIdProp ??
    propertyData?.id ??
    propertyData?.identity?.id ??
    propertyData?.property_uid ??
    propertyData?.identity?.property_uid ??
    propertyIdFallback;

  const [aiAuditModalOpen, setAiAuditModalOpen] = useState(false);
  const handleOpenAIAssistant = (labelOrContext) => {
    if (onOpenAIAssistantProp) {
      onOpenAIAssistantProp(labelOrContext);
    } else {
      const ctx = typeof labelOrContext === "object" && labelOrContext !== null ? labelOrContext : { systemName: labelOrContext };
      setAiSidebarSystemLabelLocal(ctx.systemName ?? labelOrContext);
      setAiSidebarSystemContextLocal(typeof labelOrContext === "object" && labelOrContext !== null ? labelOrContext : null);
      setAiSidebarOpen(true);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Expand section when navigating from "Complete Outstanding Tasks"
  useEffect(() => {
    if (expandSectionId) {
      setExpandedSections((prev) => ({
        ...prev,
        [expandSectionId]: true,
      }));
    }
  }, [expandSectionId]);

  const handleNewInstallChange = (systemType, isNew, customDataKey) => {
    setNewInstallStates((prev) => ({
      ...prev,
      [systemType]: isNew,
    }));
    const isNewInstallField =
      customDataKey != null
        ? `customSystem_${customDataKey}::isNewInstall`
        : `${systemType}IsNewInstall`;
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

  const handleScheduleInspection =
    (systemType, nextInspectionField) => (date) => {
      handleInputChange({
        target: {
          name: nextInspectionField,
          value: date,
        },
      });
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
    for (const [systemKey, aiCondition] of Object.entries(aiConditionBySystem)) {
      if (!aiCondition?.status || !validStatuses.includes(aiCondition.status)) continue;
      const conditionField = getConditionFieldName(systemKey);
      if (!conditionField) continue;
      const currentVal = getCurrentConditionValue(currentPropertyData, systemKey);
      if (currentVal !== "") continue;
      const capitalized =
        aiCondition.status.charAt(0).toUpperCase() + aiCondition.status.slice(1);
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
    const custom = customSystemNames.map((name, i) => ({
      id: `custom-${name}-${i}`,
      label: name,
    }));
    return [general, ...selected, ...custom].filter(Boolean);
  }, [visibleSystemIdsForUpload, customSystemNames]);

  return (
    <>
    <div className="space-y-4">
      {aiSummaryUpdatedAt && propertyId && (
        <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
          <span>
            AI analysis updated {new Date(aiSummaryUpdatedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
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
      {/* Systems Section - Roof */}
      {isVisible("roof") && (
        <CollapsibleSection
          sectionId="roof"
          title="Roof"
          icon={Building}
          isOpen={expandedSections.roof}
          onToggle={() => toggleSection("roof")}
          showActionButtons={true}
          installerId={propertyData.roofInstaller}
          systemType="roof"
          systemLabel="Roof"
          contacts={contacts}
          isNewInstall={newInstallStates.roof || propertyData.roofIsNewInstall}
          onNewInstallChange={(isNew) => handleNewInstallChange("roof", isNew)}
          onScheduleInspection={handleScheduleInspection(
            "roof",
            "roofNextInspection",
          )}
          progress={systemsProgress.roof}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.roof}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Material
              </label>
              <input
                type="text"
                name="roofMaterial"
                value={propertyData.roofMaterial || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="roofInstallDate"
                value={propertyData.roofInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="roofInstaller"
                value={propertyData.roofInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.roofInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="roofCondition"
                value={propertyData.roofCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="roofLastInspection"
                value={propertyData.roofLastInspection || ""}
                onChange={handleInputChange}
                disabled={
                  newInstallStates.roof || propertyData.roofIsNewInstall
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Warranty
              </label>
              <select
                name="roofWarranty"
                value={propertyData.roofWarranty || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="roofNextInspection"
                value={propertyData.roofNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="roofIssues"
                value={propertyData.roofIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Gutters */}
      {isVisible("gutters") && (
        <CollapsibleSection
          sectionId="gutters"
          title="Gutters"
          icon={Droplet}
          isOpen={expandedSections.gutters}
          onToggle={() => toggleSection("gutters")}
          showActionButtons={true}
          installerId={propertyData.gutterInstaller}
          systemType="gutters"
          systemLabel="Gutters"
          contacts={contacts}
          isNewInstall={
            newInstallStates.gutters || propertyData.gutterIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("gutters", isNew)
          }
          onScheduleInspection={handleScheduleInspection(
            "gutters",
            "gutterNextInspection",
          )}
          progress={systemsProgress.gutters}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.gutters}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Material
              </label>
              <input
                type="text"
                name="gutterMaterial"
                value={propertyData.gutterMaterial || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="gutterInstallDate"
                value={propertyData.gutterInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="gutterInstaller"
                value={propertyData.gutterInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.gutterInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="gutterCondition"
                value={propertyData.gutterCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="gutterLastInspection"
                value={propertyData.gutterLastInspection || ""}
                onChange={handleInputChange}
                disabled={
                  newInstallStates.gutters || propertyData.gutterIsNewInstall
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Warranty
              </label>
              <select
                name="gutterWarranty"
                value={propertyData.gutterWarranty || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="gutterNextInspection"
                value={propertyData.gutterNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="gutterIssues"
                value={propertyData.gutterIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Foundation & Structure */}
      {isVisible("foundation") && (
        <CollapsibleSection
          sectionId="foundation"
          title="Foundation & Structure"
          icon={Building}
          isOpen={expandedSections.foundation}
          onToggle={() => toggleSection("foundation")}
          showActionButtons={true}
          systemType="foundation"
          systemLabel="Foundation & Structure"
          contacts={contacts}
          isNewInstall={
            newInstallStates.foundation || propertyData.foundationIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("foundation", isNew)
          }
          onScheduleInspection={handleScheduleInspection(
            "foundation",
            "foundationNextInspection",
          )}
          progress={systemsProgress.foundation}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.foundation}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Foundation Type
              </label>
              <input
                type="text"
                name="foundationType"
                value={propertyData.foundationType || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="foundationCondition"
                value={propertyData.foundationCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="foundationLastInspection"
                value={propertyData.foundationLastInspection || ""}
                onChange={handleInputChange}
                disabled={
                  newInstallStates.foundation ||
                  propertyData.foundationIsNewInstall
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="foundationNextInspection"
                value={propertyData.foundationNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="foundationIssues"
                value={propertyData.foundationIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Exterior */}
      {isVisible("exterior") && (
        <CollapsibleSection
          sectionId="exterior"
          title="Exterior"
          icon={Building}
          isOpen={expandedSections.exterior}
          onToggle={() => toggleSection("exterior")}
          showActionButtons={true}
          installerId={propertyData.sidingInstaller}
          systemType="exterior"
          systemLabel="Exterior/Siding"
          contacts={contacts}
          isNewInstall={
            newInstallStates.exterior || propertyData.exteriorIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("exterior", isNew)
          }
          onScheduleInspection={handleScheduleInspection(
            "exterior",
            "sidingNextInspection",
          )}
          progress={systemsProgress.exterior}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.exterior}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Siding Type
              </label>
              <input
                type="text"
                name="sidingType"
                value={propertyData.sidingType || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="sidingInstallDate"
                value={propertyData.sidingInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="sidingInstaller"
                value={propertyData.sidingInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.sidingInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="sidingCondition"
                value={propertyData.sidingCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="sidingIssues"
                value={propertyData.sidingIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Windows */}
      {isVisible("windows") && (
        <CollapsibleSection
          sectionId="windows"
          title="Windows"
          icon={Home}
          isOpen={expandedSections.windows}
          onToggle={() => toggleSection("windows")}
          showActionButtons={true}
          installerId={propertyData.windowInstaller}
          systemType="windows"
          systemLabel="Windows"
          contacts={contacts}
          isNewInstall={
            newInstallStates.windows || propertyData.windowIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("windows", isNew)
          }
          onScheduleInspection={handleScheduleInspection(
            "windows",
            "windowNextInspection",
          )}
          progress={systemsProgress.windows}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.windows}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Window Type
              </label>
              <input
                type="text"
                name="windowType"
                value={propertyData.windowType || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="windowInstallDate"
                value={propertyData.windowInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="windowInstaller"
                value={propertyData.windowInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.windowInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="windowCondition"
                value={propertyData.windowCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="windowLastInspection"
                value={propertyData.windowLastInspection || ""}
                onChange={handleInputChange}
                disabled={
                  newInstallStates.windows || propertyData.windowIsNewInstall
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Warranty
              </label>
              <select
                name="windowWarranty"
                value={propertyData.windowWarranty || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="windowNextInspection"
                value={propertyData.windowNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="windowIssues"
                value={propertyData.windowIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Heating */}
      {isVisible("heating") && (
        <CollapsibleSection
          sectionId="heating"
          title="Heating"
          icon={Zap}
          isOpen={expandedSections.heating}
          onToggle={() => toggleSection("heating")}
          showActionButtons={true}
          installerId={propertyData.heatingInstaller}
          systemType="heating"
          systemLabel="Heating"
          contacts={contacts}
          isNewInstall={
            newInstallStates.heating || propertyData.heatingIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("heating", isNew)
          }
          onScheduleInspection={handleScheduleInspection(
            "heating",
            "heatingNextInspection",
          )}
          progress={systemsProgress.heating}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.heating}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                System Type
              </label>
              <input
                type="text"
                name="heatingSystemType"
                value={propertyData.heatingSystemType || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="heatingInstallDate"
                value={propertyData.heatingInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="heatingInstaller"
                value={propertyData.heatingInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.heatingInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="heatingCondition"
                value={propertyData.heatingCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="heatingLastInspection"
                value={propertyData.heatingLastInspection || ""}
                onChange={handleInputChange}
                disabled={
                  newInstallStates.heating || propertyData.heatingIsNewInstall
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Warranty
              </label>
              <select
                name="heatingWarranty"
                value={propertyData.heatingWarranty || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="heatingNextInspection"
                value={propertyData.heatingNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Location
              </label>
              <input
                type="text"
                name="heatingLocation"
                value={propertyData.heatingLocation || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="heatingIssues"
                value={propertyData.heatingIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Air Conditioning */}
      {isVisible("ac") && (
        <CollapsibleSection
          sectionId="ac"
          title="Air Conditioning"
          icon={Zap}
          isOpen={expandedSections.ac}
          onToggle={() => toggleSection("ac")}
          showActionButtons={true}
          installerId={propertyData.acInstaller}
          systemType="ac"
          systemLabel="Air Conditioning"
          contacts={contacts}
          isNewInstall={newInstallStates.ac || propertyData.acIsNewInstall}
          onNewInstallChange={(isNew) => handleNewInstallChange("ac", isNew)}
          onScheduleInspection={handleScheduleInspection(
            "ac",
            "acNextInspection",
          )}
          progress={systemsProgress.ac}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.ac}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                System Type
              </label>
              <input
                type="text"
                name="acSystemType"
                value={propertyData.acSystemType || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="acInstallDate"
                value={propertyData.acInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="acInstaller"
                value={propertyData.acInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.acInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="acCondition"
                value={propertyData.acCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="acLastInspection"
                value={propertyData.acLastInspection || ""}
                onChange={handleInputChange}
                disabled={newInstallStates.ac || propertyData.acIsNewInstall}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Warranty
              </label>
              <select
                name="acWarranty"
                value={propertyData.acWarranty || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="acNextInspection"
                value={propertyData.acNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Location
              </label>
              <input
                type="text"
                name="acLocation"
                value={propertyData.acLocation || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="acIssues"
                value={propertyData.acIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Water Heating */}
      {isVisible("waterHeating") && (
        <CollapsibleSection
          sectionId="waterHeating"
          title="Water Heating"
          icon={Droplet}
          isOpen={expandedSections.waterHeating}
          onToggle={() => toggleSection("waterHeating")}
          showActionButtons={true}
          installerId={propertyData.waterHeatingInstaller}
          systemType="waterHeating"
          systemLabel="Water Heating"
          contacts={contacts}
          isNewInstall={
            newInstallStates.waterHeating ||
            propertyData.waterHeatingIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("waterHeating", isNew)
          }
          onScheduleInspection={handleScheduleInspection(
            "waterHeating",
            "waterHeatingNextInspection",
          )}
          progress={systemsProgress.waterHeating}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.waterHeating}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                System Type
              </label>
              <input
                type="text"
                name="waterHeatingSystemType"
                value={propertyData.waterHeatingSystemType || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="waterHeatingInstallDate"
                value={propertyData.waterHeatingInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="waterHeatingInstaller"
                value={propertyData.waterHeatingInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.waterHeatingInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="waterHeatingCondition"
                value={propertyData.waterHeatingCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="waterHeatingLastInspection"
                value={propertyData.waterHeatingLastInspection || ""}
                onChange={handleInputChange}
                disabled={
                  newInstallStates.waterHeating ||
                  propertyData.waterHeatingIsNewInstall
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Warranty
              </label>
              <select
                name="waterHeatingWarranty"
                value={propertyData.waterHeatingWarranty || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="waterHeatingNextInspection"
                value={propertyData.waterHeatingNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Location
              </label>
              <input
                type="text"
                name="waterHeatingLocation"
                value={propertyData.waterHeatingLocation || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="waterHeatingIssues"
                value={propertyData.waterHeatingIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Electrical */}
      {isVisible("electrical") && (
        <CollapsibleSection
          sectionId="electrical"
          title="Electrical"
          icon={Zap}
          isOpen={expandedSections.electrical}
          onToggle={() => toggleSection("electrical")}
          showActionButtons={true}
          installerId={propertyData.electricalInstaller}
          systemType="electrical"
          systemLabel="Electrical"
          contacts={contacts}
          isNewInstall={
            newInstallStates.electrical || propertyData.electricalIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("electrical", isNew)
          }
          onScheduleInspection={handleScheduleInspection(
            "electrical",
            "electricalNextInspection",
          )}
          progress={systemsProgress.electrical}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.electrical}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Service Amperage
              </label>
              <input
                type="number"
                name="electricalServiceAmperage"
                value={propertyData.electricalServiceAmperage || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="electricalInstallDate"
                value={propertyData.electricalInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="electricalInstaller"
                value={propertyData.electricalInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.electricalInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="electricalCondition"
                value={propertyData.electricalCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="electricalLastInspection"
                value={propertyData.electricalLastInspection || ""}
                onChange={handleInputChange}
                disabled={
                  newInstallStates.electrical ||
                  propertyData.electricalIsNewInstall
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Warranty
              </label>
              <select
                name="electricalWarranty"
                value={propertyData.electricalWarranty || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="electricalNextInspection"
                value={propertyData.electricalNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Location
              </label>
              <input
                type="text"
                name="electricalLocation"
                value={propertyData.electricalLocation || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Issues
              </label>
              <textarea
                name="electricalIssues"
                value={propertyData.electricalIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Plumbing */}
      {isVisible("plumbing") && (
        <CollapsibleSection
          sectionId="plumbing"
          title="Plumbing"
          icon={Droplet}
          isOpen={expandedSections.plumbing}
          onToggle={() => toggleSection("plumbing")}
          showActionButtons={true}
          installerId={propertyData.plumbingInstaller}
          systemType="plumbing"
          systemLabel="Plumbing"
          contacts={contacts}
          isNewInstall={
            newInstallStates.plumbing || propertyData.plumbingIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("plumbing", isNew)
          }
          onScheduleInspection={handleScheduleInspection(
            "plumbing",
            "plumbingNextInspection",
          )}
          progress={systemsProgress.plumbing}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.plumbing}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Supply Materials
              </label>
              <input
                type="text"
                name="plumbingSupplyMaterials"
                value={propertyData.plumbingSupplyMaterials || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Waste Type
              </label>
              <select
                name="plumbingWasteType"
                value={propertyData.plumbingWasteType || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="sewer">Sewer</option>
                <option value="septic">Septic</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Leaks or Backups
              </label>
              <textarea
                name="plumbingIssues"
                value={propertyData.plumbingIssues || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[60px]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Install Date
              </label>
              <DatePickerInput
                name="plumbingInstallDate"
                value={propertyData.plumbingInstallDate || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Installer
              </label>
              <InstallerSelect
                name="plumbingInstaller"
                value={propertyData.plumbingInstaller || ""}
                onChange={handleInputChange}
                contacts={contacts}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Age{" "}
                <Tooltip
                  content="Calculated from install date"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {formatAgeFromInstallDate(
                  getAgeFromInstallDate(propertyData.plumbingInstallDate),
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Condition
              </label>
              <select
                name="plumbingCondition"
                value={propertyData.plumbingCondition || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select condition</option>
                <option value="Excellent">Excellent</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Inspection{" "}
                <Tooltip
                  content="Disabled when marked as new installation"
                  position="right"
                >
                  <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                </Tooltip>
              </label>
              <DatePickerInput
                name="plumbingLastInspection"
                value={propertyData.plumbingLastInspection || ""}
                onChange={handleInputChange}
                disabled={
                  newInstallStates.plumbing || propertyData.plumbingIsNewInstall
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Warranty
              </label>
              <select
                name="plumbingWarranty"
                value={propertyData.plumbingWarranty || ""}
                onChange={handleInputChange}
                className="form-select w-full"
              >
                <option value="">Select</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Next Inspection
              </label>
              <DatePickerInput
                name="plumbingNextInspection"
                value={propertyData.plumbingNextInspection || ""}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Main Turnoff Location
              </label>
              <input
                type="text"
                name="plumbingMainTurnoffLocation"
                value={propertyData.plumbingMainTurnoffLocation || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Clearout Location
              </label>
              <input
                type="text"
                name="plumbingClearoutLocation"
                value={propertyData.plumbingClearoutLocation || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Systems Section - Safety */}
      {isVisible("safety") && (
        <CollapsibleSection
          sectionId="safety"
          title="Safety"
          icon={Shield}
          isOpen={expandedSections.safety}
          onToggle={() => toggleSection("safety")}
          showActionButtons={true}
          systemType="safety"
          systemLabel="Safety"
          contacts={contacts}
          isNewInstall={
            newInstallStates.safety || propertyData.safetyIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("safety", isNew)
          }
          progress={systemsProgress.safety}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.safety}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Smoke/CO Coverage
              </label>
              <input
                type="text"
                name="safetySmokeCOCoverage"
                value={propertyData.safetySmokeCOCoverage || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                GFCI Status
              </label>
              <input
                type="text"
                name="safetyGFCIStatus"
                value={propertyData.safetyGFCIStatus || ""}
                onChange={handleInputChange}
                className="form-input w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Known Hazards (asbestos, lead, poly, knob & tube, etc.)
              </label>
              <textarea
                name="safetyKnownHazards"
                value={propertyData.safetyKnownHazards || ""}
                onChange={handleInputChange}
                className="form-input w-full min-h-[80px]"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Inspections Section */}
      {isVisible("inspections") && (
        <CollapsibleSection
          sectionId="inspections"
          title="Inspections"
          icon={FileCheck}
          isOpen={expandedSections.inspections}
          onToggle={() => toggleSection("inspections")}
          showActionButtons={true}
          systemType="inspections"
          systemLabel="Inspections"
          contacts={contacts}
          isNewInstall={
            newInstallStates.inspections || propertyData.inspectionsIsNewInstall
          }
          onNewInstallChange={(isNew) =>
            handleNewInstallChange("inspections", isNew)
          }
          progress={systemsProgress.inspections}
          propertyId={propertyId}
          propertyData={propertyData}
          systemsToShow={systemsToShow}
          customSystemsData={customSystemsData}
          maintenanceEvents={maintenanceEvents}
          maintenanceRecords={maintenanceRecords}
          onScheduleSuccess={onScheduleSuccess}
          aiCondition={aiConditionBySystem.inspections}
          inspectionAnalysis={inspectionAnalysis}
          onOpenInspectionReport={onOpenInspectionReport}
          onOpenAIAssistant={handleOpenAIAssistant}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                General Inspection
              </label>
              <div className="flex gap-4 items-center">
                <select
                  name="generalInspection"
                  value={propertyData.generalInspection || ""}
                  onChange={handleInputChange}
                  className="form-select w-24"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {propertyData.generalInspection === "yes" && (
                  <>
                    <DatePickerInput
                      name="generalInspectionDate"
                      value={propertyData.generalInspectionDate || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Date"
                    />
                    <input
                      type="text"
                      name="generalInspectionLink"
                      value={propertyData.generalInspectionLink || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Upload link"
                    />
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Roof Inspection
              </label>
              <div className="flex gap-4 items-center">
                <select
                  name="roofInspection"
                  value={propertyData.roofInspection || ""}
                  onChange={handleInputChange}
                  className="form-select w-24"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {propertyData.roofInspection === "yes" && (
                  <>
                    <DatePickerInput
                      name="roofInspectionDate"
                      value={propertyData.roofInspectionDate || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Date"
                    />
                    <input
                      type="text"
                      name="roofInspectionLink"
                      value={propertyData.roofInspectionLink || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Upload link"
                    />
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Sewer Scope
              </label>
              <div className="flex gap-4 items-center">
                <select
                  name="sewerScope"
                  value={propertyData.sewerScope || ""}
                  onChange={handleInputChange}
                  className="form-select w-24"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {propertyData.sewerScope === "yes" && (
                  <>
                    <DatePickerInput
                      name="sewerScopeDate"
                      value={propertyData.sewerScopeDate || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Date"
                    />
                    <input
                      type="text"
                      name="sewerScopeLink"
                      value={propertyData.sewerScopeLink || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Upload link"
                    />
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                HVAC Inspection
              </label>
              <div className="flex gap-4 items-center">
                <select
                  name="hvacInspection"
                  value={propertyData.hvacInspection || ""}
                  onChange={handleInputChange}
                  className="form-select w-24"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {propertyData.hvacInspection === "yes" && (
                  <>
                    <DatePickerInput
                      name="hvacInspectionDate"
                      value={propertyData.hvacInspectionDate || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Date"
                    />
                    <input
                      type="text"
                      name="hvacInspectionLink"
                      value={propertyData.hvacInspectionLink || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Upload link"
                    />
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Pest Inspection
              </label>
              <div className="flex gap-4 items-center">
                <select
                  name="pestInspection"
                  value={propertyData.pestInspection || ""}
                  onChange={handleInputChange}
                  className="form-select w-24"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {propertyData.pestInspection === "yes" && (
                  <>
                    <DatePickerInput
                      name="pestInspectionDate"
                      value={propertyData.pestInspectionDate || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Date"
                    />
                    <input
                      type="text"
                      name="pestInspectionLink"
                      value={propertyData.pestInspectionLink || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Upload link"
                    />
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Other Inspection
              </label>
              <div className="flex gap-4 items-center">
                <select
                  name="otherInspection"
                  value={propertyData.otherInspection || ""}
                  onChange={handleInputChange}
                  className="form-select w-24"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {propertyData.otherInspection === "yes" && (
                  <>
                    <DatePickerInput
                      name="otherInspectionDate"
                      value={propertyData.otherInspectionDate || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Date"
                    />
                    <input
                      type="text"
                      name="otherInspectionLink"
                      value={propertyData.otherInspectionLink || ""}
                      onChange={handleInputChange}
                      className="form-input flex-1"
                      placeholder="Upload link"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Custom systems - standard section with STANDARD_CUSTOM_SYSTEM_FIELDS */}
      {(() => {
        const customNames = propertyData.customSystemNames ?? [];
        const displayNames = getDisplayNamesWithCounters(customNames);
        return customNames.map((systemName, index) => {
          const displayName = displayNames[index] ?? systemName;
          const sectionId = `custom-${systemName}-${index}`;
          const systemData = customSystemsData[systemName] ?? {};
          // Calculate progress for custom system
          const customProgress = (() => {
            const trackableFields = STANDARD_CUSTOM_SYSTEM_FIELDS.filter(
              (f) => f.type !== "computed-age",
            );
            const total = trackableFields.length;
            const filled = trackableFields.filter((f) => {
              const val = systemData[f.key];
              return val != null && String(val).trim() !== "";
            }).length;
            return {
              filled,
              total,
              percent: total > 0 ? (filled / total) * 100 : 0,
            };
          })();

          return (
            <CollapsibleSection
              key={sectionId}
              sectionId={sectionId}
              title={displayName}
              icon={Settings}
              isOpen={expandedSections[sectionId] ?? false}
              onToggle={() => toggleSection(sectionId)}
              showActionButtons={true}
              installerId={systemData.installer}
              installerName={systemData.installer}
              systemType={sectionId}
              systemLabel={displayName}
              contacts={contacts}
              isNewInstall={
                newInstallStates[sectionId] || systemData.isNewInstall
              }
              onNewInstallChange={(isNew) =>
                handleNewInstallChange(sectionId, isNew, systemName)
              }
              onScheduleInspection={handleScheduleInspection(
                sectionId,
                `customSystem_${systemName}::nextInspection`,
              )}
              progress={customProgress}
              propertyId={propertyId}
              propertyData={propertyData}
              systemsToShow={systemsToShow}
              customSystemsData={customSystemsData}
              maintenanceEvents={maintenanceEvents}
              maintenanceRecords={maintenanceRecords}
              onScheduleSuccess={onScheduleSuccess}
              aiCondition={aiConditionBySystem[sectionId] ?? aiConditionBySystem[`custom-${systemName}`]}
              inspectionAnalysis={inspectionAnalysis}
              onOpenInspectionReport={onOpenInspectionReport}
              onOpenAIAssistant={handleOpenAIAssistant}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {STANDARD_CUSTOM_SYSTEM_FIELDS.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {field.label}
                      {field.key === "age" && (
                        <>
                          {" "}
                          <Tooltip
                            content="Calculated from install date"
                            position="right"
                          >
                            <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                          </Tooltip>
                        </>
                      )}
                      {field.key === "lastInspection" && (
                        <>
                          {" "}
                          <Tooltip
                            content="Disabled when marked as new installation"
                            position="right"
                          >
                            <Info className="w-3.5 h-3.5 inline-block ml-0.5 align-middle text-gray-400 cursor-help" />
                          </Tooltip>
                        </>
                      )}
                    </label>
                    {field.type === "select" ? (
                      <select
                        name={`customSystem_${systemName}::${field.key}`}
                        value={systemData[field.key] ?? ""}
                        onChange={handleInputChange}
                        className="form-select w-full"
                      >
                        <option value="">Select…</option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "warranty-select" ? (
                      <select
                        name={`customSystem_${systemName}::${field.key}`}
                        value={systemData[field.key] ?? ""}
                        onChange={handleInputChange}
                        className="form-select w-full"
                      >
                        <option value="">Select</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : field.type === "date" ? (
                      <DatePickerInput
                        name={`customSystem_${systemName}::${field.key}`}
                        value={systemData[field.key] ?? ""}
                        onChange={handleInputChange}
                        disabled={
                          field.key === "lastInspection" &&
                          (newInstallStates[sectionId] ||
                            systemData.isNewInstall)
                        }
                      />
                    ) : field.type === "installer" ? (
                      <InstallerSelect
                        name={`customSystem_${systemName}::${field.key}`}
                        value={systemData[field.key] ?? ""}
                        onChange={handleInputChange}
                        contacts={contacts}
                      />
                    ) : field.type === "computed-age" ? (
                      <div className="form-input w-full bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {formatAgeFromInstallDate(
                          getAgeFromInstallDate(systemData.installDate),
                        )}
                      </div>
                    ) : field.type === "textarea" ? (
                      <textarea
                        name={`customSystem_${systemName}::${field.key}`}
                        value={systemData[field.key] ?? ""}
                        onChange={handleInputChange}
                        className="form-input w-full min-h-[80px]"
                      />
                    ) : (
                      <input
                        type="text"
                        name={`customSystem_${systemName}::${field.key}`}
                        value={systemData[field.key] ?? ""}
                        onChange={handleInputChange}
                        className="form-input w-full"
                      />
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          );
        });
      })()}
    </div>

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
    </>
  );
}

export default SystemsTab;
