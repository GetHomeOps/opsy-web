"use strict";

const { normalizeCustomerIoIcons } = require("../constants/emailIconSlots");

/**
 * Merge configured S3 icon URLs into outbound email / Customer.io payload.
 * @param {string} emailType
 * @param {Object} mergeData
 * @param {Record<string, string>|null|undefined} customerIoIcons
 */
function attachTemplateIconMergeData(emailType, mergeData, customerIoIcons) {
  const icons = normalizeCustomerIoIcons(emailType, customerIoIcons);
  if (!Object.keys(icons).length) return { ...mergeData };
  return { ...mergeData, ...icons };
}

/**
 * Sample / preview icon keys (empty strings when not configured).
 * @param {string} emailType
 */
function emptyIconMergeDefaults(emailType) {
  const { getCustomerIoIconSlots } = require("../constants/emailIconSlots");
  const out = {};
  for (const slot of getCustomerIoIconSlots(emailType)) {
    out[slot.key] = "";
  }
  return out;
}

module.exports = {
  attachTemplateIconMergeData,
  emptyIconMergeDefaults,
};
