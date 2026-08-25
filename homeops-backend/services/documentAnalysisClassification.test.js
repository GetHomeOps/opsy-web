"use strict";

/**
 * Classification + identity-apply tests.
 * Run: node services/documentAnalysisClassification.test.js
 */

const {
  classifyCategoryFromHints,
  resolveDetectedCategory,
  resolveDeclaredCategory,
  canonicalDocumentTypeForCategory,
  shouldSyncDocumentType,
  canProposePropertyIdentity,
  shouldWriteExtractedFieldsToSystem,
} = require("./documentAnalysisClassification");
const {
  buildIdentityReviewFields,
  mergeSelectedIdentityFields,
  namespaceIdentityFindings,
  isIdentityColumnBlank,
  snapshotQuoteFields,
} = require("./documentAnalysisFieldMapper");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✓ ${name}`))
    .catch((err) => {
      console.error(`✗ ${name}:`, err.message);
      process.exitCode = 1;
    });
}

async function run() {
  await test("maps filename and type hints to bid vs invoice", () => {
    assert(classifyCategoryFromHints({ fileName: "roof-quote.pdf" }) === "bid", "quote → bid");
    assert(
      classifyCategoryFromHints({ documentType: "invoice" }) === "installation_invoice",
      "invoice type → installation_invoice",
    );
    assert(
      resolveDetectedCategory("bid", { documentType: "receipt" }) === "bid",
      "AI category wins over hint",
    );
    assert(
      resolveDetectedCategory("not-a-category", { documentType: "inspection" }) ===
        "inspection_report",
      "invalid AI category falls back to hints",
    );
  });

  await test("accepts only picker-declared categories before analysis", () => {
    assert(resolveDeclaredCategory("bid") === "bid", "bid declared");
    assert(
      resolveDeclaredCategory("installation_invoice") === "installation_invoice",
      "invoice declared",
    );
    assert(resolveDeclaredCategory("other") === "other", "other declared");
    assert(resolveDeclaredCategory("inspection_report") === null, "inspection not picker");
    assert(resolveDeclaredCategory("maintenance_report") === null, "maintenance not picker");
    assert(resolveDeclaredCategory("nope") === null, "invalid rejected");
  });

  await test("bids do not write extracted fields onto the system", () => {
    assert(shouldWriteExtractedFieldsToSystem("bid") === false, "bid blocked");
    assert(shouldWriteExtractedFieldsToSystem("installation_invoice") === true, "invoice writes");
    assert(shouldWriteExtractedFieldsToSystem("other") === true, "other writes");
    const snap = snapshotQuoteFields([
      { fieldKey: "cost", label: "Cost", value: "4200" },
      { key: "installer", value: "Belden" },
    ]);
    assert(snap.length === 2, "snapshot keeps quote fields");
    assert(snap[0].fieldKey === "cost", "cost key");
    assert(snap[1].fieldKey === "installer", "installer from key");
  });

  await test("syncs canonical display types without overwriting other with specialized types", () => {
    assert(canonicalDocumentTypeForCategory("bid") === "bid", "bid canonical");
    assert(
      canonicalDocumentTypeForCategory("installation_invoice") === "invoice",
      "invoice canonical",
    );
    assert(shouldSyncDocumentType("receipt", "bid") === true, "receipt → bid");
    assert(shouldSyncDocumentType("bid", "bid") === false, "already bid");
    assert(shouldSyncDocumentType("warranty", "other") === false, "do not sync other");
  });

  await test("only invoices can propose property identity", () => {
    assert(canProposePropertyIdentity("installation_invoice") === true, "invoice ok");
    assert(canProposePropertyIdentity("bid") === false, "bid blocked");
    assert(canProposePropertyIdentity("other") === false, "other blocked");
  });

  await test("namespaces identity findings on invoices and strips them from bids", () => {
    const invoice = namespaceIdentityFindings(
      [{ fieldKey: "address", value: "12 Main St" }, { fieldKey: "cost", value: "400" }],
      "installation_invoice",
    );
    assert(
      invoice.some((f) => f.fieldKey === "identity.address"),
      "address namespaced",
    );
    const bid = namespaceIdentityFindings(
      [{ fieldKey: "identity.address", value: "12 Main St" }, { fieldKey: "cost", value: "400" }],
      "bid",
    );
    assert(!bid.some((f) => f.fieldKey === "identity.address"), "bid identity stripped");
    assert(bid.some((f) => f.fieldKey === "cost"), "bid keeps system fields");
  });

  await test("preselects only blank identity fields with enough confidence", () => {
    const rows = buildIdentityReviewFields(
      [
        { fieldKey: "identity.address", value: "12 Main St", confidence: 0.9 },
        { fieldKey: "identity.yearBuilt", value: "1998", confidence: 0.95 },
        { fieldKey: "identity.city", value: "Kent", confidence: 0.4 },
      ],
      { address: "", year_built: 1970, city: "" },
    );
    const byKey = Object.fromEntries(rows.map((r) => [r.fieldKey, r]));
    assert(byKey["identity.address"].selectedByDefault === true, "blank address selected");
    assert(byKey["identity.yearBuilt"].selectedByDefault === false, "filled year not selected");
    assert(byKey["identity.yearBuilt"].hasConflict === true, "filled year is conflict");
    assert(byKey["identity.city"].selectedByDefault === false, "low confidence not selected");
  });

  await test("treats sentinel 0 as a blank identity number", () => {
    assert(isIdentityColumnBlank(0, "integer") === true, "0 year is blank");
    assert(isIdentityColumnBlank(1984, "integer") === false, "real year is filled");
  });

  await test("applies only selected allowlisted identity fields for invoices", () => {
    const invoice = mergeSelectedIdentityFields(
      [
        { fieldKey: "identity.address", value: "12 Main St" },
        { fieldKey: "identity.yearBuilt", value: "1998" },
        { fieldKey: "identity.taxId", value: "ABC-1" },
      ],
      ["identity.address", "identity.yearBuilt"],
      { address: "", year_built: 0 },
      { category: "installation_invoice" },
    );
    assert(invoice.columns.address === "12 Main St", "address applied");
    assert(invoice.columns.year_built === 1998, "year coerced");
    assert(invoice.columns.tax_id == null, "unselected tax skipped");
    assert(invoice.applied.length === 2, "two applied rows");

    const bid = mergeSelectedIdentityFields(
      [{ fieldKey: "identity.address", value: "12 Main St" }],
      ["identity.address"],
      { address: "" },
      { category: "bid" },
    );
    assert(Object.keys(bid.columns).length === 0, "bid cannot apply identity");
  });
}

run();
