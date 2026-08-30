"use strict";

/**
 * Year-in-review aggregation and HTML for Homeaversary emails.
 * Run: node services/homeaversaryYearInReview.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  taskTitleFromRecord,
  buildYearInReviewHtml,
  buildMilestoneColumns,
  toMergeFields,
  loadYearInReview,
  propertyStreetLabel,
  EMPTY_COPY,
} = require("./homeaversaryYearInReview");

describe("taskTitleFromRecord", () => {
  it("prefers description", () => {
    assert.strictEqual(
      taskTitleFromRecord({ description: "HVAC tune-up", record_type: "Maintenance", system_key: "heating" }),
      "HVAC tune-up",
    );
  });

  it("falls back to record type and system label", () => {
    assert.strictEqual(
      taskTitleFromRecord({ description: "  ", record_type: "Inspection", system_key: "roof" }),
      "Inspection · Roof",
    );
  });

  it("falls back to Maintenance when nothing else is present", () => {
    assert.strictEqual(taskTitleFromRecord({}), "Maintenance");
  });
});

describe("buildYearInReviewHtml", () => {
  it("lists escaped task titles", () => {
    const html = buildYearInReviewHtml([{ title: "Gutter <clean>" }]);
    assert.match(html, /Gutter &lt;clean&gt;/);
    assert.doesNotMatch(html, /Gutter <clean>/);
  });

  it("uses homeowner empty copy when there are no tasks", () => {
    const html = buildYearInReviewHtml([], "homeowner");
    assert.match(html, /Start logging maintenance/);
  });

  it("uses agent empty copy when there are no tasks", () => {
    const html = buildYearInReviewHtml([], "agent");
    assert.ok(html.includes(EMPTY_COPY.agent.replace(/—/g, "—")));
    assert.match(html, /No completed tasks logged yet/);
  });
});

describe("buildMilestoneColumns", () => {
  it("shows real counts when they are present", () => {
    const cols = buildMilestoneColumns({
      yearsOwned: 7,
      streetLabel: "205 E 95th St",
      tasksCompletedCount: 4,
      documentsUploadedCount: 3,
    });
    assert.strictEqual(cols.milestone1Title, "7 Years");
    assert.strictEqual(cols.milestone1Body, "at 205 E 95th St");
    assert.strictEqual(cols.milestone2Title, "4");
    assert.strictEqual(cols.milestone2Body, "tasks completed");
    assert.strictEqual(cols.milestone3Title, "3");
    assert.strictEqual(cols.milestone3Body, "documents added");
  });

  it("falls back to celebratory copy when counts are zero", () => {
    const cols = buildMilestoneColumns({
      yearsOwned: 1,
      streetLabel: "Elm Street",
      tasksCompletedCount: 0,
      documentsUploadedCount: 0,
    });
    assert.strictEqual(cols.milestone1Title, "1 Year");
    assert.strictEqual(cols.milestone2Title, "Memories made");
    assert.strictEqual(cols.milestone3Title, "Here for you");
  });
});

describe("toMergeFields", () => {
  it("stringifies counts and marks hasYearInReview", () => {
    const merge = toMergeFields(
      {
        tasksCompletedCount: 2,
        documentsUploadedCount: 1,
        systemsServicedCount: 2,
        tasks: [{ title: "Roof inspection" }],
      },
      { audience: "homeowner", yearsOwned: 3, streetLabel: "1 Main St" },
    );
    assert.strictEqual(merge.tasksCompletedCount, "2");
    assert.strictEqual(merge.hasYearInReview, "true");
    assert.match(merge.yearInReviewHtml, /Roof inspection/);
    assert.match(merge.milestoneHtml, /3 Years/);
  });

  it("leaves hasYearInReview empty when there are no tasks", () => {
    const merge = toMergeFields(
      { tasksCompletedCount: 0, documentsUploadedCount: 0, systemsServicedCount: 0, tasks: [] },
      { audience: "agent", yearsOwned: 2, streetLabel: "1 Main St" },
    );
    assert.strictEqual(merge.hasYearInReview, "");
    assert.match(merge.yearInReviewHtml, /No completed tasks logged yet/);
  });
});

describe("propertyStreetLabel", () => {
  it("prefers address_line_1 then the first address segment", () => {
    assert.strictEqual(propertyStreetLabel({ address_line_1: "1 Main St" }), "1 Main St");
    assert.strictEqual(
      propertyStreetLabel({ address: "1 Main St, Austin, TX" }),
      "1 Main St",
    );
  });
});

describe("loadYearInReview", () => {
  it("counts completed records in the window and skips pending", async () => {
    const review = await loadYearInReview(10, {
      now: new Date("2026-03-01T00:00:00.000Z"),
      query: async (sql) => {
        if (sql.includes("COUNT(*)") && sql.includes("property_maintenance")) {
          return { rows: [{ tasks_completed: 2, systems_serviced: 2 }] };
        }
        if (sql.includes("property_documents")) {
          return { rows: [{ documents_uploaded: 1 }] };
        }
        if (sql.includes("ORDER BY completed_at")) {
          return {
            rows: [
              { description: "HVAC tune-up", record_type: "Maintenance", system_key: "heating" },
              { description: "", record_type: "Inspection", system_key: "roof" },
            ],
          };
        }
        return { rows: [] };
      },
    });
    assert.strictEqual(review.tasksCompletedCount, 2);
    assert.strictEqual(review.documentsUploadedCount, 1);
    assert.strictEqual(review.systemsServicedCount, 2);
    assert.strictEqual(review.tasks.length, 2);
    assert.strictEqual(review.tasks[0].title, "HVAC tune-up");
    assert.strictEqual(review.tasks[1].title, "Inspection · Roof");
  });

  it("returns zeros for an empty property", async () => {
    const review = await loadYearInReview(10, {
      query: async () => ({ rows: [{ tasks_completed: 0, systems_serviced: 0, documents_uploaded: 0 }] }),
    });
    assert.strictEqual(review.tasksCompletedCount, 0);
    assert.deepStrictEqual(review.tasks, []);
  });

  it("does not query task titles when the count is zero", async () => {
    let listQueries = 0;
    const review = await loadYearInReview(10, {
      query: async (sql) => {
        if (sql.includes("ORDER BY completed_at")) listQueries += 1;
        if (sql.includes("property_maintenance")) {
          return { rows: [{ tasks_completed: 0, systems_serviced: 0 }] };
        }
        return { rows: [{ documents_uploaded: 0 }] };
      },
    });
    assert.strictEqual(review.tasksCompletedCount, 0);
    assert.strictEqual(listQueries, 0);
  });
});
