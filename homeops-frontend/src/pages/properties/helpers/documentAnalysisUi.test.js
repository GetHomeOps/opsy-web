import { describe, expect, it } from "vitest";
import {
  partitionReviewFields,
  resolveFindingsModalConfig,
  guessAnalysisCategory,
  pickQuoteSummary,
  shouldPromptActionItemLink,
  getAnalysisPromptSteps,
  getAnalysisPromptStepTitle,
  filingTypeForAnalysisGroup,
  shouldSkipAnalysisTypeStep,
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

  it("keeps a declared Other category even when the filing type maps to bid", () => {
    expect(
      guessAnalysisCategory({
        document_type: "contract",
        declaredAnalysisCategory: "other",
      }),
    ).toBe("other");
  });

  it("still maps contract to bid when the user did not declare Other", () => {
    expect(guessAnalysisCategory({ document_type: "contract" })).toBe("bid");
  });
});

describe("filingTypeForAnalysisGroup", () => {
  it("maps upload groups to filing types", () => {
    expect(filingTypeForAnalysisGroup("bid")).toBe("bid");
    expect(filingTypeForAnalysisGroup("installation_invoice")).toBe("invoice");
    expect(filingTypeForAnalysisGroup("installation_invoice", "receipt")).toBe(
      "receipt",
    );
    expect(filingTypeForAnalysisGroup("other", "contract")).toBe("contract");
    expect(filingTypeForAnalysisGroup("other", "unknown")).toBe("other");
    expect(filingTypeForAnalysisGroup("")).toBe(null);
  });
});

describe("shouldSkipAnalysisTypeStep", () => {
  it("skips the type step only when Bid or Invoice was already chosen", () => {
    expect(shouldSkipAnalysisTypeStep("bid")).toBe(true);
    expect(shouldSkipAnalysisTypeStep("installation_invoice")).toBe(true);
    expect(shouldSkipAnalysisTypeStep("other")).toBe(false);
    expect(shouldSkipAnalysisTypeStep(null)).toBe(false);
  });
});

describe("shouldPromptActionItemLink", () => {
  it("asks for an action item on bids and invoices only", () => {
    expect(shouldPromptActionItemLink("bid")).toBe(true);
    expect(shouldPromptActionItemLink("installation_invoice")).toBe(true);
    expect(shouldPromptActionItemLink("other")).toBe(false);
    expect(shouldPromptActionItemLink("inspection_report")).toBe(false);
    expect(shouldPromptActionItemLink(null)).toBe(false);
  });
});

describe("getAnalysisPromptSteps", () => {
  it("starts with the action item when the document can be linked", () => {
    expect(getAnalysisPromptSteps({ canLinkActionItem: true })).toEqual([
      "project",
      "type",
      "approval",
    ]);
  });

  it("skips the action item when link context is missing", () => {
    expect(getAnalysisPromptSteps({ canLinkActionItem: false })).toEqual([
      "type",
      "approval",
    ]);
    expect(getAnalysisPromptSteps()).toEqual(["type", "approval"]);
  });

  it("skips the type step when Bid or Invoice was already declared", () => {
    expect(
      getAnalysisPromptSteps({
        canLinkActionItem: true,
        declaredCategory: "bid",
      }),
    ).toEqual(["project", "approval"]);
    expect(
      getAnalysisPromptSteps({
        canLinkActionItem: false,
        declaredCategory: "installation_invoice",
      }),
    ).toEqual(["approval"]);
  });

  it("keeps the type step for Other so the user can reclassify", () => {
    expect(
      getAnalysisPromptSteps({
        canLinkActionItem: true,
        declaredCategory: "other",
      }),
    ).toEqual(["project", "type", "approval"]);
  });

  it("titles each prompt step", () => {
    expect(getAnalysisPromptStepTitle("project")).toBe("Which project is this for?");
    expect(getAnalysisPromptStepTitle("type")).toBe("What is this document?");
    expect(getAnalysisPromptStepTitle("approval")).toBe(
      "Analyze this document with AI?",
    );
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
