/**
 * Compress an image file for faster upload and loading.
 * Resizes to max 960px on the longest side.
 * By default encodes as JPEG at 0.72 quality (with a white backdrop for transparency).
 * Pass preserveTransparency to encode as WebP and keep alpha (for logos/icons).
 * Non-image files are returned unchanged.
 *
 * @param {File} file - Image file (JPEG, PNG, WebP, etc.)
 * @param {Object} [options]
 * @param {number} [options.maxWidth=960] - Max width in pixels
 * @param {number} [options.quality=0.72] - Encode quality 0–1
 * @param {boolean} [options.preserveTransparency=false] - Keep alpha via WebP (no white fill)
 * @returns {Promise<File>} Compressed file or original if not compressible
 */
export function compressImageForUpload(file, options = {}) {
  const { maxWidth = 960, quality = 0.72, preserveTransparency = false } = options;
  if (!file || !file.type.startsWith("image/")) {
    return Promise.resolve(file);
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      let w = width;
      let h = height;
      if (width > maxWidth || height > maxWidth) {
        if (width >= height) {
          w = maxWidth;
          h = Math.round((height / width) * maxWidth);
        } else {
          h = maxWidth;
          w = Math.round((width / height) * maxWidth);
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      if (!preserveTransparency) {
        // JPEG has no alpha — fill white so transparent PNG areas don't flatten to black.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);

      const mimeType = preserveTransparency ? "image/webp" : "image/jpeg";
      const ext = preserveTransparency ? ".webp" : ".jpg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, "") + ext;
          resolve(new File([blob], name, { type: mimeType }));
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
