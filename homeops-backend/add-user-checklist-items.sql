-- Migration: Allow user-created inspection checklist items
-- Run against the database to apply this change.

-- 1. Make analysis_result_id nullable (user items have no analysis)
ALTER TABLE inspection_checklist_items
  ALTER COLUMN analysis_result_id DROP NOT NULL;

-- 2. Make source_index nullable (user items have no source index)
ALTER TABLE inspection_checklist_items
  ALTER COLUMN source_index DROP NOT NULL;

-- 3. Expand the source CHECK constraint to include 'user_created'
ALTER TABLE inspection_checklist_items
  DROP CONSTRAINT IF EXISTS inspection_checklist_items_source_check;

ALTER TABLE inspection_checklist_items
  ADD CONSTRAINT inspection_checklist_items_source_check
  CHECK (source IN ('needs_attention', 'maintenance_suggestion', 'user_created'));
