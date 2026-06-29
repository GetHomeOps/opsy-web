import {lazy} from "react";

/** Session flag so we only auto-reload once per visit when a deploy invalidates chunks. */
export const CHUNK_RELOAD_KEY = "opsy-chunk-reload";

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
    return sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1";
  } catch {
    return false;
  }
}

function buildCacheBustUrl() {
  const {pathname, search, hash} = window.location;
  const bust = `_chunk=${Date.now()}`;
  const nextSearch = search ? `${search}&${bust}` : `?${bust}`;
  return `${pathname}${nextSearch}${hash}`;
}

function hardNavigateForStaleChunk() {
  window.location.replace(buildCacheBustUrl());
}

export function reloadOnceForStaleChunk() {
  if (hasChunkReloadBeenAttempted()) return false;

  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    /* ignore storage errors */
  }

  if (!import.meta.env.DEV && "serviceWorker" in navigator) {
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
