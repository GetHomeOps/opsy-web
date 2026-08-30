import { describe, expect, it } from "vitest";
import {
  bidStatusLabel,
  parseMoney,
  inferCertainty,
  groupBidsByActionItem,
  buildAskContractorMessage,
  unansweredQuestionCount,
} from "./bidReview";

describe("bidReview helpers", () => {
  it("labels bid statuses", () => {
    expect(bidStatusLabel("reviewing")).toBe("Reviewing");
    expect(bidStatusLabel("no_bids")).toBe("No Bids");
  });

  it("parses money and infers certainty for legacy fields", () => {
    expect(parseMoney("$15,871")).toBe(15871);
    expect(inferCertainty({ certainty: "inferred", value: "maybe" })).toBe(
      "inferred",
    );
    expect(
      inferCertainty({ value: "2 years", confidence: 0.9, evidence: "2 year" }),
    ).toBe("stated");
    expect(inferCertainty({ value: "" })).toBe("not_found");
  });

  it("groups bids by action item and keeps unlinked bids", () => {
    const { grouped, unlinked } = groupBidsByActionItem(
      [
        { id: 1, checklistItemId: 10, total: "$100" },
        { id: 2, checklistItemId: 10, total: "$200" },
        { id: 3, checklistItemId: null, total: "$50" },
      ],
      [{ id: 10, title: "Replace flooring", bid_status: "reviewing" }],
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0].bidCount).toBe(2);
    expect(grouped[0].title).toBe("Replace flooring");
    expect(grouped[0].priceRange).toContain("$100");
    expect(unlinked).toHaveLength(1);
  });

  it("builds a contractor email from selected questions", () => {
    const message = buildAskContractorMessage({
      contractorName: "John Smith",
      senderName: "Alex",
      questions: [
        { text: "Does the price include subfloor leveling?" },
        { text: "What flooring grade is included?" },
      ],
    });
    expect(message).toContain("Hi John,");
    expect(message).toContain("1. Does the price include subfloor leveling?");
    expect(message).toContain("Thanks,\nAlex");
  });

  it("counts unanswered selected questions per contractor", () => {
    const questions = [
      {
        documentId: 5,
        groups: [
          {
            category: "Scope",
            items: [
              { text: "A", selected: true },
              { text: "B", selected: false },
            ],
          },
        ],
      },
    ];
    expect(unansweredQuestionCount(questions, 5)).toBe(1);
  });
});
