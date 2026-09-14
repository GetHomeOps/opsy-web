import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, waitFor} from "@testing-library/react";
import {DEFAULT_ACCENT} from "../utils/brandingCss";

// Hoisted holders so the (hoisted) vi.mock factories can safely reference them.
const mocks = vi.hoisted(() => ({
  authValue: {currentUser: null, impersonation: null},
  currentAccountValue: null,
  getAccountBranding: vi.fn(),
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => mocks.authValue,
}));

vi.mock("../hooks/useCurrentAccount", () => ({
  default: () => ({currentAccount: mocks.currentAccountValue}),
}));

vi.mock("../api/api", () => ({
  default: {
    getAccountBranding: (...args) => mocks.getAccountBranding(...args),
  },
}));

import {
  AccountBrandingProvider,
  useAccountBranding,
} from "./AccountBrandingContext";

function BrandingProbe() {
  const {branding} = useAccountBranding();
  return <div data-testid="logo">{branding.sidebarIconUrl || "none"}</div>;
}

function renderProvider() {
  return render(
    <AccountBrandingProvider>
      <BrandingProbe />
    </AccountBrandingProvider>,
  );
}

function readAccent() {
  return document.documentElement.style.getPropertyValue("--opsy-accent").trim();
}

beforeEach(() => {
  mocks.getAccountBranding.mockReset();
});

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--opsy-accent");
  document.documentElement.style.removeProperty("--opsy-accent-hover");
  document.documentElement.style.removeProperty("--opsy-accent-fg");
  document.documentElement.style.removeProperty("--opsy-button");
  document.documentElement.style.removeProperty("--opsy-button-hover");
  document.documentElement.style.removeProperty("--opsy-button-fg");
});

describe("AccountBrandingProvider branding suppression", () => {
  it("does not load a customer's branding for a non-impersonating super_admin", async () => {
    mocks.authValue = {
      currentUser: {id: 1, role: "super_admin"},
      impersonation: null,
    };
    // Even if an account is selected, an admin must stay on the default shell.
    mocks.currentAccountValue = {id: 20, url: "custom-agency"};
    mocks.getAccountBranding.mockResolvedValue({
      accentColor: "#0f3057",
      sidebarIconUrl: "https://cdn.example/logo.png",
    });

    renderProvider();

    // Give any (unexpected) async fetch a chance to resolve.
    await Promise.resolve();

    expect(mocks.getAccountBranding).not.toHaveBeenCalled();
    expect(screen.getByTestId("logo").textContent).toBe("none");
    expect(readAccent()).toBe(DEFAULT_ACCENT);
  });

  it("loads custom branding while an admin is actively impersonating", async () => {
    mocks.authValue = {
      currentUser: {id: 99, role: "agent"},
      impersonation: {active: true, impersonatorId: 1},
    };
    mocks.currentAccountValue = {id: 20, url: "custom-agency"};
    mocks.getAccountBranding.mockResolvedValue({
      accentColor: "#0f3057",
      sidebarIconUrl: "https://cdn.example/logo.png",
    });

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("logo").textContent).toBe(
        "https://cdn.example/logo.png",
      );
    });
    expect(mocks.getAccountBranding).toHaveBeenCalledWith(20);
    expect(readAccent()).toBe("#0f3057");
  });

  it("keeps the default shell for a plain agent with no selected account", async () => {
    mocks.authValue = {currentUser: {id: 42, role: "agent"}, impersonation: null};
    mocks.currentAccountValue = null;

    renderProvider();
    await Promise.resolve();

    expect(mocks.getAccountBranding).not.toHaveBeenCalled();
    expect(screen.getByTestId("logo").textContent).toBe("none");
    expect(readAccent()).toBe(DEFAULT_ACCENT);
  });
});
