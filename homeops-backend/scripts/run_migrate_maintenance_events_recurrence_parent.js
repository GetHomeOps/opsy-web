"use strict";

/**
 * One-shot migration: add recurrence_parent_id to maintenance_events so
 * recurring occurrences created from the same source event can be tracked
 * and managed as a series. Safe to run multiple times.
 */
const db = require("../db");

const STATEMENTS = [
  `ALTER TABLE maintenance_events
    ADD COLUMN IF NOT EXISTS recurrence_parent_id INTEGER
      REFERENCES maintenance_events(id) ON DELETE CASCADE`,
  `CREATE INDEX IF NOT EXISTS idx_maintenance_events_recurrence_parent
    ON maintenance_events(recurrence_parent_id)`,
];

async function run() {
  for (const sql of STATEMENTS) {
    await db.query(sql);
  }
  // eslint-disable-next-line no-console
  console.log("maintenance_events.recurrence_parent_id is present.");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
