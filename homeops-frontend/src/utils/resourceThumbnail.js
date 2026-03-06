import OpsyBodyDefault from "../images/Opsy/Opsy-body.svg";

/**
 * Derives a thumbnail URL for resources (video links, article links).
 * - YouTube: uses img.youtube.com/vi/VIDEO_ID/hqdefault.jpg
 * - Vimeo: uses vumbnail.com (free service)
 * - Other URLs: returns null (caller can use placeholder)
 */
export function getResourceThumbnailUrl(resource) {
  const url = resource?.url || resource?.linkUrl || "";
  const type = resource?.type || "";
  if (!url?.trim()) return null;

  const trimmed = url.trim();

  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const ytMatch =
    trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/) ||
    trimmed.match(/youtube\.com\/v\/([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  // Vimeo: vimeo.com/123456789
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
  }

  // For web_link or other URLs, we could add Open Graph fetching later.
  // For now return null so caller uses placeholder.
  return null;
}

/** Placeholder image for resources without a derived thumbnail */
export const RESOURCE_THUMBNAIL_PLACEHOLDER =
  "https://images.unsplash.com/photo-1580584126903-c17d41830450?w=600&h=400&fit=crop";

/** Default header image when no header image is provided (Opsy branding) */
export const DEFAULT_HEADER_IMAGE = OpsyBodyDefault;
