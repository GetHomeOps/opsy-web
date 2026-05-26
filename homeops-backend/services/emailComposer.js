"use strict";

/**
 * Compose final SES HTML by wrapping the editable body in a container
 * and (optionally) appending the brand footer.
 */

const sesProvider = require("./emailProviders/sesProvider");

const DEFAULT_CONTAINER_STYLE =
  "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 16px;";

function escapeHtmlAttr(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildFooterHtml({ brandName, footerImageUrl, footerLinkUrl }) {
  const safeBrand = String(brandName || "Opsy");
  const link = footerLinkUrl || "https://heyopsy.com";
  const img =
    footerImageUrl && String(footerImageUrl).trim()
      ? String(footerImageUrl).trim()
      : `cid:${sesProvider.FOOTER_IMAGE_CID}`;
  return `
<p style="color: #6b7280; font-size: 12px; margin-top: 32px; margin-bottom: 8px; line-height: 1.5;">— The ${safeBrand} Team</p>
<p style="margin-top: 12px; margin-bottom: 0; text-align: center;">
  <a href="${escapeHtmlAttr(link)}" style="text-decoration: none; border: 0;">
    <img src="${escapeHtmlAttr(img)}" alt="${safeBrand}" width="560" style="display: inline-block; border: 0; outline: none; max-width: 100%; width: 100%; height: auto;" />
  </a>
</p>`.trim();
}

/**
 * Wrap an editable body in the email container with an optional footer.
 * @param {string} bodyHtml - the raw template body (already rendered or with merge tags)
 * @param {Object} opts
 * @param {boolean} [opts.showFooter=true]
 * @param {string} [opts.footerImageUrl] - per-template footer image URL
 * @param {string} [opts.footerLinkUrl]
 * @param {string} [opts.brandName]
 */
function wrapEmailHtml(bodyHtml, opts = {}) {
  const { showFooter = true, footerImageUrl, footerLinkUrl, brandName } = opts;
  const body = bodyHtml || "";
  const footer = showFooter
    ? buildFooterHtml({ brandName, footerImageUrl, footerLinkUrl })
    : "";
  return `<div style="${DEFAULT_CONTAINER_STYLE}">${body}${footer}</div>`;
}

module.exports = {
  wrapEmailHtml,
  buildFooterHtml,
  DEFAULT_CONTAINER_STYLE,
};
