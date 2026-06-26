/** True when the app is served from the public demo site. */
export function isDemoSite() {
  return (
    typeof window !== "undefined" &&
    window.location.hostname === "demo.heyopsy.com"
  );
}

function normalizeRole(role) {
  return String(role || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

/** On demo, only super_admin may create users (backend enforces the same). */
export function canCreateUsersOnDemo(user) {
  if (!isDemoSite()) return true;
  const r = normalizeRole(user?.role);
  return r === "super_admin" || r === "superadmin";
}

/** On demo, only super_admin should see Users admin navigation. */
export function canAccessUsersOnDemo(user) {
  return canCreateUsersOnDemo(user);
}
