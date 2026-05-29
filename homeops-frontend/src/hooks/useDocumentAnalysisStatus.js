import { useCallback, useEffect, useState } from "react";
import AppApi from "../api/api";
import {
  DOCUMENT_ANALYSIS_UPDATED_EVENT,
  getDocumentAnalysisUiState,
} from "../pages/properties/helpers/documentAnalysisFlow";

/**
 * Per-document AI analysis status for property documents (preview actions, etc.).
 */
export function useDocumentAnalysisStatus(propertyId) {
  const [byDocumentId, setByDocumentId] = useState({});

  const load = useCallback(async () => {
    if (!propertyId) {
      setByDocumentId({});
      return;
    }
    try {
      const items = await AppApi.getDocumentAnalysisByProperty(propertyId);
      const map = {};
      for (const item of items) {
        const docId = item.propertyDocumentId;
        if (!docId || map[docId]) continue;
        map[docId] = item;
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
    (documentId) => getDocumentAnalysisUiState(byDocumentId[documentId]),
    [byDocumentId],
  );

  const getAnalysisItem = useCallback(
    (documentId) => byDocumentId[documentId] ?? null,
    [byDocumentId],
  );

  return { getUiState, getAnalysisItem, refresh: load };
}
