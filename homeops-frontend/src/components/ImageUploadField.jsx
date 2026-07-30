import React, {useRef, useState} from "react";
import {User, ImagePlus, X, Loader2, AlertCircle, Upload} from "lucide-react";

const PLACEHOLDER_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'%3E%3C/path%3E%3C/svg%3E";

const SIZES = {
  xs: "w-14 h-14",
  sm: "w-20 h-20 sm:w-24 sm:h-24",
  md: "w-24 h-24 sm:w-36 sm:h-36",
  lg: "w-36 h-36 sm:w-52 sm:h-52",
  xl: "w-full h-full",
};

/**
 * Reusable image upload field with preview, upload menu, and S3 upload support.
 *
 * @param {Object} props
 * @param {string|null} props.imageSrc - URL to display (from preview, uploaded, or API)
 * @param {boolean} props.hasImage - Whether an image is set (for styling)
 * @param {boolean} props.imageUploading - Upload in progress
 * @param {boolean} [props.imageLoading=false] - Remote image loading in progress
 * @param {Function} props.onUpload - (file: File) => void
 * @param {Function} props.onRemove - () => void
 * @param {Function} [props.onPasteUrl] - () => void, shows Paste URL option when provided
 * @param {boolean} [props.showRemove=true] - Show remove button when image exists
 * @param {string|null} props.imageUploadError - Error message to display
 * @param {Function} props.onDismissError - () => void
 * @param {string} [props.size='md'] - 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * @param {'avatar'|'generic'} [props.placeholder='generic'] - Placeholder icon when empty
 * @param {string} [props.alt='Image'] - Alt text for img
 * @param {string} [props.uploadLabel='Upload photo'] - Label for upload action
 * @param {string} [props.removeLabel='Remove photo'] - Label for remove action
 * @param {string} [props.pasteUrlLabel='Paste URL'] - Label for paste URL action
 * @param {React.RefObject} [props.fileInputRef] - Ref for the hidden file input
 * @param {boolean} [props.menuOpen] - Whether menu is open (controlled)
 * @param {Function} [props.onMenuToggle] - (open: boolean) => void
 * @param {string} [props.emptyLabel] - Label shown below icon when empty (e.g. "Add image")
 * @param {string} [props.emptyBackgroundSrc] - Background image when empty (e.g. property placeholder)
 * @param {boolean} [props.showEmptyUploadButton=false] - Orange upload button over empty background
 * @param {'photo'|'logo'} [props.variant='photo'] - photo: cover + white plate; logo: contain + checkerboard
 */
function ImageUploadField({
  imageSrc,
  hasImage,
  imageUploading,
  imageLoading = false,
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
  emptyBackgroundSrc,
  showEmptyUploadButton = false,
  fileInputRef,
  menuOpen = false,
  onMenuToggle,
  variant = "photo",
}) {
  const sizeClass = SIZES[size] || SIZES.md;
  const isCompact = size === "xs";
  const isLogo = variant === "logo";
  const PlaceholderIcon = placeholder === "avatar" ? User : ImagePlus;
  const [showOverlay, setShowOverlay] = useState(false);
  const internalInputRef = useRef(null);
  const inputRef = fileInputRef ?? internalInputRef;

  const isBusy = imageUploading || imageLoading;
  const isEmpty = !imageSrc && !isBusy;
  const isXl = size === "xl";
  const hasEmptyPlaceholder = isEmpty && !!emptyBackgroundSrc;
  const areaOpensPicker = !hasEmptyPlaceholder;

  const handleAreaClick = () => {
    if (isBusy || !areaOpensPicker) return;
    inputRef?.current?.click();
  };

  const handleUploadButtonClick = (e) => {
    e.stopPropagation();
    if (isBusy) return;
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
        className={`${sizeClass} ${isCompact ? "rounded-lg" : "rounded-xl"} overflow-hidden transition-all duration-200 flex flex-col items-center justify-center relative ${
          hasImage
            ? `${isLogo ? "shadow-sm cursor-pointer" : "bg-white shadow-sm cursor-pointer"}${
                isXl
                  ? ""
                  : " ring-2 ring-gray-200 dark:ring-gray-600 ring-offset-2 dark:ring-offset-gray-800"
              }`
            : hasEmptyPlaceholder
              ? "bg-neutral-900 cursor-default"
              : "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-750 border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-650 dark:hover:to-gray-700"
        }`}
        style={
          hasImage && isLogo
            ? {
                backgroundImage:
                  "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                backgroundSize: "12px 12px",
                backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
                backgroundColor: "#f9fafb",
              }
            : undefined
        }
        onClick={handleAreaClick}
        role={areaOpensPicker ? "button" : undefined}
        tabIndex={areaOpensPicker ? 0 : undefined}
        onKeyDown={(e) => areaOpensPicker && e.key === "Enter" && handleAreaClick()}
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
        {isBusy && !imageSrc ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
            <Loader2
              className={`${isCompact ? "w-5 h-5" : "w-10 h-10"} animate-spin`}
            />
            <span
              className={`${isCompact ? "text-[10px]" : "text-xs"} font-medium`}
            >
              {imageUploading ? "Uploading..." : "Loading..."}
            </span>
          </div>
        ) : imageSrc ? (
          <>
            <img
              key={imageSrc}
              src={imageSrc}
              alt={alt}
              className={`w-full h-full ${isLogo ? "object-contain p-1" : "object-cover"}`}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER_FALLBACK;
              }}
            />
            {isBusy && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                <Loader2
                  className={`${isCompact ? "w-5 h-5" : "w-8 h-8"} animate-spin text-white`}
                />
              </div>
            )}
            {showRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove();
                }}
                className={`absolute z-10 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors shadow-md ${
                  isCompact ? "top-0.5 right-0.5 p-0.5" : "top-2 right-2 p-1.5"
                }`}
                aria-label={removeLabel}
              >
                <X className={isCompact ? "w-3 h-3" : "w-4 h-4"} />
              </button>
            )}
            {showOverlay && !isBusy && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <span
                  className={`${isCompact ? "text-[10px]" : "text-sm"} font-medium text-white`}
                >
                  {uploadLabel}
                </span>
              </div>
            )}
          </>
        ) : hasEmptyPlaceholder ? (
          <>
            <img
              src={emptyBackgroundSrc}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover"
            />
            {showEmptyUploadButton && (
              <button
                type="button"
                onClick={handleUploadButtonClick}
                className="absolute z-10 flex items-center gap-2 rounded-full bg-[#C26E4E] hover:bg-[#B56346] text-white pl-1 pr-4 py-1 shadow-md transition-colors"
                style={{top: "52%", right: "6%"}}
                aria-label={uploadLabel}
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white shrink-0">
                  <Upload className="w-4 h-4 text-[#C26E4E]" strokeWidth={2.5} />
                </span>
                <span className="text-sm font-bold tracking-wide">UPLOAD</span>
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <PlaceholderIcon
              className={`${isCompact ? "w-6 h-6" : "w-12 h-12"} text-gray-400 dark:text-gray-500`}
            />
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
