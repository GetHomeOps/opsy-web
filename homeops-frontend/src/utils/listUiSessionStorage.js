const PREFIX = "opsy.listUi.v1:";

// Clear saved list UI on every full page load / reload so filters start fresh.
// Module-level code only runs once per bundle load; in-app navigations reuse the
// already-loaded module, so this won't fire during SPA route changes.
try {
  if (typeof sessionStorage !== "undefined") {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  }
} catch {
  /* private mode / SSR */
}

export function readListUiSession(scopeId) {
  if (!scopeId || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + scopeId);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

export function writeListUiSession(scopeId, data) {
  if (!scopeId || typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + scopeId, JSON.stringify(data));
  } catch {
    /* quota or private mode */
  }
}
