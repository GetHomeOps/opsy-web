"use strict";

/**
 * Invitation token + expiry helpers.
 * Run: node helpers/invitationTokens.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  generateInvitationToken,
  INVITATION_EXPIRY_HOURS,
  invitationExpiresAt,
} = require("./invitationTokens");

describe("generateInvitationToken", () => {
  it("returns a hex token and matching sha256 hash", () => {
    const { token, tokenHash } = generateInvitationToken();
    assert.equal(typeof token, "string");
    assert.equal(token.length, 64);
    assert.equal(tokenHash.length, 64);
    assert.notEqual(token, tokenHash);
  });
});

describe("invitationExpiresAt", () => {
  it("defaults to 168 hours from the given time", () => {
    const from = new Date("2026-08-13T12:00:00.000Z");
    const expires = invitationExpiresAt(from);
    assert.equal(INVITATION_EXPIRY_HOURS, 168);
    assert.equal(expires.toISOString(), "2026-08-20T12:00:00.000Z");
  });
});
