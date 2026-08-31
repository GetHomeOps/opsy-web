"use strict";

/**
 * Invitation.regenerateToken — Resend must revive expired pending invites.
 * Run: node models/invitation.regenerateToken.test.js
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { INVITATION_EXPIRY_HOURS } = require("../helpers/invitationTokens");

const dbPath = require.resolve("../db");
const invitationPath = require.resolve("./invitation");

let invitationRow;
const updates = [];

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      if (String(sql).includes("FROM invitations WHERE id")) {
        return { rows: invitationRow ? [{ ...invitationRow }] : [] };
      }
      if (String(sql).includes("UPDATE invitations") && String(sql).includes("token_hash")) {
        updates.push({ sql, params });
        invitationRow = {
          ...invitationRow,
          expiresAt: params[1],
        };
        return { rows: [] };
      }
      return { rows: [] };
    },
  },
};
delete require.cache[invitationPath];
const Invitation = require("./invitation");

describe("Invitation.regenerateToken", () => {
  before(() => {
    updates.length = 0;
  });

  after(() => {
    delete require.cache[dbPath];
    delete require.cache[invitationPath];
  });

  it("refreshes token and expiry for an expired pending invitation", async () => {
    invitationRow = {
      id: "inv-1",
      type: "property",
      status: "pending",
      inviteeEmail: "kataicarmen@windermere.com",
      expiresAt: new Date("2026-08-20T12:00:00.000Z"),
    };
    updates.length = 0;
    const before = Date.now();
    const { invitation, token } = await Invitation.regenerateToken("inv-1");
    const after = Date.now();

    assert.equal(typeof token, "string");
    assert.equal(token.length, 64);
    assert.equal(updates.length, 1);
    const [, newExpiresAt, id] = updates[0].params;
    assert.equal(id, "inv-1");
    assert.ok(newExpiresAt instanceof Date);
    const minExpiry = before + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000 - 1000;
    const maxExpiry = after + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000 + 1000;
    assert.ok(
      newExpiresAt.getTime() >= minExpiry && newExpiresAt.getTime() <= maxExpiry,
      `expected expiry ~168h from now, got ${newExpiresAt.toISOString()}`
    );
    assert.equal(invitation.status, "pending");
  });

  it("also refreshes token and expiry for a still-valid pending invitation", async () => {
    invitationRow = {
      id: "inv-3",
      type: "property",
      status: "pending",
      inviteeEmail: "agent@example.com",
      expiresAt: new Date(Date.now() + 86400000),
    };
    updates.length = 0;
    const before = Date.now();
    const { token } = await Invitation.regenerateToken("inv-3");
    const after = Date.now();

    assert.equal(typeof token, "string");
    assert.equal(token.length, 64);
    assert.equal(updates.length, 1);
    const [, newExpiresAt, id] = updates[0].params;
    assert.equal(id, "inv-3");
    const minExpiry = before + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000 - 1000;
    const maxExpiry = after + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000 + 1000;
    assert.ok(
      newExpiresAt.getTime() >= minExpiry && newExpiresAt.getTime() <= maxExpiry,
      `expected expiry ~168h from now, got ${newExpiresAt.toISOString()}`
    );
  });

  it("rejects invitations that are no longer pending", async () => {
    invitationRow = {
      id: "inv-2",
      type: "property",
      status: "accepted",
      inviteeEmail: "someone@example.com",
      expiresAt: new Date(Date.now() + 86400000),
    };
    await assert.rejects(
      () => Invitation.regenerateToken("inv-2"),
      /no longer pending/i
    );
  });
});
