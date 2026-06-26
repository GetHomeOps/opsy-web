"use strict";

/**
 * Idempotent schema bootstrap for Default System Maintenance Recommendations.
 *
 * - Creates `system_recommendation_templates` (the Super Admin-managed library).
 * - Adds frequency / lifecycle / template_id columns to
 *   `inspection_checklist_items` and extends the `source` CHECK to allow
 *   'default_recommendation' (generated Action Items copied from templates).
 * - Adds `property_systems.recommendations_generated_at` (per-system dedup guard).
 * - Seeds the library from data/defaultSystemRecommendations.js when empty.
 *
 * Runs at startup (server.js) and via any future migration script. All
 * statements are guarded so existing databases upgrade safely.
 */

const db = require("../db");
const {
  DEFAULT_SYSTEM_RECOMMENDATIONS,
} = require("../data/defaultSystemRecommendations");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS system_recommendation_templates (
     id SERIAL PRIMARY KEY,
     system_key VARCHAR(50) NOT NULL,
     title VARCHAR(500) NOT NULL,
     description TEXT,
     frequency INTEGER,
     frequency_unit VARCHAR(20),
     priority VARCHAR(20) NOT NULL DEFAULT 'medium',
     lifecycle_replacement_years INTEGER,
     active BOOLEAN NOT NULL DEFAULT TRUE,
     sort_order INTEGER NOT NULL DEFAULT 0,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_system_rec_templates_system
     ON system_recommendation_templates (system_key, sort_order)`,

  // New columns on generated Action Items.
  `ALTER TABLE inspection_checklist_items ADD COLUMN IF NOT EXISTS frequency INTEGER`,
  `ALTER TABLE inspection_checklist_items ADD COLUMN IF NOT EXISTS frequency_unit VARCHAR(20)`,
  `ALTER TABLE inspection_checklist_items ADD COLUMN IF NOT EXISTS lifecycle_replacement_years INTEGER`,
  `ALTER TABLE inspection_checklist_items ADD COLUMN IF NOT EXISTS template_id INTEGER`,
  // User-editable maintenance dates on recommendations.
  `ALTER TABLE inspection_checklist_items ADD COLUMN IF NOT EXISTS last_performed_date DATE`,
  `ALTER TABLE inspection_checklist_items ADD COLUMN IF NOT EXISTS next_due_date DATE`,

  // Allow the new 'default_recommendation' source value.
  `ALTER TABLE inspection_checklist_items DROP CONSTRAINT IF EXISTS inspection_checklist_items_source_check`,
  `ALTER TABLE inspection_checklist_items
     ADD CONSTRAINT inspection_checklist_items_source_check
     CHECK (source IN ('needs_attention', 'maintenance_suggestion', 'user_created', 'default_recommendation'))`,

  // Per-system dedup guard so recommendations generate only once per system.
  `ALTER TABLE property_systems ADD COLUMN IF NOT EXISTS recommendations_generated_at TIMESTAMPTZ`,
];

/** Insert default templates only when the library table is empty. */
async function seedDefaultsIfEmpty() {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS count FROM system_recommendation_templates`
  );
  if (rows[0].count > 0) return;

  const values = [];
  const placeholders = [];
  let idx = 1;

  for (const [systemKey, templates] of Object.entries(
    DEFAULT_SYSTEM_RECOMMENDATIONS
  )) {
    templates.forEach((tpl, sortOrder) => {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );
      values.push(
        systemKey,
        tpl.title,
        tpl.description || null,
        tpl.frequency ?? null,
        tpl.frequencyUnit || null,
        tpl.priority || "medium",
        tpl.lifecycleReplacementYears ?? null,
        sortOrder
      );
    });
  }

  if (placeholders.length === 0) return;

  await db.query(
    `INSERT INTO system_recommendation_templates
       (system_key, title, description, frequency, frequency_unit,
        priority, lifecycle_replacement_years, sort_order)
     VALUES ${placeholders.join(", ")}`,
    values
  );
}

async function ensureSystemRecommendationTemplateSchema() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  await seedDefaultsIfEmpty();
}

module.exports = { ensureSystemRecommendationTemplateSchema };
