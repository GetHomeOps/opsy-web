import {useState, useCallback} from "react";
import AppApi from "../api/api";

const BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:3000";

/**
 * Upload a document with progress reporting.
 * Uses XMLHttpRequest for upload progress events.
 *
 * @param {Object} options
 * @param {(result: { key: string, url: string }) => void} [options.onSuccess]
 * @param {(error: string) => void} [options.onError]
 * @returns {{ uploadDocument: (file: File) => Promise<{ key: string, url: string } | null>, progress: number, isUploading: boolean, error: string | null, clearError: () => void }}
 */
export default function useDocumentUpload({onSuccess, onError} = {}) {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const uploadDocument = useCallback(
    (file) => {
      return new Promise((resolve) => {
        const token = AppApi.token;
        if (!token) {
          const msg = "Authentication required";
          setError(msg);
          onError?.(msg);
          resolve(null);
          return;
        }

        setProgress(0);
        setIsUploading(true);
        setError(null);

        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append("file", file);

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setProgress(pct);
          }
        });

        xhr.addEventListener("load", () => {
          setIsUploading(false);
          setProgress(100);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              const doc = res?.document ?? res;
              const key = doc?.key ?? doc?.s3Key ?? doc?.fileKey;
              const url = doc?.url ?? doc?.presignedUrl ?? doc?.presigned_url;
              if (key || url) {
                const result = {key: key ?? "", url: url ?? ""};
                onSuccess?.(result);
                resolve(result);
              } else {
                const msg = "Upload succeeded but no key/URL returned";
                setError(msg);
                onError?.(msg);
                resolve(null);
              }
            } catch (err) {
              const msg = err?.message || "Invalid response";
              setError(msg);
              onError?.(msg);
              resolve(null);
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              const msg = err?.error?.message || xhr.statusText || "Upload failed";
              setError(msg);
              onError?.(msg);
            } catch {
              setError(xhr.statusText || "Upload failed");
              onError?.(xhr.statusText || "Upload failed");
            }
            resolve(null);
          }
        });

        xhr.addEventListener("error", () => {
          setIsUploading(false);
          const msg = "Network error during upload";
          setError(msg);
          onError?.(msg);
          resolve(null);
        });

        xhr.addEventListener("abort", () => {
          setIsUploading(false);
          setError("Upload cancelled");
          resolve(null);
        });

        xhr.open("POST", `${BASE_URL}/documents/upload`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });
    },
    [onSuccess, onError],
  );

  return {uploadDocument, progress, isUploading, error, clearError};
}
