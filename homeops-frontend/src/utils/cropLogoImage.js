/**
 * Crop a logo image (react-easy-crop pixel area) and optionally punch out
 * light / checkerboard backgrounds to transparent. Exports as WebP with alpha.
 */

/** Near-neutral, high-luminance pixels at or above this are fully punched. */
const DEFAULT_LUMINANCE_THRESHOLD = 200;
const DEFAULT_SOFT_EDGE = 16;
const DEFAULT_MAX_CHROMA = 18;

/**
 * Load an image from a URL (blob: or http(s):).
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = src;
  });
}

/**
 * Punch near-neutral light pixels to transparent (white plates + gray/white checkerboards).
 * @param {ImageData} imageData
 * @param {number} luminanceThreshold - Avg RGB above this → fully transparent
 * @param {number} softEdge - fade range below threshold
 * @param {number} maxChroma - skip saturated brand colors
 */
function removeLightBackground(
  imageData,
  luminanceThreshold = DEFAULT_LUMINANCE_THRESHOLD,
  softEdge = DEFAULT_SOFT_EDGE,
  maxChroma = DEFAULT_MAX_CHROMA,
) {
  const {data} = imageData;
  const softStart = Math.max(0, luminanceThreshold - softEdge);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const chroma = maxChannel - minChannel;
    if (chroma > maxChroma) continue;

    const luminance = (r + g + b) / 3;
    if (luminance >= luminanceThreshold) {
      data[i + 3] = 0;
    } else if (luminance >= softStart && softEdge > 0) {
      const t = (luminance - softStart) / softEdge;
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
    }
  }
}

/**
 * Crop image to the given pixel area and optionally remove a light background.
 *
 * @param {string} imageSrc - Object URL or image URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop - From react-easy-crop
 * @param {Object} [options]
 * @param {boolean} [options.removeWhiteBackground=false] - Punch light / checkerboard mats
 * @param {number} [options.luminanceThreshold=200]
 * @param {number} [options.maxSize=2048] - Max longest side of output
 * @param {number} [options.quality=0.95]
 * @param {string} [options.fileName='logo.webp']
 * @returns {Promise<File>}
 */
export async function cropLogoImage(imageSrc, pixelCrop, options = {}) {
  const {
    removeWhiteBackground = false,
    luminanceThreshold = DEFAULT_LUMINANCE_THRESHOLD,
    maxSize = 2048,
    quality = 0.95,
    fileName = "logo.webp",
  } = options;

  const img = await loadImage(imageSrc);
  const cropW = Math.max(1, Math.round(pixelCrop.width));
  const cropH = Math.max(1, Math.round(pixelCrop.height));
  const cropX = Math.max(0, Math.round(pixelCrop.x));
  const cropY = Math.max(0, Math.round(pixelCrop.y));

  let outW = cropW;
  let outH = cropH;
  if (outW > maxSize || outH > maxSize) {
    if (outW >= outH) {
      outH = Math.round((outH / outW) * maxSize);
      outW = maxSize;
    } else {
      outW = Math.round((outW / outH) * maxSize);
      outH = maxSize;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not available");
  }

  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

  if (removeWhiteBackground) {
    const imageData = ctx.getImageData(0, 0, outW, outH);
    removeLightBackground(imageData, luminanceThreshold);
    ctx.putImageData(imageData, 0, 0);
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode cropped logo"))),
      "image/webp",
      quality,
    );
  });

  const name = fileName.replace(/\.[^.]+$/, "") + ".webp";
  return new File([blob], name, {type: "image/webp"});
}

/**
 * Build a preview object URL of the cropped (optionally punched) logo for live UI preview.
 * @param {string} imageSrc
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {boolean} removeWhiteBackground
 * @returns {Promise<string>}
 */
export async function cropLogoPreviewDataUrl(imageSrc, pixelCrop, removeWhiteBackground = false) {
  const file = await cropLogoImage(imageSrc, pixelCrop, {
    removeWhiteBackground,
    maxSize: 320,
    quality: 0.85,
    fileName: "preview.webp",
  });
  return URL.createObjectURL(file);
}
