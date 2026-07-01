"use strict";

const db = require("../db");

/** Paired demo homeowner linked to a provisioned agent (demo site super-admin view). */
async function getPairedDemoHomeownerForAgent(agentUserId) {
  const pairedRes = await db.query(
    `SELECT id, email, name, demo_login_password AS "demoLoginPassword",
            demo_expires_at AS "demoExpiresAt"
     FROM users
     WHERE demo_paired_agent_id = $1
     ORDER BY id
     LIMIT 1`,
    [agentUserId]
  );
  return pairedRes.rows[0] || null;
}

module.exports = { getPairedDemoHomeownerForAgent };
