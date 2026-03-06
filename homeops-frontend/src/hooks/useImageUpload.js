import { useState, useCallback } from "react";
import AppApi from "../api/api";
import { compressImageForUpload } from "../utils/compressImage";

const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,image/gif";

/**
 * Reusable hook for uploading images to S3.
 * Handles validation, loading state, errors, and local preview.
 *
 * @param {Object} options
 * @param {(key: string, displayUrl?: string) => void} [options.onSuccess] - Called with S3 key and optional display URL
 * @param {(message: string) => void} [options.onError] - Called on validation or upload error
 * @returns {{
 *   uploadImage: (file: File) => Promise<void>,
 *   imagePreviewUrl: string | null,
 *   uploadedImageUrl: string | null,
 *   imageUploading: boolean,
 *   imageUploadError: string | null,
 *   setImageUploadError: (msg: string | null) => void,
 *   clearPreview: () => void,
 *   clearUploadedUrl: () => void,
 *   accept: string,
 * }}
 */
export default function useImageUpload({ onSuccess, onError } = {}) {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState(null);

  const clearPreview = useCallback(() => {
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const clearUploadedUrl = useCallback(() => {
    setUploadedImageUrl(null);
  }, []);

  const uploadImage = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) {
        const msg = "Please select an image file (JPEG, PNG, WebP)";
        setImageUploadError(msg);
        onError?.(msg);
        return;
      }

      clearPreview();
      setImagePreviewUrl(URL.createObjectURL(file));
      setUploadedImageUrl(null);
      setImageUploading(true);
      setImageUploadError(null);

      try {
        const toUpload = await compressImageForUpload(file);
        const document = await AppApi.uploadDocument(toUpload);
        const key =
          document?.key ??
          document?.s3Key ??
          document?.fileKey ??
          document?.objectKey ??
          document?.url;
        const displayUrl =
          document?.url ??
          document?.presignedUrl ??
          document?.presigned_url;

        if (key) {
          onSuccess?.(key, displayUrl);
          if (displayUrl) {
            setUploadedImageUrl(displayUrl);
          }
        } else {
          const msg = "Upload succeeded but no key/URL was returned";
          setImageUploadError(msg);
          onError?.(msg);
        }
      } catch (err) {
        const msg =
          Array.isArray(err) ? err.join(", ") : err?.message || "Upload failed";
        setImageUploadError(msg);
        onError?.(msg);
      } finally {
        setImageUploading(false);
      }
    },
    [onSuccess, onError, clearPreview],
  );

  return {
    uploadImage,
    imagePreviewUrl,
    uploadedImageUrl,
    imageUploading,
    imageUploadError,
    setImageUploadError,
    clearPreview,
    clearUploadedUrl,
    accept: ACCEPT_IMAGE,
  };
}
