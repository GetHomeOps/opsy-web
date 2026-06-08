"use strict";

/**
 * Property completeness rules for invitation follow-up emails.
 * Keep aligned with homeops-frontend identitySections / systemSections / propertySystems.
 */

const IDENTITY_SECTIONS = [
  {
    id: "identity_address",
    label: "Identity & address",
    fields: ["propertyName", "address", "addressLine1", "city", "state", "zip", "county", "taxId"],
  },
  {
    id: "ownership_occupancy",
    label: "Ownership & occupancy",
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
    label: "General information",
    fields: ["propertyType", "subType", "yearBuilt"],
  },
  {
    id: "size_lot",
    label: "Size & lot",
    fields: [
      "sqFtTotal",
      "sqFtFinished",
      "garageSqFt",
      "totalDwellingSqFt",
      "lotSize",
    ],
  },
];

const FIELD_ALIASES = {
  taxId: ["parcelTaxId"],
  sqFtTotal: ["squareFeet"],
  bedCount: ["rooms"],
  bathCount: ["bathrooms"],
};

const SYSTEM_SECTIONS = {
  roof: {
    label: "Roof",
    fields: [
      "roofMaterial",
      "roofInstallDate",
      "roofInstaller",
      "roofCondition",
      "roofWarranty",
      "roofLastInspection",
      "roofNextInspection",
      "roofIssues",
    ],
  },
  gutters: {
    label: "Gutters",
    fields: [
      "gutterMaterial",
      "gutterInstallDate",
      "gutterInstaller",
      "gutterCondition",
      "gutterWarranty",
      "gutterLastInspection",
      "gutterNextInspection",
      "gutterIssues",
    ],
  },
  heating: {
    label: "Heating",
    fields: [
      "heatingSystemType",
      "heatingInstallDate",
      "heatingInstaller",
      "heatingCondition",
      "heatingWarranty",
      "heatingLastInspection",
      "heatingNextInspection",
      "heatingIssues",
    ],
  },
  ac: {
    label: "Air conditioning",
    fields: [
      "acSystemType",
      "acInstallDate",
      "acInstaller",
      "acCondition",
      "acWarranty",
      "acLastInspection",
      "acNextInspection",
      "acIssues",
    ],
  },
  electrical: {
    label: "Electrical",
    fields: [
      "electricalServiceAmperage",
      "electricalInstallDate",
      "electricalInstaller",
      "electricalCondition",
      "electricalWarranty",
      "electricalLastInspection",
      "electricalNextInspection",
      "electricalIssues",
    ],
  },
  plumbing: {
    label: "Plumbing",
    fields: [
      "plumbingSupplyMaterials",
      "plumbingInstallDate",
      "plumbingInstaller",
      "plumbingCondition",
      "plumbingWarranty",
      "plumbingLastInspection",
      "plumbingNextInspection",
      "plumbingIssues",
    ],
  },
};

const IS_NEW_INSTALL_FIELD_BY_SYSTEM = {
  roof: "roofIsNewInstall",
  gutters: "gutterIsNewInstall",
  heating: "heatingIsNewInstall",
  ac: "acIsNewInstall",
  electrical: "electricalIsNewInstall",
  plumbing: "plumbingIsNewInstall",
};

const LAST_INSPECTION_FIELD_BY_SYSTEM = {
  roof: "roofLastInspection",
  gutters: "gutterLastInspection",
  heating: "heatingLastInspection",
  ac: "acLastInspection",
  electrical: "electricalLastInspection",
  plumbing: "plumbingLastInspection",
};

const AGE_FROM_INSTALL_DATE = {
  roofAge: "roofInstallDate",
  gutterAge: "gutterInstallDate",
  heatingAge: "heatingInstallDate",
  acAge: "acInstallDate",
  electricalAge: "electricalInstallDate",
  plumbingAge: "plumbingInstallDate",
};

const DEFAULT_SYSTEM_IDS = ["roof", "gutters", "heating", "ac", "electrical", "plumbing"];

const SYSTEM_LABELS = {
  roof: "Roof",
  gutters: "Gutters",
  foundation: "Foundation",
  exterior: "Exterior",
  windows: "Windows",
  heating: "Heating",
  ac: "Air conditioning",
  waterHeating: "Water heating",
  electrical: "Electrical",
  plumbing: "Plumbing",
  safety: "Safety",
  inspections: "Inspections",
};

const MAX_GAP_ITEMS = 3;

module.exports = {
  IDENTITY_SECTIONS,
  FIELD_ALIASES,
  SYSTEM_SECTIONS,
  IS_NEW_INSTALL_FIELD_BY_SYSTEM,
  LAST_INSPECTION_FIELD_BY_SYSTEM,
  AGE_FROM_INSTALL_DATE,
  DEFAULT_SYSTEM_IDS,
  SYSTEM_LABELS,
  MAX_GAP_ITEMS,
};
