import { SYSTEM_SECTIONS } from "../constants/systemSections";

const SYSTEMS_CONFIG_KEYS = new Set([
  "selectedSystemIds",
  "customSystemNames",
  "customSystemsData",
]);
const SYSTEM_FIELD_NAMES = new Set(
  Object.values(SYSTEM_SECTIONS).flatMap((s) => s.fields ?? [])
);
const MAINTENANCE_KEYS = new Set(["maintenanceHistory"]);

const initialIdentity = {
  id: null,
  propertyName: "",
  address: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  price: null,
  rooms: null,
  bathrooms: null,
  squareFeet: null,
  yearBuilt: null,
  hpsScore: 0,
  healthScore: 0,
  mainPhoto: "",
  summary: "",
  agentId: "",
  homeownerIds: [],
  teamMembers: [],
  healthMetrics: {
    documentsUploaded: { current: 0, total: 10 },
    systemsIdentified: { current: 0, total: 6 },
    maintenanceProfileSetup: { complete: false },
  },
  healthHighlights: [],
  photos: [],
  documents: [],
  fullAddress: "",
  county: "",
};

const initialSystems = {
  selectedSystemIds: [],
  customSystemNames: [],
  customSystemsData: {},
};

/**
 * Split flat form data into tabbed structure: identity, systems, maintenanceRecords.
 */
export function splitFormDataByTabs(flat) {
  if (!flat || typeof flat !== "object") {
    return {
      identity: { ...initialIdentity },
      systems: { ...initialSystems },
      maintenanceRecords: [],
    };
  }
  const identity = { ...initialIdentity };
  const systems = { ...initialSystems };
  let maintenanceRecords = [];

  for (const [key, value] of Object.entries(flat)) {
    if (MAINTENANCE_KEYS.has(key)) {
      maintenanceRecords = Array.isArray(value) ? value : [];
    } else if (SYSTEMS_CONFIG_KEYS.has(key)) {
      if (key === "selectedSystemIds")
        systems.selectedSystemIds = Array.isArray(value) ? value : [];
      else if (key === "customSystemNames")
        systems.customSystemNames = Array.isArray(value) ? value : [];
      else if (key === "customSystemsData")
        systems.customSystemsData =
          value && typeof value === "object" ? value : {};
    } else if (SYSTEM_FIELD_NAMES.has(key)) {
      systems[key] = value;
    } else {
      identity[key] = value;
    }
  }
  return { identity, systems, maintenanceRecords };
}

/**
 * Merge tabbed form data to flat (for components expecting flat structure).
 */
export function mergeFormDataFromTabs(tabbed) {
  if (!tabbed || typeof tabbed !== "object") return {};
  const {
    identity = {},
    systems = {},
    maintenanceRecords = [],
  } = tabbed;
  const { selectedSystemIds, customSystemNames, customSystemsData, ...systemFields } =
    systems;
  return {
    ...identity,
    selectedSystemIds: selectedSystemIds ?? [],
    customSystemNames: customSystemNames ?? [],
    customSystemsData: customSystemsData ?? {},
    ...systemFields,
    maintenanceHistory: maintenanceRecords,
  };
}

export { SYSTEM_FIELD_NAMES, SYSTEMS_CONFIG_KEYS, MAINTENANCE_KEYS };
export const INITIAL_IDENTITY = initialIdentity;
export const INITIAL_SYSTEMS = initialSystems;
