import {lazy} from "react";

/** Session flag so we only auto-reload once per cooldown when a deploy invalidates chunks. */
export const CHUNK_RELOAD_KEY = "opsy-chunk-reload";

/** Ignore a second auto-reload for this long after the first. Must outlast the
 * time it takes a lazy route to fail — otherwise a failed Helpdesk import
 * reloads, main.jsx used to clear the flag immediately, and the tab looped. */
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

export function isChunkLoadError(error) {
  const message = String(error?.message || "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Loading chunk") ||
    message.includes("Loading CSS chunk") ||
    error?.name === "ChunkLoadError"
  );
}

export function hasChunkReloadBeenAttempted() {
  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    if (!raw) return false;
    if (raw === "1") return true;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < CHUNK_RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function buildCacheBustUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set("_chunk", String(Date.now()));
  return `${url.pathname}${url.search}${url.hash}`;
}

function hardNavigateForStaleChunk() {
  window.location.replace(buildCacheBustUrl());
}

export function reloadOnceForStaleChunk() {
  if (hasChunkReloadBeenAttempted()) return false;

  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    /* ignore storage errors */
  }

  // Query-param cache-busting is for production CDNs. In Vite, a 504
  // "Outdated Optimize Dep" is fixed by a plain reload (or restarting Vite),
  // not by stacking `?_chunk=` on the URL.
  if (import.meta.env.DEV) {
    window.location.reload();
    return true;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .then(hardNavigateForStaleChunk)
      .catch(hardNavigateForStaleChunk);
  } else {
    hardNavigateForStaleChunk();
  }

  return true;
}

async function importWithRetry(importFn) {
  try {
    return await importFn();
  } catch (error) {
    if (isChunkLoadError(error) && reloadOnceForStaleChunk()) {
      return new Promise(() => {});
    }
    throw error;
  }
}

/** Dynamic import() wrapper for on-demand vendor/util chunks. */
export function dynamicImportWithRetry(importFn) {
  return importWithRetry(importFn);
}

/** React.lazy wrapper that reloads once when a hashed chunk 404s after a deploy. */
export function lazyWithRetry(importFn) {
  return lazy(() => importWithRetry(importFn));
}
