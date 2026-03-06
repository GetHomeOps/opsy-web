/**
 * Helpers for computing system status (Needs Attention, Scheduled Event)
 * used by the Systems tab collapsible headers.
 */

/** systemType -> { lastInspection, nextInspection, condition, issues, installDate } field names */
export const INSPECTION_FIELDS_BY_SYSTEM = {
  roof: { lastInspection: "roofLastInspection", nextInspection: "roofNextInspection", condition: "roofCondition", issues: "roofIssues", installDate: "roofInstallDate" },
  gutters: { lastInspection: "gutterLastInspection", nextInspection: "gutterNextInspection", condition: "gutterCondition", issues: "gutterIssues", installDate: "gutterInstallDate" },
  foundation: { lastInspection: "foundationLastInspection", nextInspection: "foundationNextInspection", condition: "foundationCondition", issues: "foundationIssues", installDate: null },
  exterior: { lastInspection: "sidingLastInspection", nextInspection: "sidingNextInspection", condition: "sidingCondition", issues: "sidingIssues", installDate: "sidingInstallDate" },
  windows: { lastInspection: "windowLastInspection", nextInspection: "windowNextInspection", condition: "windowCondition", issues: "windowIssues", installDate: "windowInstallDate" },
  heating: { lastInspection: "heatingLastInspection", nextInspection: "heatingNextInspection", condition: "heatingCondition", issues: "heatingIssues", installDate: "heatingInstallDate" },
  ac: { lastInspection: "acLastInspection", nextInspection: "acNextInspection", condition: "acCondition", issues: "acIssues", installDate: "acInstallDate" },
  waterHeating: { lastInspection: "waterHeatingLastInspection", nextInspection: "waterHeatingNextInspection", condition: "waterHeatingCondition", issues: "waterHeatingIssues", installDate: "waterHeatingInstallDate" },
  electrical: { lastInspection: "electricalLastInspection", nextInspection: "electricalNextInspection", condition: "electricalCondition", issues: "electricalIssues", installDate: "electricalInstallDate" },
  plumbing: { lastInspection: "plumbingLastInspection", nextInspection: "plumbingNextInspection", condition: "plumbingCondition", issues: "plumbingIssues", installDate: "plumbingInstallDate" },
};

function isFilled(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

/**
 * Extract custom system name from sectionId (e.g. "custom-Solar Panel-0" -> "Solar Panel").
 */
function getCustomSystemName(systemType) {
  if (!systemType || !String(systemType).startsWith("custom-")) return null;
  const rest = String(systemType).slice(7); // after "custom-"
  const lastDash = rest.lastIndexOf("-");
  if (lastDash < 0) return rest;
  return rest.slice(0, lastDash);
}

/**
 * Check if a date string is in the future (or today).
 */
function isUpcomingDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d >= today;
}

/**
 * Find the next upcoming maintenance event for a system from maintenance_events.
 * @param {Array} maintenanceEvents - Events from API (scheduled_date, system_key, scheduled_time)
 * @param {string} systemType - System ID (e.g. "roof", "heating")
 * @returns {{ scheduledDate: string, scheduledTime: string|null }|null}
 */
function getUpcomingEventForSystem(maintenanceEvents, systemType) {
  if (!Array.isArray(maintenanceEvents) || !systemType) return null;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = maintenanceEvents
    .filter(
      (e) =>
        (e.system_key ?? e.systemKey) === systemType &&
        (e.scheduled_date ?? e.scheduledDate) >= today &&
        ["scheduled", "confirmed"].includes((e.status || "").toLowerCase()),
    )
    .sort((a, b) => {
      const da = a.scheduled_date ?? a.scheduledDate ?? "";
      const db = b.scheduled_date ?? b.scheduledDate ?? "";
      return da.localeCompare(db);
    })[0];
  if (!upcoming) return null;
  return {
    scheduledDate: upcoming.scheduled_date ?? upcoming.scheduledDate ?? "",
    scheduledTime: upcoming.scheduled_time ?? upcoming.scheduledTime ?? null,
  };
}

/**
 * Compute status flags and attention reasons for a system.
 * @param {Object} propertyData - Property form data
 * @param {string} systemType - System ID (e.g. "roof", "custom-Solar-0")
 * @param {boolean} isNewInstall - Whether system is marked as new install
 * @param {Object} customSystemsData - Custom system data (for custom systems)
 * @param {Array} [maintenanceEvents] - Upcoming maintenance events from API
 * @returns {{ needsAttention: boolean, attentionReasons: string[], hasScheduledEvent: boolean, scheduledDate?: string, scheduledTime?: string|null }}
 */
export function getSystemStatus(
  propertyData,
  systemType,
  isNewInstall,
  customSystemsData = {},
  maintenanceEvents = [],
) {
  let lastInspection = null;
  let nextInspection = null;
  let installDate = null;

  const customName = getCustomSystemName(systemType);
  let condition = null;
  let issues = null;

  if (customName) {
    const customData = customSystemsData[customName] ?? {};
    lastInspection = customData.lastInspection;
    nextInspection = customData.nextInspection;
    condition = customData.condition;
    issues = customData.issues;
    installDate = customData.installDate;
  } else {
    const fields = INSPECTION_FIELDS_BY_SYSTEM[systemType];
    if (fields) {
      lastInspection = propertyData?.[fields.lastInspection];
      nextInspection = propertyData?.[fields.nextInspection];
      condition = propertyData?.[fields.condition];
      issues = propertyData?.[fields.issues];
      installDate = fields.installDate ? propertyData?.[fields.installDate] : null;
    }
  }

  const attentionReasons = [];
  if (!isNewInstall && !isFilled(lastInspection)) {
    attentionReasons.push("No inspection date recorded");
  }
  if (!isNewInstall && !isFilled(installDate) && (customName || INSPECTION_FIELDS_BY_SYSTEM[systemType]?.installDate)) {
    attentionReasons.push("No installation data available");
  }
  if (condition === "Poor") {
    attentionReasons.push("Condition: Poor");
  } else if (condition === "Fair") {
    attentionReasons.push("Condition: Fair");
  }
  if (isFilled(issues)) {
    attentionReasons.push("Known issues reported");
  }

  const needsAttention = attentionReasons.length > 0;

  // Scheduled Event: from form (nextInspection) OR from maintenance_events (e.g. AI chat scheduling)
  const fromForm = isFilled(nextInspection) && isUpcomingDate(nextInspection);
  const eventForSystem = getUpcomingEventForSystem(maintenanceEvents, systemType);
  const fromEvents = !!eventForSystem;
  const hasScheduledEvent = fromForm || fromEvents;

  const scheduledDate =
    fromEvents && eventForSystem?.scheduledDate
      ? eventForSystem.scheduledDate
      : fromForm && nextInspection
        ? nextInspection
        : undefined;
  const scheduledTime = fromEvents ? eventForSystem?.scheduledTime : undefined;

  return {
    needsAttention,
    attentionReasons,
    hasScheduledEvent,
    ...(scheduledDate != null && {scheduledDate}),
    ...(scheduledTime !== undefined && {scheduledTime}),
  };
}

/**
 * Get the condition field name for a system (for form input).
 * @param {string} systemType - e.g. "roof", "custom-Solar-0"
 * @param {string} [customSystemName] - For custom systems, the display name (e.g. "Solar")
 * @returns {string|null} Field name or null if system has no condition field
 */
export function getConditionFieldName(systemType, customSystemName) {
  const customName = getCustomSystemName(systemType);
  if (customName) {
    const name = customSystemName ?? customName;
    return `customSystem_${name}::condition`;
  }
  const fields = INSPECTION_FIELDS_BY_SYSTEM[systemType];
  return fields?.condition ?? null;
}

/**
 * Get the current condition value from property data.
 * @param {Object} propertyData - Merged form data
 * @param {string} systemType - e.g. "roof", "custom-Solar-0"
 * @returns {string} Current condition value or empty string
 */
export function getCurrentConditionValue(propertyData, systemType) {
  const customName = getCustomSystemName(systemType);
  if (customName) {
    const val = propertyData?.customSystemsData?.[customName]?.condition;
    return val != null && String(val).trim() !== "" ? String(val).trim() : "";
  }
  const fields = INSPECTION_FIELDS_BY_SYSTEM[systemType];
  if (!fields) return "";
  const val = propertyData?.[fields.condition];
  return val != null && String(val).trim() !== "" ? String(val).trim() : "";
}
