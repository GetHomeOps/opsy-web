import {useCallback, useEffect, useState} from "react";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  // Exclude in-app browsers (Instagram, Facebook, etc.)
  const isInAppBrowser = /(FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp)/i.test(ua);
  return !isInAppBrowser;
}

function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /(FBAN|FBAV|Instagram|Line\/|Twitter|LinkedInApp)/i.test(ua);
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 1023px)").matches;
}

export default function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = () => setInstalled(isStandalone());

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    mediaQuery.addEventListener("change", onDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mediaQuery.removeEventListener("change", onDisplayModeChange);
    };
  }, []);

  const isIos = isIosSafari();
  const inAppBrowser = isInAppBrowser();

  const canInstall =
    !installed &&
    (Boolean(deferredPrompt) || isIos || (isMobileViewport() && !inAppBrowser));

  const promptInstall = useCallback(async () => {
    if (installed) return "unavailable";

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      return "prompted";
    }

    if (isIos || inAppBrowser) {
      return "ios";
    }

    return "unavailable";
  }, [deferredPrompt, installed, isIos, inAppBrowser]);

  return {
    canInstall,
    isIos,
    inAppBrowser,
    promptInstall,
  };
}
