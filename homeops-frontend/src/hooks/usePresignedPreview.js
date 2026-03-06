import {useState, useCallback, useRef} from "react";
import AppApi from "../api/api";

// In-memory cache for presigned URLs (typically valid ~5 min). TTL 4 min to be safe.
const PRESIGNED_CACHE_TTL_MS = 4 * 60 * 1000;
const presignedCache = new Map();

function getCachedUrl(key) {
  const entry = presignedCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.url;
}

function setCachedUrl(key, url) {
  presignedCache.set(key, {url, expiresAt: Date.now() + PRESIGNED_CACHE_TTL_MS});
}

/**
 * Fetches a presigned URL for secure document preview.
 * Uses in-memory cache to avoid redundant API calls for recently viewed items.
 *
 * @returns {{ url: string | null, isLoading: boolean, error: string | null, fetchPreview: (key: string) => Promise<void>, clearError: () => void, clearUrl: () => void, refetch: () => Promise<void>, currentKey: string | null }}
 */
export default function usePresignedPreview() {
  const [url, setUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentKey, setCurrentKey] = useState(null);
  const fetchKeyRef = useRef(null);

  const clearError = useCallback(() => setError(null), []);

  const clearUrl = useCallback(() => {
    setUrl(null);
    setCurrentKey(null);
    fetchKeyRef.current = null;
  }, []);

  const fetchPreview = useCallback(async (key) => {
    const trimmedKey = key?.trim();
    if (!trimmedKey) {
      setError("Document key is required.");
      setUrl(null);
      return;
    }
    fetchKeyRef.current = trimmedKey;
    setCurrentKey(trimmedKey);
    setError(null);

    const cached = getCachedUrl(trimmedKey);
    if (cached) {
      setUrl(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setUrl(null);
    try {
      const presignedUrl = await AppApi.getPresignedPreviewUrl(trimmedKey);
      if (fetchKeyRef.current !== trimmedKey) return;
      setCachedUrl(trimmedKey, presignedUrl);
      setUrl(presignedUrl);
    } catch (err) {
      if (fetchKeyRef.current !== trimmedKey) return;
      const message = Array.isArray(err)
        ? err.join(", ")
        : err?.message || "Failed to load document preview.";
      setError(message);
      setUrl(null);
    } finally {
      if (fetchKeyRef.current === trimmedKey) {
        setIsLoading(false);
      }
    }
  }, []);

  const refetch = useCallback(async () => {
    if (currentKey) {
      await fetchPreview(currentKey);
    }
  }, [currentKey, fetchPreview]);

  return {url, isLoading, error, fetchPreview, clearError, clearUrl, refetch, currentKey};
}
