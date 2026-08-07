import { useState, useCallback } from "react";
import AppApi from "../api/api";
import { compressImageForUpload } from "../utils/compressImage";
import { S3_UPLOAD_FOLDER } from "../constants/s3UploadFolders";

const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,image/gif";

/**
 * Reusable hook for uploading images to S3.
 * Handles validation, loading state, errors, and local preview.
 *
 * @param {Object} options
 * @param {(key: string, displayUrl?: string) => void} [options.onSuccess] - Called with S3 key and optional display URL
 * @param {(message: string) => void} [options.onError] - Called on validation or upload error
 * @param {string} [options.uploadFolder] - S3 upload_folder (default: general attachments / legacy `documents/`)
 * @param {boolean} [options.preserveTransparency=false] - Keep alpha when compressing (logos/icons)
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
export default function useImageUpload({
  onSuccess,
  onError,
  uploadFolder = S3_UPLOAD_FOLDER.DOCUMENTS,
  preserveTransparency = false,
} = {}) {
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
        // Logo crop already emits high-quality WebP with alpha — skip a second lossy pass.
        const alreadyCroppedWebp =
          preserveTransparency && file.type === "image/webp";
        const toUpload = alreadyCroppedWebp
          ? file
          : await compressImageForUpload(file, {
              preserveTransparency,
              ...(preserveTransparency
                ? { maxWidth: 2048, quality: 0.95 }
                : {}),
            });
        const document = await AppApi.uploadDocument(toUpload, { uploadFolder });
        const key =
          document?.key ??
          document?.s3Key ??
          document?.fileKey ??
          document?.objectKey ??
          document?.url;
        const displayUrl =
          document?.presignedUrl ??
          document?.presigned_url ??
          // Upload returns a permanent bucket URL that 403s on private buckets —
          // only treat it as displayable when it looks like a signed URL.
          (typeof document?.url === "string" &&
          (document.url.includes("X-Amz-") || document.url.includes("Signature="))
            ? document.url
            : null);

        if (key) {
          onSuccess?.(key, displayUrl ?? undefined);
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
    [onSuccess, onError, clearPreview, uploadFolder, preserveTransparency],
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
