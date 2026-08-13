"use strict";

/**
 * Assistant property inheritance tests.
 * Run: node helpers/propertyAccess.assistant.test.js
 */

const {
  resolveAssistantAgentUserId,
  resolvePropertiesListUserId,
  hasAssistantInheritedMembership,
  isUserAuthorizedForProperty,
} = require("./propertyAccess");

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✓ ${name}`))
    .catch((err) => {
      console.error(`✗ ${name}:`, err.message);
      process.exitCode = 1;
    });
}

function mockDb(handler) {
  return { query: (...args) => Promise.resolve(handler(...args)) };
}

async function run() {
  await test("resolveAssistantAgentUserId returns tethered agent", async () => {
    const db = mockDb((sql, params) => {
      if (sql.includes("assistant_of_user_id") && params[0] === 42) {
        return { rows: [{ agentId: 7 }] };
      }
      return { rows: [] };
    });
    const agentId = await resolveAssistantAgentUserId(42, db);
    if (agentId !== 7) throw new Error(`Expected 7, got ${agentId}`);
  });

  await test("resolveAssistantAgentUserId returns null for non-assistants", async () => {
    const db = mockDb(() => ({ rows: [] }));
    const agentId = await resolveAssistantAgentUserId(99, db);
    if (agentId !== null) throw new Error(`Expected null, got ${agentId}`);
  });

  await test("resolvePropertiesListUserId uses agent id for assistants", async () => {
    const db = mockDb((sql, params) => {
      if (params[0] === 42) return { rows: [{ agentId: 7 }] };
      return { rows: [] };
    });
    const listId = await resolvePropertiesListUserId(42, db);
    if (listId !== 7) throw new Error(`Expected 7, got ${listId}`);
  });

  await test("resolvePropertiesListUserId keeps own id for agents", async () => {
    const db = mockDb(() => ({ rows: [] }));
    const listId = await resolvePropertiesListUserId(7, db);
    if (listId !== 7) throw new Error(`Expected 7, got ${listId}`);
  });

  await test("assistants inherit agent property membership", async () => {
    const db = mockDb((sql, params) => {
      if (sql.includes("assistant_of_user_id")) {
        return { rows: [{ agentId: 7 }] };
      }
      if (sql.includes("property_users") && params[0] === 100 && params[1] === 7) {
        return { rows: [{ "?column?": 1 }] };
      }
      return { rows: [] };
    });
    const ok = await hasAssistantInheritedMembership(
      { userId: 42, propertyId: 100 },
      db,
    );
    if (!ok) throw new Error("Expected inherited membership");
  });

  await test("isUserAuthorizedForProperty allows inherited assistant access", async () => {
    const db = mockDb((sql, params) => {
      if (sql.includes("assistant_of_user_id")) {
        return { rows: [{ agentId: 7 }] };
      }
      if (sql.includes("property_users")) {
        /* Direct assistant membership: none; agent membership: yes */
        if (params[1] === 42) return { rows: [] };
        if (params[1] === 7) return { rows: [{ "?column?": 1 }] };
      }
      return { rows: [] };
    });
    const ok = await isUserAuthorizedForProperty(
      { userId: 42, propertyId: 100, role: "assistant" },
      db,
    );
    if (!ok) throw new Error("Expected assistant authorization via agent");
  });
}

run();
