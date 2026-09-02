export const DEFAULT_ACCENT = "#456564";
export const DEFAULT_ACCENT_HOVER = "#34514f";
export const DEFAULT_SIDEBAR_TEXT = "#ffffff";
export const DEFAULT_BUTTON = DEFAULT_ACCENT;
export const DEFAULT_BUTTON_TEXT = "#ffffff";

let brandingSessionGen = 0;

/** Invalidate in-flight branding fetches (e.g. impersonation start/stop). */
export function bumpBrandingSession() {
  brandingSessionGen += 1;
  return brandingSessionGen;
}

export function getBrandingSessionGen() {
  return brandingSessionGen;
}

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

/**
 * Apply shell accent + primary button CSS vars.
 * Button bg falls back to accent; button text defaults to white.
 */
export function applyCssVars({
  accent,
  sidebarText,
  buttonColor,
  buttonTextColor,
} = {}) {
  if (typeof document === "undefined") return;
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

export function applyDefaultBrandingCss() {
  applyCssVars({
    accent: DEFAULT_ACCENT,
    sidebarText: DEFAULT_SIDEBAR_TEXT,
    buttonColor: DEFAULT_BUTTON,
    buttonTextColor: DEFAULT_BUTTON_TEXT,
  });
}

export function applyBrandingCss(data) {
  applyCssVars({
    accent: data?.accentColor || DEFAULT_ACCENT,
    sidebarText: data?.sidebarTextColor || DEFAULT_SIDEBAR_TEXT,
    buttonColor: data?.buttonColor || null,
    buttonTextColor: data?.buttonTextColor || null,
  });
}

/** Drop a foreign accent immediately when the logged-in identity changes. */
export function resetShellBrandingForSessionChange() {
  bumpBrandingSession();
  applyDefaultBrandingCss();
}
