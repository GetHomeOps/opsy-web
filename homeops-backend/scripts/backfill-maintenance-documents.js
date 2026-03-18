#!/usr/bin/env node
/**
 * One-time backfill: sync files from existing maintenance records to property_documents
 * so they appear in the Documents tab. Run after adding maintenance_record_id column.
 *
 * Usage: node scripts/backfill-maintenance-documents.js
 */
require("dotenv").config();
const MaintenanceRecord = require("../models/maintenanceRecord");
const { syncMaintenanceRecordDocuments } = require("../services/maintenanceRecordDocumentsService");
const db = require("../db");

async function main() {
  const res = await db.query(
    `SELECT id FROM property_maintenance ORDER BY id`
  );
  const records = res.rows;
  console.log(`Found ${records.length} maintenance records`);
  let synced = 0;
  let errors = 0;
  for (const row of records) {
    try {
      const record = await MaintenanceRecord.getByRecordId(row.id);
      const files = Array.isArray(record?.data?.files) ? record.data.files : [];
      const withKeys = files.filter((f) => f?.key || f?.document_key);
      if (withKeys.length > 0) {
        await syncMaintenanceRecordDocuments(record);
        synced++;
      }
    } catch (err) {
      errors++;
      console.error(`Record ${row.id}:`, err.message);
    }
  }
  console.log(`Synced ${synced} records, ${errors} errors`);
  process.exit(errors > 0 ? 1 : 0);
}

main();
