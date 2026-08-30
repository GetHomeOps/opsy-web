import React from "react";
import ReactDOM from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import {registerSW} from "virtual:pwa-register";
import ThemeProvider from "./utils/ThemeContext";
import App from "./App";
import {
  hasChunkReloadBeenAttempted,
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

function showChunkLoadFailure(rootMessage) {
  const root = document.getElementById("root");
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;padding:2rem;text-align:center">
      <h1 style="font-size:1.5rem;font-weight:600;margin-bottom:0.5rem;color:#1f2937">Something went wrong</h1>
      <p style="color:#6b7280;margin-bottom:1.5rem">${rootMessage}</p>
      <button type="button" onclick="window.location.reload()" style="padding:0.5rem 1.5rem;border-radius:0.5rem;background-color:#456564;color:white;border:none;cursor:pointer;font-size:0.875rem">Reload</button>
    </div>
  `;
}

// Vite preloads linked CSS/JS before React.lazy runs; recover from missing hashes.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForStaleChunk()) {
    event.preventDefault();
    return;
  }
  showChunkLoadFailure(
    "The app could not load a required file. Please reload the page.",
  );
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason) && reloadOnceForStaleChunk()) {
    event.preventDefault();
  }
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

const errorFallbackStyles = {
  container: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Inter, system-ui, sans-serif",
    padding: "2rem",
    textAlign: "center",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
    color: "#1f2937",
  },
  message: {color: "#6b7280", marginBottom: "1.5rem"},
  button: {
    padding: "0.5rem 1.5rem",
    borderRadius: "0.5rem",
    backgroundColor: "#456564",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontSize: "0.875rem",
  },
};

function ErrorFallback({message}) {
  return (
    <div style={errorFallbackStyles.container}>
      <h1 style={errorFallbackStyles.title}>Something went wrong</h1>
      <p style={errorFallbackStyles.message}>{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={errorFallbackStyles.button}
      >
        Reload
      </button>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false, pendingChunkReload: false};
  }
  static getDerivedStateFromError(error) {
    if (isChunkLoadError(error)) {
      if (hasChunkReloadBeenAttempted()) {
        return {hasError: true, pendingChunkReload: false};
      }
      return {hasError: false, pendingChunkReload: true};
    }
    return {hasError: true, pendingChunkReload: false};
  }
  componentDidCatch(error, info) {
    if (isChunkLoadError(error)) {
      if (!hasChunkReloadBeenAttempted() && reloadOnceForStaleChunk()) {
        return;
      }
      console.error("Chunk load failed after reload attempt:", error, info);
      return;
    }
    console.error("Uncaught error:", error, info);
  }
  render() {
    if (this.state.pendingChunkReload) {
      return (
        <ErrorFallback message="Loading an updated version of the app..." />
      );
    }
    if (this.state.hasError) {
      return (
        <ErrorFallback message="An unexpected error occurred. Please reload the page." />
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
