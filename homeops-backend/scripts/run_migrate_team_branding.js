"use strict";

/**
 * One-shot migration: add team branding columns for white-label customization.
 * Used when the parent agency has no customization. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7)`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS sidebar_icon_key TEXT`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS agent_card_logo_key TEXT`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS agent_card_accent_color VARCHAR(7)`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS agent_card_background_color VARCHAR(7)`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS agent_card_agent_label VARCHAR(80)`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS agent_card_company_name VARCHAR(120)`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS sidebar_text_color VARCHAR(7)`,
  `ALTER TABLE teams
    ADD COLUMN IF NOT EXISTS agent_card_text_color VARCHAR(7)`,
  // Unify sidebar icon + company logo into one logical logo (keep both columns in sync).
  `UPDATE teams
    SET sidebar_icon_key = COALESCE(sidebar_icon_key, agent_card_logo_key)
    WHERE sidebar_icon_key IS NULL AND agent_card_logo_key IS NOT NULL`,
  `UPDATE teams
    SET agent_card_logo_key = sidebar_icon_key
    WHERE sidebar_icon_key IS NOT NULL
      AND (agent_card_logo_key IS DISTINCT FROM sidebar_icon_key)`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("teams: branding columns are present; logo keys synced.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
