"use strict";

/**
 * One-shot: ensure subscription_products.code = agent_free exists with plan_limits.
 * Safe to re-run — skips insert when the product already exists.
 * Uses DATABASE_URL from env.
 *
 * Run: node scripts/run_ensure_agent_free_plan.js
 * Or:  npm run ensure:agent-free
 */
const db = require("../db");

const AGENT_FREE = {
  code: "agent_free",
  name: "Free",
  description:
    "Entry-level agent plan. Track properties and contacts with basic tools. No AI or Opsy Scout.",
  targetRole: "agent",
  price: 0,
  sortOrder: 1,
  limits: {
    maxProperties: 3,
    maxContacts: 30,
    maxViewers: 1,
    maxTeamMembers: 2,
    aiTokenMonthlyQuota: 0,
    maxDocumentsPerSystem: 1,
    aiFeaturesEnabled: false,
    prePurchaseEnabled: false,
    otherLimits: {storageGb: 1},
  },
  features: [
    {id: "properties", label: "Up to 3 properties", included: true},
    {id: "contacts", label: "Up to 30 contacts", included: true},
    {id: "ai_assistant", label: "Opsy assistant", included: false},
    {id: "opsy_scout", label: "Opsy Scout", included: false},
    {id: "inspection_analysis", label: "AI inspection analysis", included: false},
    {id: "support", label: "FAQs, Bot, Videos, email (DIY)", included: true},
  ],
};

async function run() {
  const existing = await db.query(
    `SELECT id FROM subscription_products WHERE code = $1 LIMIT 1`,
    [AGENT_FREE.code]
  );

  let productId;
  if (existing.rows[0]?.id) {
    productId = existing.rows[0].id;
    // eslint-disable-next-line no-console
    console.log(`agent_free already exists (id=${productId}); ensuring plan_limits.`);
  } else {
    const lim = AGENT_FREE.limits;
    const ins = await db.query(
      `INSERT INTO subscription_products
        (name, description, target_role, price, billing_interval, code, sort_order,
         max_properties, max_contacts, max_viewers, max_team_members, features, popular, is_active)
       VALUES ($1, $2, $3, $4, 'month', $5, $6, $7, $8, $9, $10, $11, false, true)
       RETURNING id`,
      [
        AGENT_FREE.name,
        AGENT_FREE.description,
        AGENT_FREE.targetRole,
        AGENT_FREE.price,
        AGENT_FREE.code,
        AGENT_FREE.sortOrder,
        lim.maxProperties,
        lim.maxContacts,
        lim.maxViewers,
        lim.maxTeamMembers,
        JSON.stringify(AGENT_FREE.features),
      ]
    );
    productId = ins.rows[0].id;
    // eslint-disable-next-line no-console
    console.log(`Inserted agent_free subscription product (id=${productId}).`);
  }

  const lim = AGENT_FREE.limits;
  await db.query(
    `INSERT INTO plan_limits
      (subscription_product_id, max_properties, max_contacts, max_viewers, max_team_members,
       ai_token_monthly_quota, max_documents_per_system, ai_features_enabled, pre_purchase_enabled,
       other_limits, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     ON CONFLICT (subscription_product_id) DO NOTHING`,
    [
      productId,
      lim.maxProperties,
      lim.maxContacts,
      lim.maxViewers,
      lim.maxTeamMembers,
      lim.aiTokenMonthlyQuota,
      lim.maxDocumentsPerSystem,
      lim.aiFeaturesEnabled,
      lim.prePurchaseEnabled,
      JSON.stringify(lim.otherLimits || {}),
    ]
  );

  // eslint-disable-next-line no-console
  console.log("agent_free plan is present with plan_limits.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
