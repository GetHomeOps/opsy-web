import { useCallback, useEffect, useState } from "react";
import AppApi from "../api/api";
import { DOCUMENT_ANALYSIS_UPDATED_EVENT } from "../pages/properties/helpers/documentAnalysisFlow";

/**
 * Approved AI document finding counts per system_key for system card badges.
 */
export function useDocumentAnalysisCounts(propertyId) {
  const [countsBySystem, setCountsBySystem] = useState({});

  const load = useCallback(async () => {
    if (!propertyId) {
      setCountsBySystem({});
      return;
    }
    try {
      const items = await AppApi.getDocumentAnalysisByProperty(propertyId);
      const map = {};
      for (const item of items) {
        if (!item.systemKey) continue;
        const hasResult = item.reviewStatus != null || item.findings != null;
        const hasActiveJob =
          !hasResult &&
          item.status &&
          !["failed", "cancelled"].includes(item.status);
        if (hasResult || hasActiveJob) {
          map[item.systemKey] = (map[item.systemKey] || 0) + 1;
        }
      }
      setCountsBySystem(map);
    } catch {
      setCountsBySystem({});
    }
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined" || !propertyId) return;
    const handler = (e) => {
      if (String(e.detail?.propertyId) === String(propertyId)) load();
    };
    window.addEventListener(DOCUMENT_ANALYSIS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(DOCUMENT_ANALYSIS_UPDATED_EVENT, handler);
  }, [propertyId, load]);

  return countsBySystem;
}
