/** True when the app is served from the public demo site. */
export function isDemoSite() {
  return (
    typeof window !== "undefined" &&
    window.location.hostname === "demo.heyopsy.com"
  );
}

export const DEMO_UPLOAD_UNAVAILABLE_TITLE = "Document upload not available on demo";

export const DEMO_UPLOAD_UNAVAILABLE_MESSAGE =
  "Document upload is not available on the demo site. A full HeyOpsy account includes secure document storage — upload inspection reports, warranties, and receipts organized by home system.";

export const DEMO_AI_UNAVAILABLE_TITLE = "AI features not available on demo";

export const DEMO_AI_UNAVAILABLE_MESSAGE =
  "AI features are not available on the demo site. A full HeyOpsy account includes the Opsy assistant, AI inspection analysis, and AI-powered maintenance insights.";

/** On demo, document upload is disabled for all users. */
export function canUploadDocumentsOnDemo() {
  return !isDemoSite();
}

/** On demo, AI features are disabled for all users. */
export function canUseAiOnDemo() {
  return !isDemoSite();
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
