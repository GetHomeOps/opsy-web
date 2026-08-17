import { useCallback, useEffect, useState } from "react";
import AppApi from "../api/api";
import { useAuth } from "../context/AuthContext";
import { isAdminRole } from "../utils/roles";
import {
  DOCUMENT_ANALYSIS_UPDATED_EVENT,
  MAX_DOCUMENT_ANALYSIS_RUNS,
  getDocumentAnalysisUiState,
} from "../pages/properties/helpers/documentAnalysisFlow";

function isCompletedAnalysisItem(item) {
  return item?.reviewStatus != null || item?.status === "completed";
}

/**
 * Per-document AI analysis status for property documents (preview actions, etc.).
 */
export function useDocumentAnalysisStatus(propertyId) {
  const { currentUser } = useAuth();
  const isAdmin = isAdminRole(currentUser?.role);
  const [byDocumentId, setByDocumentId] = useState({});

  const load = useCallback(async () => {
    if (!propertyId) {
      setByDocumentId({});
      return;
    }
    try {
      const items = await AppApi.getDocumentAnalysisByProperty(propertyId);
      const completedCounts = {};
      const map = {};
      for (const item of items) {
        const docId = item.propertyDocumentId;
        if (!docId) continue;
        if (typeof item.completedRunCount === "number") {
          if (completedCounts[docId] == null) {
            completedCounts[docId] = item.completedRunCount;
          }
        } else if (isCompletedAnalysisItem(item)) {
          completedCounts[docId] = (completedCounts[docId] || 0) + 1;
        }
        if (!map[docId]) {
          map[docId] = item;
        }
      }
      for (const docId of Object.keys(map)) {
        map[docId] = {
          ...map[docId],
          completedRunCount:
            completedCounts[docId] ?? map[docId].completedRunCount ?? 0,
          maxAnalysisRuns:
            map[docId].maxAnalysisRuns ?? MAX_DOCUMENT_ANALYSIS_RUNS,
        };
      }
      setByDocumentId(map);
    } catch {
      setByDocumentId({});
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

  const getUiState = useCallback(
    (documentId) =>
      getDocumentAnalysisUiState(byDocumentId[documentId], { isAdmin }),
    [byDocumentId, isAdmin],
  );

  const getAnalysisItem = useCallback(
    (documentId) => byDocumentId[documentId] ?? null,
    [byDocumentId],
  );

  return { getUiState, getAnalysisItem, refresh: load };
}
