#!/usr/bin/env node
"use strict";

/**
 * Seed Stripe Plans
 *
 * Uses data/plans.json. Updates existing rows by code; inserts only if subscription_products is empty
 * (so admin-deleted tiers are not recreated). plan_limits / plan_prices updated for synced rows.
 * Stripe Price IDs: set via env STRIPE_PRICE_IDS (JSON) or leave null for Super Admin to fill via UI.
 *
 * Usage: node scripts/seed_stripe_plans.js
 * Env: STRIPE_PRICE_IDS='{"homeowner_maintain_month":"price_xxx","homeowner_maintain_year":"price_yyy",...}'
 */

require("dotenv").config();
const { ensureStripePlans } = require("../services/planSeedService");

async function run() {
  await ensureStripePlans();
  console.log("Seed complete. Add Stripe Price IDs via STRIPE_PRICE_IDS env or Super Admin > Billing Plans.");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
