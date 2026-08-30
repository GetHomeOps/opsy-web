import { describe, expect, it } from "vitest";
import { toFiledDocumentForAnalysis } from "./documentAnalysisFlow";

describe("toFiledDocumentForAnalysis", () => {
  it("keeps checklist_item_id so the analysis prompt can preselect a project", () => {
    const normalized = toFiledDocumentForAnalysis({
      id: 12,
      document_name: "Belden Invoice",
      system_key: "flooring",
      document_type: "invoice",
      checklist_item_id: 44,
    });
    expect(normalized.checklist_item_id).toBe(44);
  });

  it("reads camelCase checklistItemId from analysis results", () => {
    const normalized = toFiledDocumentForAnalysis({
      id: 12,
      name: "Roof bid",
      system: "roof",
      type: "bid",
      checklistItemId: 9,
    });
    expect(normalized.checklist_item_id).toBe(9);
    expect(normalized.system_key).toBe("roof");
    expect(normalized.document_type).toBe("bid");
  });

  it("keeps declaredAnalysisCategory so Other uploads are not remapped to bid", () => {
    const normalized = toFiledDocumentForAnalysis({
      id: 12,
      document_name: "Service contract",
      document_type: "contract",
      declaredAnalysisCategory: "other",
    });
    expect(normalized.declaredAnalysisCategory).toBe("other");
    expect(normalized.document_type).toBe("contract");
  });
});
