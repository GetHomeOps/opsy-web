import {useEffect} from "react";
import {useLocation} from "react-router-dom";
import {useAuth} from "../context/AuthContext";
import AppApi from "../api/api";

/** Paths where we do not record page_view (marketing / auth shells). */
const SKIP_PATHS = new Set([
  "/signin",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/auth/callback",
  "/coming-soon",
]);

function shouldSkipPathname(pathname) {
  if (!pathname) return true;
  if (SKIP_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/reset-password")) return true;
  return false;
}

/**
 * Logs one platform page_view per client-side navigation while the user is
 * authenticated, so analytics (e.g. Account Analytics top pages) include all
 * routes — not only /:accountUrl/home (Main).
 */
export default function PageViewTracker() {
  const location = useLocation();
  const {currentUser, isLoading} = useAuth();

  useEffect(() => {
    if (isLoading || !currentUser?.id) return;
    const path = location.pathname;
    if (shouldSkipPathname(path)) return;
    AppApi.logEngagementEvent("page_view", {path}).catch(() => {});
  }, [location.pathname, currentUser?.id, isLoading]);

  return null;
}
