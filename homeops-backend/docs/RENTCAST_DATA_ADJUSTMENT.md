# RentCast Data Locking & Data Adjustment Requests

## Overview

Property fields sourced from the RentCast data provider are trusted and verified. These fields are read-only in the Property form. Users can request changes via the Data Adjustment Request workflow.

## Migration

For **deployed databases** created before this feature, run the following SQL against your database (e.g. via `psql` or your DB client):

```sql
-- 1. Add identity_data_source to properties (when 'rentcast', RentCast fields are read-only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'identity_data_source'
  ) THEN
    ALTER TABLE properties ADD COLUMN identity_data_source VARCHAR(50) DEFAULT NULL;
  END IF;
END $$;

-- 2. Extend support_tickets for data adjustment requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_tickets' AND column_name = 'property_id'
  ) THEN
    ALTER TABLE support_tickets ADD COLUMN property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL;
    ALTER TABLE support_tickets ADD COLUMN data_source VARCHAR(50) DEFAULT NULL;
    ALTER TABLE support_tickets ADD COLUMN data_adjustment_field VARCHAR(100) DEFAULT NULL;
    ALTER TABLE support_tickets ADD COLUMN data_adjustment_current TEXT DEFAULT NULL;
    ALTER TABLE support_tickets ADD COLUMN data_adjustment_requested TEXT DEFAULT NULL;
    CREATE INDEX IF NOT EXISTS idx_support_tickets_property_id ON support_tickets(property_id);
  END IF;
END $$;

-- 3. Update support_tickets type constraint to allow 'data_adjustment'
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_type_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_type_check
  CHECK (type IN ('support', 'feedback', 'data_adjustment'));

-- 4. Update support_tickets status constraint to allow 'pending_review'
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN (
    'new', 'working_on_it', 'solved', 'waiting_on_user', 'resolved', 'closed',
    'under_review', 'planned', 'implemented', 'rejected', 'pending_review'
  ));
```

This adds:
- `properties.identity_data_source` – when `'rentcast'`, RentCast-sourced fields are locked
- `support_tickets` – `property_id`, `data_source`, `data_adjustment_field`, `data_adjustment_current`, `data_adjustment_requested`
- Extended `type` and `status` constraints for data adjustment tickets

*Note: Fresh installs via `opsy-schema.sql` or `opsyDB.sql` already include these changes; no migration needed.*

## Locked Fields (RentCast-sourced)

When `identity_data_source === 'rentcast'`, these fields are read-only:

- Owner (name, name 2, city)
- Tax/Parcel ID
- Address Line 2
- County
- Property Type, Sub Type, Roof Type
- Year Built
- Sq Ft (Total, Finished, Total Dwelling)
- Lot Size
- Beds, Baths (all variants)
- Fireplaces, Fireplace Types
- Basement
- Parking (Type, Covered, Uncovered)
- Schools (District, Elementary, Junior High, Senior High)

## Data Adjustment Request Flow

1. From a property page with RentCast data: Actions → "Request Data Adjustment"
2. Or from Support: "Request Data Adjustment" button → Data Adjustment Request page
3. Form pre-fills Property and Field when opened from a property
4. User enters requested value, reason, and optional attachments
5. Submission creates a support ticket with type `data_adjustment` and status `pending_review`

## Setting `identity_data_source`

`identity_data_source` is set to `'rentcast'` when a property is created via the Systems Setup Modal and the user has used the RentCast property lookup. It is not editable by users after creation.
