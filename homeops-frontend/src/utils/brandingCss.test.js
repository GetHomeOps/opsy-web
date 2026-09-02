import {afterEach, describe, expect, it} from "vitest";
import {
  DEFAULT_ACCENT,
  DEFAULT_SIDEBAR_TEXT,
  applyBrandingCss,
  applyDefaultBrandingCss,
  bumpBrandingSession,
  getBrandingSessionGen,
  resetShellBrandingForSessionChange,
} from "./brandingCss";

function readAccent() {
  return document.documentElement.style.getPropertyValue("--opsy-accent").trim();
}

afterEach(() => {
  document.documentElement.style.removeProperty("--opsy-accent");
  document.documentElement.style.removeProperty("--opsy-accent-hover");
  document.documentElement.style.removeProperty("--opsy-accent-fg");
  document.documentElement.style.removeProperty("--opsy-button");
  document.documentElement.style.removeProperty("--opsy-button-hover");
  document.documentElement.style.removeProperty("--opsy-button-fg");
});

describe("brandingCss session reset", () => {
  it("paints a custom accent then restores Opsy defaults on session change", () => {
    applyBrandingCss({accentColor: "#0f3057"});
    expect(readAccent()).toBe("#0f3057");

    const genBefore = getBrandingSessionGen();
    resetShellBrandingForSessionChange();

    expect(readAccent()).toBe(DEFAULT_ACCENT);
    expect(
      document.documentElement.style.getPropertyValue("--opsy-accent-fg").trim(),
    ).toBe(DEFAULT_SIDEBAR_TEXT);
    expect(getBrandingSessionGen()).toBe(genBefore + 1);
  });

  it("applyDefaultBrandingCss does not bump the session generation", () => {
    const genBefore = getBrandingSessionGen();
    applyDefaultBrandingCss();
    expect(getBrandingSessionGen()).toBe(genBefore);
  });

  it("bumpBrandingSession is what in-flight fetches should compare against", () => {
    const started = getBrandingSessionGen();
    bumpBrandingSession();
    expect(getBrandingSessionGen()).not.toBe(started);
  });
});
