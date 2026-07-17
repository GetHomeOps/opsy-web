import React, {useEffect, useRef, useState} from "react";
import ImageUploadField from "../../components/ImageUploadField";
import useImageUpload from "../../hooks/useImageUpload";
import usePresignedPreview from "../../hooks/usePresignedPreview";
import AppApi, {getApiErrorMessage} from "../../api/api";
import {S3_UPLOAD_FOLDER} from "../../constants/s3UploadFolders";
import {MapPin} from "lucide-react";
import {StatusBadge} from "../properties/partials/passport/StatusBadge";
import {PASSPORT_CARD_SHADOW} from "../properties/partials/passport/SectionCard";
import house3 from "../../images/house3.png";
import house4 from "../../images/house4.png";
import house5 from "../../images/house5.png";
import {
  CONDITION_BADGE,
  formatAddress,
  formatDisplayName,
} from "./prePurchaseUtils";

const HOUSE_PLACEHOLDERS = [house3, house4, house5];

/** Stable per-analysis pick so the same property keeps the same illustration. */
function pickHousePlaceholder(seed) {
  const str = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return HOUSE_PLACEHOLDERS[hash % HOUSE_PLACEHOLDERS.length];
}

function formatAnalysisDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Pre-purchase analysis hero: compact photo + identity + meta.
 * Convert / Share / Download live in the top Actions menu.
 */
export default function PrePurchaseAnalysisHeader({analysis, onPhotoChanged}) {
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoKey, setPhotoKey] = useState(analysis?.photoKey || null);
  const [photoError, setPhotoError] = useState(null);

  const {
    url: photoPreviewUrl,
    isLoading: photoLoading,
    fetchPreview,
    clearUrl: clearPhotoPreview,
  } = usePresignedPreview({forImage: true});

  const {
    uploadImage,
    imagePreviewUrl,
    imageUploading,
    imageUploadError,
    setImageUploadError,
    clearPreview,
  } = useImageUpload({
    uploadFolder: S3_UPLOAD_FOLDER.PROPERTY_PHOTOS,
    onSuccess: async (key) => {
      if (!analysis?.id) return;
      try {
        const updated = await AppApi.updatePrePurchaseAnalysis(analysis.id, {
          photoKey: key,
        });
        setPhotoKey(updated?.photoKey || key);
        onPhotoChanged?.(updated);
      } catch (err) {
        setPhotoError(getApiErrorMessage(err, "Failed to save photo."));
      }
    },
    onError: (msg) => setPhotoError(msg),
  });

  useEffect(() => {
    setPhotoKey(analysis?.photoKey || null);
  }, [analysis?.photoKey, analysis?.id]);

  useEffect(() => {
    if (photoKey) {
      fetchPreview(photoKey);
    } else {
      clearPhotoPreview();
    }
  }, [photoKey, fetchPreview, clearPhotoPreview]);

  async function handleRemovePhoto() {
    if (!analysis?.id) return;
    setPhotoError(null);
    try {
      const updated = await AppApi.updatePrePurchaseAnalysis(analysis.id, {
        photoKey: null,
      });
      setPhotoKey(null);
      clearPreview();
      clearPhotoPreview();
      onPhotoChanged?.(updated);
    } catch (err) {
      setPhotoError(getApiErrorMessage(err, "Failed to remove photo."));
    }
  }

  const heroImageUrl = imagePreviewUrl || photoPreviewUrl;
  const displayError = photoError || imageUploadError;
  const housePlaceholder = pickHousePlaceholder(analysis?.id);

  return (
    <section
      className="rounded-2xl overflow-hidden border border-neutral-200/80 bg-white dark:border-neutral-700/50 dark:bg-neutral-900"
      style={{boxShadow: PASSPORT_CARD_SHADOW}}
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="w-full sm:w-52 md:w-60 lg:w-72 shrink-0 px-4 pt-4 pb-2 sm:p-4 sm:pr-0 sm:flex sm:items-center">
          <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-[#3d6b6a] border border-neutral-200/80 dark:border-neutral-600/50 shadow-sm">
            <div className="absolute inset-0">
              <ImageUploadField
                imageSrc={heroImageUrl}
                hasImage={Boolean(heroImageUrl)}
                imageUploading={imageUploading}
                imageLoading={Boolean(photoKey) && photoLoading && !imagePreviewUrl}
                onUpload={uploadImage}
                onRemove={handleRemovePhoto}
                showRemove={Boolean(photoKey || imagePreviewUrl)}
                imageUploadError={displayError}
                onDismissError={() => {
                  setPhotoError(null);
                  setImageUploadError(null);
                }}
                size="xl"
                placeholder="generic"
                alt={formatDisplayName(analysis)}
                emptyBackgroundSrc={!heroImageUrl ? housePlaceholder : undefined}
                showEmptyUploadButton={false}
                emptyLabel="Add photo"
                fileInputRef={fileInputRef}
                menuOpen={menuOpen}
                onMenuToggle={setMenuOpen}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center px-4 md:px-6 py-4 gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white truncate">
            {formatDisplayName(analysis)}
          </h1>
          <p className="flex items-start gap-1.5 text-sm text-neutral-500">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
            <span>{formatAddress(analysis) || "Address not set"}</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-1">
            {analysis.overallConditionRating && (
              <StatusBadge
                tone={
                  CONDITION_BADGE[analysis.overallConditionRating] || "neutral"
                }
                className="capitalize"
              >
                {analysis.overallConditionRating}
              </StatusBadge>
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                Analysis Date
              </span>
              <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                {formatAnalysisDate(
                  analysis.completedAt ||
                    analysis.startedAt ||
                    analysis.createdAt
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
