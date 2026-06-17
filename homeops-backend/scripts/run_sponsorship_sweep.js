"use strict";

/**
 * One-shot manual run of the sponsorship grace/pending sweep. Useful for ops/testing
 * without waiting for the in-process hourly sweeper. Uses DATABASE_URL from env.
 */
const propertySponsorshipService = require("../services/propertySponsorshipService");

async function run() {
  const result = await propertySponsorshipService.runSponsorshipSweep();
  // eslint-disable-next-line no-console
  console.log("Sponsorship sweep complete:", result);
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
