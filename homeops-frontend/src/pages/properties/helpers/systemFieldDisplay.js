import { formatOverviewDate } from "../partials/passport/SystemsOverviewPanel";
import {
  getAgeFromInstallDate,
  formatAgeFromInstallDate,
} from "../constants/systemSections";
import {
  SYSTEM_FIELD_DEFINITIONS,
  SYSTEM_FIELDS_BY_ID,
  INSTALL_DATE_FIELD_BY_SYSTEM,
  INSPECTION_TOGGLE_FIELDS,
} from "../constants/systemFieldConfig";
import { STANDARD_CUSTOM_SYSTEM_FIELDS } from "../constants/propertySystems";

/** Group field names by card section for a standard system. */
export function groupFieldsBySystemId(systemId) {
  const fieldNames = SYSTEM_FIELDS_BY_ID[systemId] ?? [];
  const groups = { identity: [], condition: [], inspection: [], issues: [] };
  for (const name of fieldNames) {
    const def = SYSTEM_FIELD_DEFINITIONS[name];
    if (!def) continue;
    groups[def.group]?.push(name);
  }
  return groups;
}

/** Find the "next inspection / cleaning" field within inspection group. */
export function findNextInspectionFieldName(groups) {
  return groups.inspection?.find(
    (f) =>
      /NextInspection$/.test(f) ||
      /next cleaning/i.test(SYSTEM_FIELD_DEFINITIONS[f]?.label ?? ""),
  );
}

/** Format a raw property value for read-only display. */
export function formatSystemFieldDisplayValue(
  fieldName,
  definition,
  rawValue,
  resolveInstaller,
) {
  if (rawValue == null || String(rawValue).trim() === "") return null;
  if (definition?.type === "date") {
    return formatOverviewDate(rawValue) ?? rawValue;
  }
  if (definition?.type === "installer") {
    return resolveInstaller?.(rawValue) ?? rawValue;
  }
  if (definition?.type === "warranty-select") {
    return rawValue === "yes" ? "Yes" : rawValue === "no" ? "No" : rawValue;
  }
  return rawValue;
}

function conditionTone(condition) {
  const c = String(condition ?? "").toLowerCase();
  if (c === "excellent" || c === "good") return "emerald";
  if (c === "fair") return "amber";
  if (c === "poor") return "red";
  return "neutral";
}

export { conditionTone };

/** Contact id for an installer field when the raw value is a resolvable id. */
function installerContactId(definition, rawValue, displayedValue) {
  if (definition?.type !== "installer") return null;
  if (displayedValue == null || String(displayedValue).trim() === "") return null;
  if (rawValue == null || String(rawValue).trim() === "") return null;
  if (Number.isNaN(Number(rawValue))) return null;
  /* Unresolved ids fall back to the raw id as the display value — no link */
  if (String(displayedValue) === String(rawValue)) return null;
  return rawValue;
}

/** Build { label, value } items for a standard system read-only overview. */
export function buildStandardSystemReadOnlyGroups(
  systemId,
  propertyData,
  resolveInstaller,
) {
  const groups = groupFieldsBySystemId(systemId);
  const installDateField = INSTALL_DATE_FIELD_BY_SYSTEM[systemId];
  const result = { identity: [], condition: [], inspection: [], issues: [] };

  for (const groupKey of ["identity", "condition", "inspection", "issues"]) {
    for (const fieldName of groups[groupKey] ?? []) {
      const def = SYSTEM_FIELD_DEFINITIONS[fieldName];
      if (!def) continue;
      const rawValue = propertyData?.[fieldName];
      const value = formatSystemFieldDisplayValue(
        fieldName,
        def,
        rawValue,
        resolveInstaller,
      );
      result[groupKey].push({
        fieldName,
        label: def.label,
        value,
        contactId: installerContactId(def, rawValue, value),
        isCondition: /condition/i.test(def.label) && def.type === "select",
      });
    }
  }

  if (installDateField) {
    result.identity.push({
      fieldName: "__age__",
      label: "Age",
      value: formatAgeFromInstallDate(
        getAgeFromInstallDate(propertyData?.[installDateField]),
      ),
      isCondition: false,
    });
  }

  return result;
}

const CUSTOM_GROUP_FOR_KEY = {
  material: "identity",
  installDate: "identity",
  installer: "identity",
  age: "identity",
  condition: "condition",
  warranty: "condition",
  lastInspection: "inspection",
  nextInspection: "inspection",
  issues: "issues",
};

/** Build read-only groups for a custom system. */
export function buildCustomSystemReadOnlyGroups(
  systemData,
  resolveInstaller,
) {
  const result = { identity: [], condition: [], inspection: [], issues: [] };

  for (const field of STANDARD_CUSTOM_SYSTEM_FIELDS) {
    const groupKey = CUSTOM_GROUP_FOR_KEY[field.key] ?? "identity";
    let value;
    if (field.type === "computed-age") {
      value = formatAgeFromInstallDate(
        getAgeFromInstallDate(systemData.installDate),
      );
    } else {
      const raw = systemData[field.key];
      if (field.type === "date") {
        value = formatOverviewDate(raw) ?? raw;
      } else if (field.type === "installer") {
        value = resolveInstaller?.(raw) ?? raw;
      } else if (field.type === "warranty-select") {
        value =
          raw === "yes" ? "Yes" : raw === "no" ? "No" : raw ?? null;
      } else {
        value = raw;
      }
      if (value != null && String(value).trim() === "") value = null;
    }
    result[groupKey].push({
      fieldName: field.key,
      label: field.label,
      value,
      contactId: installerContactId(field, systemData[field.key], value),
      isCondition: field.key === "condition",
    });
  }

  return result;
}

/** Build read-only rows for the inspections system. */
export function buildInspectionsReadOnlyGroups(propertyData) {
  const identity = INSPECTION_TOGGLE_FIELDS.map(({ toggle, date, link, label }) => {
    const yes = propertyData?.[toggle] === "yes";
    const no = propertyData?.[toggle] === "no";
    let value = null;
    if (yes) {
      const dateStr = formatOverviewDate(propertyData?.[date]) ?? propertyData?.[date];
      const linkStr = propertyData?.[link];
      value = [dateStr, linkStr].filter(Boolean).join(" · ") || "Yes";
    } else if (no) {
      value = "No";
    }
    return { fieldName: toggle, label, value, isCondition: false };
  });
  return { identity, condition: [], inspection: [], issues: [] };
}
