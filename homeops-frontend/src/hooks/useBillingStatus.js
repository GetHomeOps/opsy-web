import {useState, useEffect, useCallback} from "react";
import AppApi from "../api/api";
import {useAuth} from "../context/AuthContext";
import useCurrentAccount from "./useCurrentAccount";

const ADMIN_ROLES = ["super_admin", "admin"];

/** Module-level cache so Sidebar/Header/Shell share one billing fetch per account. */
const cacheByAccount = new Map();
/** In-flight promises keyed by accountId to dedupe concurrent requests. */
const inflightByAccount = new Map();

const EMPTY_STATUS = {
  plan: null,
  limits: null,
  usage: null,
  sponsorship: null,
  subscription: null,
};

function statusFromResponse(res) {
  return {
    plan: res.plan || null,
    limits: res.limits || null,
    usage: res.usage || null,
    sponsorship: res.sponsorship || null,
    subscription: res.subscription || null,
  };
}

function getCachedStatus(accountId) {
  if (accountId == null) return null;
  return cacheByAccount.get(accountId) ?? null;
}

function setCachedStatus(accountId, status) {
  if (accountId == null) return;
  cacheByAccount.set(accountId, status);
}

function clearCachedStatus(accountId) {
  if (accountId == null) {
    cacheByAccount.clear();
    inflightByAccount.clear();
    return;
  }
  cacheByAccount.delete(accountId);
  inflightByAccount.delete(accountId);
}

async function fetchBillingStatus(accountId, {bustCache = false} = {}) {
  if (bustCache) {
    clearCachedStatus(accountId);
  } else {
    const cached = getCachedStatus(accountId);
    if (cached) return cached;
  }

  const key = accountId ?? "__none__";
  const existing = inflightByAccount.get(key);
  if (existing) return existing;

  const promise = AppApi.getBillingStatus(accountId)
    .then((res) => {
      const status = statusFromResponse(res);
      setCachedStatus(accountId, status);
      return status;
    })
    .finally(() => {
      inflightByAccount.delete(key);
    });

  inflightByAccount.set(key, promise);
  return promise;
}

function initialState(isAdmin, accountId) {
  if (isAdmin) {
    return {...EMPTY_STATUS, loading: false, error: null};
  }
  const cached = getCachedStatus(accountId);
  if (cached) {
    return {...cached, loading: false, error: null};
  }
  return {...EMPTY_STATUS, loading: true, error: null};
}

/**
 * Hook to fetch and cache billing status (plan, limits, usage).
 * Admin roles are always unrestricted.
 * Shares a module-level cache across mounts so remounts (e.g. Scout shell)
 * do not re-block on GET /billing/status.
 */
export default function useBillingStatus() {
  const {currentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();

  const isAdmin = ADMIN_ROLES.includes(currentUser?.role);
  const accountId = currentAccount?.id;

  const [state, setState] = useState(() => initialState(isAdmin, accountId));

  const refresh = useCallback(
    async ({bustCache = false} = {}) => {
      if (isAdmin) {
        setState({...EMPTY_STATUS, loading: false, error: null});
        return;
      }
      try {
        const cached = !bustCache ? getCachedStatus(accountId) : null;
        if (!cached) {
          setState((s) => ({...s, loading: true, error: null}));
        }
        const status = await fetchBillingStatus(accountId, {bustCache});
        setState({...status, loading: false, error: null});
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err?.message || "Failed to load billing status",
        }));
      }
    },
    [isAdmin, accountId]
  );

  useEffect(() => {
    // Re-hydrate when account/role changes; use cache when available.
    setState(initialState(isAdmin, accountId));
    refresh();
  }, [isAdmin, accountId, refresh]);

  const isWithinLimit = useCallback(
    (limitKey, currentCount) => {
      if (isAdmin) return true;
      if (!state.limits) return true;
      const max = state.limits[limitKey];
      if (max == null) return true;
      return currentCount < max;
    },
    [isAdmin, state.limits]
  );

  const getLimitInfo = useCallback(
    (limitKey, currentCount) => {
      if (isAdmin) return {allowed: true, current: currentCount || 0, max: Infinity};
      const max = state.limits?.[limitKey];
      if (max == null) return {allowed: true, current: currentCount || 0, max: Infinity};
      return {allowed: (currentCount || 0) < max, current: currentCount || 0, max};
    },
    [isAdmin, state.limits]
  );

  return {
    ...state,
    isAdmin,
    refresh: () => refresh({bustCache: true}),
    isWithinLimit,
    getLimitInfo,
  };
}
