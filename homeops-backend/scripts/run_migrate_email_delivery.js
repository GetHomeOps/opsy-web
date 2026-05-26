"use strict";

/**
 * One-shot migration: platform email delivery settings and template configs.
 * Uses DATABASE_URL from env.
 */
const db = require("../db");
const EmailTemplateConfig = require("../models/emailTemplateConfig");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS platform_email_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    default_provider VARCHAR(20) NOT NULL DEFAULT 'ses',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by INTEGER REFERENCES users(id)
  )`,
  `INSERT INTO platform_email_settings (id, default_provider)
   VALUES (1, 'ses')
   ON CONFLICT (id) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS email_template_configs (
    email_type VARCHAR(60) PRIMARY KEY,
    provider VARCHAR(20) NOT NULL DEFAULT 'inherit',
    is_switchable BOOLEAN NOT NULL DEFAULT true,
    label VARCHAR(120) NOT NULL,
    description TEXT,
    ses_subject TEXT,
    ses_html_body TEXT,
    customer_io_mode VARCHAR(20) DEFAULT 'event',
    customer_io_transactional_id INTEGER,
    customer_io_event_name VARCHAR(100),
    merge_variables JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  await EmailTemplateConfig.ensureSeeded();
  // eslint-disable-next-line no-console
  console.log("Email delivery tables ready; template configs seeded.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
