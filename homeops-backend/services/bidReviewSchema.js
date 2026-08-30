"use strict";

/**
 * Idempotent schema bootstrap for Action Item ↔ bid linking and reviews.
 */

const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE property_documents
     ADD COLUMN IF NOT EXISTS checklist_item_id INTEGER
     REFERENCES inspection_checklist_items(id) ON DELETE SET NULL`,
  `CREATE INDEX IF NOT EXISTS idx_property_documents_checklist_item
     ON property_documents (checklist_item_id)`,
  `ALTER TABLE inspection_checklist_items
     ADD COLUMN IF NOT EXISTS selected_bid_document_id INTEGER
     REFERENCES property_documents(id) ON DELETE SET NULL`,
  `ALTER TABLE inspection_checklist_items
     ADD COLUMN IF NOT EXISTS bid_status VARCHAR(40) NOT NULL DEFAULT 'no_bids'`,
  `ALTER TABLE inspection_checklist_items
     ADD COLUMN IF NOT EXISTS bid_selected_at TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS action_item_bid_reviews (
     checklist_item_id INTEGER PRIMARY KEY
       REFERENCES inspection_checklist_items(id) ON DELETE CASCADE,
     comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
     questions JSONB NOT NULL DEFAULT '[]'::jsonb,
     activity JSONB NOT NULL DEFAULT '[]'::jsonb,
     generated_at TIMESTAMPTZ,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
];

async function ensureBidReviewSchema() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
}

module.exports = { ensureBidReviewSchema };
