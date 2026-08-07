import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Cropper from "react-easy-crop";
import {Loader2} from "lucide-react";
import ModalBlank from "./ModalBlank";
import {cropLogoImage, cropLogoPreviewDataUrl} from "../utils/cropLogoImage";

const STAGE_PADDING = 16;
const FRAME_PCT_MIN = 40;
const FRAME_PCT_MAX = 100;
const MIN_FRAME_PX = 48;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

/**
 * Modal to crop a logo before upload, with draggable frame handles and
 * optional light-background removal.
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
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [crop, setCrop] = useState({x: 0, y: 0});
  const [zoom, setZoom] = useState(1);
  const [horizontalPct, setHorizontalPct] = useState(FRAME_PCT_MAX);
  const [verticalPct, setVerticalPct] = useState(FRAME_PCT_MAX);
  const [stageSize, setStageSize] = useState({width: 0, height: 0});
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [removeWhiteBackground, setRemoveWhiteBackground] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resizing, setResizing] = useState(false);

  const onCropComplete = useCallback((_croppedArea, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const maxFrame = useMemo(() => {
    const maxW = Math.max(0, stageSize.width - STAGE_PADDING * 2);
    const maxH = Math.max(0, stageSize.height - STAGE_PADDING * 2);
    return {maxW, maxH};
  }, [stageSize.width, stageSize.height]);

  // Measure crop stage for cropSize
  useEffect(() => {
    if (!open) return undefined;
    const el = stageRef.current;
    if (!el) return undefined;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setStageSize({
        width: Math.max(0, Math.round(rect.width)),
        height: Math.max(0, Math.round(rect.height)),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, imageSrc]);

  // Reset state when a new image opens
  useEffect(() => {
    if (!open || !imageSrc) return;
    setCrop({x: 0, y: 0});
    setZoom(1);
    setHorizontalPct(FRAME_PCT_MAX);
    setVerticalPct(FRAME_PCT_MAX);
    setCroppedAreaPixels(null);
    setRemoveWhiteBackground(false);
    setError(null);
    setSaving(false);
    setResizing(false);
  }, [open, imageSrc]);

  const cropSize = useMemo(() => {
    const {maxW, maxH} = maxFrame;
    if (maxW < MIN_FRAME_PX || maxH < MIN_FRAME_PX) return undefined;
    return {
      width: Math.max(MIN_FRAME_PX, Math.round((maxW * horizontalPct) / 100)),
      height: Math.max(MIN_FRAME_PX, Math.round((maxH * verticalPct) / 100)),
    };
  }, [maxFrame, horizontalPct, verticalPct]);

  const beginResize = useCallback(
    (edge, event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!cropSize) return;
      const point = "touches" in event ? event.touches[0] : event;
      dragRef.current = {
        edge,
        startX: point.clientX,
        startY: point.clientY,
        startW: cropSize.width,
        startH: cropSize.height,
      };
      setResizing(true);
    },
    [cropSize],
  );

  useEffect(() => {
    if (!resizing) return undefined;

    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const point = "touches" in event ? event.touches[0] : event;
      if (!point) return;
      const {maxW, maxH} = maxFrame;
      if (maxW < MIN_FRAME_PX || maxH < MIN_FRAME_PX) return;

      const dx = point.clientX - drag.startX;
      const dy = point.clientY - drag.startY;
      // Frame stays centered — edge drag changes size symmetrically.
      let nextW = drag.startW;
      let nextH = drag.startH;

      if (drag.edge.includes("e")) nextW = drag.startW + dx * 2;
      if (drag.edge.includes("w")) nextW = drag.startW - dx * 2;
      if (drag.edge.includes("s")) nextH = drag.startH + dy * 2;
      if (drag.edge.includes("n")) nextH = drag.startH - dy * 2;

      nextW = Math.min(maxW, Math.max(MIN_FRAME_PX, nextW));
      nextH = Math.min(maxH, Math.max(MIN_FRAME_PX, nextH));

      const nextHPct = Math.round(
        Math.min(FRAME_PCT_MAX, Math.max(FRAME_PCT_MIN, (nextW / maxW) * 100)),
      );
      const nextVPct = Math.round(
        Math.min(FRAME_PCT_MAX, Math.max(FRAME_PCT_MIN, (nextH / maxH) * 100)),
      );

      if (drag.edge.includes("e") || drag.edge.includes("w")) {
        setHorizontalPct(nextHPct);
      }
      if (drag.edge.includes("n") || drag.edge.includes("s")) {
        setVerticalPct(nextVPct);
      }
    };

    const onEnd = () => {
      dragRef.current = null;
      setResizing(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("touchmove", onMove, {passive: false});
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [resizing, maxFrame]);

  // Live preview of crop (+ optional punch-out) on accent backdrop
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

  const handleFitFullLogo = () => {
    setHorizontalPct(FRAME_PCT_MAX);
    setVerticalPct(FRAME_PCT_MAX);
    setZoom(1);
    setCrop({x: 0, y: 0});
  };

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

  const handleClass =
    "absolute z-20 flex items-center justify-center touch-none select-none pointer-events-auto p-2";
  const cornerKnobClass =
    "w-2 h-2 rounded-[3px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.2)] pointer-events-none";
  const edgeKnobClass =
    "rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.2)] pointer-events-none";

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
      contentClassName="max-w-2xl"
    >
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Crop logo
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Drag the handles to resize the crop frame, then optionally remove the
          background so the logo sits cleanly on your accent color.
        </p>

        <div
          ref={stageRef}
          className={`mt-4 relative w-full h-72 sm:h-80 rounded-lg overflow-hidden bg-neutral-200 dark:bg-gray-800 ${
            resizing ? "select-none" : ""
          }`}
        >
          {imageSrc && cropSize ? (
            <>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                cropSize={cropSize}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                objectFit="contain"
                showGrid
                restrictPosition={zoom >= 1}
              />
              {/* Centered frame overlay with draggable edge/corner handles */}
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <div
                  className="relative"
                  style={{width: cropSize.width, height: cropSize.height}}
                >
                  <div
                    className={`${handleClass} top-1/2 -translate-y-1/2 -left-2.5 cursor-ew-resize`}
                    onPointerDown={(e) => beginResize("w", e)}
                    role="slider"
                    aria-label="Resize crop left"
                    tabIndex={0}
                  >
                    <span className={`${edgeKnobClass} w-1 h-3.5`} />
                  </div>
                  <div
                    className={`${handleClass} top-1/2 -translate-y-1/2 -right-2.5 cursor-ew-resize`}
                    onPointerDown={(e) => beginResize("e", e)}
                    role="slider"
                    aria-label="Resize crop right"
                    tabIndex={0}
                  >
                    <span className={`${edgeKnobClass} w-1 h-3.5`} />
                  </div>
                  <div
                    className={`${handleClass} left-1/2 -translate-x-1/2 -top-2.5 cursor-ns-resize`}
                    onPointerDown={(e) => beginResize("n", e)}
                    role="slider"
                    aria-label="Resize crop top"
                    tabIndex={0}
                  >
                    <span className={`${edgeKnobClass} w-3.5 h-1`} />
                  </div>
                  <div
                    className={`${handleClass} left-1/2 -translate-x-1/2 -bottom-2.5 cursor-ns-resize`}
                    onPointerDown={(e) => beginResize("s", e)}
                    role="slider"
                    aria-label="Resize crop bottom"
                    tabIndex={0}
                  >
                    <span className={`${edgeKnobClass} w-3.5 h-1`} />
                  </div>
                  <div
                    className={`${handleClass} -top-2 -left-2 cursor-nwse-resize`}
                    onPointerDown={(e) => beginResize("nw", e)}
                    role="slider"
                    aria-label="Resize crop top-left"
                    tabIndex={0}
                  >
                    <span className={cornerKnobClass} />
                  </div>
                  <div
                    className={`${handleClass} -top-2 -right-2 cursor-nesw-resize`}
                    onPointerDown={(e) => beginResize("ne", e)}
                    role="slider"
                    aria-label="Resize crop top-right"
                    tabIndex={0}
                  >
                    <span className={cornerKnobClass} />
                  </div>
                  <div
                    className={`${handleClass} -bottom-2 -left-2 cursor-nesw-resize`}
                    onPointerDown={(e) => beginResize("sw", e)}
                    role="slider"
                    aria-label="Resize crop bottom-left"
                    tabIndex={0}
                  >
                    <span className={cornerKnobClass} />
                  </div>
                  <div
                    className={`${handleClass} -bottom-2 -right-2 cursor-nwse-resize`}
                    onPointerDown={(e) => beginResize("se", e)}
                    role="slider"
                    aria-label="Resize crop bottom-right"
                    tabIndex={0}
                  >
                    <span className={cornerKnobClass} />
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="logo-crop-zoom"
                className="block text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                Zoom
              </label>
              <button
                type="button"
                onClick={handleFitFullLogo}
                className="text-xs font-medium text-[var(--opsy-accent,#254f48)] hover:underline"
              >
                Fit full logo
              </button>
            </div>
            <input
              id="logo-crop-zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
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
                Remove background
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Punch out near-white and light-gray pixels so solid plates and
                exported transparency grids become transparent. Confirm on the
                accent preview below.
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
