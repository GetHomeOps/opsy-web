/**
 * Computes the Home Passport Health Status (HPS) score from property form data.
 * Uses the same logic as ScoreCard: average of identity, systems, and maintenance completion.
 * @param {Object} propertyData - Merged form data (identity + systems + maintenance)
 * @returns {number} Integer 0-100
 */
import { IDENTITY_SECTIONS, isSectionComplete } from "../constants/identitySections";
import {
  countCompletedSystemsWithCustom,
} from "../constants/systemSections";
import { PROPERTY_SYSTEMS, DEFAULT_SYSTEM_IDS } from "../constants/propertySystems";

export function computeHpsScore(propertyData) {
  if (!propertyData || typeof propertyData !== "object") return 0;

  // Identity score
  const identitySections = IDENTITY_SECTIONS;
  const completedIdentitySections = identitySections.filter((s) =>
    isSectionComplete(propertyData, s)
  );
  const identityScore = identitySections.length
    ? (completedIdentitySections.length / identitySections.length) * 100
    : 0;

  // Systems score
  const visibleSystemIds =
    (propertyData.selectedSystemIds?.length ?? 0) > 0
      ? propertyData.selectedSystemIds
      : DEFAULT_SYSTEM_IDS;
  const customSystemNames = propertyData.customSystemNames ?? [];
  const systemItems = [
    ...PROPERTY_SYSTEMS.filter((s) => visibleSystemIds.includes(s.id)),
    ...customSystemNames.map((name, index) => ({
      id: `custom-${name}-${index}`,
      name,
    })),
  ];
  const currentSystems = countCompletedSystemsWithCustom(
    propertyData,
    visibleSystemIds,
    customSystemNames
  );
  const systemsScore = systemItems.length
    ? (currentSystems / systemItems.length) * 100
    : 0;

  // Maintenance score (same as ScoreCard)
  const currentMaintenance =
    propertyData.healthMetrics?.maintenanceCompleted?.current ?? 0;
  const maintenanceScore = systemItems.length
    ? (currentMaintenance / systemItems.length) * 100
    : 0;

  const totalScore = (identityScore + systemsScore + maintenanceScore) / 3;
  return Math.round(Math.max(0, Math.min(100, totalScore)));
}

/**
 * Returns the three score components (Identity, Systems, Maintenance) as used by ScoreCard.
 * Used by HomeownerHome to display the same breakdown.
 *
 * @param {Object} propertyData - Merged form data (identity + systems + maintenance)
 * @param {Array} [maintenanceRecords] - Optional. If provided, maintenance score is computed from
 *   count of systems with at least one record. Otherwise uses propertyData.healthMetrics.maintenanceCompleted.
 * @returns {{ identityScore: number, systemsScore: number, maintenanceScore: number }}
 */
export function computeHpsScoreBreakdown(propertyData, maintenanceRecords) {
  if (!propertyData || typeof propertyData !== "object") {
    return {identityScore: 0, systemsScore: 0, maintenanceScore: 0};
  }

  // Identity score
  const identitySections = IDENTITY_SECTIONS;
  const completedIdentitySections = identitySections.filter((s) =>
    isSectionComplete(propertyData, s)
  );
  const identityScore = identitySections.length
    ? (completedIdentitySections.length / identitySections.length) * 100
    : 0;

  // Systems score
  const visibleSystemIds =
    (propertyData.selectedSystemIds?.length ?? 0) > 0
      ? propertyData.selectedSystemIds
      : DEFAULT_SYSTEM_IDS;
  const customSystemNames = propertyData.customSystemNames ?? [];
  const systemItems = [
    ...PROPERTY_SYSTEMS.filter((s) => visibleSystemIds.includes(s.id)),
    ...customSystemNames.map((name, index) => ({
      id: `custom-${name}-${index}`,
      name,
    })),
  ];
  const currentSystems = countCompletedSystemsWithCustom(
    propertyData,
    visibleSystemIds,
    customSystemNames
  );
  const systemsScore = systemItems.length
    ? (currentSystems / systemItems.length) * 100
    : 0;

  // Maintenance score
  let currentMaintenance =
    propertyData.healthMetrics?.maintenanceCompleted?.current ?? 0;
  if (Array.isArray(maintenanceRecords) && maintenanceRecords.length > 0) {
    const systemKeysWithRecords = new Set(
      maintenanceRecords
        .map((r) => (r.system_key ?? r.systemId ?? "").toString())
        .filter(Boolean)
    );
    const camelToSnake = (s) =>
      s.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "");
    currentMaintenance = systemItems.filter((item) => {
      const id = item.id;
      if (id.startsWith("custom-")) {
        const name = id.replace(/^custom-(\w+)-\d+$/, "$1");
        return systemKeysWithRecords.has(name) || systemKeysWithRecords.has(id);
      }
      return (
        systemKeysWithRecords.has(id) || systemKeysWithRecords.has(camelToSnake(id))
      );
    }).length;
  }
  const maintenanceScore = systemItems.length
    ? (currentMaintenance / systemItems.length) * 100
    : 0;

  return {
    identityScore: Math.round(Math.max(0, Math.min(100, identityScore))),
    systemsScore: Math.round(Math.max(0, Math.min(100, systemsScore))),
    maintenanceScore: Math.round(Math.max(0, Math.min(100, maintenanceScore))),
  };
}
