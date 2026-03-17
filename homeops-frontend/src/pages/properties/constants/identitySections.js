/**
 * Identity form sections and their fields.
 * Used by ScoreCard to compute completion (each section complete = all fields filled).
 */
export const IDENTITY_SECTIONS = [
  {
    id: "identity_address",
    label: "Identity & Address",
    description: "Core property identification and location information",
    fields: ["propertyName", "address", "addressLine1", "city", "state", "zip", "county", "taxId"],
  },
  {
    id: "ownership_occupancy",
    label: "Ownership & Occupancy",
    description: "Owner and occupant details for property management",
    fields: [
      "ownerName",
      "ownerName2",
      "ownerCity",
      "occupantName",
      "occupantType",
      "ownerPhone",
    ],
  },
  {
    id: "general_info",
    label: "General Information",
    description: "Property type, construction, and basic characteristics",
    fields: [
      "propertyType",
      "subType",
      "yearBuilt",
    ],
  },
  {
    id: "size_lot",
    label: "Size & Lot",
    description: "Square footage, lot dimensions, and property measurements",
    fields: [
      "sqFtTotal",
      "sqFtFinished",
      "garageSqFt",
      "totalDwellingSqFt",
      "lotSize",
    ],
  },
  {
    id: "rooms_baths",
    label: "Rooms & Baths",
    description: "Bedroom, bathroom, and fixture counts",
    fields: [
      "bedCount",
      "bathCount",
      "fullBaths",
      "threeQuarterBaths",
      "halfBaths",
      "numberOfShowers",
      "numberOfBathtubs",
    ],
  },
  {
    id: "features_parking",
    label: "Features & Parking",
    description: "Fireplaces, basement, and parking details",
    fields: [
      "fireplaces",
      "fireplaceTypes",
      "basement",
      "parkingType",
      "totalCoveredParking",
      "totalUncoveredParking",
    ],
  },
  {
    id: "schools",
    label: "Schools",
    description: "School district and school assignments",
    fields: [
      "schoolDistrict",
      "elementarySchool",
      "juniorHighSchool",
      "seniorHighSchool",
    ],
  },
];

/** Aliases for field keys (backend may use different names). */
const FIELD_ALIASES = {
  taxId: ["parcelTaxId"],
  sqFtTotal: ["squareFeet"],
  bedCount: ["rooms"],
  bathCount: ["bathrooms"],
};

/**
 * Get field value from propertyData, checking aliases.
 * Special case: "address" is considered filled when we have address/fullAddress,
 * or when addressLine1 + city + state + zip are all present (composed address).
 */
function getFieldValue(propertyData, key) {
  const val = propertyData?.[key];
  if (val != null && (typeof val !== "string" || String(val).trim() !== ""))
    return val;
  if (key === "address") {
    const fullAddr = propertyData?.fullAddress;
    if (fullAddr != null && String(fullAddr).trim()) return fullAddr;
    const line1 = propertyData?.addressLine1;
    const city = propertyData?.city;
    const state = propertyData?.state;
    const zip = propertyData?.zip;
    if (
      line1 &&
      String(line1).trim() &&
      city &&
      String(city).trim() &&
      state &&
      String(state).trim() &&
      zip &&
      String(zip).trim()
    ) {
      return [line1, city, state, zip].filter(Boolean).join(", ");
    }
  }
  const aliases = FIELD_ALIASES[key];
  if (!aliases) return val;
  for (const alt of aliases) {
    const altVal = propertyData[alt];
    if (altVal != null) return altVal;
  }
  return undefined;
}

/**
 * Check if a field value is filled (non-empty).
 * @param {any} value - Field value
 * @returns {boolean} True if filled
 */
export function isFilled(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  return true;
}

/**
 * Check if an identity section is complete (all fields filled).
 * @param {Object} propertyData - Property form data
 * @param {Object} section - Section from IDENTITY_SECTIONS
 * @returns {boolean} True if all fields in the section are filled
 */
export function isSectionComplete(propertyData, section) {
  return section.fields.every((key) =>
    isFilled(getFieldValue(propertyData, key)),
  );
}

/**
 * Get section progress (filled count and percentage).
 * @param {Object} propertyData - Property form data
 * @param {Object} section - Section from IDENTITY_SECTIONS
 * @returns {{ filled: number, total: number, percent: number }} Progress stats
 */
export function getSectionProgress(propertyData, section) {
  const total = section.fields.length;
  const filled = section.fields.filter((key) =>
    isFilled(getFieldValue(propertyData, key)),
  ).length;
  const percent = total > 0 ? (filled / total) * 100 : 0;
  return { filled, total, percent };
}
