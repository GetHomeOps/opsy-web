"use strict";

/**
 * S3 key access helper tests (no live DB).
 * Run: node helpers/s3KeyAccess.test.js
 */

const { isOwnUploadKey, startsWithSharedPrefix } = require("./s3KeyAccess");

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}:`, err.message);
    process.exitCode = 1;
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message || "assertion failed");
}

test("own upload key matches second path segment", () => {
  assert(isOwnUploadKey("property_documents/42/file.pdf", 42));
  assert(isOwnUploadKey("user_photos/42", 42));
  assert(!isOwnUploadKey("property_documents/99/file.pdf", 42));
  assert(!isOwnUploadKey("property_documents/421/file.pdf", 42));
});

test("shared prefixes are catalog/platform assets", () => {
  assert(startsWithSharedPrefix("email_assets/welcome/icon.png"));
  assert(startsWithSharedPrefix("demo/fixture.pdf"));
  assert(startsWithSharedPrefix("professionals/1/photo.jpg"));
  assert(!startsWithSharedPrefix("property_documents/1/secret.pdf"));
  assert(!startsWithSharedPrefix("documents/1/secret.pdf"));
});
