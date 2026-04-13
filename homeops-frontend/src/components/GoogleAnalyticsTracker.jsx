import {useEffect, useRef} from "react";
import {useLocation} from "react-router-dom";

/** Only set in deploy/CI (e.g. Railway). Omit locally to disable GA entirely. */
const GA_MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID || "").trim();

const gaDebug =
  import.meta.env.DEV || import.meta.env.VITE_GA_DEBUG === "true";

/** Collapse duplicate `page_view` within this window (React StrictMode double-invokes effects in dev). */
const GA_DEDUPE_MS = 100;
let lastGaPageKeySent = null;
let lastGaSentAt = 0;

let gtagLoadPromise = null;

/**
 * Injects gtag.js once; `config` sends the initial page_view when the library is ready.
 * @returns {Promise<boolean>} false if the script failed to load
 */
function ensureGtagLoaded(measurementId, debug) {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }
  if (gtagLoadPromise) {
    return gtagLoadPromise;
  }

  gtagLoadPromise = new Promise((resolve) => {
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      measurementId,
    )}`;
    script.onload = () => {
      const opts = debug ? {debug_mode: true} : {};
      gtag("config", measurementId, opts);
      resolve(true);
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

  return gtagLoadPromise;
}

function sendGaPageView(pathname, search) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  if (typeof window.gtag !== "function") return;

  const pagePath = `${pathname || "/"}${search || ""}`;
  const now = Date.now();
  if (
    lastGaPageKeySent === pagePath &&
    now - lastGaSentAt < GA_DEDUPE_MS
  ) {
    return;
  }
  lastGaPageKeySent = pagePath;
  lastGaSentAt = now;

  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_title: document.title || undefined,
    page_location: window.location.href,
  });
}

/**
 * Loads GA4 only when `VITE_GA_MEASUREMENT_ID` is set at build time (e.g. Railway).
 * SPA navigations after the first load send additional page_view events.
 *
 * Local dev: leave the variable unset — no requests to Google.
 * DebugView: `VITE_GA_DEBUG=true` on a build that includes the measurement ID.
 */
export default function GoogleAnalyticsTracker() {
  const location = useLocation();
  /** First URL is covered by gtag config after script load; record it and only fire on later route changes. */
  const routeBaselineRef = useRef(null);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    ensureGtagLoaded(GA_MEASUREMENT_ID, gaDebug).catch(() => {});
  }, []);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    const path = location.pathname || "/";
    const search = location.search || "";
    const key = `${path}${search}`;

    if (routeBaselineRef.current === null) {
      routeBaselineRef.current = key;
      return;
    }
    if (routeBaselineRef.current === key) return;

    routeBaselineRef.current = key;
    ensureGtagLoaded(GA_MEASUREMENT_ID, gaDebug).then((ok) => {
      if (ok) sendGaPageView(path, search);
    });
  }, [location.pathname, location.search]);

  return null;
}
