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

  it("after stopping impersonation, never keeps the impersonated account even if the admin is a member of it", () => {
    // Admin also belongs to the customized workspace (id 20), but the stored
    // selection was written while impersonating user 99. It must be dropped in
    // favor of the admin's own first (owned) account.
    const adminWithSharedMembership = {
      id: 1,
      accounts: [
        {id: 10, name: "Opsy", url: "opsy"},
        {id: 20, name: "Custom Agency", url: "custom-agency"},
      ],
    };
    const stored = {
      id: 20,
      name: "Custom Agency",
      url: "custom-agency",
      userId: 99,
    };
    const resolved = resolveCurrentAccount(adminWithSharedMembership, stored);
    expect(resolved.id).toBe(10);
    expect(resolved.userId).toBe(1);
  });

  it("keeps the canonical account written for the restored user", () => {
    // AuthContext persists the restored user's first account (userId matches).
    const stored = {id: 20, name: "Custom Agency", url: "custom-agency", userId: 99};
    const resolved = resolveCurrentAccount(impersonated, stored);
    expect(resolved.id).toBe(20);
    expect(resolved.userId).toBe(99);
  });

  it("strips leading slashes from the account url", () => {
    const stored = {id: 20, name: "Custom Agency", url: "/custom-agency", userId: 99};
    const resolved = resolveCurrentAccount(impersonated, stored);
    expect(resolved.url).toBe("custom-agency");
  });
});
