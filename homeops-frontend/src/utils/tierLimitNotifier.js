const listeners = new Set();

export function onTierLimit(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function emitTierLimit({ message, status }) {
  for (const fn of listeners) {
    try {
      fn({ message, status });
    } catch {
      // listener threw — don't break others
    }
  }
}

const TIER_KEYWORDS = ["quota", "limit reached", "upgrade your plan", "upgrade to"];

export function isTierRestrictionError(status, message) {
  if (status !== 403 || !message) return false;
  const lower = message.toLowerCase();
  return TIER_KEYWORDS.some((kw) => lower.includes(kw));
}
