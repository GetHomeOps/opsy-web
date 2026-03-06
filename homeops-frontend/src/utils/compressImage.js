/**
 * Compress an image file for faster upload and loading.
 * Resizes to max 960px on the longest side and encodes as JPEG at 0.72 quality.
 * Non-image files are returned unchanged.
 *
 * @param {File} file - Image file (JPEG, PNG, WebP, etc.)
 * @param {Object} [options]
 * @param {number} [options.maxWidth=960] - Max width in pixels
 * @param {number} [options.quality=0.72] - JPEG quality 0–1
 * @returns {Promise<File>} Compressed file (JPEG) or original if not compressible
 */
export function compressImageForUpload(file, options = {}) {
  const { maxWidth = 960, quality = 0.72 } = options;
  if (!file || !file.type.startsWith("image/")) {
    return Promise.resolve(file);
  }

  return new Promise((resolve, reject) => {
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
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
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
