import {useLayoutEffect, useEffect, useRef} from "react";
import {
  readListUiSession,
  writeListUiSession,
} from "../utils/listUiSessionStorage";

/** Dispatched to merge saved list UI (search, filters, pagination) after mount. */
export const HYDRATE_LIST_UI = "HYDRATE_LIST_UI";

/**
 * Restores list search / filters / pagination from sessionStorage when the list
 * remounts (e.g. back from a detail view), and keeps them in sync while the list
 * is visible. Scoped per account via `scopeId`.
 */
export default function usePersistListUiSession(
  scopeId,
  {
    dispatch,
    searchTerm,
    activeFilters,
    itemsPerPage,
    currentPage,
    sortConfig,
    setSortConfig,
  },
) {
  // Guard: skip the first write so the initial empty state doesn't overwrite
  // saved filters before hydration settles into the reducer.
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    mountedRef.current = false;
    if (!scopeId) return;
    const raw = readListUiSession(scopeId);
    if (!raw || typeof raw !== "object") return;
    const payload = {};
    if (typeof raw.searchTerm === "string") payload.searchTerm = raw.searchTerm;
    if (Array.isArray(raw.activeFilters))
      payload.activeFilters = raw.activeFilters;
    if (Number.isFinite(Number(raw.itemsPerPage)))
      payload.itemsPerPage = Number(raw.itemsPerPage);
    if (Number.isFinite(Number(raw.currentPage)))
      payload.currentPage = Number(raw.currentPage);
    if (Object.keys(payload).length > 0) {
      dispatch({type: HYDRATE_LIST_UI, payload});
    }
    if (setSortConfig && raw.sortConfig && typeof raw.sortConfig === "object") {
      setSortConfig({
        key: raw.sortConfig.key ?? null,
        direction:
          raw.sortConfig.direction === "desc"
            ? "desc"
            : raw.sortConfig.direction === "asc"
              ? "asc"
              : null,
      });
    }
  }, [scopeId, dispatch, setSortConfig]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (!scopeId) return;
    const blob = {
      searchTerm,
      activeFilters,
      itemsPerPage,
      currentPage,
    };
    if (sortConfig !== undefined) blob.sortConfig = sortConfig;
    writeListUiSession(scopeId, blob);
  }, [
    scopeId,
    searchTerm,
    activeFilters,
    itemsPerPage,
    currentPage,
    sortConfig,
  ]);
}
