import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import {registerSW} from "virtual:pwa-register";
import ThemeProvider from "./utils/ThemeContext";
import App from "./App";
import {
  CHUNK_RELOAD_KEY,
  isChunkLoadError,
  reloadOnceForStaleChunk,
} from "./utils/lazyWithRetry";
import "./i18n";

/** Set when a new service worker activated mid-session; applied on the next visit. */
const PWA_RELOAD_PENDING_KEY = "opsy-pwa-reload-pending";

function applyDeferredPwaReload() {
  if (import.meta.env.DEV) return;
  try {
    if (sessionStorage.getItem(PWA_RELOAD_PENDING_KEY)) {
      sessionStorage.removeItem(PWA_RELOAD_PENDING_KEY);
      window.location.reload();
    }
  } catch {
    /* ignore storage errors */
  }
}

function registerAppServiceWorker() {
  registerSW({
    immediate: true,
    onNeedReload() {
      // registerType: autoUpdate + skipWaiting() normally hard-reloads the tab as
      // soon as a deploy is detected — after the dashboard is already visible.
      // Defer to the next visit so the session isn't interrupted mid-page.
      try {
        sessionStorage.setItem(PWA_RELOAD_PENDING_KEY, "1");
      } catch {
        window.location.reload();
      }
    },
  });
}

// Apply a deferred SW update before React mounts (brief spinner, no dashboard flash).
applyDeferredPwaReload();

// Successful load — allow one auto-reload on the next stale-chunk failure.
try {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
} catch {
  /* ignore storage errors */
}

// Vite preloads linked CSS/JS before React.lazy runs; recover from missing hashes.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnceForStaleChunk();
});

// In dev, unregister any stale production/PWA service workers so Safari does not
// intercept localhost requests or enter an auto-update reload loop.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
} else if (import.meta.env.PROD) {
  if (document.readyState === "complete") {
    registerAppServiceWorker();
  } else {
    window.addEventListener("load", registerAppServiceWorker, {once: true});
  }
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    if (isChunkLoadError(error)) {
      return {hasError: false};
    }
    return {hasError: true};
  }
  componentDidCatch(error, info) {
    if (isChunkLoadError(error)) {
      reloadOnceForStaleChunk();
      return;
    }
    console.error("Uncaught error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem", color: "#1f2937" }}>Something went wrong</h1>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>An unexpected error occurred. Please reload the page.</p>
          <button onClick={() => window.location.reload()} style={{ padding: "0.5rem 1.5rem", borderRadius: "0.5rem", backgroundColor: "#456564", color: "white", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

if (localStorage.getItem("sidebar-expanded") === "true") {
  document.body.classList.add("sidebar-expanded");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
