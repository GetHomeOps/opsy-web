"use strict";

/**
 * One-shot migration: homeaversary_sends claim table for anniversary emails.
 */
const { ensureHomeaversarySchema } = require("../services/homeaversarySchema");

async function run() {
  await ensureHomeaversarySchema();
  console.log("homeaversary_sends schema is present.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
