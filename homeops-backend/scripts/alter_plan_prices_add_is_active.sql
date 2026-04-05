-- Add is_active column to plan_prices so individual billing intervals
-- (month / year) can be toggled on or off per plan.
-- When both intervals are inactive the plan should be treated as deactivated
-- by application logic (getPlansForAudience already filters on sp.is_active).

ALTER TABLE plan_prices
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
