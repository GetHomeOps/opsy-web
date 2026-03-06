import {useState, useEffect, useCallback} from "react";
import AppApi from "../api/api";
import {useAuth} from "../context/AuthContext";

const ADMIN_ROLES = ["super_admin", "admin"];

/**
 * Hook to fetch and cache billing status (plan, limits, usage).
 * Admin roles are always unrestricted.
 */
export default function useBillingStatus() {
  const {currentUser} = useAuth();
  const [state, setState] = useState({
    plan: null,
    limits: null,
    usage: null,
    loading: true,
    error: null,
  });

  const isAdmin = ADMIN_ROLES.includes(currentUser?.role);

  const refresh = useCallback(async () => {
    if (isAdmin) {
      setState({plan: null, limits: null, usage: null, loading: false, error: null});
      return;
    }
    try {
      setState((s) => ({...s, loading: true, error: null}));
      const res = await AppApi.getBillingStatus();
      setState({
        plan: res.plan || null,
        limits: res.limits || null,
        usage: res.usage || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setState((s) => ({...s, loading: false, error: err?.message || "Failed to load billing status"}));
    }
  }, [isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    refresh,
    isWithinLimit,
    getLimitInfo,
  };
}
