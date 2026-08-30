import {describe, expect, it} from "vitest";
import {
  DEFAULT_FILE_FOLDER,
  clientIdFromInboxDocId,
  fileAllItemFromCard,
  inboxCardToUIDoc,
  inboxDocId,
  isInboxDoc,
} from "./inboxDocuments";

function sampleCard(overrides = {}) {
  return {
    clientId: "c1",
    id: 42,
    name: "Belden Invoice.pdf",
    documentKey: "accounts/1/documents/abc.pdf",
    createdAt: "2026-08-29T14:00:00.000Z",
    status: "uploaded",
    proposed: {
      system_key: null,
      document_type: "invoice",
      document_name: "Belden Invoice",
      document_date: "2026-08-29",
    },
    ...overrides,
  };
}

describe("inboxCardToUIDoc", () => {
  it("marks unguessed uploads as inbox items that need a folder", () => {
    const doc = inboxCardToUIDoc(sampleCard());
    expect(doc.id).toBe("inbox:c1");
    expect(doc.source).toBe("inbox");
    expect(doc.type).toBe("invoice");
    expect(doc.system).toBeNull();
    expect(doc.needsFolder).toBe(true);
    expect(doc.name).toBe("Belden Invoice");
  });

  it("keeps a guessed folder", () => {
    const doc = inboxCardToUIDoc(
      sampleCard({
        proposed: {
          system_key: "roof",
          document_type: "invoice",
          document_name: "Roof invoice",
          document_date: "2026-08-29",
        },
      }),
    );
    expect(doc.system).toBe("roof");
    expect(doc.needsFolder).toBe(false);
  });
});

describe("fileAllItemFromCard", () => {
  it("defaults a missing folder to Other", () => {
    const item = fileAllItemFromCard(sampleCard(), "2026-08-29");
    expect(item.system_key).toBe(DEFAULT_FILE_FOLDER);
    expect(item.document_type).toBe("invoice");
    expect(item.document_name).toBe("Belden Invoice");
    expect(item.document_date).toBe("2026-08-29");
  });

  it("keeps an explicit folder", () => {
    const item = fileAllItemFromCard(
      sampleCard({
        proposed: {
          system_key: "plumbing",
          document_type: "invoice",
          document_name: "Plumber invoice",
          document_date: "2026-01-01",
        },
      }),
    );
    expect(item.system_key).toBe("plumbing");
    expect(item.document_date).toBe("2026-01-01");
  });
});

describe("inbox id helpers", () => {
  it("round-trips client ids", () => {
    expect(clientIdFromInboxDocId(inboxDocId("abc"))).toBe("abc");
    expect(isInboxDoc({source: "inbox"})).toBe(true);
    expect(isInboxDoc({id: 1})).toBe(false);
  });
});
