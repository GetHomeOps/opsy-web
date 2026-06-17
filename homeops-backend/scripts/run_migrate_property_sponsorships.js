"use strict";

/**
 * One-shot migration: add property_sponsorships + properties.active_sponsor_account_id
 * to databases created from an older schema. Uses DATABASE_URL from env.
 */
const { ensurePropertySponsorshipSchema } = require("../services/propertySponsorshipSchema");

async function run() {
  await ensurePropertySponsorshipSchema();
  // eslint-disable-next-line no-console
  console.log("property_sponsorships schema is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
