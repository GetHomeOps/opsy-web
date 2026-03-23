-- Apply to existing databases that were created before homeowner_agent_inquiries existed.
-- Safe to run once; uses IF NOT EXISTS / IF NOT EXISTS column patterns where supported.

CREATE TABLE IF NOT EXISTS homeowner_agent_inquiries (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(30) NOT NULL CHECK (kind IN ('message', 'referral_request', 'refer_agent')),
    payload JSONB NOT NULL DEFAULT '{}',
    agent_read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hai_agent_account ON homeowner_agent_inquiries(agent_user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_hai_account_created ON homeowner_agent_inquiries(account_id, created_at DESC);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS homeowner_inquiry_id INTEGER REFERENCES homeowner_agent_inquiries(id) ON DELETE SET NULL;
