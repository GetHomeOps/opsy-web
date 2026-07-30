/**
 * Crop a logo image (react-easy-crop pixel area) and optionally punch out
 * near-white pixels to transparent. Exports as WebP with alpha.
 */

const DEFAULT_WHITE_THRESHOLD = 245;
const DEFAULT_SOFT_EDGE = 10;

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
 * Punch near-white pixels to transparent (soft edge near threshold).
 * @param {ImageData} imageData
 * @param {number} threshold - RGB channel min to treat as white (0–255)
 * @param {number} softEdge - fade range below threshold
 */
function removeNearWhite(imageData, threshold = DEFAULT_WHITE_THRESHOLD, softEdge = DEFAULT_SOFT_EDGE) {
  const {data} = imageData;
  const softStart = Math.max(0, threshold - softEdge);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const minChannel = Math.min(r, g, b);
    // Only punch near-neutral whites (avoid wiping light brand colors)
    const maxChannel = Math.max(r, g, b);
    const chroma = maxChannel - minChannel;
    if (chroma > 18) continue;

    if (minChannel >= threshold) {
      data[i + 3] = 0;
    } else if (minChannel >= softStart && softEdge > 0) {
      const t = (minChannel - softStart) / softEdge;
      data[i + 3] = Math.round(data[i + 3] * (1 - t));
    }
  }
}

/**
 * Crop image to the given pixel area and optionally remove a white background.
 *
 * @param {string} imageSrc - Object URL or image URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop - From react-easy-crop
 * @param {Object} [options]
 * @param {boolean} [options.removeWhiteBackground=false]
 * @param {number} [options.whiteThreshold=245]
 * @param {number} [options.maxSize=960] - Max longest side of output
 * @param {number} [options.quality=0.92]
 * @param {string} [options.fileName='logo.webp']
 * @returns {Promise<File>}
 */
export async function cropLogoImage(imageSrc, pixelCrop, options = {}) {
  const {
    removeWhiteBackground = false,
    whiteThreshold = DEFAULT_WHITE_THRESHOLD,
    maxSize = 960,
    quality = 0.92,
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
    removeNearWhite(imageData, whiteThreshold);
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
 * Build a preview data URL of the cropped (optionally punched) logo for live UI preview.
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
