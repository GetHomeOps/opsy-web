import React, {useCallback, useEffect, useRef, useState} from "react";
import {Camera, ImagePlus, RotateCcw} from "lucide-react";
import ModalBlank from "../../../../components/ModalBlank";

function buildScanFileName(mimeType) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
  const ext =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/gif"
          ? "gif"
          : "jpg";
  return `scan-${stamp}.${ext}`;
}

function renameFile(file) {
  const name = buildScanFileName(file.type || "image/jpeg");
  if (file.name === name) return file;
  return new File([file], name, {type: file.type || "image/jpeg"});
}

/**
 * Mobile-first document photo capture. Uses native camera on iOS/Android via
 * capture="environment"; desktop falls back to image file picker.
 */
function DocumentCaptureModal({open, onClose, onAddToInbox}) {
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setPendingFile(null);
  }, []);

  const reset = useCallback(() => {
    clearPreview();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [clearPreview]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose?.();
  }, [onClose, reset]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    clearPreview();
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setPendingFile(file);
  }, [clearPreview]);

  const handleTakePhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRetake = useCallback(() => {
    reset();
    fileInputRef.current?.click();
  }, [reset]);

  const handleAddToInbox = useCallback(() => {
    if (!pendingFile) return;
    onAddToInbox?.([renameFile(pendingFile)]);
    handleClose();
  }, [pendingFile, onAddToInbox, handleClose]);

  return (
    <ModalBlank
      modalOpen={open}
      setModalOpen={(isOpen) => !isOpen && handleClose()}
      contentClassName="max-w-md w-full mx-4"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#456564]/10 dark:bg-[#456564]/20 flex items-center justify-center">
            <Camera className="w-5 h-5 text-[#456564] dark:text-[#7a9a88]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Capture document photo
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Photograph a paper invoice, receipt, or report
            </p>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {previewUrl ? (
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <img
                src={previewUrl}
                alt="Document preview"
                className="w-full max-h-72 object-contain"
              />
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 px-4 py-8 text-center">
              <ImagePlus className="w-10 h-10 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                Take a clear photo of your document
              </p>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                <li>Place on a flat surface with good lighting</li>
                <li>Fill the frame and keep text in focus</li>
                <li>Avoid shadows and glare</li>
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={handleClose}
            className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm px-4 py-2"
          >
            Cancel
          </button>
          {previewUrl ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="btn bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm px-4 py-2 inline-flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Retake
              </button>
              <button
                type="button"
                onClick={handleAddToInbox}
                className="btn bg-[#456564] hover:bg-[#3a5548] text-white text-sm px-4 py-2"
              >
                Add to inbox
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleTakePhoto}
              className="btn bg-[#456564] hover:bg-[#3a5548] text-white text-sm px-4 py-2 inline-flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              Take photo
            </button>
          )}
        </div>
      </div>
    </ModalBlank>
  );
}

export default DocumentCaptureModal;
