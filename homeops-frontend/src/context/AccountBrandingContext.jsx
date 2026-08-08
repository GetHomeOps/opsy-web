import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AppApi from "../api/api";
import {useAuth} from "./AuthContext";
import useCurrentAccount from "../hooks/useCurrentAccount";

export const DEFAULT_ACCENT = "#456564";
export const DEFAULT_ACCENT_HOVER = "#34514f";
export const DEFAULT_SIDEBAR_TEXT = "#ffffff";
export const DEFAULT_BUTTON = DEFAULT_ACCENT;
export const DEFAULT_BUTTON_TEXT = "#ffffff";

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

/** Darken a #RRGGBB hex by mixing toward black. */
export function darkenHex(hex, amount = 0.18) {
  if (!hex || typeof hex !== "string") return DEFAULT_ACCENT_HOVER;
  const m = hex.trim().match(/^#([0-9A-Fa-f]{6})$/);
  if (!m) return DEFAULT_ACCENT_HOVER;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 0xff) * (1 - amount));
  const g = Math.round(((n >> 8) & 0xff) * (1 - amount));
  const b = Math.round((n & 0xff) * (1 - amount));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

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

/**
 * Apply shell accent + primary button CSS vars.
 * Button bg falls back to accent; button text defaults to white.
 */
function applyCssVars({
  accent,
  sidebarText,
  buttonColor,
  buttonTextColor,
} = {}) {
  const root = document.documentElement;
  const color = accent || DEFAULT_ACCENT;
  const hover = darkenHex(color);
  const fg = sidebarText || DEFAULT_SIDEBAR_TEXT;
  const button = buttonColor || color || DEFAULT_BUTTON;
  const buttonHover = darkenHex(button);
  const buttonFg = buttonTextColor || DEFAULT_BUTTON_TEXT;
  root.style.setProperty("--opsy-accent", color);
  root.style.setProperty("--opsy-accent-hover", hover);
  root.style.setProperty("--opsy-accent-fg", fg);
  root.style.setProperty("--opsy-button", button);
  root.style.setProperty("--opsy-button-hover", buttonHover);
  root.style.setProperty("--opsy-button-fg", buttonFg);
}

function applyDefaults() {
  applyCssVars({
    accent: DEFAULT_ACCENT,
    sidebarText: DEFAULT_SIDEBAR_TEXT,
    buttonColor: DEFAULT_BUTTON,
    buttonTextColor: DEFAULT_BUTTON_TEXT,
  });
}

function applyFromBranding(data) {
  applyCssVars({
    accent: data?.accentColor || DEFAULT_ACCENT,
    sidebarText: data?.sidebarTextColor || DEFAULT_SIDEBAR_TEXT,
    buttonColor: data?.buttonColor || null,
    buttonTextColor: data?.buttonTextColor || null,
  });
}

export function AccountBrandingProvider({children}) {
  const {currentUser} = useAuth();
  const {currentAccount} = useCurrentAccount();
  const [branding, setBranding] = useState(EMPTY_BRANDING);
  const [loading, setLoading] = useState(false);
  const loadGenRef = useRef(0);

  const loadBranding = useCallback(async (accountId, {resetFirst = false} = {}) => {
    const gen = ++loadGenRef.current;

    // Hard reset on user/account switch so a customized shell cannot linger
    // (e.g. after stopping impersonation) while the next fetch is in flight.
    if (resetFirst || !accountId) {
      setBranding(EMPTY_BRANDING);
      applyDefaults();
    }

    if (!accountId) {
      return;
    }

    setLoading(true);
    try {
      // GET /accounts/:id/branding returns effective branding (agency / sponsor inheritance).
      const data = await AppApi.getAccountBranding(accountId);
      if (gen !== loadGenRef.current) return;
      setBranding(data || EMPTY_BRANDING);
      applyFromBranding(data);
    } catch {
      if (gen !== loadGenRef.current) return;
      setBranding(EMPTY_BRANDING);
      applyDefaults();
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Reload when account or logged-in user changes (e.g. stop impersonation).
  useEffect(() => {
    loadBranding(currentAccount?.id, {resetFirst: true});
  }, [currentAccount?.id, currentUser?.id, loadBranding]);

  const refreshBranding = useCallback(async () => {
    await loadBranding(currentAccount?.id);
  }, [currentAccount?.id, loadBranding]);

  // Sponsorship accept / plan changes can flip effective branding (sponsor inheritance).
  useEffect(() => {
    const onPlansUpdated = () => {
      if (currentAccount?.id) {
        loadBranding(currentAccount.id);
      }
    };
    window.addEventListener("plans-updated", onPlansUpdated);
    return () => window.removeEventListener("plans-updated", onPlansUpdated);
  }, [currentAccount?.id, loadBranding]);

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
            applyFromBranding(next);
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
