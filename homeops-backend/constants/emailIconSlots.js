"use strict";

/**
 * Optional PNG icons uploaded per email template (S3) and sent as Customer.io merge fields.
 * @type {Record<string, { key: string, label: string, description?: string }[]>}
 */
const CUSTOMER_IO_ICON_SLOTS_BY_TYPE = {
  property_invitation: [
    {
      key: "emailIconPlace",
      label: "“Everything in one place”",
      description: "20×20 PNG for the first feature row",
    },
    {
      key: "emailIconAlert",
      label: "“A heads-up before it's urgent”",
      description: "20×20 PNG for the second feature row",
    },
    {
      key: "emailIconHome",
      label: "“Agent stays in the picture”",
      description: "20×20 PNG for the third feature row",
    },
  ],
};

function getCustomerIoIconSlots(emailType) {
  return CUSTOMER_IO_ICON_SLOTS_BY_TYPE[emailType] || [];
}

function isAllowedCustomerIoIconSlot(emailType, slotKey) {
  return getCustomerIoIconSlots(emailType).some((s) => s.key === slotKey);
}

/**
 * @param {string} emailType
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
function normalizeCustomerIoIcons(emailType, value) {
  const allowed = new Set(getCustomerIoIconSlots(emailType).map((s) => s.key));
  if (!allowed.size) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!allowed.has(key)) continue;
    const url = raw == null ? "" : String(raw).trim();
    if (url) out[key] = url;
  }
  return out;
}

module.exports = {
  CUSTOMER_IO_ICON_SLOTS_BY_TYPE,
  getCustomerIoIconSlots,
  isAllowedCustomerIoIconSlot,
  normalizeCustomerIoIcons,
};
