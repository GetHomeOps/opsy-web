import React from "react";
import {
  Bed,
  Building2,
  Check,
  ClipboardList,
  Flame,
  Home,
  Ruler,
  School,
} from "lucide-react";
import SectionCard from "../../properties/partials/passport/SectionCard";
import LabelValue from "../../properties/partials/passport/LabelValue";
import {StatusBadge} from "../../properties/partials/passport/StatusBadge";
import {
  IDENTITY_SECTIONS,
  getSectionProgress,
} from "../../properties/constants/identitySections";
import {formatAddress, formatDisplayName} from "../prePurchaseUtils";

/** Pre-purchase omits ownership/occupancy (seller privacy). */
const PRE_PURCHASE_IDENTITY_SECTIONS = IDENTITY_SECTIONS.filter(
  (s) => s.id !== "ownership_occupancy"
);

const SECTION_ICONS = {
  identity_address: Home,
  general_info: Building2,
  size_lot: Ruler,
  rooms_baths: Bed,
  features_parking: Flame,
  schools: School,
};

const FIELD_VALUE_ALIASES = {
  taxId: ["parcelTaxId"],
  bedCount: ["rooms"],
  bathCount: ["bathrooms"],
  sqFtTotal: ["squareFeet"],
};

const READONLY_FIELD_LABELS = {
  propertyName: "Property Name",
  address: "Full Address",
  addressLine1: "Street",
  city: "City",
  state: "State",
  zip: "ZIP",
  county: "County",
  taxId: "Tax / Parcel ID",
  propertyType: "Property Type",
  subType: "Sub Type",
  yearBuilt: "Year Built",
  sqFtTotal: "Total (ft²)",
  sqFtFinished: "Finished (ft²)",
  garageSqFt: "Garage (ft²)",
  totalDwellingSqFt: "Total Dwelling (ft²)",
  lotSize: "Lot Size",
  bedCount: "Bedrooms",
  bathCount: "Bathrooms",
  fullBaths: "Full Baths",
  threeQuarterBaths: "3/4 Baths",
  halfBaths: "Half Baths",
  numberOfShowers: "Showers",
  numberOfBathtubs: "Bathtubs",
  fireplaces: "Fireplaces",
  fireplaceTypes: "Fireplace Type",
  basement: "Basement",
  parkingType: "Parking Type",
  totalCoveredParking: "Covered Parking",
  totalUncoveredParking: "Uncovered Parking",
  schoolDistrict: "School District",
  elementarySchool: "Elementary",
  juniorHighSchool: "Junior High",
  seniorHighSchool: "Senior High",
};

const IDENTITY_PRIMARY_FIELD_WRAP = "col-span-full min-w-0";

function getFieldValue(propertyData, fieldName) {
  const keys = [fieldName, ...(FIELD_VALUE_ALIASES[fieldName] || [])];
  for (const k of keys) {
    const v = propertyData?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function identityPrimaryFieldClass(fieldName) {
  return fieldName === "propertyName" || fieldName === "address"
    ? IDENTITY_PRIMARY_FIELD_WRAP
    : "";
}

function readOnlyDisplayValue(propertyData, fieldName) {
  if (fieldName === "address") {
    return (
      propertyData?.fullAddress ||
      propertyData?.address ||
      [
        propertyData?.addressLine1,
        propertyData?.city,
        propertyData?.state,
        propertyData?.zip,
      ]
        .filter(Boolean)
        .join(", ")
    );
  }
  const v = getFieldValue(propertyData, fieldName);
  if (typeof v === "number") return String(v);
  return v;
}

/**
 * Flatten analysis address + public-records identityData into the same shape
 * the properties Identity tab expects.
 */
export function buildIdentityPropertyData(analysis) {
  const identity =
    analysis?.identityData && typeof analysis.identityData === "object"
      ? analysis.identityData
      : {};
  const displayName = formatDisplayName(analysis);
  const address = formatAddress(analysis);
  const street = analysis?.street || identity.addressLine1 || null;

  return {
    ...identity,
    propertyName:
      (displayName && displayName !== "Untitled analysis" ? displayName : null) ||
      identity.propertyName ||
      null,
    address: address || identity.address || identity.fullAddress || null,
    fullAddress: address || identity.fullAddress || identity.address || null,
    addressLine1: street,
    city: analysis?.city || identity.city || null,
    state: analysis?.state || identity.state || null,
    zip: analysis?.zip || identity.zip || null,
  };
}

function ReadOnlySectionCard({section, propertyData}) {
  const Icon = SECTION_ICONS[section.id] ?? Home;
  const {filled, total} = getSectionProgress(propertyData, section);
  const isComplete = filled >= total;

  return (
    <div
      className="rounded-xl border border-neutral-200/80 dark:border-neutral-700/50 bg-white dark:bg-neutral-900 p-4 h-full"
      data-section-id={section.id}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-[#456564] dark:text-[#7fa3a1] shrink-0" />
        <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
          {section.label}
        </h4>
        {isComplete ? (
          <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-emerald-400/20 dark:bg-emerald-400/25 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Check className="w-3 h-3" strokeWidth={2.5} />
          </span>
        ) : (
          <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500 shrink-0">
            {filled}/{total}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        {section.fields.map((fieldName) => (
          <LabelValue
            key={fieldName}
            label={READONLY_FIELD_LABELS[fieldName] ?? fieldName}
            value={readOnlyDisplayValue(propertyData, fieldName)}
            className={identityPrimaryFieldClass(fieldName)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Read-only Identity tab mirrored from the properties passport Identity layout.
 * Ownership & occupancy is omitted for pre-purchase privacy.
 */
export default function IdentityTab({analysis}) {
  const propertyData = buildIdentityPropertyData(analysis);
  const source = analysis?.identityDataSource;
  const sourceLabel =
    source === "rentcast" ? "RentCast" : source === "attom" ? "ATTOM" : null;

  const completedSections = PRE_PURCHASE_IDENTITY_SECTIONS.filter(
    (s) => getSectionProgress(propertyData, s).percent >= 100
  ).length;
  const allSectionsComplete =
    completedSections === PRE_PURCHASE_IDENTITY_SECTIONS.length;

  return (
    <SectionCard
      flat
      title="Property Identity"
      description="Core identity and property information"
      icon={ClipboardList}
      badge={
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge tone={allSectionsComplete ? "emerald" : "neutral"}>
            {allSectionsComplete ? (
              <>
                <Check className="w-3 h-3" strokeWidth={2.5} />
                Complete
              </>
            ) : (
              `${completedSections} of ${PRE_PURCHASE_IDENTITY_SECTIONS.length} complete`
            )}
          </StatusBadge>
          {sourceLabel ? (
            <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
              Source: {sourceLabel}
            </span>
          ) : null}
        </div>
      }
      bodyClassName="pt-2"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {PRE_PURCHASE_IDENTITY_SECTIONS.map((section) => (
          <ReadOnlySectionCard
            key={section.id}
            section={section}
            propertyData={propertyData}
          />
        ))}
      </div>
    </SectionCard>
  );
}
