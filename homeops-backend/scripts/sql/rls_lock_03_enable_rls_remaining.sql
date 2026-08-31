-- Enable RLS (no policies, no FORCE) on every remaining public table.
-- Safe for the Node backend while it connects as postgres (BYPASSRLS).
-- Do not add auth.uid() policies — this app does not use Supabase Auth.
-- Reversible: ALTER TABLE ... DISABLE ROW LEVEL SECURITY for each table.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;
