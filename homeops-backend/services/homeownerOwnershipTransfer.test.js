"use strict";

/**
 * Homeowner auto-ownership and agent property limit tests.
 * Run: node services/homeownerOwnershipTransfer.test.js
 */

require("dotenv").config();
const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  shouldAutoTransferOwnershipOnHomeownerInvite,
} = require("./propertyOwnershipService");
const {
  countPropertiesForLimit,
  countAgentManagedProperties,
  countAccountOwnedProperties,
} = require("./tierService");

function mockQuery(responses) {
  let callIndex = 0;
  return async (sql, params) => {
    const handler = responses[callIndex];
    callIndex += 1;
    if (typeof handler === "function") return handler(sql, params);
    return handler;
  };
}

describe("shouldAutoTransferOwnershipOnHomeownerInvite", () => {
  const baseInvitation = {
    type: "property",
    propertyId: 10,
    intendedPropertyRole: "homeowner",
    intendedRole: "editor",
    inviterUserId: 1,
  };

  it("returns false for view-only homeowner invites", async () => {
    const result = await shouldAutoTransferOwnershipOnHomeownerInvite({
      invitation: { ...baseInvitation, intendedRole: "viewer" },
      inviteeUserId: 2,
      inviteeUserRole: "homeowner",
      queryFn: mockQuery([]),
    });
    assert.strictEqual(result, false);
  });

  it("returns false when inviter is not agent or super_admin", async () => {
    const result = await shouldAutoTransferOwnershipOnHomeownerInvite({
      invitation: baseInvitation,
      inviteeUserId: 2,
      inviteeUserRole: "homeowner",
      queryFn: mockQuery([
        { rows: [{ role: "homeowner" }] },
      ]),
    });
    assert.strictEqual(result, false);
  });

  it("returns false when invitee is not a homeowner", async () => {
    const result = await shouldAutoTransferOwnershipOnHomeownerInvite({
      invitation: baseInvitation,
      inviteeUserId: 2,
      inviteeUserRole: "agent",
      queryFn: mockQuery([
        { rows: [{ role: "agent" }] },
      ]),
    });
    assert.strictEqual(result, false);
  });

  it("returns false when a homeowner owner already exists", async () => {
    const result = await shouldAutoTransferOwnershipOnHomeownerInvite({
      invitation: baseInvitation,
      inviteeUserId: 2,
      inviteeUserRole: "homeowner",
      queryFn: mockQuery([
        { rows: [{ role: "agent" }] },
        { rows: [{ 1: 1 }] },
      ]),
    });
    assert.strictEqual(result, false);
  });

  it("returns transfer details for qualifying agent homeowner invite", async () => {
    const result = await shouldAutoTransferOwnershipOnHomeownerInvite({
      invitation: baseInvitation,
      inviteeUserId: 2,
      inviteeUserRole: "homeowner",
      queryFn: mockQuery([
        { rows: [{ role: "agent" }] },
        { rows: [] },
        { rows: [{ user_id: 1 }] },
      ]),
    });
    assert.deepStrictEqual(result, {
      fromUserId: 1,
      toUserId: 2,
      propertyId: 10,
    });
  });

  it("returns transfer details for super_admin inviter", async () => {
    const result = await shouldAutoTransferOwnershipOnHomeownerInvite({
      invitation: baseInvitation,
      inviteeUserId: 2,
      inviteeUserRole: "homeowner",
      queryFn: mockQuery([
        { rows: [{ role: "super_admin" }] },
        { rows: [] },
        { rows: [{ user_id: 99 }] },
      ]),
    });
    assert.deepStrictEqual(result, {
      fromUserId: 99,
      toUserId: 2,
      propertyId: 10,
    });
  });

  it("returns false for non-homeowner intended property role", async () => {
    const result = await shouldAutoTransferOwnershipOnHomeownerInvite({
      invitation: { ...baseInvitation, intendedPropertyRole: "agent" },
      inviteeUserId: 2,
      inviteeUserRole: "homeowner",
      queryFn: mockQuery([]),
    });
    assert.strictEqual(result, false);
  });
});

describe("tierService property counting (integration)", () => {
  const hasDb = Boolean(process.env.DATABASE_URL);

  it("countAccountOwnedProperties returns a number", { skip: !hasDb }, async () => {
    const db = require("../db");
    const acc = await db.query(`SELECT id FROM accounts LIMIT 1`);
    if (!acc.rows[0]) return;
    const count = await countAccountOwnedProperties(acc.rows[0].id);
    assert.ok(typeof count === "number" && count >= 0);
  });

  it("countAccountOwnedProperties ignores orphan properties with no team", { skip: !hasDb }, async () => {
    const db = require("../db");
    const tag = `orphan-count-${Date.now()}`;
    const ownerRes = await db.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, email_verified)
       VALUES ($1, $2, 'test-hash', 'homeowner', true, true)
       RETURNING id`,
      [`Owner ${tag}`, `${tag}@example.com`]
    );
    const ownerId = ownerRes.rows[0].id;
    const accountRes = await db.query(
      `INSERT INTO accounts (name, url, owner_user_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [`Account ${tag}`, tag.slice(0, 40), ownerId]
    );
    const accountId = accountRes.rows[0].id;
    await db.query(
      `INSERT INTO account_users (account_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [accountId, ownerId]
    );

    const orphanRes = await db.query(
      `INSERT INTO properties (account_id, property_name, property_uid)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [accountId, `Orphan ${tag}`, tag.slice(0, 12)]
    );
    const orphanId = orphanRes.rows[0].id;

    const visibleRes = await db.query(
      `INSERT INTO properties (account_id, property_name, property_uid)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [accountId, `Visible ${tag}`, `${tag}`.slice(0, 11) + "v"]
    );
    const visibleId = visibleRes.rows[0].id;
    await db.query(
      `INSERT INTO property_users (property_id, user_id, role)
       VALUES ($1, $2, 'owner')`,
      [visibleId, ownerId]
    );

    try {
      const count = await countAccountOwnedProperties(accountId);
      assert.strictEqual(count, 1);
      const forLimit = await countPropertiesForLimit({
        accountId,
        userId: ownerId,
        userRole: "homeowner",
      });
      assert.strictEqual(forLimit, 1);
    } finally {
      await db.query(`DELETE FROM properties WHERE id IN ($1, $2)`, [orphanId, visibleId]);
      await db.query(`DELETE FROM account_users WHERE account_id = $1`, [accountId]);
      await db.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
      await db.query(`DELETE FROM users WHERE id = $1`, [ownerId]);
    }
  });

  it("countAgentManagedProperties returns a number for agent users", { skip: !hasDb }, async () => {
    const db = require("../db");
    const agent = await db.query(`SELECT id FROM users WHERE role = 'agent' LIMIT 1`);
    if (!agent.rows[0]) return;
    const count = await countAgentManagedProperties(agent.rows[0].id);
    assert.ok(typeof count === "number" && count >= 0);
  });

  it("countPropertiesForLimit uses agent-managed count for agents", { skip: !hasDb }, async () => {
    const db = require("../db");
    const agent = await db.query(
      `SELECT u.id, au.account_id
       FROM users u
       JOIN account_users au ON au.user_id = u.id
       WHERE u.role = 'agent'
       LIMIT 1`
    );
    if (!agent.rows[0]) return;
    const { id: userId, account_id: accountId } = agent.rows[0];
    const [managed, forLimit] = await Promise.all([
      countAgentManagedProperties(userId),
      countPropertiesForLimit({ accountId, userId, userRole: "agent" }),
    ]);
    assert.strictEqual(forLimit, managed);
  });
});

describe("Property.updatePropertyUsers empty-team guard", () => {
  it("rejects syncing an empty team before touching the database", async () => {
    const Property = require("../models/property");
    await assert.rejects(
      () => Property.updatePropertyUsers(1, []),
      (err) => {
        assert.match(String(err.message || err), /at least one team member/i);
        return true;
      }
    );
  });
});
