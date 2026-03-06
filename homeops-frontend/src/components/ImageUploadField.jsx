import React, {useRef, useState} from "react";
import {User, ImagePlus, X, Loader2, AlertCircle} from "lucide-react";

const PLACEHOLDER_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'%3E%3C/path%3E%3C/svg%3E";

const SIZES = {
  sm: "w-24 h-24",
  md: "w-36 h-36",
  lg: "w-52 h-52",
  xl: "w-full h-full min-h-[208px] lg:min-h-[288px]",
};

/**
 * Reusable image upload field with preview, upload menu, and S3 upload support.
 *
 * @param {Object} props
 * @param {string|null} props.imageSrc - URL to display (from preview, uploaded, or API)
 * @param {boolean} props.hasImage - Whether an image is set (for styling)
 * @param {boolean} props.imageUploading - Upload in progress
 * @param {Function} props.onUpload - (file: File) => void
 * @param {Function} props.onRemove - () => void
 * @param {Function} [props.onPasteUrl] - () => void, shows Paste URL option when provided
 * @param {boolean} [props.showRemove=true] - Show remove button when image exists
 * @param {string|null} props.imageUploadError - Error message to display
 * @param {Function} props.onDismissError - () => void
 * @param {string} [props.size='md'] - 'sm' | 'md' | 'lg' | 'xl'
 * @param {'avatar'|'generic'} [props.placeholder='generic'] - Placeholder icon when empty
 * @param {string} [props.alt='Image'] - Alt text for img
 * @param {string} [props.uploadLabel='Upload photo'] - Label for upload action
 * @param {string} [props.removeLabel='Remove photo'] - Label for remove action
 * @param {string} [props.pasteUrlLabel='Paste URL'] - Label for paste URL action
 * @param {React.RefObject} [props.fileInputRef] - Ref for the hidden file input
 * @param {boolean} [props.menuOpen] - Whether menu is open (controlled)
 * @param {Function} [props.onMenuToggle] - (open: boolean) => void
 * @param {string} [props.emptyLabel] - Label shown below icon when empty (e.g. "Add image")
 */
function ImageUploadField({
  imageSrc,
  hasImage,
  imageUploading,
  onUpload,
  onRemove,
  onPasteUrl,
  showRemove = true,
  imageUploadError,
  onDismissError,
  size = "md",
  placeholder = "generic",
  alt = "Image",
  uploadLabel = "Upload photo",
  removeLabel = "Remove photo",
  pasteUrlLabel = "Paste URL",
  emptyLabel,
  fileInputRef,
  menuOpen = false,
  onMenuToggle,
}) {
  const sizeClass = SIZES[size] || SIZES.md;
  const PlaceholderIcon = placeholder === "avatar" ? User : ImagePlus;
  const [showOverlay, setShowOverlay] = useState(false);
  const internalInputRef = useRef(null);
  const inputRef = fileInputRef ?? internalInputRef;

  const isEmpty = !imageSrc && !imageUploading;
  const isXl = size === "xl";

  const handleAreaClick = () => {
    if (imageUploading) return;
    inputRef?.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      e.target.value = "";
    }
  };

  return (
    <div
      className={`relative flex flex-col items-start gap-2 ${isXl ? "w-full h-full min-h-0" : "shrink-0"}`}
    >
      <div
        className={`${sizeClass} rounded-xl overflow-hidden transition-all duration-200 flex flex-col items-center justify-center relative ${
          hasImage
            ? "ring-2 ring-gray-200 dark:ring-gray-600 ring-offset-2 dark:ring-offset-gray-800 shadow-sm cursor-pointer"
            : "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-750 border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-650 dark:hover:to-gray-700"
        }`}
        onClick={handleAreaClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleAreaClick()}
        onMouseEnter={() => hasImage && setShowOverlay(true)}
        onMouseLeave={() => setShowOverlay(false)}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
        />
        {imageUploading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin" />
            <span className="text-xs font-medium">Uploading…</span>
          </div>
        ) : imageSrc ? (
          <>
            <img
              key={imageSrc}
              src={imageSrc}
              alt={alt}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER_FALLBACK;
              }}
            />
            {showRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove();
                }}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors shadow-md"
                aria-label={removeLabel}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {showOverlay && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <span className="text-sm font-medium text-white">
                  {uploadLabel}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <PlaceholderIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
            {emptyLabel && (
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {emptyLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {imageUploadError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm max-w-[200px]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1 min-w-0 truncate">{imageUploadError}</span>
          <button
            type="button"
            onClick={onDismissError}
            className="shrink-0 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40 rounded"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default ImageUploadField;
