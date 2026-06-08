import React, {useCallback, useState} from "react";
import ImageUploadField from "../../components/ImageUploadField";
import AppApi from "../../api/api";
import {compressImageForUpload} from "../../utils/compressImage";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";

/**
 * Upload + preview for one Customer.io template icon (S3 email_assets).
 */
export default function EmailCustomerIoIconSlot({
  emailType,
  slot,
  imageUrl,
  disabled,
  onUrlChange,
  onError,
}) {
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState(null);

  const clearPreview = useCallback(() => {
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const handleUpload = useCallback(
    async (file) => {
      if (!file?.type?.startsWith("image/")) {
        const msg = "Please select an image file (PNG, JPEG, or WebP).";
        setImageUploadError(msg);
        onError?.(msg);
        return;
      }
      clearPreview();
      setImagePreviewUrl(URL.createObjectURL(file));
      setImageUploading(true);
      setImageUploadError(null);
      try {
        const toUpload = await compressImageForUpload(file);
        const document = await AppApi.uploadDocument(toUpload, {
          uploadFolder: S3_UPLOAD_FOLDER.EMAIL_ASSETS,
          emailType,
          iconSlot: slot.key,
        });
        const displayUrl =
          document?.url ??
          document?.presignedUrl ??
          document?.presigned_url;
        if (!displayUrl) {
          throw new Error("Upload succeeded but no URL was returned.");
        }
        clearPreview();
        onUrlChange?.(slot.key, displayUrl);
      } catch (err) {
        const msg = err?.message || "Icon upload failed.";
        setImageUploadError(msg);
        onError?.(msg);
      } finally {
        setImageUploading(false);
      }
    },
    [clearPreview, emailType, onError, onUrlChange, slot.key],
  );

  const displaySrc = imagePreviewUrl || imageUrl || null;
  const hasImage = Boolean(displaySrc);
  const liquid = `{{event.${slot.key}}}`;

  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900/50 p-2.5 flex flex-col gap-1.5 min-h-0">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-medium text-gray-800 dark:text-gray-100 leading-snug">
          {slot.label}
        </p>
        {slot.description ? (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
            {slot.description}
          </p>
        ) : null}
        <p className="text-[10px] font-mono text-[#456564] dark:text-emerald-300 break-all">
          {liquid}
        </p>
      </div>
      <ImageUploadField
        size="xs"
        placeholder="generic"
        alt={slot.label}
        imageSrc={displaySrc}
        hasImage={hasImage}
        imageUploading={imageUploading}
        onUpload={handleUpload}
        onRemove={
          hasImage && !disabled
            ? () => {
                clearPreview();
                onUrlChange?.(slot.key, "");
              }
            : undefined
        }
        showRemove={hasImage && !disabled}
        imageUploadError={imageUploadError}
        onDismissError={() => setImageUploadError(null)}
        uploadLabel="Upload"
        removeLabel="Remove"
      />
    </div>
  );
}
