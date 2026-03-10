# Welcome Modal Backend Persistence Migration

**For existing databases**, run this SQL to add the `welcome_modal_dismissed` column:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_modal_dismissed BOOLEAN DEFAULT false;
```

New deployments using `opsy-schema.sql` already include this column. The column defaults to `false` (show the modal until the user dismisses it).
