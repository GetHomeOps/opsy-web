"use strict";

/**
 * One-shot migration: Pre-Purchase Analysis tables.
 * Uses DATABASE_URL from env. Safe to re-run (IF NOT EXISTS).
 */
const db = require("../db");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS pre_purchase_analyses (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    street VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip VARCHAR(20),
    photo_key VARCHAR(512),
    identity_data JSONB DEFAULT NULL,
    identity_data_source VARCHAR(50) DEFAULT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft',
            'uploading',
            'extracting',
            'identifying_systems',
            'detecting_issues',
            'generating_recommendations',
            'completed',
            'failed'
        )),
    progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
    progress_message VARCHAR(255),
    error_message TEXT,
    overall_condition_score INTEGER CHECK (overall_condition_score IS NULL OR (overall_condition_score >= 0 AND overall_condition_score <= 100)),
    overall_condition_rating VARCHAR(20)
        CHECK (overall_condition_rating IS NULL OR overall_condition_rating IN ('excellent', 'good', 'fair', 'poor', 'unknown')),
    executive_summary TEXT,
    repair_cost_low NUMERIC(12, 2),
    repair_cost_high NUMERIC(12, 2),
    repair_confidence VARCHAR(20)
        CHECK (repair_confidence IS NULL OR repair_confidence IN ('low', 'medium', 'high')),
    positive_findings JSONB DEFAULT '[]',
    top_concerns JSONB DEFAULT '[]',
    disclaimer_version VARCHAR(20) DEFAULT 'v1',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE pre_purchase_analyses ADD COLUMN IF NOT EXISTS identity_data JSONB DEFAULT NULL`,
  `ALTER TABLE pre_purchase_analyses ADD COLUMN IF NOT EXISTS identity_data_source VARCHAR(50) DEFAULT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_analyses_account ON pre_purchase_analyses(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_analyses_property ON pre_purchase_analyses(property_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_analyses_status ON pre_purchase_analyses(status)`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_analyses_created ON pre_purchase_analyses(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_analyses_created_by ON pre_purchase_analyses(created_by)`,
  `CREATE TABLE IF NOT EXISTS pre_purchase_documents (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL REFERENCES pre_purchase_analyses(id) ON DELETE CASCADE,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(40) NOT NULL DEFAULT 'other'
        CHECK (document_type IN ('inspection', 'disclosure', 'estimate', 'other')),
    document_key VARCHAR(512) NOT NULL,
    mime_type VARCHAR(100),
    page_count INTEGER,
    file_size_bytes INTEGER,
    analysis_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_documents_analysis ON pre_purchase_documents(analysis_id)`,
  `CREATE TABLE IF NOT EXISTS pre_purchase_systems (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL REFERENCES pre_purchase_analyses(id) ON DELETE CASCADE,
    system_key VARCHAR(50) NOT NULL,
    system_label VARCHAR(100) NOT NULL,
    condition VARCHAR(20)
        CHECK (condition IS NULL OR condition IN ('excellent', 'good', 'fair', 'poor', 'unknown')),
    condition_confidence NUMERIC(4, 2),
    issues_count INTEGER NOT NULL DEFAULT 0,
    repair_cost_low NUMERIC(12, 2),
    repair_cost_high NUMERIC(12, 2),
    urgency VARCHAR(20)
        CHECK (urgency IS NULL OR urgency IN ('immediate', 'near_term', 'long_term', 'monitor')),
    evidence_summary TEXT,
    evidence_sources JSONB DEFAULT '[]',
    details JSONB DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_systems_analysis ON pre_purchase_systems(analysis_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_pre_purchase_systems_key ON pre_purchase_systems(analysis_id, system_key)`,
  `CREATE TABLE IF NOT EXISTS pre_purchase_findings (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL REFERENCES pre_purchase_analyses(id) ON DELETE CASCADE,
    system_id INTEGER REFERENCES pre_purchase_systems(id) ON DELETE SET NULL,
    document_id INTEGER REFERENCES pre_purchase_documents(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'moderate'
        CHECK (severity IN ('major', 'moderate', 'minor')),
    urgency VARCHAR(20)
        CHECK (urgency IS NULL OR urgency IN ('immediate', 'near_term', 'long_term', 'monitor')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    evidence TEXT,
    source_excerpt TEXT,
    page_reference VARCHAR(100),
    estimated_cost_low NUMERIC(12, 2),
    estimated_cost_high NUMERIC(12, 2),
    recommended_action TEXT,
    confidence NUMERIC(4, 2),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_findings_analysis ON pre_purchase_findings(analysis_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_findings_severity ON pre_purchase_findings(analysis_id, severity)`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_findings_system ON pre_purchase_findings(system_id)`,
  `CREATE TABLE IF NOT EXISTS pre_purchase_recommendations (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL REFERENCES pre_purchase_analyses(id) ON DELETE CASCADE,
    finding_id INTEGER REFERENCES pre_purchase_findings(id) ON DELETE SET NULL,
    system_key VARCHAR(50),
    urgency_group VARCHAR(20) NOT NULL DEFAULT 'near_term'
        CHECK (urgency_group IN ('immediate', 'near_term', 'long_term', 'monitor')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_recommendations_analysis ON pre_purchase_recommendations(analysis_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_recommendations_urgency ON pre_purchase_recommendations(analysis_id, urgency_group)`,
  `CREATE TABLE IF NOT EXISTS pre_purchase_professional_matches (
    id SERIAL PRIMARY KEY,
    analysis_id INTEGER NOT NULL REFERENCES pre_purchase_analyses(id) ON DELETE CASCADE,
    recommendation_id INTEGER REFERENCES pre_purchase_recommendations(id) ON DELETE SET NULL,
    finding_id INTEGER REFERENCES pre_purchase_findings(id) ON DELETE SET NULL,
    system_key VARCHAR(50),
    professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    match_reason TEXT,
    match_score NUMERIC(6, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_pro_matches_analysis ON pre_purchase_professional_matches(analysis_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pre_purchase_pro_matches_pro ON pre_purchase_professional_matches(professional_id)`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("pre_purchase_*: tables are present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
