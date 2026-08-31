-- Pilot: enable RLS with no policies on a low-risk analytics table.
-- No FORCE. postgres (backend) still bypasses RLS.
-- Reversible: ALTER TABLE public.daily_metrics_snapshot DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.daily_metrics_snapshot ENABLE ROW LEVEL SECURITY;
