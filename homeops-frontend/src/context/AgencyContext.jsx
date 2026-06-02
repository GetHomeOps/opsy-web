import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";

const AgencyContext = createContext(null);

function paramsKey(params) {
  return JSON.stringify(params ?? {});
}

/** Session cache for paginated admin agency list — survives list page remounts. */
export function AgencyProvider({children}) {
  const cacheRef = useRef(null);

  const getListCache = useCallback((listParams) => {
    const cache = cacheRef.current;
    if (!cache?.hasLoadedOnce) return null;
    if (paramsKey(cache.listParams) !== paramsKey(listParams)) return null;
    return cache;
  }, []);

  const setListCache = useCallback((listParams, {agencies, total}) => {
    cacheRef.current = {
      ...(cacheRef.current ?? {}),
      listParams: {...listParams},
      agencies: agencies ?? [],
      total: total ?? 0,
      hasLoadedOnce: true,
    };
  }, []);

  const getFacetsCache = useCallback((facetParams) => {
    const cache = cacheRef.current;
    if (!cache?.facetsLoaded) return null;
    if (paramsKey(cache.facetParams) !== paramsKey(facetParams)) return null;
    return {
      states: cache.facetStates ?? [],
      cities: cache.facetCities ?? [],
    };
  }, []);

  const setFacetsCache = useCallback((facetParams, {states, cities}) => {
    cacheRef.current = {
      ...(cacheRef.current ?? {}),
      facetParams: {...facetParams},
      facetStates: states ?? [],
      facetCities: cities ?? [],
      facetsLoaded: true,
    };
  }, []);

  const getAgencyFromCache = useCallback((id) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return null;
    return (
      cacheRef.current?.agencies?.find((agency) => agency.id === numericId) ??
      null
    );
  }, []);

  const updateAgencyInListCache = useCallback((agency) => {
    if (!agency?.id || !cacheRef.current?.agencies) return;
    cacheRef.current.agencies = cacheRef.current.agencies.map((row) =>
      row.id === agency.id ? {...row, ...agency} : row,
    );
  }, []);

  const value = useMemo(
    () => ({
      getListCache,
      setListCache,
      getFacetsCache,
      setFacetsCache,
      getAgencyFromCache,
      updateAgencyInListCache,
    }),
    [
      getListCache,
      setListCache,
      getFacetsCache,
      setFacetsCache,
      getAgencyFromCache,
      updateAgencyInListCache,
    ],
  );

  return (
    <AgencyContext.Provider value={value}>{children}</AgencyContext.Provider>
  );
}

export function useAgencyListCache() {
  const ctx = useContext(AgencyContext);
  if (!ctx) {
    throw new Error("useAgencyListCache must be used within AgencyProvider");
  }
  return ctx;
}

export default AgencyContext;
