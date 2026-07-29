/**
 * Short-lived in-memory cache for billing-gate results.
 * Survives React Strict Mode remounts and the BillingSuccess → home handoff
 * so ProtectedRoute does not flash home then re-show a spinner.
 */

const TTL_MS = 60_000;

/** @type {Map<string, {active: boolean, checkedAt: number}>} */
const cache = new Map();

function cacheKey(accountId, userId) {
  if (accountId != null && accountId !== "") return `account:${accountId}`;
  if (userId != null && userId !== "") return `user:${userId}`;
  return null;
}

/**
 * @param {string|number|null|undefined} accountId
 * @param {string|number|null|undefined} [userId]
 * @returns {{active: boolean, checkedAt: number}|null}
 */
export function getBillingGateCache(accountId, userId) {
  const key = cacheKey(accountId, userId);
  if (!key) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.checkedAt > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

/**
 * @param {string|number|null|undefined} accountId
 * @param {boolean} active
 * @param {string|number|null|undefined} [userId]
 */
export function setBillingGateCache(accountId, active, userId) {
  const key = cacheKey(accountId, userId);
  if (!key) return;
  cache.set(key, {active: !!active, checkedAt: Date.now()});
}
