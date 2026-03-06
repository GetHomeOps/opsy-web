-- Migration: property_uid CHAR(26) -> VARCHAR(26)
-- Required for shorter property IDs (12-char nanoid). VARCHAR avoids padding 12-char
-- values with spaces. Run this on existing databases.
-- New properties will get 12-char IDs; existing 26-char ULIDs remain valid.

ALTER TABLE properties ALTER COLUMN property_uid TYPE VARCHAR(26);
