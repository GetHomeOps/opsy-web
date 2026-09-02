import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AppApi from "../api/api";
import {useAuth} from "./AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_HOVER,
  applyBrandingCss,
  applyDefaultBrandingCss,
  darkenHex,
  getBrandingSessionGen,
} from "../utils/brandingCss";

export {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_HOVER,
  DEFAULT_SIDEBAR_TEXT,
  DEFAULT_BUTTON,
  DEFAULT_BUTTON_TEXT,
  darkenHex,
} from "../utils/brandingCss";

const EMPTY_BRANDING = {
  id: null,
  name: null,
  url: null,
  accentColor: null,
  sidebarIconKey: null,
  sidebarIconUrl: null,
  agentCardLogoKey: null,
  agentCardLogoUrl: null,
  agentCardAccentColor: null,
  agentCardBackgroundColor: null,
  agentCardAgentLabel: null,
  agentCardCompanyName: null,
  sidebarTextColor: null,
  agentCardTextColor: null,
  buttonColor: null,
  buttonTextColor: null,
};

const AccountBrandingContext = createContext({
  branding: EMPTY_BRANDING,
  loading: false,
  refreshBranding: async () => {},
  effectiveAccent: DEFAULT_ACCENT,
  effectiveAccentHover: DEFAULT_ACCENT_HOVER,
});

/** Expand #RGB → #RRGGBB; return null if not a hex color. */
function normalizeHexColor(hex) {
  const raw = String(hex || "").trim();
  const short = raw.match(/^#([0-9A-Fa-f]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = raw.match(/^#([0-9A-Fa-f]{6})$/);
  return full ? `#${full[1].toLowerCase()}` : null;
}

/** Relative luminance for a hex color (0–1). Supports #RGB and #RRGGBB. */
export function hexLuminance(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return 0.5;
  const n = parseInt(normalized.slice(1), 16);
  const channels = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function AccountBrandingProvider({children}) {
  const {currentUser, impersonation} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const [branding, setBranding] = useState(EMPTY_BRANDING);
  const [loading, setLoading] = useState(false);
  const loadGenRef = useRef(0);
  const desiredAccountIdRef = useRef(null);
  desiredAccountIdRef.current = currentAccount?.id ?? null;

  const loadBranding = useCallback(async (accountId, {resetFirst = false} = {}) => {
    const gen = ++loadGenRef.current;
    const sessionAtStart = getBrandingSessionGen();

    // Hard reset on user/account switch so a customized shell cannot linger
    // (e.g. after stopping impersonation) while the next fetch is in flight.
    if (resetFirst || !accountId) {
      setBranding(EMPTY_BRANDING);
      applyDefaultBrandingCss();
    }

    if (!accountId) {
      return;
    }

    setLoading(true);
    try {
      // GET /accounts/:id/branding returns effective branding (agency / sponsor inheritance).
      const data = await AppApi.getAccountBranding(accountId);
      if (gen !== loadGenRef.current) return;
      if (sessionAtStart !== getBrandingSessionGen()) return;
      if (accountId !== desiredAccountIdRef.current) return;
      setBranding(data || EMPTY_BRANDING);
      applyBrandingCss(data);
    } catch {
      if (gen !== loadGenRef.current) return;
      if (sessionAtStart !== getBrandingSessionGen()) return;
      if (accountId !== desiredAccountIdRef.current) return;
      setBranding(EMPTY_BRANDING);
      applyDefaultBrandingCss();
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Reload before paint when account, user, or impersonation changes.
  useLayoutEffect(() => {
    loadBranding(currentAccount?.id, {resetFirst: true});
  }, [
    currentAccount?.id,
    currentUser?.id,
    impersonation?.active,
    loadBranding,
  ]);

  const refreshBranding = useCallback(async () => {
    await loadBranding(desiredAccountIdRef.current);
  }, [loadBranding]);

  // Sponsorship accept / plan changes can flip effective branding (sponsor inheritance).
  useEffect(() => {
    const onPlansUpdated = () => {
      if (desiredAccountIdRef.current) {
        loadBranding(desiredAccountIdRef.current);
      }
    };
    window.addEventListener("plans-updated", onPlansUpdated);
    return () => window.removeEventListener("plans-updated", onPlansUpdated);
  }, [loadBranding]);

  const effectiveAccent = branding.accentColor || DEFAULT_ACCENT;
  const effectiveAccentHover = darkenHex(effectiveAccent);

  const value = useMemo(
    () => ({
      branding,
      loading,
      refreshBranding,
      effectiveAccent,
      effectiveAccentHover,
      setBrandingPreview: (partial) => {
        setBranding((prev) => {
          const next = {...prev, ...partial};
          if (
            partial.accentColor !== undefined ||
            partial.sidebarTextColor !== undefined ||
            partial.buttonColor !== undefined ||
            partial.buttonTextColor !== undefined
          ) {
            applyBrandingCss(next);
          }
          return next;
        });
      },
    }),
    [branding, loading, refreshBranding, effectiveAccent, effectiveAccentHover],
  );

  return (
    <AccountBrandingContext.Provider value={value}>
      {children}
    </AccountBrandingContext.Provider>
  );
}

export function useAccountBranding() {
  return useContext(AccountBrandingContext);
}

export default AccountBrandingContext;
