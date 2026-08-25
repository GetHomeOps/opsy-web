import { describe, expect, it } from "vitest";
import {
  partitionReviewFields,
  resolveFindingsModalConfig,
  guessAnalysisCategory,
  pickQuoteSummary,
} from "./documentAnalysisUi";

describe("resolveFindingsModalConfig", () => {
  it("opens a bid-focused quotes modal from system Overview", () => {
    const config = resolveFindingsModalConfig({
      categoryFilter: "bid",
      systemLabel: "Roof",
    });
    expect(config.title).toBe("Quotes & bids");
    expect(config.tabs).toEqual([{ id: "bid", label: "Bids" }]);
    expect(config.emptyTitle).toMatch(/quotes or bids/i);
    expect(config.description).toContain("Roof");
  });

  it("keeps the full insights modal when no filter is set", () => {
    const config = resolveFindingsModalConfig({ systemLabel: "Roof" });
    expect(config.title).toBe("AI document insights");
    expect(config.tabs.map((tab) => tab.id)).toContain("installation_invoice");
  });
});

describe("guessAnalysisCategory", () => {
  it("prefills bid vs invoice from type or filename before analysis", () => {
    expect(guessAnalysisCategory({ document_type: "invoice" })).toBe(
      "installation_invoice",
    );
    expect(guessAnalysisCategory({ document_name: "Roof bid quote.pdf" })).toBe(
      "bid",
    );
    expect(guessAnalysisCategory({ document_name: "Belden invoice.pdf" })).toBe(
      "installation_invoice",
    );
    expect(guessAnalysisCategory({ document_name: "manual.pdf" })).toBe("other");
    expect(guessAnalysisCategory(null)).toBe("other");
    expect(guessAnalysisCategory(undefined)).toBe("other");
  });
});

describe("partitionReviewFields", () => {
  it("groups invoice identity fields separately from system fields", () => {
    const { identityFields, systemFields } = partitionReviewFields([
      {
        fieldKey: "identity.address",
        destination: "property_identity",
        selectedByDefault: true,
      },
      {
        fieldKey: "cost",
        destination: "schema",
        selectedByDefault: true,
      },
    ]);
    expect(identityFields.map((f) => f.fieldKey)).toEqual(["identity.address"]);
    expect(systemFields.map((f) => f.fieldKey)).toEqual(["cost"]);
  });
});

describe("pickQuoteSummary", () => {
  it("pulls contractor, total, and line items for bid comparison", () => {
    const summary = pickQuoteSummary({
      findings: [
        { fieldKey: "installer", value: "Belden" },
        { fieldKey: "totalPrice", value: "4200" },
        { fieldKey: "lineItems", value: [{ description: "Shingles" }] },
      ],
    });
    expect(summary.installer).toBe("Belden");
    expect(summary.total).toBe("4200");
    expect(summary.lineItems).toEqual([{ description: "Shingles" }]);
  });
});
