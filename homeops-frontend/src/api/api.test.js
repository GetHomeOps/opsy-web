import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AppApi, { ApiError } from "./api";

describe("AppApi.request auth error handling", () => {
  let fetchStub;

  beforeEach(() => {
    fetchStub = vi.fn();
    vi.stubGlobal("fetch", fetchStub);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    // Ensure no token so we don't try refresh for auth endpoints
    AppApi.token = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auth/token 401: does not attempt refresh, throws ApiError with backend message", async () => {
    fetchStub.mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ error: { message: "Invalid email or password", status: 401 } }),
      statusText: "Unauthorized",
    });

    await expect(AppApi.request("auth/token", { email: "x@y.com", password: "wrong" }, "POST")).rejects.toThrow(
      ApiError
    );

    // Should have been called exactly once (no retry with refresh)
    expect(fetchStub).toHaveBeenCalledTimes(1);

    let caught;
    try {
      await AppApi.request("auth/token", { email: "x@y.com", password: "wrong" }, "POST");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught?.message).toContain("Invalid email or password");
    expect(caught?.status).toBe(401);
  });

  it("protected endpoint 401: attempts refresh; on refresh failure throws Session expired", async () => {
    // First call: protected endpoint returns 401
    fetchStub
      .mockResolvedValueOnce({
        status: 401,
        ok: false,
        json: async () => ({}),
        statusText: "Unauthorized",
      })
      // Second call: refresh endpoint (auth/refresh) - will be called by refreshAccessToken
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

    // Ensure no refresh token so refresh fails
    vi.mocked(localStorage.getItem).mockImplementation((key) => {
      if (key === "app-refresh-token") return null;
      return null;
    });

    const err = await AppApi.request("users/me").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.messages || [err.message]).toContain("Session expired. Please sign in again.");
    expect(err.status).toBe(401);
  });

  it("auth/token is in AUTH_NO_REFRESH", () => {
    expect(AppApi.AUTH_NO_REFRESH.has("auth/token")).toBe(true);
  });
});
