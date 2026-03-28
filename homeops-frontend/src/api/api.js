// In dev/same-origin, use '' (fetch relative to current origin). Otherwise use explicit URL.
// NEVER default to http:// in production - causes "connection not secure" / mixed content.
// When VITE_BASE_URL is unset in prod, use '' so buildApiUrl uses window.location.origin (same-origin).
export const API_BASE_URL =
  import.meta.env.VITE_BASE_URL ??
  (import.meta.env.DEV ? "" : "");
const BASE_URL = API_BASE_URL;

// new URL() requires absolute URL; use window.location.origin when BASE_URL is empty (same-origin deploy)
export function buildApiUrl(endpoint) {
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const base = BASE_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  return new URL(path, base);
}

const TOKEN_STORAGE_KEY = "app-token";
const REFRESH_TOKEN_STORAGE_KEY = "app-refresh-token";

import { emitTierLimit, isTierRestrictionError } from "../utils/tierLimitNotifier";
import {
  MAX_DOCUMENT_UPLOAD_BYTES,
  documentFileTooLargeMessage,
} from "../constants/documentUpload";

export class ApiError extends Error {
  constructor(messages, status = 500) {
    const msg = Array.isArray(messages) ? messages[0] : messages;
    super(typeof msg === "string" ? msg : msg?.message ?? "Request failed");
    this.messages = Array.isArray(messages) ? messages : [messages];
    this.status = status;

    if (
      isTierRestrictionError(status, this.message) &&
      !AppApi._suppressTierEmit
    ) {
      emitTierLimit({ message: this.message, status });
    }
  }
}

/** User-facing copy from API errors (ApiError, fetch failures, etc.). */
export function getApiErrorMessage(err, fallback = "Something went wrong.") {
  if (err == null) return fallback;
  const first = err.messages?.[0];
  if (typeof first === "string" && first.trim()) return first;
  if (first && typeof first === "object" && typeof first.message === "string") {
    return first.message;
  }
  if (typeof err.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

class AppApi {
  static token;
  static _refreshPromise = null;
  /** When true, ApiError will not emit to TierLimitBanner (used when caller shows its own upgrade UI) */
  static _suppressTierEmit = false;

  /** Get token from memory or localStorage (ensures token is available before AuthContext sync) */
  static getToken() {
    if (AppApi.token) return AppApi.token;
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) AppApi.token = stored;
      return stored;
    }
    return null;
  }

  /** Decode JWT payload without verification to read exp. Returns null if invalid. */
  static decodeTokenPayload(token) {
    if (!token || typeof token !== "string") return null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
      );
      return payload;
    } catch {
      return null;
    }
  }

  /** Returns true if token is expired or will expire within bufferSeconds. */
  static isTokenExpiredOrExpiringSoon(token, bufferSeconds = 60) {
    const payload = AppApi.decodeTokenPayload(token);
    if (!payload || typeof payload.exp !== "number") return true;
    return payload.exp * 1000 <= Date.now() + bufferSeconds * 1000;
  }

  /** Refresh token if expired/expiring. Returns fresh token or null. Skips for pure auth endpoints (login, register, etc.). */
  static AUTH_NO_REFRESH = new Set([
    "auth/login",
    "auth/token",
    "auth/register",
    "auth/refresh",
    "auth/forgot-password",
    "auth/reset-password",
    "auth/verify-email",
    "auth/resend-verification",
    "auth/google/signin",
    "auth/google/signup",
    "auth/check-email",
  ]);
  static async ensureValidToken(endpoint) {
    const token = AppApi.getToken();
    if (!token || AppApi.AUTH_NO_REFRESH.has(endpoint)) return token;
    if (!AppApi.isTokenExpiredOrExpiringSoon(token)) return token;
    await AppApi.refreshAccessToken();
    return AppApi.getToken();
  }

  static async refreshAccessToken() {
    if (AppApi._refreshPromise) return AppApi._refreshPromise;

    AppApi._refreshPromise = (async () => {
      try {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        if (!refreshToken) throw new Error("No refresh token");

        const resp = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (!resp.ok) throw new Error("Refresh failed");

        const data = await resp.json();
        AppApi.token = data.accessToken;
        localStorage.setItem(TOKEN_STORAGE_KEY, data.accessToken);
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
        return data.accessToken;
      } catch (err) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        AppApi.token = null;
        const returnTo = typeof window !== "undefined" && window.location?.pathname ? encodeURIComponent(window.location.pathname + window.location.search) : "";
        window.location.href = returnTo ? `/signin?returnTo=${returnTo}` : "/signin";
        throw err;
      } finally {
        AppApi._refreshPromise = null;
      }
    })();

    return AppApi._refreshPromise;
  }

  static async request(endpoint, data = {}, method = "GET", customHeaders = {}) {
    const url = buildApiUrl(endpoint);
    const token = await AppApi.ensureValidToken(endpoint);
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...customHeaders
    };
    url.search = (method === "GET") ? new URLSearchParams(data) : "";
    const body = (method !== "GET") ? JSON.stringify(data) : undefined;

    if (import.meta.env.DEV) {
      console.debug("[API request]", { endpoint, method, status: "(pending)" });
    }
    let resp = await fetch(url, { method, body, headers });
    if (import.meta.env.DEV) {
      console.debug("[API response]", { endpoint, status: resp.status });
    }

    if (resp.status === 401 && !AppApi.AUTH_NO_REFRESH.has(endpoint)) {
      try {
        await AppApi.refreshAccessToken();
        const newToken = AppApi.getToken();
        if (newToken) headers.Authorization = `Bearer ${newToken}`;
        resp = await fetch(url, { method, body, headers });
      } catch {
        throw new ApiError(["Session expired. Please sign in again."], 401);
      }
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const message = errBody?.error?.message ?? resp.statusText;
      const messages = Array.isArray(message) ? message : [message];
      if (import.meta.env.DEV) {
        console.debug("[API error]", { endpoint, status: resp.status, message });
      }
      console.error("API Error:", resp.statusText, resp.status);
      throw new ApiError(messages, resp.status);
    }
    const contentType = resp.headers.get("content-type");
    if (resp.status === 204 || !contentType?.includes("application/json")) {
      return {};
    }
    return await resp.json();
  }

  static async requestFormData(endpoint, formData, method = "POST") {
    const url = buildApiUrl(endpoint);
    const token = await AppApi.ensureValidToken(endpoint);
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };

    let resp = await fetch(url, { method, body: formData, headers });

    if (resp.status === 401 && !AppApi.AUTH_NO_REFRESH.has(endpoint)) {
      try {
        await AppApi.refreshAccessToken();
        const newToken = AppApi.getToken();
        if (newToken) headers.Authorization = `Bearer ${newToken}`;
        resp = await fetch(url, { method, body: formData, headers });
      } catch {
        throw new ApiError(["Session expired. Please sign in again."], 401);
      }
    }

    if (!resp.ok) {
      console.error("API Error:", resp.statusText, resp.status);
      const err = await resp.json().catch(() => ({}));
      const message = err?.error?.message || resp.statusText;
      const messages = Array.isArray(message) ? message : [message];
      throw new ApiError(messages, resp.status);
    }
    return await resp.json();
  }

  /* --------- Users --------- */

  static async getCurrentUser(username) {
    let res = await this.request(`users/${username}`);
    return res.user;
  }

  static async login(data) {
    const res = await this.request(`auth/token`, data, "POST");
    if (res.mfaRequired && (res.mfaTicket || res.mfaPendingToken)) {
      return {
        mfaRequired: true,
        mfaTicket: res.mfaTicket || res.mfaPendingToken,
      };
    }
    return { accessToken: res.accessToken, refreshToken: res.refreshToken };
  }

  static async verifyMfa(mfaTicket, codeOrBackupCode) {
    const res = await fetch(`${BASE_URL}/auth/mfa/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mfaTicket}`,
      },
      body: JSON.stringify({ codeOrBackupCode, tokenOrBackupCode: codeOrBackupCode }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody?.error?.message ?? res.statusText;
      throw new ApiError(Array.isArray(message) ? message : [message], res.status);
    }
    return res.json();
  }

  static async signup(data) {
    let res = await this.request(`auth/register`, data, "POST");
    return res;
  }

  static async verifyEmailWithToken(token) {
    const url = buildApiUrl("auth/verify-email");
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({token}),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const message = errBody?.error?.message ?? res.statusText;
      throw new ApiError(Array.isArray(message) ? message : [message], res.status);
    }
    return res.json();
  }

  static async resendVerificationEmail(email) {
    return this.request("auth/resend-verification", {email}, "POST");
  }

  /** Fetch current authenticated user + accounts in one request. */
  static async getAuthBootstrap() {
    const res = await this.request("auth/bootstrap");
    return res.user;
  }

  /** Check if a user already exists with this email (for signup flow). Returns { exists: boolean }. */
  static async checkEmailExists(email) {
    const res = await this.request(`auth/check-email`, { email }, "GET");
    return res;
  }

  static async saveProfile(username, data) {
    let res = await this.request(`users/${username}`, data, "PATCH");
    return res.user;
  }

  /** Mark welcome modal as dismissed for the current user. Persists on backend. */
  static async dismissWelcomeModal(userId) {
    const res = await this.request(`users/${userId}`, { welcome_modal_dismissed: true }, "PATCH");
    return res.user;
  }

  static async getAllUsers() {
    let res = await this.request(`users`);
    return res.users;
  }

  static async getUsersByAccountId(accountId) {
    let res = await this.request(`users/account/${accountId}`);
    return res.users;
  }

  static async getUsersByAgentId(agentId) {
    let res = await this.request(`users/agent/${agentId}`);
    return res.users;
  }

  static async getAgents() {
    let res = await this.request("users/agents");
    return res.agents ?? [];
  }

  static async updateUser(id, data) {
    let res = await this.request(`users/${id}`, data, 'PATCH');
    return res.user;
  }

  static async adminCreateUser(data) {
    let res = await this.request(`users`, data, "POST");
    return res.user;
  }

  static async deleteUser(id) {
    let res = await this.request(`users/${id}`, {}, 'DELETE');
    return res;
  }

  static async activateUser(data) {
    let res = await this.request(`users/activate/${data.userId}`, data, 'POST');
    return res;
  }

  /* --------- Accounts --------- */

  static async createAccount(data) {
    let res = await this.request(`accounts`, data, "POST");
    return res.account;
  }

  static async addUserToAccount(data) {
    let res = await this.request(`accounts/account_users`, data, "POST");
    return res.accountUser;
  }

  static async getUserAccounts(userId) {
    let res = await this.request(`accounts/user/${userId}`);
    return res.accounts;
  }

  /* --------- Invitations --------- */

  static async createInvitation(data) {
    let res = await this.request(`invitations`, data, "POST");
    return res;
  }

  static async acceptInvitation(id, data) {
    let res = await this.request(`invitations/${id}/accept`, data, "POST");
    return res;
  }

  static async declineInvitation(id) {
    let res = await this.request(`invitations/${id}/decline`, {}, "POST");
    return res;
  }

  static async revokeInvitation(id) {
    let res = await this.request(`invitations/${id}/revoke`, {}, "POST");
    return res;
  }

  static async resendInvitation(id) {
    return this.request(`invitations/${id}/resend`, {}, "POST");
  }

  static async getSentInvitations() {
    let res = await this.request(`invitations/sent`);
    return res.invitations;
  }

  static async getPropertyInvitations(propertyId, params = {}) {
    let res = await this.request(`invitations/property/${propertyId}`, params);
    return res.invitations;
  }

  static async getAccountInvitations(accountId, params = {}) {
    let res = await this.request(`invitations/account/${accountId}`, params);
    return res.invitations;
  }

  static async getReceivedInvitations(params = {}) {
    let res = await this.request("invitations/received", params);
    return res.invitations;
  }

  static async acceptInvitationInApp(invitationId) {
    return this.request(`invitations/${invitationId}/accept-in-app`, {}, "POST");
  }

  static async confirmInvitation(data) {
    let res = await this.request(`auth/confirm`, data, 'POST');
    return res;
  }

  static async changePassword(currentPassword, newPassword) {
    return this.request(`auth/change-password`, { currentPassword, newPassword }, "POST");
  }

  static async requestPasswordReset(email) {
    return this.request(`auth/forgot-password`, { email }, "POST");
  }

  static async resetPassword(token, newPassword) {
    return this.request(`auth/reset-password`, { token, newPassword }, "POST");
  }

  static async completeOnboarding(data) {
    return this.request(`auth/complete-onboarding`, data, "POST");
  }

  /* --------- Billing --------- */

  static async getBillingPlans(audience) {
    const res = await this.request(`billing/plans/${audience}`);
    return res;
  }

  static async createCheckoutSession({ planCode, billingInterval, successUrl, cancelUrl }) {
    const res = await this.request(`billing/checkout-session`, {
      planCode,
      billingInterval: billingInterval || "month",
      successUrl,
      cancelUrl,
    }, "POST");
    return res;
  }

  /** Switch account to a free / zero-cost plan (cancels Stripe sub when applicable). */
  static async downgradeToPlan({ planCode, accountId }) {
    const body = { planCode };
    if (accountId != null) body.accountId = accountId;
    return this.request(`billing/downgrade-to-plan`, body, "POST");
  }

  static async createPortalSession({ accountId, returnUrl }) {
    const res = await this.request(`billing/portal-session`, { accountId, returnUrl }, "POST");
    return res;
  }

  static async getBillingStatus(accountId) {
    const params = accountId ? { accountId } : {};
    const res = await this.request(`billing/status`, params);
    return res;
  }

  static async getBillingPaymentMethod(accountId) {
    const params = accountId ? { accountId } : {};
    return this.request(`billing/payment-method`, params);
  }

  static async getBillingInvoices(accountId, limit = 12) {
    const params = { limit };
    if (accountId) params.accountId = accountId;
    return this.request(`billing/invoices`, params);
  }

  /** Super Admin: reconcile a user's Stripe billing state into local DB */
  static async reconcileUserBilling(userId) {
    return this.request(`billing/admin/reconcile-user/${userId}`, {}, "POST");
  }

  /** Super Admin: list all plans with limits and prices */
  static async getBillingPlansAll() {
    const res = await this.request(`billing/plans`);
    return res;
  }

  /** Super Admin: update plan (name, description, etc.) */
  static async updateBillingPlan(id, data) {
    const res = await this.request(`billing/plans/${id}`, data, "PATCH");
    return res;
  }

  /** Super Admin: update plan limits */
  static async updateBillingPlanLimits(id, limits) {
    const res = await this.request(`billing/plans/${id}/limits`, limits, "PATCH");
    return res;
  }

  /** Super Admin: update plan price */
  static async updateBillingPlanPrice(id, billingInterval, stripePriceId) {
    const res = await this.request(`billing/plans/${id}/prices`, { billingInterval, stripePriceId: stripePriceId || null }, "PATCH");
    return res;
  }

  /** Super Admin: update plan features */
  static async updateBillingPlanFeatures(id, features) {
    const res = await this.request(`billing/plans/${id}/features`, { features }, "PATCH");
    return res;
  }

  /** Super Admin: toggle "most popular" on a plan (clears siblings of same role) */
  static async setBillingPlanPopular(id, popular) {
    const res = await this.request(`billing/plans/${id}/popular`, { popular }, "PATCH");
    return res;
  }

  /** Super Admin: fetch active Stripe prices for dropdown */
  static async getStripePrices() {
    const res = await this.request(`billing/stripe/prices`);
    return res;
  }

  /* --------- MFA --------- */

  static async getMfaStatus() {
    return this.request("mfa/status");
  }

  static async mfaSetup() {
    return this.request("mfa/setup", {}, "POST");
  }

  static async mfaConfirm(token) {
    return this.request("mfa/confirm", { token }, "POST");
  }

  static async mfaDisable({ codeOrBackupCode, password }) {
    return this.request("mfa/disable", { codeOrBackupCode, password }, "POST");
  }

  /* --------- Calendar Integrations --------- */

  /** Get connected calendar integrations (Google, Outlook). */
  static async getCalendarIntegrations() {
    const res = await this.request("calendar-integrations");
    return res.integrations ?? [];
  }

  /** Disconnect a calendar integration. */
  static async deleteCalendarIntegration(id) {
    await this.request(`calendar-integrations/${id}`, {}, "DELETE");
  }

  /**
   * Get OAuth connect URL for a calendar provider. Requires auth (JWT). Returns the Google/Outlook OAuth URL
   * so the frontend can redirect. Use this instead of direct navigation to /connect (which fails with 401
   * because links don't send the Authorization header).
   * @param {string} provider - "google" | "outlook"
   * @param {string} [returnTo] - Path to return to after OAuth (e.g. "acme/settings/configuration")
   * @returns {Promise<{ url: string }>}
   */
  static async getCalendarConnectUrl(provider, returnTo = "") {
    const params = returnTo ? { returnTo } : {};
    const res = await this.request(`calendar-integrations/oauth/${provider}/url`, params);
    return res;
  }

  static async revokeRefreshToken(refreshToken) {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Don't block logout on backend failure
    }
  }

  /* --------- Contacts --------- */

  static async getAllContacts() {
    try {
      let res = await this.request(`contacts/`);
      return res.contacts;
    } catch (error) {
      console.error("API: Error in getAllContacts:", error);
      return [];
    }
  }

  static async getContactsByAccountId(accountId) {
    let res = await this.request(`contacts/account/${accountId}`);
    return res.contacts;
  }

  static async getTagsByAccountId(accountId) {
    let res = await this.request(`contacts/account/${accountId}/tags`);
    return res.tags || [];
  }

  static async createTag(accountId, { name, color }) {
    let res = await this.request(`contacts/account/${accountId}/tags`, { name, color }, "POST");
    return res.tag;
  }

  static async deleteTag(accountId, tagId) {
    await this.request(`contacts/account/${accountId}/tags/${tagId}`, {}, "DELETE");
  }

  static async getContact(id) {
    let res = await this.request(`contacts/${id}`);
    return res.contact;
  }

  static async updateContact(id, data) {
    let res = await this.request(`contacts/${id}`, data, 'PATCH');
    return res.contact;
  }

  static async deleteContact(id) {
    let res = await this.request(`contacts/${id}`, {}, 'DELETE');
    return res;
  }

  static async createContact(data) {
    try {
      let res = await this.request(`contacts`, data, 'POST');
      if (!res || !res.contact) {
        throw new Error("Invalid response from server");
      }
      return res.contact;
    } catch (error) {
      console.error("Error in createContact:", error);
      throw error;
    }
  }

  /* --------- Properties --------- */

  static async createProperty(data) {
    let res = await this.request(`properties`, data, 'POST');
    return res.property;
  }

  static async getAllProperties() {
    let res = await this.request(`properties`);
    return res.properties;
  }

  static async getPropertyById(uid) {
    let res = await this.request(`properties/${uid}`);
    return res.property;
  }

  static async getPropertiesByUserId(userId) {
    let res = await this.request(`properties/user/${userId}`);
    return res.properties;
  }

  static async getPropertyTeam(uid) {
    let res = await this.request(`properties/team/${uid}`);
    return res;
  }

  static async getAgentByAccountId(accountId) {
    let res = await this.request(`properties/agent/account/${accountId}`);
    return res.users;
  }

  static async addUsersToProperty(propertyId, users) {
    let res = await this.request(`properties/${propertyId}/users`, users, 'POST');
    return res.property;
  }

  static async updateProperty(propertyId, data) {
    let res = await this.request(`properties/${propertyId}`, data, 'PATCH');
    return res.property;
  }

  static async deleteProperty(propertyId) {
    await this.request(`properties/${propertyId}`, {}, 'DELETE');
    return { deleted: true };
  }

  static async updatePropertyTeam(propertyId, team) {
    let res = await this.request(`properties/${propertyId}/team`, team, 'PATCH');
    return res.property;
  }

  /** Current owner requests transfer; recipient gets a notification to accept or decline. */
  static async requestPropertyOwnershipTransfer(propertyId, toUserId) {
    return this.request(
      `properties/${propertyId}/ownership-transfer-request`,
      {toUserId},
      "POST",
    );
  }

  static async acceptOwnershipTransferRequest(requestId) {
    return this.request(
      `properties/ownership-transfer-requests/${requestId}/accept`,
      {},
      "POST",
    );
  }

  static async declineOwnershipTransferRequest(requestId) {
    return this.request(
      `properties/ownership-transfer-requests/${requestId}/decline`,
      {},
      "POST",
    );
  }

  /* --------- Systems --------- */

  static async createSystem(data) {
    let res = await this.request(`systems/${data.property_id}`, data, 'POST');
    return res.system;
  }

  static async updateSystem(systemId, data) {
    let res = await this.request(`systems/${systemId}`, data, 'PATCH');
    return res.system;
  }

  static async batchUpdateSystems(propertyId, systems) {
    let res = await this.request(`systems/${propertyId}/batch`, { systems }, 'PUT');
    return res;
  }

  static async getSystemsByPropertyId(propertyId) {
    let res = await this.request(`systems/${propertyId}`);
    return res;
  }

  /** Get property AI summary state (for Systems tab badge, before/after view). */
  static async getPropertyAiSummary(propertyId) {
    let res = await this.request(`ai/property-ai-summary/${propertyId}`);
    return res.aiSummary;
  }

  /** Get property AI reanalysis audit trail (before/after comparison). */
  static async getPropertyAiAudit(propertyId, limit = 20) {
    let res = await this.request(`ai/property-ai-audit/${propertyId}?limit=${limit}`);
    return res.audit;
  }

  /* --------- Maintenance Records --------- */

  static async createMaintenanceRecords(propertyId, records) {
    const res = await this.request(`maintenance/${propertyId}`, { maintenanceRecords: records }, "POST");
    return res.maintenanceRecords;
  }

  static async createMaintenanceRecord(data) {
    let res = await this.request(`maintenance/record/${data.property_id}`, data, 'POST');
    return res.maintenanceRecord ?? res.maintenance;
  }

  static async updateMaintenanceRecord(id, data) {
    const res = await this.request(`maintenance/${id}`, data, "PATCH");
    return res.maintenance;
  }

  static async deleteMaintenanceRecord(id, propertyId) {
    const qs = propertyId ? `?propertyId=${propertyId}` : "";
    await this.request(`maintenance/${id}${qs}`, {}, "DELETE");
  }

  static async getMaintenanceRecordsByPropertyId(propertyId) {
    let res = await this.request(`maintenance/${propertyId}`);
    return res.maintenanceRecords;
  }

  /** Send maintenance report link to contractor via email. */
  static async sendMaintenanceToContractor(recordId, { contractorEmail, contractorName } = {}) {
    const res = await this.request(`maintenance/${recordId}/send-to-contractor`, { contractorEmail, contractorName }, "POST");
    return res;
  }

  /* --------- Maintenance Events (Calendar) --------- */

  /**
   * Get unified home events: reminders, scheduled work, next alert.
   */
  static async getHomeEvents() {
    const res = await this.request("maintenance-events/home-events");
    return res;
  }

  /**
   * Get inspection + maintenance events for the current user in a date range.
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate - YYYY-MM-DD
   * @returns {Promise<Array>} events
   */
  static async getCalendarEvents(startDate, endDate) {
    const res = await this.request("maintenance-events/calendar", {
      start: startDate,
      end: endDate,
    });
    return res.events ?? [];
  }

  /**
   * Get maintenance events for a property.
   * @param {string|number} propertyId - property ID or UID
   * @returns {Promise<Array>} events
   */
  static async getMaintenanceEventsByProperty(propertyId) {
    const res = await this.request(`maintenance-events/${propertyId}`);
    return res.events ?? [];
  }

  /**
   * Get AI maintenance advice for a system.
   * @param {string|number} propertyId - property ID or UID
   * @param {Object} context - { systemType, systemName, systemContext? }
   * @returns {Promise<{ recommendedFrequency, riskWarning, suggestedQuestions, suggestions }>}
   */
  static async getAIMaintenanceAdvice(propertyId, { systemType, systemName, systemContext = {}, scheduleType = null }) {
    const res = await this.request(
      `maintenance-events/${propertyId}/ai-advice`,
      { systemType, systemName, systemContext, scheduleType },
      "POST"
    );
    return res.advice;
  }

  /**
   * Create a maintenance event for a property.
   * @param {string} propertyId - property UID
   * @param {Object} payload - event payload (system_key, scheduled_date, etc.)
   */
  static async createMaintenanceEvent(propertyId, payload) {
    const res = await this.request(`maintenance-events/${propertyId}`, payload, "POST");
    return res.event;
  }

  /**
   * Delete a maintenance event.
   * @param {string|number} eventId - maintenance event id
   */
  static async deleteMaintenanceEvent(eventId) {
    await this.request(`maintenance-events/${eventId}`, {}, "DELETE");
  }

  /* --------- Documents --------- */

  static async getPresignedPreviewUrl(key) {
    if (!key) throw ["Document key is required"];
    let res = await this.request("documents/presigned-preview", { key }, "GET");
    return res.url;
  }

  /** Presigned URL for inline images with correct Content-Type (fixes ERR_BLOCKED_BY_ORB). */
  static async getInlineImageUrl(key) {
    if (!key) throw ["Document key is required"];
    let res = await this.request("documents/inline-image-url", { key }, "GET");
    return res.url;
  }

  static async uploadDocument(file) {
    if (
      file &&
      typeof file.size === "number" &&
      file.size > MAX_DOCUMENT_UPLOAD_BYTES
    ) {
      throw new ApiError([documentFileTooLargeMessage()], 400);
    }
    const formData = new FormData();
    formData.append("file", file);
    let res = await this.requestFormData("documents/upload", formData);
    return res.document;
  }

  /* --------- Property Documents --------- */

  static async createPropertyDocument(data) {
    const prev = AppApi._suppressTierEmit;
    AppApi._suppressTierEmit = true;
    try {
      const res = await this.request("propertyDocuments", data, "POST");
      return res.document;
    } finally {
      AppApi._suppressTierEmit = prev;
    }
  }

  static async getPropertyDocuments(propertyId) {
    const res = await this.request(`propertyDocuments/property/${propertyId}`);
    return res.documents ?? [];
  }

  static async getPropertyDocument(id) {
    const res = await this.request(`propertyDocuments/${id}`);
    return res.document;
  }

  static async deletePropertyDocument(id) {
    await this.request(`propertyDocuments/${id}`, {}, "DELETE");
  }

  /* --------- Subscriptions --------- */

  static async getAllSubscriptions(filters = {}) {
    let res = await this.request(`subscriptions`, filters);
    const raw = res.subscriptions || [];
    return raw.map((s) => ({
      ...s,
      databaseName: s.accountName ?? s.databaseName,
      userName: s.ownerName ?? s.userName,
      userEmail: s.ownerEmail ?? s.userEmail,
      subscriptionProductName: s.productName ?? s.subscriptionProductName,
      subscriptionProductPrice: s.productPrice ?? s.subscriptionProductPrice,
      subscriptionStatus: s.status ?? s.subscriptionStatus,
      userType: s.ownerRole ?? s.targetRole ?? null,
    }));
  }

  static async getSubscription(id) {
    let res = await this.request(`subscriptions/${id}`);
    const s = res.subscription;
    if (!s) return null;
    return {
      ...s,
      databaseName: s.accountName ?? s.databaseName,
      userName: s.ownerName ?? s.userName,
      userEmail: s.ownerEmail ?? s.userEmail,
      subscriptionProductName: s.productName ?? s.subscriptionProductName,
      subscriptionProductPrice: s.productPrice ?? s.subscriptionProductPrice,
      subscriptionStatus: s.status ?? s.subscriptionStatus,
      userType: s.ownerRole ?? s.targetRole ?? null,
      accountName: s.accountName ?? s.databaseName,
    };
  }

  static async getSubscriptionsByAccountId(accountId) {
    let res = await this.request(`subscriptions/account/${accountId}`);
    return res.subscriptions;
  }

  static async createSubscription(data) {
    let res = await this.request(`subscriptions`, data, "POST");
    return res.subscription;
  }

  /** Create subscription for own account (agents/homeowners) */
  static async createAccountSubscription(data) {
    let res = await this.request(`subscriptions/account`, data, "POST");
    return res.subscription;
  }

  static async updateSubscription(id, data) {
    let res = await this.request(`subscriptions/${id}`, data, "PATCH");
    return res.subscription;
  }

  static async deleteSubscription(id) {
    return this.request(`subscriptions/${id}`, {}, "DELETE");
  }

  /** Backfill: create default subscription for accounts that have none. Super admin only. */
  static async backfillSubscriptions() {
    return this.request(`subscriptions/backfill`, {}, "POST");
  }

  /* --------- Subscription Products --------- */

  static async getAllSubscriptionProducts() {
    let res = await this.request(`subscription-products`);
    return res.products;
  }

  static async getSubscriptionProductsByRole(role) {
    let res = await this.request(`subscription-products/for-role/${role}`);
    return res.products || [];
  }

  static async getSubscriptionProduct(id) {
    let res = await this.request(`subscription-products/${id}`);
    return res.product;
  }

  /** Get default plan features from JSON (for new products). Super Admin only. */
  static async getDefaultPlanFeatures() {
    const res = await this.request(`subscription-products/default-features`);
    return res.features || [];
  }

  static async createSubscriptionProduct(data) {
    let res = await this.request(`subscription-products`, data, "POST");
    return res.product;
  }

  static async updateSubscriptionProduct(id, data) {
    let res = await this.request(`subscription-products/${id}`, data, "PATCH");
    return res.product;
  }

  static async deleteSubscriptionProduct(id) {
    let res = await this.request(`subscription-products/${id}`, {}, "DELETE");
    return res;
  }

  /** Archive a subscription product (sets isActive: false). No deletion. */
  static async archiveSubscriptionProduct(id) {
    const res = await this.request(`subscription-products/${id}`, { isActive: false }, "PATCH");
    return res.product;
  }

  /* --------- Inspection Report Analysis --------- */

  static async startInspectionAnalysis(propertyId, { s3Key, fileName, mimeType }) {
    const res = await this.request(`properties/${propertyId}/inspection-report/analyze`, {
      s3Key,
      fileName: fileName || null,
      mimeType: mimeType || null,
    }, "POST");
    return res.jobId;
  }

  static async getInspectionAnalysisJob(jobId) {
    const res = await this.request(`inspection-analysis/jobs/${jobId}`);
    return res;
  }

  static async getInspectionAnalysisByProperty(propertyId, query = {}) {
    const res = await this.request(
      `properties/${propertyId}/inspection-analysis`,
      query,
      "GET"
    );
    return res;
  }

  /* --------- Inspection Checklist --------- */

  static async getInspectionChecklist(propertyId, { systemKey, status } = {}) {
    const params = {};
    if (systemKey) params.systemKey = systemKey;
    if (status) params.status = status;
    const res = await this.request(`properties/${propertyId}/inspection-checklist`, params, "GET");
    return res.items ?? [];
  }

  static async getInspectionChecklistProgress(propertyId) {
    const res = await this.request(`properties/${propertyId}/inspection-checklist/progress`, {}, "GET");
    return res.progress ?? { total: 0, completed: 0, pending: 0, bySystem: {} };
  }

  static async updateChecklistItem(itemId, data) {
    const res = await this.request(`inspection-checklist/${itemId}`, data, "PATCH");
    return res.item;
  }

  static async completeChecklistItem(itemId, { maintenanceId, notes } = {}) {
    const res = await this.request(`inspection-checklist/${itemId}/complete`, {
      maintenanceId: maintenanceId || null,
      notes: notes || null,
    }, "POST");
    return res.item;
  }

  static async createChecklistItem(propertyId, { systemKey, title, description, priority }) {
    const res = await this.request(`properties/${propertyId}/inspection-checklist`, {
      systemKey,
      title,
      description: description || null,
      priority: priority || "medium",
    }, "POST");
    return res.item;
  }

  static async deleteChecklistItem(itemId) {
    const res = await this.request(`inspection-checklist/${itemId}`, {}, "DELETE");
    return res;
  }

  /* --------- Property Contractors --------- */

  static async getPropertyContractors(propertyId, query = "") {
    const res = await this.request(`properties/${propertyId}/contractors`, { query }, "GET");
    return res.contractors ?? [];
  }

  /* --------- AI Chat --------- */

  static async getAiSystemContext(propertyId, systemId) {
    const res = await this.request("ai/system-context", { propertyId, systemId }, "GET");
    return res;
  }

  static async aiChat({ conversationId, propertyId, message, systemContext, contextType }) {
    const res = await this.request("ai/chat", {
      conversationId,
      propertyId,
      message,
      systemContext,
      contextType,
    }, "POST");
    return res;
  }

  static async aiSelectContractor(actionDraftId, { contractorId, contractorSource, contractorName }) {
    const res = await this.request(`ai/actions/${actionDraftId}/select-contractor`, {
      contractorId,
      contractorSource,
      contractorName,
    }, "POST");
    return res;
  }

  static async aiConfirmSchedule(actionDraftId, { scheduledFor, scheduledTime, eventType, notes, systemKey }) {
    const res = await this.request(`ai/actions/${actionDraftId}/confirm-schedule`, {
      scheduledFor,
      scheduledTime: scheduledTime || undefined,
      eventType: eventType || undefined,
      notes,
      systemKey: systemKey || undefined,
    }, "POST");
    return res;
  }

  static async aiLoadConversation(propertyId) {
    const res = await this.request("ai/conversations/latest", { propertyId }, "GET");
    return res;
  }

  static async aiResetConversation(conversationId) {
    const res = await this.request(`ai/conversations/${conversationId}`, {}, "DELETE");
    return res;
  }

  static async aiIngestDocuments(propertyId) {
    const res = await this.request("ai/ingest-documents", { propertyId }, "POST");
    return res;
  }

  /* --------- Property Data Lookup (ATTOM / RentCast) --------- */

  static async lookupPropertyDetails(propertyInfo) {
    let res = await this.request("predict/property-details", propertyInfo, "POST");
    return res;
  }

  /* --------- Platform Analytics --------- */

  static async getAnalyticsSummary() {
    let res = await this.request("analytics/summary");
    return res.summary;
  }

  static async getAnalyticsDaily(params = {}) {
    let res = await this.request("analytics/daily", params);
    return res.metrics;
  }

  static async getAnalyticsGrowth(entity, months = 12) {
    let res = await this.request("analytics/growth/" + entity, { months });
    return res.growth;
  }

  static async getAnalyticsAccounts() {
    let res = await this.request("analytics/accounts");
    return res.analytics;
  }

  static async getAnalyticsAccountById(accountId) {
    let res = await this.request(`analytics/accounts/${accountId}`);
    return res.analytics;
  }

  /* --------- Cost Analytics (Dashboard) --------- */

  static async getCostSummary(params = {}) {
    let res = await this.request("analytics/costs/summary", params);
    return res.summary;
  }

  static async getCostPerAccount(params = {}) {
    let res = await this.request("analytics/costs/per-account", params);
    return res.accounts;
  }

  static async getCostPerUser(params = {}) {
    let res = await this.request("analytics/costs/per-user", params);
    return res.users ?? [];
  }

  static async getAgentAnalytics() {
    let res = await this.request("analytics/agents");
    return res.agents ?? [];
  }

  static async getPropertyAnalytics() {
    let res = await this.request("analytics/properties");
    return res.properties ?? [];
  }

  /* --------- Platform Engagement --------- */

  static async getEngagementCounts(params = {}) {
    let res = await this.request("engagement/counts", params);
    return res.counts;
  }

  static async getEngagementTrend(params = {}) {
    let res = await this.request("engagement/trend", params);
    return res.trend;
  }

  static async logEngagementEvent(eventType, eventData = {}) {
    await this.request("engagement", { eventType, eventData }, "POST");
  }

  /* --------- Professional Categories --------- */

  static async getAllProfessionalCategories() {
    let res = await this.request("professional-categories");
    return res.categories;
  }

  static async getProfessionalCategoryHierarchy() {
    let res = await this.request("professional-categories/hierarchy");
    return res.hierarchy;
  }

  static async getProfessionalCategory(id) {
    let res = await this.request(`professional-categories/${id}`);
    return res.category;
  }

  static async createProfessionalCategory(data) {
    let res = await this.request("professional-categories", data, "POST");
    return res.category;
  }

  static async updateProfessionalCategory(id, data) {
    let res = await this.request(`professional-categories/${id}`, data, "PATCH");
    return res.category;
  }

  static async deleteProfessionalCategory(id) {
    return this.request(`professional-categories/${id}`, {}, "DELETE");
  }

  static async seedProfessionalCategories() {
    let res = await this.request("professional-categories/seed", {}, "POST");
    return res;
  }

  /* --------- Professionals --------- */

  static async getAllProfessionals(filters = {}) {
    const params = {};
    if (filters.category_id != null) params.category_id = filters.category_id;
    if (filters.subcategory_id != null) params.subcategory_id = filters.subcategory_id;
    if (filters.city) params.city = filters.city;
    if (filters.state) params.state = filters.state;
    if (filters.search) params.search = filters.search;
    if (filters.min_rating != null) params.min_rating = filters.min_rating;
    if (filters.budget_level) params.budget_level = filters.budget_level;
    if (filters.language) params.language = filters.language;
    if (filters.is_verified) params.is_verified = "true";
    const res = await this.request("professionals", params);
    return res.professionals;
  }

  static async getProfessional(id) {
    let res = await this.request(`professionals/${id}`);
    return res.professional;
  }

  /** Get reviews for a professional. */
  static async getProfessionalReviews(professionalId) {
    const res = await this.request(`professionals/${professionalId}/reviews`);
    return { reviews: res.reviews ?? [], aggregate: res.aggregate ?? {} };
  }

  /** Check if current user can submit a review. */
  static async getProfessionalReviewEligibility(professionalId) {
    return this.request(`professionals/${professionalId}/review-eligibility`);
  }

  /** Create a review (backend validates eligibility and one-per-user). */
  static async createProfessionalReview(professionalId, { rating, comment }) {
    const res = await this.request(`professionals/${professionalId}/reviews`, {
      rating,
      comment: comment || null,
    }, "POST");
    return res.review;
  }

  /** Send a contact message to a professional (backend delivers via AWS SES). */
  static async contactProfessional(professionalId, { message, replyToEmail }) {
    const body = { message };
    if (replyToEmail != null && String(replyToEmail).trim()) {
      body.replyToEmail = String(replyToEmail).trim();
    }
    return this.request(`professionals/${professionalId}/contact`, body, "POST");
  }

  static async createProfessional(data) {
    let res = await this.request("professionals", data, "POST");
    return res.professional;
  }

  static async updateProfessional(id, data) {
    let res = await this.request(`professionals/${id}`, data, "PATCH");
    return res.professional;
  }

  static async deleteProfessional(id) {
    return this.request(`professionals/${id}`, {}, "DELETE");
  }

  static async addProfessionalPhoto(professionalId, data) {
    let res = await this.request(`professionals/${professionalId}/photos`, data, "POST");
    return res.photo;
  }

  static async removeProfessionalPhoto(professionalId, photoId) {
    return this.request(`professionals/${professionalId}/photos/${photoId}`, {}, "DELETE");
  }

  /* --------- Saved Professionals --------- */

  static async getSavedProfessionals() {
    const res = await this.request("saved-professionals");
    return res.professionals ?? [];
  }

  static async saveProfessional(professionalId) {
    await this.request(`saved-professionals/${professionalId}`, {}, "POST");
  }

  static async unsaveProfessional(professionalId) {
    await this.request(`saved-professionals/${professionalId}`, {}, "DELETE");
  }

  /* --------- Support Tickets --------- */

  static async createSupportTicket(data) {
    const res = await this.request("support-tickets", data, "POST");
    return res.ticket;
  }

  static async getMySupportTickets() {
    const res = await this.request("support-tickets/my");
    return res.tickets ?? [];
  }

  static async getAllSupportTickets() {
    const res = await this.request("support-tickets");
    return res.tickets ?? [];
  }

  static async getSupportTicket(id) {
    const res = await this.request(`support-tickets/${id}`);
    return res.ticket;
  }

  static async updateSupportTicket(id, data) {
    const res = await this.request(`support-tickets/${id}`, data, "PATCH");
    return res.ticket;
  }

  static async addSupportTicketReply(id, body) {
    const res = await this.request(`support-tickets/${id}/replies`, { body }, "POST");
    return res.ticket;
  }

  static async getSupportAssignmentAdmins() {
    const res = await this.request("support-tickets/assignment-admins");
    return res.admins ?? [];
  }

  /* --------- Resources (Discover feed) --------- */

  static async getResources(params = {}) {
    const res = await this.request("resources", params);
    return res.resources ?? [];
  }

  static async getResourceRecipientOptions() {
    const res = await this.request("resources/recipients/options");
    return res;
  }

  static async estimateResourceRecipients(data) {
    const res = await this.request("resources/recipients/estimate", data, "POST");
    return res.count ?? 0;
  }

  static async sendResource(id) {
    const res = await this.request(`resources/${id}/send`, {}, "POST");
    return res;
  }

  static async activateResource(id) {
    const res = await this.request(`resources/${id}/activate`, {}, "POST");
    return res.resource;
  }

  static async getResource(id) {
    const res = await this.request(`resources/${id}`);
    const resource = res.resource;
    // Migrate legacy article_link -> web_link
    if (resource?.type === "article_link") {
      resource.type = "web_link";
    }
    return resource;
  }

  /** Get a sent resource for viewing (any logged-in user). Used by ResourceViewer. */
  static async getResourceView(id) {
    const res = await this.request(`resources/${id}/view`);
    const resource = res.resource ?? res;
    // Migrate legacy article_link -> web_link
    if (resource?.type === "article_link") {
      resource.type = "web_link";
    }
    return { ...res, resource };
  }

  static async getResourcesAdmin(params = {}) {
    const res = await this.request("resources/admin", params);
    return res.resources ?? [];
  }

  static async createResource(data) {
    const res = await this.request("resources", data, "POST");
    return res.resource;
  }

  static async updateResource(id, data) {
    const res = await this.request(`resources/${id}`, data, "PATCH");
    return res.resource;
  }

  static async deleteResource(id) {
    await this.request(`resources/${id}`, {}, "DELETE");
  }

  /* --------- Communications (refactored) --------- */

  static async getCommunications(accountId, params = {}) {
    const res = await this.request("communications", { accountId, ...params });
    return res.communications ?? [];
  }

  /** Get communications sent to current user (for Discover feed). */
  static async getCommunicationsForRecipient(params = {}) {
    const res = await this.request("communications/received", params);
    return res.communications ?? [];
  }

  /** Get a communication for viewing (recipient must be in comm_recipients). */
  static async getCommunicationView(id) {
    const res = await this.request(`communications/${id}/view`);
    return res;
  }

  static async getCommunication(id) {
    const res = await this.request(`communications/${id}`);
    return res;
  }

  static async createCommunication(data) {
    const res = await this.request("communications", data, "POST");
    return res;
  }

  static async updateCommunication(id, data) {
    const res = await this.request(`communications/${id}`, data, "PATCH");
    return res;
  }

  static async deleteCommunication(id) {
    await this.request(`communications/${id}`, {}, "DELETE");
  }

  static async sendCommunication(id) {
    const res = await this.request(`communications/${id}/send`, {}, "POST");
    return res;
  }

  static async scheduleCommunication(id, scheduledAt) {
    const res = await this.request(`communications/${id}/schedule`, { scheduledAt }, "POST");
    return res;
  }

  static async cancelScheduleCommunication(id) {
    const res = await this.request(`communications/${id}/cancel-schedule`, {}, "POST");
    return res;
  }

  static async getCommRecipientOptions() {
    const res = await this.request("communications/recipients/options");
    return res;
  }

  static async estimateCommRecipients(data) {
    const res = await this.request("communications/recipients/estimate", data, "POST");
    return res.count ?? 0;
  }

  static async getCommTemplates(accountId) {
    const res = await this.request("communications/templates", { accountId });
    return res.templates ?? [];
  }

  static async getCommDefaultTemplate(accountId) {
    const res = await this.request("communications/templates/default", { accountId });
    return res.template;
  }

  static async updateCommTemplate(templateId, data) {
    const res = await this.request(`communications/templates/${templateId}`, data, "PATCH");
    return res.template;
  }

  /* --------- Notifications --------- */

  static async getNotifications(params = {}) {
    const res = await this.request("notifications", params);
    return { notifications: res.notifications ?? [], unreadCount: res.unreadCount ?? 0 };
  }

  static async markNotificationRead(id) {
    return this.request(`notifications/${id}/read`, {}, "POST");
  }

  static async markAllNotificationsRead() {
    return this.request("notifications/read-all", {}, "POST");
  }

  /* --------- Homeowner → agent inbox --------- */

  static async submitHomeownerAgentInquiry(data) {
    return this.request("homeowner-agent-inquiries", data, "POST");
  }

  static async getHomeownerAgentInquiries(accountId, params = {}) {
    const res = await this.request("homeowner-agent-inquiries", { accountId, ...params });
    return res.inquiries ?? [];
  }

  static async markHomeownerAgentInquiryRead(id) {
    return this.request(`homeowner-agent-inquiries/${id}/read`, {}, "POST");
  }

  // ─── Conversations ──────────────────────────────────────────────────────────

  static async getConversations(accountId, params = {}) {
    const res = await this.request("conversations", { accountId, ...params });
    return res.conversations ?? [];
  }

  static async getMyConversations(params = {}) {
    const res = await this.request("conversations/mine", params);
    return res.conversations ?? [];
  }

  static async createConversation({ accountId, propertyUid, agentUserId }) {
    const res = await this.request("conversations", { accountId, propertyUid, agentUserId }, "POST");
    return res.conversation;
  }

  static async getConversationMessages(conversationId, params = {}) {
    const res = await this.request(`conversations/${conversationId}/messages`, params);
    return res.messages ?? [];
  }

  static async sendConversationMessage(conversationId, data) {
    const res = await this.request(`conversations/${conversationId}/messages`, data, "POST");
    return res.message;
  }

  static async markConversationRead(conversationId) {
    return this.request(`conversations/${conversationId}/read`, {}, "POST");
  }
}

export default AppApi;
