/** True when the app is served from the public demo site. */
export function isDemoSite() {
  return (
    typeof window !== "undefined" &&
    window.location.hostname === "demo.heyopsy.com"
  );
}
