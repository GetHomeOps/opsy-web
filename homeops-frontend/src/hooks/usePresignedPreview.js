import {useState, useCallback, useRef} from "react";
import AppApi from "../api/api";

// In-memory cache for presigned URLs (typically valid ~5 min). TTL 4 min to be safe.
const PRESIGNED_CACHE_TTL_MS = 4 * 60 * 1000;
const presignedCache = new Map();

function cacheKey(key, forImage) {
  return `${forImage ? "img:" : "doc:"}${key}`;
}

function getCachedUrl(key, forImage) {
  const entry = presignedCache.get(cacheKey(key, forImage));
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.url;
}

function setCachedUrl(key, url, forImage) {
  presignedCache.set(cacheKey(key, forImage), {
    url,
    expiresAt: Date.now() + PRESIGNED_CACHE_TTL_MS,
  });
}

/**
 * Fetches a presigned URL for secure document preview.
 * Uses in-memory cache to avoid redundant API calls for recently viewed items.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forImage=false] - Use inline-image URL (correct Content-Type; avoids ORB)
 * @returns {{ url: string | null, isLoading: boolean, error: string | null, fetchPreview: (key: string) => Promise<void>, clearError: () => void, clearUrl: () => void, refetch: () => Promise<void>, currentKey: string | null }}
 */
export default function usePresignedPreview({forImage = false} = {}) {
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

  const fetchPreview = useCallback(
    async (key) => {
      const trimmedKey = key?.trim();
      if (!trimmedKey) {
        setError("Document key is required.");
        setUrl(null);
        return;
      }
      fetchKeyRef.current = trimmedKey;
      setCurrentKey(trimmedKey);
      setError(null);

      const cached = getCachedUrl(trimmedKey, forImage);
      if (cached) {
        setUrl(cached);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setUrl(null);
      try {
        const presignedUrl = forImage
          ? await AppApi.getInlineImageUrl(trimmedKey)
          : await AppApi.getPresignedPreviewUrl(trimmedKey);
        if (fetchKeyRef.current !== trimmedKey) return;
        setCachedUrl(trimmedKey, presignedUrl, forImage);
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
    },
    [forImage],
  );

  const refetch = useCallback(async () => {
    if (currentKey) {
      await fetchPreview(currentKey);
    }
  }, [currentKey, fetchPreview]);

  return {
    url,
    isLoading,
    error,
    fetchPreview,
    clearError,
    clearUrl,
    refetch,
    currentKey,
  };
}
