import {useState, useCallback} from "react";
import AppApi, { buildApiUrl } from "../api/api";
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  documentFileTooLargeMessage,
} from "../constants/documentUpload";
import { S3_UPLOAD_FOLDER } from "../constants/s3UploadFolders";
import {
  canUploadDocumentsOnDemo,
  DEMO_UPLOAD_UNAVAILABLE_MESSAGE,
} from "../utils/demoSite";

/**
 * Upload a single document to S3, reporting progress via `onProgress`.
 * Resolves with `{ key, url }` on success; rejects with an Error on failure.
 * Suitable for parallel uploads where each file needs independent progress.
 *
 * @param {File} file
 * @param {Object} [options]
 * @param {string} [options.uploadFolder]
 * @param {(pct: number) => void} [options.onProgress]
 * @returns {Promise<{ key: string, url: string }>}
 */
export function uploadDocumentFile(
  file,
  {uploadFolder = S3_UPLOAD_FOLDER.DOCUMENTS, onProgress} = {},
) {
  return new Promise((resolve, reject) => {
    const token = AppApi.token;
    if (!token) {
      reject(new Error("Authentication required"));
      return;
    }
    if (!canUploadDocumentsOnDemo()) {
      reject(new Error(DEMO_UPLOAD_UNAVAILABLE_MESSAGE));
      return;
    }
    if (
      file &&
      typeof file.size === "number" &&
      file.size > MAX_DOCUMENT_UPLOAD_BYTES
    ) {
      reject(new Error(documentFileTooLargeMessage()));
      return;
    }

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);
    if (uploadFolder) {
      formData.append("upload_folder", uploadFolder);
    }

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          const doc = res?.document ?? res;
          const key = doc?.key ?? doc?.s3Key ?? doc?.fileKey;
          const url = doc?.url ?? doc?.presignedUrl ?? doc?.presigned_url;
          if (key || url) {
            resolve({key: key ?? "", url: url ?? ""});
          } else {
            reject(new Error("Upload succeeded but no key/URL returned"));
          }
        } catch (err) {
          reject(new Error(err?.message || "Invalid response"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err?.error?.message || xhr.statusText || "Upload failed"));
        } catch {
          reject(new Error(xhr.statusText || "Upload failed"));
        }
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    xhr.open("POST", buildApiUrl("documents/upload").toString());
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}

/**
 * Upload a document with progress reporting.
 * Uses XMLHttpRequest for upload progress events.
 *
 * @param {Object} options
 * @param {(result: { key: string, url: string }) => void} [options.onSuccess]
 * @param {(error: string) => void} [options.onError]
 * @param {string} [options.uploadFolder] - S3 upload_folder (default: documents)
 * @returns {{ uploadDocument: (file: File) => Promise<{ key: string, url: string } | null>, progress: number, isUploading: boolean, error: string | null, clearError: () => void }}
 */
export default function useDocumentUpload({
  onSuccess,
  onError,
  uploadFolder = S3_UPLOAD_FOLDER.DOCUMENTS,
} = {}) {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const uploadDocument = useCallback(
    (file) => {
      setProgress(0);
      setIsUploading(true);
      setError(null);
      return uploadDocumentFile(file, {uploadFolder, onProgress: setProgress})
        .then((result) => {
          setIsUploading(false);
          setProgress(100);
          onSuccess?.(result);
          return result;
        })
        .catch((err) => {
          setIsUploading(false);
          const msg = err?.message || "Upload failed";
          setError(msg);
          onError?.(msg);
          return null;
        });
    },
    [onSuccess, onError, uploadFolder],
  );

  return {uploadDocument, progress, isUploading, error, clearError};
}
