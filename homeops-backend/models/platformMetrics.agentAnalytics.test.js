"use strict";

/**
 * Agent analytics property scoping tests.
 * Run: node models/platformMetrics.agentAnalytics.test.js
 */

require("dotenv").config();
const { describe, it } = require("node:test");
const assert = require("node:assert");
const db = require("../db");
const PlatformMetrics = require("./platformMetrics");

const TAG = `agent-analytics-${Date.now()}`;

async function seedAgentNotOnPropertyTeam() {
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
     VALUES ($1, $2, 'owner')`,
    [propertyId, homeownerId]
  );

  return { agentId, homeownerId, accountId, propertyId };
}

async function cleanup(ids) {
  await db.query(`DELETE FROM properties WHERE account_id = $1`, [ids.accountId]);
  await db.query(`DELETE FROM account_users WHERE account_id = $1`, [ids.accountId]);
  await db.query(`DELETE FROM accounts WHERE id = $1`, [ids.accountId]);
  await db.query(`DELETE FROM users WHERE id IN ($1, $2)`, [
    ids.agentId,
    ids.homeownerId,
  ]);
}

describe("PlatformMetrics.getAgentAnalytics", () => {
  it("does not attribute account properties when agent is not on property team", async () => {
    const ids = await seedAgentNotOnPropertyTeam();
    try {
      const { agents } = await PlatformMetrics.getAgentAnalytics();
      const agent = agents.find((a) => a.agentId === ids.agentId);
      assert.ok(agent, "seeded agent should appear in analytics");
      assert.strictEqual(agent.propertiesCount, 0);
      assert.strictEqual(agent.properties.length, 0);
    } finally {
      await cleanup(ids);
    }
  });
});
