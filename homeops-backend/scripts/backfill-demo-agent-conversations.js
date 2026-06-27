#!/usr/bin/env node
/**
 * Backfill demo conversation threads for provisioned agent accounts.
 * Safe to re-run — skips conversations that already have messages.
 *
 * Usage:
 *   node scripts/backfill-demo-agent-conversations.js
 *   node scripts/backfill-demo-agent-conversations.js --email agent@example.com
 */
require("dotenv").config();
const db = require("../db");
const { backfillAgentDemoConversations } = require("../services/demoAccountProvisioner");

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--email="));
  const email = emailArg ? emailArg.split("=")[1] : null;

  let agents;
  if (email) {
    const res = await db.query(
      `SELECT id, email, name FROM users WHERE email = $1 AND role = 'agent'`,
      [email]
    );
    agents = res.rows;
    if (!agents.length) {
      console.error(`No agent user found for email: ${email}`);
      process.exit(1);
    }
  } else {
    const res = await db.query(
      `SELECT DISTINCT u.id, u.email, u.name
       FROM users u
       JOIN property_users pu ON pu.user_id = u.id AND pu.role = 'editor'
       JOIN property_users owner_pu
         ON owner_pu.property_id = pu.property_id
        AND owner_pu.role = 'owner'
        AND owner_pu.user_id != u.id
       WHERE u.role = 'agent'
       ORDER BY u.id`
    );
    agents = res.rows;
  }

  console.log(`Backfilling conversations for ${agents.length} agent(s)...`);
  let totalSeeded = 0;

  for (const agent of agents) {
    try {
      const result = await backfillAgentDemoConversations(agent.id);
      const seeded = result.results.filter((r) => r.messageCount > 0).length;
      totalSeeded += seeded;
      console.log(
        `  ${agent.email} (${agent.name}): ${result.properties} properties, ${seeded} seeded`
      );
    } catch (err) {
      console.error(`  ${agent.email}: ${err.message}`);
    }
  }

  console.log(`Done. Seeded ${totalSeeded} conversation(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
