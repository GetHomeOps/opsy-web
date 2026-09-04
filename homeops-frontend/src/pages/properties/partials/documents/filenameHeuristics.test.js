import { describe, expect, it } from "vitest";
import { guessFromFilename } from "./filenameHeuristics";

describe("guessFromFilename document types", () => {
  it("distinguishes invoices from bids before analysis", () => {
    expect(guessFromFilename("Belden invoice.pdf").document_type).toBe("invoice");
    expect(guessFromFilename("Roof bid quote.pdf").document_type).toBe("bid");
    expect(guessFromFilename("paid receipt.pdf").document_type).toBe("receipt");
  });

  it("guesses hoa and tax filing types", () => {
    expect(guessFromFilename("HOA dues statement.pdf").document_type).toBe("hoa");
    expect(guessFromFilename("2025 property tax bill.pdf").document_type).toBe("tax");
  });
});
