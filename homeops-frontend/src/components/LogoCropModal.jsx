import React, {useCallback, useEffect, useState} from "react";
import Cropper from "react-easy-crop";
import {Loader2} from "lucide-react";
import ModalBlank from "./ModalBlank";
import {cropLogoImage, cropLogoPreviewDataUrl} from "../utils/cropLogoImage";

/**
 * Modal to crop a logo before upload, with optional near-white background removal.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string|null} props.imageSrc - Object URL of the selected file
 * @param {string} [props.accentColor='#254f48'] - Backdrop color for transparency preview
 * @param {(file: File) => void|Promise<void>} props.onConfirm - Receives cropped WebP File
 */
function LogoCropModal({
  open,
  onClose,
  imageSrc,
  accentColor = "#254f48",
  onConfirm,
}) {
  const [crop, setCrop] = useState({x: 0, y: 0});
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [removeWhiteBackground, setRemoveWhiteBackground] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  // Reset state when a new image opens
  useEffect(() => {
    if (!open || !imageSrc) return;
    setCrop({x: 0, y: 0});
    setZoom(1);
    setCroppedAreaPixels(null);
    setRemoveWhiteBackground(false);
    setError(null);
    setSaving(false);
  }, [open, imageSrc]);

  // Live preview of crop (+ optional white punch-out) on accent backdrop
  useEffect(() => {
    if (!open || !imageSrc || !croppedAreaPixels) return;

    let cancelled = false;
    setPreviewLoading(true);

    const timer = setTimeout(async () => {
      try {
        const url = await cropLogoPreviewDataUrl(
          imageSrc,
          croppedAreaPixels,
          removeWhiteBackground,
        );
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        if (!cancelled) setPreviewUrl(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, imageSrc, croppedAreaPixels, removeWhiteBackground]);

  // Cleanup preview URL on unmount / close
  useEffect(() => {
    if (open) return;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open]);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels || saving) return;
    setSaving(true);
    setError(null);
    try {
      const file = await cropLogoImage(imageSrc, croppedAreaPixels, {
        removeWhiteBackground,
        fileName: "logo.webp",
      });
      await onConfirm(file);
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to crop logo");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  return (
    <ModalBlank
      id="logo-crop-modal"
      modalOpen={open}
      setModalOpen={(v) => {
        if (!v) handleClose();
      }}
      closeOnClickOutside={!saving}
      closeOnBackdropClick={!saving}
      closeOnEscape={!saving}
      contentClassName="max-w-lg"
    >
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Crop logo
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Adjust the crop, then optionally remove a white background so the logo
          sits cleanly on your accent color.
        </p>

        <div className="mt-4 relative w-full h-64 sm:h-72 rounded-lg overflow-hidden bg-gray-900">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              showGrid
            />
          ) : null}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="logo-crop-zoom"
              className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5"
            >
              Zoom
            </label>
            <input
              id="logo-crop-zoom"
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[var(--opsy-accent,#254f48)]"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-300 text-[var(--opsy-accent,#254f48)] focus:ring-[var(--opsy-accent,#254f48)]"
              checked={removeWhiteBackground}
              onChange={(e) => setRemoveWhiteBackground(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">
                Remove white background
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Punch out near-white pixels so solid white plates become
                transparent. Best for logos exported on a white rectangle.
              </span>
            </span>
          </label>

          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Preview on accent
            </p>
            <div
              className="h-16 rounded-lg flex items-center justify-center relative"
              style={{backgroundColor: accentColor}}
            >
              {previewLoading && (
                <Loader2 className="w-5 h-5 animate-spin text-white/80 absolute" />
              )}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className={`h-12 max-w-[80%] object-contain ${previewLoading ? "opacity-40" : ""}`}
                />
              ) : (
                !previewLoading && (
                  <span className="text-xs text-white/70">Crop to preview</span>
                )
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            onClick={handleConfirm}
            disabled={saving || !croppedAreaPixels}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Use logo
          </button>
        </div>
      </div>
    </ModalBlank>
  );
}

export default LogoCropModal;
