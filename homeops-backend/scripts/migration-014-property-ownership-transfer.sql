-- Run against existing databases (idempotent where possible).
-- Property ownership transfer requests + notification FK.

CREATE TABLE IF NOT EXISTS property_ownership_transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT chk_otr_distinct_users CHECK (from_user_id <> to_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_otr_one_pending_per_property
    ON property_ownership_transfer_requests (property_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_otr_to_user_pending
    ON property_ownership_transfer_requests (to_user_id)
    WHERE status = 'pending';

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS ownership_transfer_request_id UUID
    REFERENCES property_ownership_transfer_requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_otr_id
    ON notifications (ownership_transfer_request_id)
    WHERE ownership_transfer_request_id IS NOT NULL;
