// Footer is now composed server-side; storage normalization is a no-op.
// Kept so existing imports continue to work.
export function toPreviewHtml(html) {
  return html || "";
}

export function toStorageHtml(html) {
  return html || "";
}
