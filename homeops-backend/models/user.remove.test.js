"use strict";

/**
 * User.remove account-ownership reassignment tests.
 * Run: node models/user.remove.test.js
 */

require("dotenv").config();
const { describe, it } = require("node:test");
const assert = require("node:assert");
const db = require("../db");
const User = require("./user");

const TAG = `user-remove-test-${Date.now()}`;

async function createAgentWithHomeownerOwnedProperty() {
  const agentRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, is_active, email_verified)
     VALUES ($1, $2, 'test-hash', 'agent', true, true)
     RETURNING id`,
    [`Agent ${TAG}`, `${TAG}-agent@example.com`]
  );
  const homeownerRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role, is_active, email_verified)
     VALUES ($1, $2, 'test-hash', 'homeowner', true, true)
     RETURNING id`,
    [`Homeowner ${TAG}`, `${TAG}-homeowner@example.com`]
  );
  const agentId = agentRes.rows[0].id;
  const homeownerId = homeownerRes.rows[0].id;

  const accountRes = await db.query(
    `INSERT INTO accounts (name, url, owner_user_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [`Account ${TAG}`, `${TAG}-acct`, agentId]
  );
  const accountId = accountRes.rows[0].id;

  await db.query(
    `INSERT INTO account_users (account_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [accountId, agentId]
  );

  const propertyRes = await db.query(
    `INSERT INTO properties (account_id, property_name, property_uid)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [accountId, `Property ${TAG}`, `${TAG}`.slice(0, 12)]
  );
  const propertyId = propertyRes.rows[0].id;

  await db.query(
    `INSERT INTO property_users (property_id, user_id, role)
     VALUES ($1, $2, 'owner'), ($1, $3, 'editor')`,
    [propertyId, homeownerId, agentId]
  );

  return { agentId, homeownerId, accountId, propertyId };
}

async function cleanup(ids) {
  const { agentId, homeownerId, accountId } = ids;
  await db.query(`DELETE FROM properties WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM account_users WHERE account_id = $1`, [accountId]);
  await db.query(`DELETE FROM accounts WHERE id = $1`, [accountId]);
  await db.query(
    `DELETE FROM users WHERE id IN ($1, $2)`,
    [agentId, homeownerId]
  );
}

describe("User.remove account ownership reassignment", () => {
  it("deletes agent who owns account with properties but is not property owner", async () => {
    const ids = await createAgentWithHomeownerOwnedProperty();

    try {
      const removed = await User.remove(ids.agentId);
      assert.strictEqual(removed.id, ids.agentId);

      const accountRes = await db.query(
        `SELECT owner_user_id FROM accounts WHERE id = $1`,
        [ids.accountId]
      );
      assert.strictEqual(
        accountRes.rows[0].owner_user_id,
        ids.homeownerId,
        "account ownership should transfer to property owner"
      );

      const memberRes = await db.query(
        `SELECT 1 FROM account_users WHERE account_id = $1 AND user_id = $2`,
        [ids.accountId, ids.homeownerId]
      );
      assert.strictEqual(memberRes.rows.length, 1);

      await db.query(`DELETE FROM properties WHERE account_id = $1`, [ids.accountId]);
      await db.query(`DELETE FROM account_users WHERE account_id = $1`, [ids.accountId]);
      await db.query(`DELETE FROM accounts WHERE id = $1`, [ids.accountId]);
      await db.query(`DELETE FROM users WHERE id = $1`, [ids.homeownerId]);
    } catch (err) {
      await cleanup(ids);
      throw err;
    }
  });

  it("still blocks users who are property owners", async () => {
    const ids = await createAgentWithHomeownerOwnedProperty();
    await db.query(
      `UPDATE property_users SET role = 'owner' WHERE property_id = $1 AND user_id = $2`,
      [ids.propertyId, ids.agentId]
    );
    await db.query(
      `UPDATE property_users SET role = 'editor' WHERE property_id = $1 AND user_id = $2`,
      [ids.propertyId, ids.homeownerId]
    );

    try {
      await assert.rejects(
        () => User.remove(ids.agentId),
        (err) => {
          assert.strictEqual(err.code, "PROPERTY_OWNER");
          return true;
        }
      );
    } finally {
      await cleanup(ids);
    }
  });
});
