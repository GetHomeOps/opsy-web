"use strict";

/**
 * Renders SES email templates with {{mergeTag}} placeholders.
 */

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace {{key}} tags with values from data (HTML-safe values should be pre-escaped by builder). */
function renderTemplate(template, data) {
  if (!template) return "";
  let out = String(template);
  for (const [key, value] of Object.entries(data || {})) {
    const replacement = value == null ? "" : String(value);
    out = out.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g"), replacement);
  }
  return out;
}

/** Strip any remaining {{...}} merge tags after rendering. */
function stripUnusedMergeTags(html) {
  if (!html) return "";
  return String(html).replace(/\{\{\s*[^}]+\s*\}\}/g, "");
}

/** Reserved for future shared tags. Currently a no-op. */
function enrichMergeData(data = {}) {
  return { ...data };
}

module.exports = {
  renderTemplate,
  stripUnusedMergeTags,
  enrichMergeData,
};
