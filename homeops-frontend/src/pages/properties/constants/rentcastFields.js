/**
 * Vendor-eligible identity fields (ATTOM / RentCast). Which ones are actually locked on the
 * Identity tab is driven by `identity_lookup_populated_keys` from the API — only keys returned
 * by the lookup are read-only; see IdentityTab `isVendorLookupLocked`.
 *
 * Backend mapping: routes/propertyPredict.js (mapAttomToFields).
 */
/** Address fields from autocomplete (Places) — also support Data Adjustment requests */
export const ADDRESS_FIELD_KEYS = new Set([
  "address",
  "addressLine1",
  "city",
  "state",
  "zip",
]);

/** RentCast-sourced fields (original set, for identity_data_source === 'rentcast') */
export const RENTCAST_FIELD_KEYS = new Set([
  "ownerName",
  "ownerName2",
  "ownerCity",
  "taxId",
  "addressLine2",
  "propertyType",
  "subType",
  "roofType",
  "yearBuilt",
  "sqFtTotal",
  "sqFtFinished",
  "garageSqFt",
  "totalDwellingSqFt",
  "lotSize",
  "bedCount",
  "bathCount",
  "fullBaths",
  "threeQuarterBaths",
  "halfBaths",
  "numberOfShowers",
  "numberOfBathtubs",
  "fireplaces",
  "fireplaceTypes",
  "basement",
  "parkingType",
  "totalCoveredParking",
  "totalUncoveredParking",
  "schoolDistrict",
  "elementarySchool",
  "juniorHighSchool",
  "seniorHighSchool",
  "county",
]);

/** All fields that support Data Adjustment (RentCast + Address) */
export const ADJUSTABLE_FIELD_KEYS = new Set([
  ...ADDRESS_FIELD_KEYS,
  "ownerName",
  "ownerName2",
  "ownerCity",
  "taxId",
  "addressLine2",
  "propertyType",
  "subType",
  "roofType",
  "yearBuilt",
  "sqFtTotal",
  "sqFtFinished",
  "garageSqFt",
  "totalDwellingSqFt",
  "lotSize",
  "bedCount",
  "bathCount",
  "fullBaths",
  "threeQuarterBaths",
  "halfBaths",
  "numberOfShowers",
  "numberOfBathtubs",
  "fireplaces",
  "fireplaceTypes",
  "basement",
  "parkingType",
  "totalCoveredParking",
  "totalUncoveredParking",
  "schoolDistrict",
  "elementarySchool",
  "juniorHighSchool",
  "seniorHighSchool",
  "county",
]);

/** Human-readable labels for Data Adjustment Request field dropdown */
export const RENTCAST_FIELD_LABELS = {
  address: "Address",
  addressLine1: "Street",
  city: "City",
  state: "State",
  zip: "ZIP",
  ownerName: "Owner Name",
  ownerName2: "Owner Name 2",
  ownerCity: "Owner City",
  taxId: "Tax / Parcel ID",
  addressLine2: "Address Line 2",
  propertyType: "Property Type",
  subType: "Sub Type",
  roofType: "Roof Type",
  yearBuilt: "Year Built",
  sqFtTotal: "Total ft²",
  sqFtFinished: "Finished ft²",
  garageSqFt: "Garage ft²",
  totalDwellingSqFt: "Total Dwelling ft²",
  lotSize: "Lot Size",
  bedCount: "Bedrooms",
  bathCount: "Bathrooms",
  fullBaths: "Full Baths",
  threeQuarterBaths: "3/4 Baths",
  halfBaths: "Half Baths",
  numberOfShowers: "Number of Showers",
  numberOfBathtubs: "Number of Bathtubs",
  fireplaces: "Fireplaces",
  fireplaceTypes: "Fireplace Type",
  basement: "Basement",
  parkingType: "Parking Type",
  totalCoveredParking: "Total Covered Parking",
  totalUncoveredParking: "Total Uncovered Parking",
  schoolDistrict: "School District",
  elementarySchool: "Elementary School",
  juniorHighSchool: "Junior High School",
  seniorHighSchool: "Senior High School",
  county: "County",
};

export const RENTCAST_VERIFIED_TOOLTIP =
  "Verified data provided by RentCast. Changes require a Data Adjustment Request.";

/** Tooltip for locked fields with click-to-support action (setup modal and Identity tab) */
export const RENTCAST_VERIFIED_TOOLTIP_WITH_ACTION =
  "Verified data from public records. Cannot be edited directly. Click to request a correction.";

/** Tooltip for address fields derived from autocomplete (same format as RentCast tooltips) */
export const AUTCOMPLETE_LOCK_TOOLTIP =
  "Verified data from public records. This field is system-managed and cannot be edited directly.";
