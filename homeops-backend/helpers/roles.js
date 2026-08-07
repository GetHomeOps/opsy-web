"use strict";

/** Platform role helpers shared across routes and services. */

function normalizeRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isAdminRole(role) {
  const r = normalizeRole(role);
  return r === "super_admin" || r === "admin";
}

function isAgentRole(role) {
  return normalizeRole(role) === "agent";
}

function isAssistantRole(role) {
  return normalizeRole(role) === "assistant";
}

/** Agents and their tethered assistants share day-to-day workspace capabilities. */
function isAgentLike(role) {
  const r = normalizeRole(role);
  return r === "agent" || r === "assistant";
}

module.exports = {
  normalizeRole,
  isAdminRole,
  isAgentRole,
  isAssistantRole,
  isAgentLike,
};
