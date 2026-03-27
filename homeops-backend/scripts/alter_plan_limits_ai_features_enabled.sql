-- Run once on existing databases (opsy-schema.sql includes this for fresh installs).
ALTER TABLE plan_limits
  ADD COLUMN IF NOT EXISTS ai_features_enabled BOOLEAN NOT NULL DEFAULT true;
