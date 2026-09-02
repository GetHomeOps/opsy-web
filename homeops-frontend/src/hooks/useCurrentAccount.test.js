import {describe, expect, it} from "vitest";
import {resolveCurrentAccount} from "./useCurrentAccount";

const admin = {
  id: 1,
  accounts: [{id: 10, name: "Opsy", url: "opsy"}],
};

const impersonated = {
  id: 99,
  accounts: [{id: 20, name: "Custom Agency", url: "custom-agency"}],
};

describe("resolveCurrentAccount", () => {
  it("ignores a stored account from a different user session", () => {
    const stored = {id: 20, name: "Custom Agency", url: "custom-agency", userId: 99};
    const resolved = resolveCurrentAccount(admin, stored);
    expect(resolved.id).toBe(10);
    expect(resolved.userId).toBe(1);
  });

  it("keeps a stored account that belongs to the current user", () => {
    const stored = {id: 10, name: "Opsy", url: "opsy", userId: 1};
    const resolved = resolveCurrentAccount(admin, stored);
    expect(resolved.id).toBe(10);
  });

  it("falls back to the impersonated user's first account", () => {
    const stored = {id: 10, name: "Opsy", url: "opsy", userId: 1};
    const resolved = resolveCurrentAccount(impersonated, stored);
    expect(resolved.id).toBe(20);
    expect(resolved.userId).toBe(99);
  });
});
