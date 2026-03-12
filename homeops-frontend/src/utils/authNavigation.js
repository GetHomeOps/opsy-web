const OAUTH_RETURN_TO_KEY = "oauth_return_to";
const POST_LOGOUT_IGNORE_RETURN_TO_KEY = "post_logout_ignore_return_to";

const GLOBAL_ROUTE_PREFIXES = new Set([
  "signin",
  "signup",
  "forgot-password",
  "reset-password",
  "privacy-policy",
  "auth",
  "onboarding",
  "billing",
  "settings",
  "coming-soon",
  "professionals-sample",
  "my-professionals-sample",
  "contractor-report",
]);

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markPostLogoutRedirectReset() {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(POST_LOGOUT_IGNORE_RETURN_TO_KEY, "1");
  storage.removeItem(OAUTH_RETURN_TO_KEY);
}

export function isPostLogoutRedirectResetPending() {
  const storage = getSessionStorage();
  if (!storage) return false;
  return storage.getItem(POST_LOGOUT_IGNORE_RETURN_TO_KEY) === "1";
}

export function consumePostLogoutRedirectReset() {
  const storage = getSessionStorage();
  if (!storage) return false;
  const shouldIgnore =
    storage.getItem(POST_LOGOUT_IGNORE_RETURN_TO_KEY) === "1";
  if (shouldIgnore) {
    storage.removeItem(POST_LOGOUT_IGNORE_RETURN_TO_KEY);
  }
  return shouldIgnore;
}

export function canRedirectToPathForUser(user, fromPath) {
  if (!user || typeof fromPath !== "string") return false;

  const normalizedPath = fromPath.trim();
  if (
    !normalizedPath.startsWith("/") ||
    normalizedPath.startsWith("//") ||
    normalizedPath === "/signin" ||
    normalizedPath === "/signup"
  ) {
    return false;
  }

  const firstSegment = normalizedPath
    .split(/[/?#]/)
    .filter(Boolean)[0]
    ?.toLowerCase();

  if (!firstSegment) return false;
  if (GLOBAL_ROUTE_PREFIXES.has(firstSegment)) return true;

  const allowedAccountSlugs = new Set(
    (user.accounts || [])
      .flatMap((account) => [account?.url, account?.name])
      .filter(Boolean)
      .map((value) => String(value).replace(/^\/+/, "").toLowerCase()),
  );

  return allowedAccountSlugs.has(firstSegment);
}
