/**
 * Prepares property form data for the backend API.
 * Converts camelCase keys to snake_case and coerces types to match the properties table.
 * Property id is a ULID assigned by the backend on create; do not send id when creating.
 */

import { IDENTITY_SECTIONS } from "../constants/identitySections";

/** Fields that appear on the Identity tab form - only these are sent on property update. */
const IDENTITY_FORM_KEYS = new Set([
  ...IDENTITY_SECTIONS.flatMap((s) => s.fields ?? []),
  "mainPhoto", // Set via image upload on property card; not in form sections
]);

/** Identity/string fields the backend expects as strings (send "" instead of null). */
const STRING_KEYS = new Set([
  "propertyName",
  "address",
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "county",
  "fullAddress",
  "ownerName",
  "ownerName2",
  "ownerCity",
  "occupantName",
  "occupantType",
  "ownerPhone",
  "phoneToShow",
  "propertyType",
  "subType",
  "roofType",
  "effectiveYearBuiltSource",
  "sqFtSource",
  "lotSizeSource",
  "lotDim",
  "fireplaceTypes",
  "basement",
  "parkingType",
  "schoolDistrict",
  "elementarySchool",
  "juniorHighSchool",
  "seniorHighSchool",
  "schoolDistrictWebsites",
  "mainPhoto",
  "taxId",
  "parcelTaxId",
]);

/** Keys that should be sent as integers (omit when null so backend gets strict integer type). */
const INTEGER_KEYS = new Set([
  "yearBuilt",
  "effectiveYearBuilt",
  "rooms",
  "bedCount",
  "bathrooms",
  "bathCount",
  "fullBaths",
  "threeQuarterBaths",
  "halfBaths",
  "numberOfShowers",
  "numberOfBathtubs",
  "fireplaces",
  "totalCoveredParking",
  "totalUncoveredParking",
  "sqFtTotal",
  "sqFtFinished",
  "sqFtUnfinished",
  "garageSqFt",
  "totalDwellingSqFt",
  "hpsScore",
  "price",
]);

/** Keys that should be sent as numbers (int or float; null if empty/invalid). */
const NUMERIC_KEYS = new Set([
  "pricePerSqFt",
  "totalPricePerSqFt",
  "squareFeet",
]);

/** Date fields: send null when empty (backend expects date or null, not ""). */
const DATE_KEYS = new Set(["listDate", "expireDate"]);

/** Installer fields: send as {prefix}_installer_id (integer). Omit when empty or invalid. */
const INSTALLER_ID_KEYS = new Set([
  "roofInstaller",
  "gutterInstaller",
  "sidingInstaller",
  "windowInstaller",
  "heatingInstaller",
  "acInstaller",
  "waterHeatingInstaller",
  "electricalInstaller",
  "plumbingInstaller",
]);

/** CamelCase -> snake_case for known property fields (identity + form). */
const SNAKE_MAP = {
  id: "id",
  propertyName: "property_name",
  address: "address",
  addressLine1: "address_line_1",
  addressLine2: "address_line_2",
  city: "city",
  state: "state",
  zip: "zip",
  fullAddress: "full_address",
  passportId: "passport_id",
  taxId: "tax_id",
  parcelTaxId: "parcel_tax_id",
  county: "county",
  ownerName: "owner_name",
  ownerName2: "owner_name_2",
  ownerCity: "owner_city",
  occupantName: "occupant_name",
  occupantType: "occupant_type",
  ownerPhone: "owner_phone",
  phoneToShow: "phone_to_show",
  propertyType: "property_type",
  subType: "sub_type",
  roofType: "roof_type",
  yearBuilt: "year_built",
  effectiveYearBuilt: "effective_year_built",
  effectiveYearBuiltSource: "effective_year_built_source",
  squareFeet: "square_feet",
  sqFtTotal: "sq_ft_total",
  sqFtFinished: "sq_ft_finished",
  sqFtUnfinished: "sq_ft_unfinished",
  garageSqFt: "garage_sq_ft",
  totalDwellingSqFt: "total_dwelling_sq_ft",
  sqFtSource: "sq_ft_source",
  lotSize: "lot_size",
  lotSizeSource: "lot_size_source",
  lotDim: "lot_dim",
  pricePerSqFt: "price_per_sq_ft",
  totalPricePerSqFt: "total_price_per_sq_ft",
  rooms: "rooms",
  bedCount: "bed_count",
  bathrooms: "bathrooms",
  bathCount: "bath_count",
  fullBaths: "full_baths",
  threeQuarterBaths: "three_quarter_baths",
  halfBaths: "half_baths",
  numberOfShowers: "number_of_showers",
  numberOfBathtubs: "number_of_bathtubs",
  fireplaces: "fireplaces",
  fireplaceTypes: "fireplace_types",
  basement: "basement",
  parkingType: "parking_type",
  totalCoveredParking: "total_covered_parking",
  totalUncoveredParking: "total_uncovered_parking",
  schoolDistrict: "school_district",
  elementarySchool: "elementary_school",
  juniorHighSchool: "junior_high_school",
  seniorHighSchool: "senior_high_school",
  schoolDistrictWebsites: "school_district_websites",
  listDate: "list_date",
  expireDate: "expire_date",
  price: "price",
  hpsScore: "hps_score",
  mainPhoto: "main_photo",
  homeownerIds: "homeowner_ids",
  teamMembers: "team_members",
  healthMetrics: "health_metrics",
  healthHighlights: "health_highlights",
  photos: "photos",
  maintenanceHistory: "maintenance_history",
  documents: "documents",
};

/** Nested keys whose children should also be snake_cased (e.g. health_metrics). */
const NESTED_SNAKE_KEYS = {
  healthMetrics: {
    documentsUploaded: "documents_uploaded",
    systemsIdentified: "systems_identified",
    maintenanceProfileSetup: "maintenance_profile_setup",
  },
  documentsUploaded: { current: "current", total: "total" },
  systemsIdentified: { current: "current", total: "total" },
  maintenanceProfileSetup: { complete: "complete" },
};

/** snake_case -> camelCase for known property keys (reverse of SNAKE_MAP). */
const CAMEL_MAP = Object.fromEntries(
  Object.entries(SNAKE_MAP).map(([camel, snake]) => [snake, camel]),
);

function toSnakeCase(key) {
  if (SNAKE_MAP[key] !== undefined) return SNAKE_MAP[key];
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function toCamelCase(key) {
  if (CAMEL_MAP[key] !== undefined) return CAMEL_MAP[key];
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Maps API property (snake_case keys) to form shape (camelCase) so the form displays correctly.
 * @param {Object} apiProperty - Property from API (may have snake_case keys)
 * @returns {Object} Property with camelCase keys for form use
 */
/** Map backend installer_id fields to form installer fields (e.g. roof_installer_id -> roofInstaller) */
const INSTALLER_ID_TO_FORM = {
  roof_installer_id: "roofInstaller",
  gutter_installer_id: "gutterInstaller",
  siding_installer_id: "sidingInstaller",
  window_installer_id: "windowInstaller",
  heating_installer_id: "heatingInstaller",
  ac_installer_id: "acInstaller",
  water_heating_installer_id: "waterHeatingInstaller",
  electrical_installer_id: "electricalInstaller",
  plumbing_installer_id: "plumbingInstaller",
};

export function mapPropertyFromBackend(apiProperty) {
  if (!apiProperty || typeof apiProperty !== "object") return apiProperty;
  const out = {};
  for (const [key, value] of Object.entries(apiProperty)) {
    const formKey = INSTALLER_ID_TO_FORM[key];
    if (formKey) {
      out[formKey] = value;
      continue;
    }
    const camelKey = toCamelCase(key);
    if (value && typeof value === "object" && !Array.isArray(value) && key === "health_metrics") {
      const inner = {};
      for (const [ik, iv] of Object.entries(value)) {
        inner[toCamelCase(ik)] = iv && typeof iv === "object" && !Array.isArray(iv) ? { ...iv } : iv;
      }
      out[camelKey] = inner;
    } else {
      out[camelKey] = value;
    }
  }
  return out;
}

/** Returns a strict integer or null. Caller should omit key when null for integer-only APIs. */
function coerceInt(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function coerceNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function transformHealthMetrics(healthMetrics) {
  if (!healthMetrics || typeof healthMetrics !== "object") return healthMetrics;
  const out = {};
  for (const [k, v] of Object.entries(healthMetrics)) {
    const snakeKey = NESTED_SNAKE_KEYS.healthMetrics?.[k] ?? toSnakeCase(k);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const inner = {};
      for (const [ik, iv] of Object.entries(v)) {
        const innerSnake = NESTED_SNAKE_KEYS[k]?.[ik] ?? ik;
        inner[innerSnake] = iv;
      }
      out[snakeKey] = inner;
    } else {
      out[snakeKey] = v;
    }
  }
  return out;
}

/**
 * Prepares property form data for the backend: snake_case keys and correct types.
 * Integer fields are omitted when null so the payload only contains actual integers.
 * @param {Object} propertyData - Raw form data (camelCase, mixed types)
 * @returns {Object} Payload suitable for API (snake_case, int/number/string)
 */
export function preparePropertyValues(propertyData) {
  if (!propertyData || typeof propertyData !== "object") return {};

  const out = {};

  for (const [key, value] of Object.entries(propertyData)) {
    const snakeKey = toSnakeCase(key);

    if (key === "healthMetrics") {
      out[snakeKey] = transformHealthMetrics(value);
      continue;
    }

    if (INSTALLER_ID_KEYS.has(key)) {
      const idVal = coerceInt(value);
      if (idVal !== null) {
        const prefix = key.replace(/Installer$/, "");
        out[toSnakeCase(prefix) + "_installer_id"] = idVal;
      }
      continue;
    }

    // TODO: Include custom_systems_data (customSystemsData) in API payload when backend supports it
    if (key === "customSystemsData") continue;

    // health_score is not a backend column; omit from payload
    if (key === "healthScore") continue;

    // summary is not a backend column; omit from payload
    if (key === "summary") continue;

    // agent_id is not a backend column; omit from payload
    if (key === "agentId") continue;

    if (Array.isArray(value)) {
      out[snakeKey] = value;
      continue;
    }

    if (INTEGER_KEYS.has(key)) {
      const intVal = coerceInt(value);
      if (intVal !== null) out[snakeKey] = intVal;
      continue;
    }

    if (NUMERIC_KEYS.has(key)) {
      const numVal = coerceNumber(value);
      if (numVal !== null) out[snakeKey] = numVal;
      continue;
    }

    if (value === "" || value === null || value === undefined) {
      if (key === "id") continue;
      if (DATE_KEYS.has(key)) {
        out[snakeKey] = null;
      } else if (STRING_KEYS.has(key)) {
        out[snakeKey] = "";
      } else {
        out[snakeKey] = null;
      }
      continue;
    }

    out[snakeKey] =
      typeof value === "string"
        ? value.trim()
        : STRING_KEYS.has(key)
          ? String(value)
          : value;
  }

  // Ensure identity string fields are always sent as strings (backend rejects null)
  const identityStringKeys = ["propertyName", "address", "addressLine1", "addressLine2", "city", "state", "zip", "county"];
  for (const camelKey of identityStringKeys) {
    const snakeKey = toSnakeCase(camelKey);
    const v = out[snakeKey];
    if (v == null || typeof v !== "string") {
      out[snakeKey] = "";
    } else {
      out[snakeKey] = v.trim();
    }
  }

  return out;
}

/**
 * Prepares identity form data for property update API.
 * Only includes fields that appear on the Identity tab form.
 * @param {Object} identityData - Identity form data (state.formData.identity)
 * @returns {Object} Payload suitable for API (snake_case, only identity tab fields)
 */
export function prepareIdentityForUpdate(identityData) {
  if (!identityData || typeof identityData !== "object") return {};
  const filtered = {};
  for (const key of Object.keys(identityData)) {
    if (IDENTITY_FORM_KEYS.has(key)) {
      filtered[key] = identityData[key];
    }
  }
  return preparePropertyValues(filtered);
}

/**
 * Prepares team/user list for adding to a property (e.g. lowercases role).
 * @param {Array} team - Array of user/team member objects
 * @returns {Array} Same array with each member's role lowercased
 */
const VALID_PROPERTY_ROLES = new Set(["owner", "editor", "viewer"]);

function toPropertyRole(role) {
  const lower = typeof role === "string" ? role.toLowerCase() : "editor";
  if (VALID_PROPERTY_ROLES.has(lower)) return lower;
  if (lower === "super_admin" || lower === "admin" || lower === "agent") return "editor";
  if (lower === "homeowner") return "editor";
  return "editor";
}

export function prepareTeamForProperty(team) {
  if (!Array.isArray(team)) return [];
  return team
    .filter((m) => m && typeof m === "object" && m.id != null && !m._pending)
    .map((member) => {
      const currentRole = (member.property_role || member.role || "").toLowerCase();
      /* Owner must always keep full access - never downgrade to viewer */
      const role =
        currentRole === "owner"
          ? "owner"
          : toPropertyRole(member.property_role || member.role);
      return {...member, role};
    });
}
