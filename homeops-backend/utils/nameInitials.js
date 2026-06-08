"use strict";

/**
 * Two-letter initials from a display name (first + last word), matching app avatar fallbacks.
 * @param {string} name
 * @param {number} [maxLen=2]
 * @returns {string}
 */
function initialsFromFullName(name, maxLen = 2) {
  if (!name || typeof name !== "string") return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) {
    return parts[0].slice(0, maxLen).toUpperCase();
  }
  const letters = `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`;
  return letters.slice(0, maxLen).toUpperCase();
}

module.exports = { initialsFromFullName };
