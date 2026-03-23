/**
 * Sync video poster URLs for common hosts (no network).
 * YouTube: official thumbnails. Vimeo: vumbnail.com (public poster by id).
 */
export function getVideoThumbnailSync(url) {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^&\s?#/]+)/,
  );
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://vumbnail.com/${vm[1]}.jpg`;
  return null;
}
