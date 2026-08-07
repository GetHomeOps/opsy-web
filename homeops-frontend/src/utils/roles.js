/** Platform role helpers shared across the frontend. */

export function normalizeRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function isAdminRole(role) {
  const r = normalizeRole(role);
  return r === "super_admin" || r === "admin";
}

export function isAgentRole(role) {
  return normalizeRole(role) === "agent";
}

export function isAssistantRole(role) {
  return normalizeRole(role) === "assistant";
}

/** Agents and tethered assistants share day-to-day workspace capabilities. */
export function isAgentLike(role) {
  const r = normalizeRole(role);
  return r === "agent" || r === "assistant";
}

/** Hide billing/subscription entry points for staff and assistants. */
export function shouldHideBilling(role) {
  return isAdminRole(role) || isAssistantRole(role);
}
