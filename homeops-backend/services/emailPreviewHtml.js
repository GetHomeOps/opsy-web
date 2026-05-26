"use strict";

const { APP_BASE_URL } = require("../config");

const FOOTER_IMAGE_CID = "opsy-footer-image";
const FOOTER_CID_SRC = `cid:${FOOTER_IMAGE_CID}`;
const FOOTER_MERGE_SRC = "{{footerImageUrl}}";

function getFooterPreviewUrl() {
  if (process.env.EMAIL_FOOTER_IMAGE_URL) {
    return process.env.EMAIL_FOOTER_IMAGE_URL;
  }
  const base = (APP_BASE_URL || process.env.APP_WEB_ORIGIN || "http://localhost:5173").replace(
    /\/$/,
    ""
  );
  return `${base}/footer.png`;
}

/** Replace inline CID / merge footer references with a browser-loadable URL for admin preview. */
function toPreviewHtml(html) {
  if (!html) return html;
  const previewUrl = getFooterPreviewUrl();
  return String(html)
    .replaceAll(FOOTER_CID_SRC, previewUrl)
    .replaceAll(`cid:${FOOTER_IMAGE_CID}`, previewUrl)
    .replace(/src=(["'])\{\{\s*footerImageUrl\s*\}\}\1/gi, `src=$1${previewUrl}$1`);
}

/** Convert preview URLs back to merge tags before persisting SES templates. */
function toStorageHtml(html) {
  if (!html) return html;
  const previewUrl = getFooterPreviewUrl();
  const escaped = previewUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = String(html);
  out = out.replace(new RegExp(escaped, "g"), FOOTER_MERGE_SRC);
  out = out.replace(/src=(["'])\/footer\.png\1/gi, `src=$1${FOOTER_MERGE_SRC}$1`);
  out = out.replace(/src=(["'])cid:opsy-footer-image\1/gi, `src=$1${FOOTER_MERGE_SRC}$1`);
  return out;
}

module.exports = {
  FOOTER_CID_SRC,
  getFooterPreviewUrl,
  toPreviewHtml,
  toStorageHtml,
};
