"use strict";

/**
 * Homeaversary classification, recipient selection, and claim-before-send.
 * Run: node services/homeaversaryEmailService.test.js
 */

const { describe, it, after } = require("node:test");
const assert = require("node:assert");
const db = require("../db");
const {
  classifyProperty,
  runHomeaversarySweep,
} = require("./homeaversaryEmailService");

describe("classifyProperty", () => {
  it("sends the homeowner email on the anniversary", () => {
    const result = classifyProperty(
      { last_sale_date: "2019-03-01" },
      "2026-03-01",
    );
    assert.strictEqual(result.sendHomeowner, true);
    assert.strictEqual(result.sendAgent, false);
    assert.strictEqual(result.years, 7);
    assert.strictEqual(result.anniversary, "2026-03-01");
  });

  it("sends the agent preview 7 days ahead", () => {
    const result = classifyProperty(
      { last_sale_date: "2019-03-01" },
      "2026-02-22",
    );
    assert.strictEqual(result.sendHomeowner, false);
    assert.strictEqual(result.sendAgent, true);
    assert.strictEqual(result.years, 7);
    assert.strictEqual(result.preview, "2026-02-22");
  });

  it("skips year-zero (sale year anniversary)", () => {
    const result = classifyProperty(
      { last_sale_date: "2026-03-01" },
      "2026-03-01",
    );
    assert.strictEqual(result.sendHomeowner, false);
    assert.strictEqual(result.sendAgent, false);
    assert.strictEqual(result.reason, "year_zero");
  });

  it("maps Feb 29 sales to Feb 28 on non-leap years", () => {
    const dayOf = classifyProperty(
      { last_sale_date: "2020-02-29" },
      "2026-02-28",
    );
    assert.strictEqual(dayOf.sendHomeowner, true);
    assert.strictEqual(dayOf.years, 6);

    const preview = classifyProperty(
      { last_sale_date: "2020-02-29" },
      "2026-02-21",
    );
    assert.strictEqual(preview.sendAgent, true);
    assert.strictEqual(preview.preview, "2026-02-21");
  });

  it("skips dates that are neither anniversary nor T-7", () => {
    const result = classifyProperty(
      { last_sale_date: "2019-03-01" },
      "2026-08-21",
    );
    assert.strictEqual(result.sendHomeowner, false);
    assert.strictEqual(result.sendAgent, false);
  });
});

function makeQueryFn({
  properties,
  recipientsByAudience,
  claimed = new Set(),
  yearInReview = {
    tasksCompleted: 2,
    systemsServiced: 2,
    documentsUploaded: 1,
    tasks: [
      { description: "HVAC tune-up", record_type: "Maintenance", system_key: "heating" },
    ],
  },
}) {
  return async (sql, params) => {
    if (sql.includes("FROM properties")) {
      return { rows: properties };
    }
    if (sql.includes("FROM property_users")) {
      const audience = params[1] === "agent" ? "agent" : "homeowner";
      return { rows: recipientsByAudience[audience] || [] };
    }
    if (sql.includes("INSERT INTO homeaversary_sends")) {
      const key = `${params[0]}:${params[1]}:${params[2]}:${params[3]}`;
      if (claimed.has(key)) return { rows: [] };
      claimed.add(key);
      return { rows: [{ id: claimed.size }] };
    }
    if (sql.includes("DELETE FROM homeaversary_sends")) {
      return { rows: [] };
    }
    if (sql.includes("COUNT(*)") && sql.includes("property_maintenance")) {
      return {
        rows: [
          {
            tasks_completed: yearInReview.tasksCompleted,
            systems_serviced: yearInReview.systemsServiced,
          },
        ],
      };
    }
    if (sql.includes("FROM property_documents")) {
      return { rows: [{ documents_uploaded: yearInReview.documentsUploaded }] };
    }
    if (sql.includes("ORDER BY completed_at")) {
      return { rows: yearInReview.tasks };
    }
    return { rows: [] };
  };
}

const SAMPLE_PROPERTY = {
  id: 10,
  last_sale_date: "2019-03-01",
  owner_name: "Pat Rivera",
  occupant_name: null,
  property_name: null,
  address: "1 Main St",
  address_line_1: "1 Main St",
  city: "Austin",
  state: "TX",
  property_uid: "abc123",
  account_id: 5,
  account_url: "home",
  account_name: "home",
};

describe("runHomeaversarySweep", () => {
  it("sends to homeowners on the anniversary and claims first", async () => {
    const sent = [];
    const claimed = new Set();
    const result = await runHomeaversarySweep("2026-03-01", {
      queryFn: makeQueryFn({
        properties: [SAMPLE_PROPERTY],
        recipientsByAudience: {
          homeowner: [{ id: 1, email: "pat@example.com", name: "Pat Rivera", role: "homeowner" }],
          agent: [{ id: 2, email: "agent@example.com", name: "Jordan Lee", role: "agent" }],
        },
        claimed,
      }),
      sendHomeowner: async (payload) => {
        sent.push({ kind: "homeowner", ...payload });
        return { success: true };
      },
      sendAgent: async (payload) => {
        sent.push({ kind: "agent", ...payload });
        return { success: true };
      },
    });

    assert.strictEqual(result.homeownerSent, 1);
    assert.strictEqual(result.agentSent, 0);
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].kind, "homeowner");
    assert.strictEqual(sent[0].to, "pat@example.com");
    assert.strictEqual(sent[0].recipientFirstName, "Pat");
    assert.strictEqual(sent[0].yearsOwned, 7);
    assert.strictEqual(sent[0].tasksCompletedCount, "2");
    assert.strictEqual(sent[0].documentsUploadedCount, "1");
    assert.strictEqual(sent[0].hasYearInReview, "true");
    assert.match(sent[0].yearInReviewHtml, /HVAC tune-up/);
    assert.match(sent[0].milestoneHtml, /7 Years/);
    assert.ok(claimed.has("10:1:homeowner:2026"));
  });

  it("sends to agents 7 days ahead", async () => {
    const sent = [];
    const result = await runHomeaversarySweep("2026-02-22", {
      queryFn: makeQueryFn({
        properties: [SAMPLE_PROPERTY],
        recipientsByAudience: {
          homeowner: [{ id: 1, email: "pat@example.com", name: "Pat Rivera", role: "homeowner" }],
          agent: [{ id: 2, email: "agent@example.com", name: "Jordan Lee", role: "agent" }],
        },
      }),
      sendHomeowner: async (payload) => {
        sent.push({ kind: "homeowner", ...payload });
        return { success: true };
      },
      sendAgent: async (payload) => {
        sent.push({ kind: "agent", ...payload });
        return { success: true };
      },
    });

    assert.strictEqual(result.agentSent, 1);
    assert.strictEqual(result.homeownerSent, 0);
    assert.strictEqual(sent[0].kind, "agent");
    assert.strictEqual(sent[0].to, "agent@example.com");
    assert.strictEqual(sent[0].ownerName, "Pat Rivera");
  });

  it("does not send again when the claim already exists", async () => {
    const sent = [];
    const claimed = new Set(["10:1:homeowner:2026"]);
    const result = await runHomeaversarySweep("2026-03-01", {
      queryFn: makeQueryFn({
        properties: [SAMPLE_PROPERTY],
        recipientsByAudience: {
          homeowner: [{ id: 1, email: "pat@example.com", name: "Pat Rivera", role: "homeowner" }],
        },
        claimed,
      }),
      sendHomeowner: async (payload) => {
        sent.push(payload);
        return { success: true };
      },
      sendAgent: async () => ({ success: true }),
    });

    assert.strictEqual(sent.length, 0);
    assert.strictEqual(result.homeownerSent, 0);
    assert.ok(result.skipped >= 1);
  });

  it("releases the claim when send fails", async () => {
    const deleted = [];
    const claimed = new Set();
    const queryFn = makeQueryFn({
      properties: [SAMPLE_PROPERTY],
      recipientsByAudience: {
        homeowner: [{ id: 1, email: "pat@example.com", name: "Pat Rivera", role: "homeowner" }],
      },
      claimed,
    });
    const wrapped = async (sql, params) => {
      if (sql.includes("DELETE FROM homeaversary_sends")) {
        deleted.push(params[0]);
      }
      return queryFn(sql, params);
    };

    const result = await runHomeaversarySweep("2026-03-01", {
      queryFn: wrapped,
      sendHomeowner: async () => ({ success: false, reason: "send_failed" }),
      sendAgent: async () => ({ success: true }),
    });

    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.homeownerSent, 0);
    assert.strictEqual(deleted.length, 1);
  });

  it("skips properties with no matching recipients", async () => {
    const sent = [];
    const result = await runHomeaversarySweep("2026-03-01", {
      queryFn: makeQueryFn({
        properties: [SAMPLE_PROPERTY],
        recipientsByAudience: { homeowner: [], agent: [] },
      }),
      sendHomeowner: async (payload) => {
        sent.push(payload);
        return { success: true };
      },
      sendAgent: async () => ({ success: true }),
    });

    assert.strictEqual(sent.length, 0);
    assert.strictEqual(result.homeownerSent, 0);
    assert.ok(result.skipped >= 1);
  });
});

after(async () => {
  await db.end();
});
