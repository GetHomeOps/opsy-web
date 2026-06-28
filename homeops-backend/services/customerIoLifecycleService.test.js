"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const customerIoProvider = require("./emailProviders/customerIoProvider");
const {
  buildPropertyUrl,
  normalizeAccountSlug,
  syncCustomerIoUserPropertyState,
} = require("./customerIoLifecycleService");

describe("customerIoLifecycleService", () => {
  describe("buildPropertyUrl", () => {
    it("builds property deep link when uid is present", () => {
      const url = buildPropertyUrl("andresordonez", "12345678");
      assert.ok(url.endsWith("/andresordonez/properties/12345678"));
    });

    it("builds add-property URL when uid is empty", () => {
      const url = buildPropertyUrl("andresordonez", "");
      assert.ok(url.endsWith("/andresordonez/properties/new"));
    });

    it("normalizes account slug slashes", () => {
      assert.equal(normalizeAccountSlug("/slug/"), "slug");
      assert.equal(normalizeAccountSlug(""), "home");
    });
  });

  describe("syncCustomerIoUserPropertyState", () => {
    const originalQuery = db.query;
    const identifyCalls = [];
    const trackCalls = [];
    let originalConfigured;
    let originalIdentify;
    let originalTrack;

    beforeEach(() => {
      identifyCalls.length = 0;
      trackCalls.length = 0;
      originalConfigured = customerIoProvider.isCustomerIoConfigured;
      originalIdentify = customerIoProvider.identifyPerson;
      originalTrack = customerIoProvider.trackNoPropertiesRemaining;
      customerIoProvider.isCustomerIoConfigured = () => true;
      customerIoProvider.identifyPerson = async (payload) => {
        identifyCalls.push(payload);
      };
      customerIoProvider.trackNoPropertiesRemaining = async (payload) => {
        trackCalls.push(payload);
      };
    });

    afterEach(() => {
      db.query = originalQuery;
      customerIoProvider.isCustomerIoConfigured = originalConfigured;
      customerIoProvider.identifyPerson = originalIdentify;
      customerIoProvider.trackNoPropertiesRemaining = originalTrack;
    });

    it("identifies has_property when user still has properties", async () => {
      db.query = async (sql) => {
        if (sql.includes("SELECT email FROM users")) {
          return { rows: [{ email: "user@example.com" }] };
        }
        if (sql.includes("COUNT(*)::int AS c")) {
          return { rows: [{ c: 2 }] };
        }
        if (sql.includes("FROM property_users pu")) {
          return {
            rows: [
              {
                id: 10,
                property_uid: "99998888",
                account_url: "myaccount",
                account_name: "My Account",
              },
            ],
          };
        }
        return { rows: [] };
      };

      await syncCustomerIoUserPropertyState({
        userId: 1,
        userEmail: "user@example.com",
      });

      assert.equal(identifyCalls.length, 1);
      assert.equal(identifyCalls[0].attributes.has_property, true);
      assert.equal(identifyCalls[0].attributes.property_count, 2);
      assert.equal(identifyCalls[0].attributes.primary_property_uid, "99998888");
      assert.ok(
        identifyCalls[0].attributes.primary_property_url.includes(
          "/myaccount/properties/99998888"
        )
      );
      assert.equal(trackCalls.length, 0);
    });

    it("fires no_properties_remaining when count is zero", async () => {
      db.query = async (sql) => {
        if (sql.includes("SELECT email FROM users")) {
          return { rows: [{ email: "user@example.com" }] };
        }
        if (sql.includes("COUNT(*)::int AS c")) {
          return { rows: [{ c: 0 }] };
        }
        if (sql.includes("FROM account_users au")) {
          return { rows: [{ url: "slug", name: "Slug" }] };
        }
        return { rows: [] };
      };

      await syncCustomerIoUserPropertyState({
        userId: 1,
        context: { reason: "property_deleted", lastPropertyId: 5 },
      });

      assert.equal(identifyCalls[0].attributes.has_property, false);
      assert.equal(identifyCalls[0].attributes.property_count, 0);
      assert.ok(
        identifyCalls[0].attributes.primary_property_url.endsWith(
          "/slug/properties/new"
        )
      );
      assert.equal(trackCalls.length, 1);
      assert.equal(trackCalls[0].reason, "property_deleted");
      assert.equal(trackCalls[0].lastPropertyId, 5);
    });

    it("does not fire exit event when fireExitEvent is false", async () => {
      db.query = async (sql) => {
        if (sql.includes("SELECT email FROM users")) {
          return { rows: [{ email: "user@example.com" }] };
        }
        if (sql.includes("COUNT(*)::int AS c")) {
          return { rows: [{ c: 0 }] };
        }
        if (sql.includes("FROM account_users au")) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      await syncCustomerIoUserPropertyState({
        userId: 1,
        fireExitEvent: false,
      });

      assert.equal(identifyCalls.length, 1);
      assert.equal(trackCalls.length, 0);
    });
  });
});
