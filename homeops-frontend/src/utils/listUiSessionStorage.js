const PREFIX = "opsy.listUi.v1:";

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
