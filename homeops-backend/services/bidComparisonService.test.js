"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  inferCertainty,
  buildComparisonPayload,
  questionAlreadyAnswered,
  filterAnsweredQuestions,
  defaultQuestionsForSnapshot,
} = require("./bidComparisonService");

function bid({ documentId, contractor, total, extraFindings = [] }) {
  return {
    documentId,
    documentName: contractor,
    findings: [
      { fieldKey: "installer", value: contractor, confidence: 0.95, evidence: contractor },
      { fieldKey: "totalPrice", value: total, confidence: 0.9, evidence: total },
      ...extraFindings,
    ],
  };
}

describe("inferCertainty", () => {
  it("uses an explicit certainty when present", () => {
    assert.equal(inferCertainty({ certainty: "inferred", value: "maybe" }), "inferred");
    assert.equal(inferCertainty({ certainty: "stated", value: "yes" }), "stated");
  });

  it("treats high-confidence evidence as stated for legacy findings", () => {
    assert.equal(
      inferCertainty({ value: "$1,200", confidence: 0.92, evidence: "Total $1,200" }),
      "stated",
    );
  });

  it("treats empty values as not found", () => {
    assert.equal(inferCertainty({ value: "" }), "not_found");
  });
});

describe("buildComparisonPayload", () => {
  it("builds price stats and a matrix without inventing a score", () => {
    const payload = buildComparisonPayload([
      bid({
        documentId: 1,
        contractor: "Maxcare",
        total: "$15,871",
        extraFindings: [
          { fieldKey: "warranty", value: "2 years", confidence: 0.9, evidence: "2 year warranty" },
          { fieldKey: "lineItems", value: ["Cleanup included"] },
        ],
      }),
      bid({
        documentId: 2,
        contractor: "Belden",
        total: "$17,017",
        extraFindings: [
          { fieldKey: "warranty", value: "5 years", confidence: 0.9, evidence: "5 year warranty" },
          { fieldKey: "lineItems", value: ["Floor preparation", "Furniture removal", "Cleanup"] },
        ],
      }),
    ]);

    assert.equal(payload.stats.min, 15871);
    assert.equal(payload.stats.max, 17017);
    assert.ok(payload.matrix.some((row) => row.key === "totalPrice"));
    assert.ok(payload.matrix.some((row) => row.key === "floor_prep"));
    assert.ok(payload.highlights.some((h) => h.type === "lowest_price"));
    assert.ok(payload.highlights.some((h) => h.type === "strongest_warranty"));
    assert.equal(payload.highlights.some((h) => h.type === "ai_score"), false);
    assert.match(payload.summary, /Maxcare|Belden|price/i);
  });

  it("handles a single incomplete bid", () => {
    const payload = buildComparisonPayload([
      bid({ documentId: 3, contractor: "Solo", total: null }),
    ]);
    assert.equal(payload.bidCount, 1);
    assert.match(payload.summary, /only bid/i);
    assert.equal(payload.stats.min, null);
  });
});

describe("question filtering", () => {
  it("skips questions already answered in the bid", () => {
    const payload = buildComparisonPayload([
      bid({
        documentId: 1,
        contractor: "Maxcare",
        total: "$10,000",
        extraFindings: [
          { fieldKey: "warranty", value: "5 years", confidence: 0.95, evidence: "5 year workmanship" },
          { fieldKey: "lineItems", value: ["Furniture moving", "Disposal of existing flooring"] },
        ],
      }),
    ]);
    const snapshot = payload.snapshots[0];
    assert.equal(
      questionAlreadyAnswered("What workmanship warranty do you provide?", snapshot),
      true,
    );
    assert.equal(
      questionAlreadyAnswered("Does your price include moving furniture?", snapshot),
      true,
    );
    const generated = defaultQuestionsForSnapshot(snapshot);
    const texts = generated.flatMap((g) => g.items.map((i) => i.text)).join(" ");
    assert.equal(/warrant/i.test(texts), false);
  });

  it("keeps user-authored questions when filtering", () => {
    const payload = buildComparisonPayload([
      bid({
        documentId: 1,
        contractor: "Maxcare",
        total: "$10,000",
        extraFindings: [
          { fieldKey: "warranty", value: "5 years", confidence: 0.95, evidence: "5 year" },
        ],
      }),
    ]);
    const filtered = filterAnsweredQuestions(
      [
        {
          documentId: 1,
          contractorName: "Maxcare",
          groups: [
            {
              category: "Warranty",
              items: [
                { id: "ai1", text: "What workmanship warranty do you provide?", source: "ai" },
                { id: "u1", text: "Can you start in June?", source: "user" },
              ],
            },
          ],
        },
      ],
      payload.snapshots,
    );
    const items = filtered[0].groups.flatMap((g) => g.items);
    assert.equal(items.some((i) => i.source === "user"), true);
    assert.equal(items.some((i) => i.source === "ai"), false);
  });
});
