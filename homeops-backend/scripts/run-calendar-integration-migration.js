#!/usr/bin/env node
/**
 * Add calendar integration tables for Google Calendar and Outlook sync.
 * Run: node scripts/run-calendar-integration-migration.js
 */
require("dotenv").config();
const db = require("../db");

const MIGRATION_SQL = `
-- Calendar integrations (OAuth tokens per user per provider)
CREATE TABLE IF NOT EXISTS calendar_integrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'outlook')),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    calendar_id VARCHAR(255) DEFAULT 'primary',
    sync_enabled BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user ON calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_provider ON calendar_integrations(provider);

-- Links maintenance events to external calendar events (one row per event per integration)
CREATE TABLE IF NOT EXISTS event_calendar_syncs (
    id SERIAL PRIMARY KEY,
    maintenance_event_id INTEGER NOT NULL REFERENCES maintenance_events(id) ON DELETE CASCADE,
    calendar_integration_id INTEGER NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
    external_event_id VARCHAR(255) NOT NULL,
    provider VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(maintenance_event_id, calendar_integration_id)
);

CREATE INDEX IF NOT EXISTS idx_event_calendar_syncs_event ON event_calendar_syncs(maintenance_event_id);
CREATE INDEX IF NOT EXISTS idx_event_calendar_syncs_integration ON event_calendar_syncs(calendar_integration_id);
`;

async function run() {
  try {
    await db.query(MIGRATION_SQL);
    console.log("Calendar integration migration complete.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

run();
