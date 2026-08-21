"use strict";

/**
 * Home anniversary date math and idempotent event creation.
 * Run: node services/homeAnniversaryService.test.js
 */

const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const db = require("../db");
const {
  nextAnniversaryDate,
  ownerLabel,
  ensureHomeAnniversaryEvents,
} = require("./homeAnniversaryService");

describe("nextAnniversaryDate", () => {
  it("returns this year's date when it has not yet passed", () => {
    assert.strictEqual(
      nextAnniversaryDate("2019-12-25", "2026-08-21"),
      "2026-12-25",
    );
  });

  it("returns next year when this year's anniversary has already passed", () => {
    assert.strictEqual(
      nextAnniversaryDate("2019-03-01", "2026-08-21"),
      "2027-03-01",
    );
  });

  it("returns today when the anniversary is today", () => {
    assert.strictEqual(
      nextAnniversaryDate("2015-08-21", "2026-08-21"),
      "2026-08-21",
    );
  });

  it("maps Feb 29 to Feb 28 on non-leap years", () => {
    assert.strictEqual(
      nextAnniversaryDate("2020-02-29", "2026-01-15"),
      "2026-02-28",
    );
  });

  it("keeps Feb 29 on a leap year", () => {
    assert.strictEqual(
      nextAnniversaryDate("2020-02-29", "2028-01-15"),
      "2028-02-29",
    );
  });

  it("rolls Feb 29 past this year's Feb 28 into next year", () => {
    assert.strictEqual(
      nextAnniversaryDate("2020-02-29", "2026-03-01"),
      "2027-02-28",
    );
  });

  it("returns null for missing or invalid dates", () => {
    assert.strictEqual(nextAnniversaryDate(null, "2026-08-21"), null);
    assert.strictEqual(nextAnniversaryDate("", "2026-08-21"), null);
    assert.strictEqual(nextAnniversaryDate("not-a-date", "2026-08-21"), null);
  });
});

describe("ownerLabel", () => {
  it("prefers owner_name then occupant then property name then address", () => {
    assert.strictEqual(ownerLabel({ owner_name: "Ada Lovelace" }), "Ada Lovelace");
    assert.strictEqual(ownerLabel({ occupant_name: "Grace" }), "Grace");
    assert.strictEqual(ownerLabel({ property_name: "Lake House" }), "Lake House");
    assert.strictEqual(ownerLabel({ address: "1 Main St" }), "1 Main St");
    assert.strictEqual(ownerLabel({}), "Homeowner");
  });
});

describe("ensureHomeAnniversaryEvents", () => {
  it("no-ops when last_sale_date is missing", async () => {
    const created = [];
    const result = await ensureHomeAnniversaryEvents(
      10,
      { createdByUserId: 1 },
      {
        queryFn: async (sql) => {
          if (sql.includes("FROM properties")) {
            return { rows: [{ id: 10, last_sale_date: null, owner_name: "Pat" }] };
          }
          return { rows: [] };
        },
        createEvent: async (data) => {
          created.push(data);
          return data;
        },
      },
    );
    assert.strictEqual(result.created, false);
    assert.strictEqual(result.reason, "no_last_sale_date");
    assert.strictEqual(created.length, 0);
  });

  it("creates homeowner and agent annual series", async () => {
    const created = [];
    const result = await ensureHomeAnniversaryEvents(
      10,
      { createdByUserId: 7 },
      {
        queryFn: async (sql) => {
          if (sql.includes("FROM properties")) {
            return {
              rows: [{
                id: 10,
                last_sale_date: "2019-03-01",
                owner_name: "Pat Rivera",
                occupant_name: null,
                property_name: null,
                address: "1 Main St",
                address_line_1: "1 Main St",
              }],
            };
          }
          return { rows: [] };
        },
        createEvent: async (data) => {
          created.push(data);
          return { id: created.length, ...data };
        },
      },
    );
    assert.strictEqual(result.created, true);
    assert.strictEqual(created.length, 2);
    assert.strictEqual(created[0].audience, "homeowner");
    assert.strictEqual(created[0].system_name, "Home Anniversary");
    assert.strictEqual(created[0].recurrence_type, "annually");
    assert.strictEqual(created[0].system_key, "homeAnniversary");
    assert.strictEqual(created[0].event_type, "homeAnniversary");
    assert.strictEqual(created[1].event_type, "homeAnniversary");
    assert.strictEqual(created[0].created_by, 7);
    assert.strictEqual(created[1].audience, "agent");
    assert.strictEqual(created[1].system_name, "Home Anniversary — Pat Rivera");
    assert.match(created[0].scheduled_date, /^\d{4}-03-01$/);
    assert.strictEqual(created[0].scheduled_date, created[1].scheduled_date);
  });

  it("is a no-op when parent events already exist", async () => {
    const created = [];
    const result = await ensureHomeAnniversaryEvents(
      10,
      {},
      {
        queryFn: async (sql) => {
          if (sql.includes("FROM properties")) {
            return { rows: [{ id: 10, last_sale_date: "2019-03-01", owner_name: "Pat" }] };
          }
          if (sql.includes("FROM maintenance_events")) {
            return { rows: [{ audience: "homeowner" }, { audience: "agent" }] };
          }
          return { rows: [] };
        },
        createEvent: async (data) => {
          created.push(data);
          return data;
        },
      },
    );
    assert.strictEqual(result.created, false);
    assert.strictEqual(result.reason, "already_exists");
    assert.strictEqual(created.length, 0);
  });

  it("creates only the missing audience when one series already exists", async () => {
    const created = [];
    const result = await ensureHomeAnniversaryEvents(
      10,
      {},
      {
        queryFn: async (sql) => {
          if (sql.includes("FROM properties")) {
            return { rows: [{ id: 10, last_sale_date: "2019-03-01", owner_name: "Pat" }] };
          }
          if (sql.includes("FROM maintenance_events")) {
            return { rows: [{ audience: "homeowner" }] };
          }
          return { rows: [] };
        },
        createEvent: async (data) => {
          created.push(data);
          return data;
        },
      },
    );
    assert.strictEqual(result.created, true);
    assert.strictEqual(created.length, 1);
    assert.strictEqual(created[0].audience, "agent");
  });
});

after(async () => {
  await db.end();
});
