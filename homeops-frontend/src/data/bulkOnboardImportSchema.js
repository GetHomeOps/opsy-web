/**
 * Schema for admin bulk agent onboarding import.
 * One row = one property + primary homeowner (+ optional co-owner).
 * Extra homeowners: duplicate the address on another row with only homeowner fields.
 * Agent is selected in the wizard UI, not from the spreadsheet.
 */

export const BULK_ONBOARD_FIELDS = [
  { key: "property_name", label: "Property Name", required: false, type: "string" },
  { key: "address", label: "Address", required: true, type: "string" },
  { key: "city", label: "City", required: true, type: "string" },
  { key: "state", label: "State (2-letter)", required: true, type: "string" },
  { key: "zip", label: "Zip", required: true, type: "string" },
  { key: "homeowner_name", label: "Homeowner Name", required: false, type: "string" },
  { key: "homeowner_email", label: "Homeowner Email", required: true, type: "email" },
  { key: "homeowner_phone", label: "Homeowner Phone", required: false, type: "string" },
  { key: "homeowner_2_name", label: "Homeowner 2 Name", required: false, type: "string" },
  { key: "homeowner_2_email", label: "Homeowner 2 Email", required: false, type: "email" },
];

export const BULK_ONBOARD_KEYS = BULK_ONBOARD_FIELDS.map((f) => f.key);

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const STATE_CODE_REGEX = /^[A-Za-z]{2}$/;

function invalidStateCodeMessage(state) {
  const value = String(state || "").trim();
  return value
    ? `State must be a 2-letter code (e.g. HI), not "${value}"`
    : "State must be a 2-letter code (e.g. HI)";
}

const LABEL_TO_KEY = new Map();
BULK_ONBOARD_FIELDS.forEach(({ key, label }) => {
  const variants = [
    key,
    label,
    key.replace(/_/g, " "),
    label.toLowerCase(),
    key.toLowerCase(),
  ];
  variants.forEach((v) => {
    if (v && !LABEL_TO_KEY.has(v)) LABEL_TO_KEY.set(v, key);
  });
});
LABEL_TO_KEY.set("state", "state");
LABEL_TO_KEY.set("State", "state");
LABEL_TO_KEY.set("zip code", "zip");
LABEL_TO_KEY.set("postal code", "zip");
LABEL_TO_KEY.set("property", "property_name");
LABEL_TO_KEY.set("owner name", "homeowner_name");
LABEL_TO_KEY.set("owner email", "homeowner_email");
LABEL_TO_KEY.set("owner phone", "homeowner_phone");
LABEL_TO_KEY.set("co-owner name", "homeowner_2_name");
LABEL_TO_KEY.set("co-owner email", "homeowner_2_email");
LABEL_TO_KEY.set("homeowner 2 name", "homeowner_2_name");
LABEL_TO_KEY.set("homeowner 2 email", "homeowner_2_email");

export function normalizeHeader(header) {
  if (header == null) return null;
  const trimmed = String(header)
    .replace(/^\uFEFF/, "")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return LABEL_TO_KEY.get(trimmed) ?? LABEL_TO_KEY.get(lower) ?? null;
}

export function getTemplateRow() {
  return BULK_ONBOARD_KEYS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {});
}

export function getTemplateHeaders() {
  return BULK_ONBOARD_FIELDS.map((f) => f.label);
}

export function isValidEmail(value) {
  const email = String(value || "").trim();
  return Boolean(email) && EMAIL_REGEX.test(email);
}

/** Normalized address key for merging duplicate-address rows. */
export function normalizeAddressKey({ address, city, state, zip } = {}) {
  return [address, city, state, zip]
    .map((v) =>
      String(v ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
    )
    .join("|");
}

/**
 * Extract homeowner entries from a raw spreadsheet row.
 * @returns {{ name: string, email: string, phone: string }[]}
 */
export function extractHomeownersFromRow(row = {}) {
  const list = [];
  const primaryEmail = String(row.homeowner_email || "").trim();
  if (primaryEmail) {
    list.push({
      name: String(row.homeowner_name || "").trim(),
      email: primaryEmail,
      phone: String(row.homeowner_phone || "").trim(),
    });
  }
  const secondEmail = String(row.homeowner_2_email || "").trim();
  if (secondEmail) {
    list.push({
      name: String(row.homeowner_2_name || "").trim(),
      email: secondEmail,
      phone: "",
    });
  }
  return list;
}

/**
 * Validate a single spreadsheet row (before merge).
 * Address fields required; at least one homeowner email required unless this is
 * a merge-only duplicate address row (caller may relax that after merge).
 */
export function validateRow(row) {
  const errors = [];
  for (const field of BULK_ONBOARD_FIELDS.filter((f) => f.required && f.type !== "email")) {
    const val = String(row[field.key] ?? "").trim();
    if (!val) errors.push(`${field.label} is required`);
  }
  const state = String(row.state ?? "").trim();
  if (state && !STATE_CODE_REGEX.test(state)) {
    errors.push(invalidStateCodeMessage(state));
  }
  const homeowners = extractHomeownersFromRow(row);
  if (homeowners.length === 0) {
    errors.push("Homeowner Email is required");
  }
  for (const ho of homeowners) {
    if (!isValidEmail(ho.email)) {
      errors.push(`Invalid email: ${ho.email || "(empty)"}`);
    }
  }
  const e2 = String(row.homeowner_2_email || "").trim();
  if (e2 && !String(row.homeowner_email || "").trim()) {
    errors.push("Homeowner Email is required when Homeowner 2 Email is set");
  }
  return errors;
}

/**
 * Merge rows that share the same address into property groups with combined homeowners.
 * @returns {{
 *   groups: Array<{
 *     key: string,
 *     property_name: string,
 *     address: string,
 *     city: string,
 *     state: string,
 *     zip: string,
 *     homeowners: Array<{ name: string, email: string, phone: string }>,
 *     sourceRowIndexes: number[],
 *     errors: string[],
 *   }>,
 *   orphanErrors: Array<{ index: number, errors: string[] }>
 * }}
 */
export function mergeRowsByAddress(rows) {
  const groupsByKey = new Map();
  const orphanErrors = [];

  rows.forEach((row, index) => {
    const address = String(row.address || "").trim();
    const city = String(row.city || "").trim();
    const state = String(row.state || "").trim();
    const zip = String(row.zip || "").trim();
    const hasAddress = Boolean(address && city && state && zip);
    const homeowners = extractHomeownersFromRow(row);

    if (!hasAddress) {
      orphanErrors.push({
        index,
        errors: validateRow(row),
      });
      return;
    }

    const key = normalizeAddressKey({ address, city, state, zip });
    let group = groupsByKey.get(key);
    if (!group) {
      group = {
        key,
        property_name: String(row.property_name || "").trim(),
        address,
        city,
        state,
        zip,
        homeowners: [],
        sourceRowIndexes: [],
        errors: [],
      };
      groupsByKey.set(key, group);
    } else if (!group.property_name && row.property_name) {
      group.property_name = String(row.property_name || "").trim();
    }

    group.sourceRowIndexes.push(index);

    const seenEmails = new Set(
      group.homeowners.map((h) => h.email.trim().toLowerCase())
    );
    for (const ho of homeowners) {
      const emailLower = ho.email.trim().toLowerCase();
      if (!emailLower) continue;
      if (!isValidEmail(ho.email)) {
        group.errors.push(`Invalid email: ${ho.email}`);
        continue;
      }
      if (seenEmails.has(emailLower)) continue;
      seenEmails.add(emailLower);
      group.homeowners.push({
        name: ho.name,
        email: ho.email.trim(),
        phone: ho.phone || "",
      });
    }
  });

  const groups = Array.from(groupsByKey.values()).map((group) => {
    const errors = [...group.errors];
    const state = String(group.state || "").trim();
    if (state && !STATE_CODE_REGEX.test(state)) {
      errors.push(invalidStateCodeMessage(state));
    }
    if (group.homeowners.length === 0) {
      errors.push("At least one homeowner email is required");
    }
    return { ...group, errors };
  });

  return { groups, orphanErrors };
}

export default BULK_ONBOARD_FIELDS;
