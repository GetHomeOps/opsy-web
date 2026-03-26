-- Tracks which identity fields were returned by ATTOM/RentCast lookup (camelCase keys).
-- NULL = use legacy lock rule (non-empty vendor-eligible saved fields) for existing rows.
-- [] = explicit empty list (no vendor-locked fields).
-- Non-empty JSON array = lock only those field keys on the Identity form.

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS identity_lookup_populated_keys JSONB DEFAULT NULL;

COMMENT ON COLUMN properties.identity_lookup_populated_keys IS
  'JSON array of camelCase field keys last populated from property record lookup (ATTOM/RentCast). NULL = legacy behavior.';
