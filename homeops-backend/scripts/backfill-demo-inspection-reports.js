#!/usr/bin/env node
/**
 * Backfill dummy inspection reports on demo sample properties that were
 * provisioned before inspection seeding ran on all property focuses.
 *
 * Matches properties by demo template address (indices 1–4) and skips any
 * property that already has an inspectionReport document.
 *
 * Usage:
 *   node scripts/backfill-demo-inspection-reports.js
 *   node scripts/backfill-demo-inspection-reports.js --email=agent@example.com
 *   node scripts/backfill-demo-inspection-reports.js --dry-run
 */
"use strict";

require("dotenv").config();
const db = require("../db");
const demoProperties = require("../data/demo-properties.json");
const { seedInspectionAnalysis } = require("../services/demoAccountProvisioner");

const DEMO_PROPERTY_INDICES = [1, 2, 3, 4];

function addressByIndex(index) {
  const entry = demoProperties.properties.find((p) => p.index === index);
  return entry?.address?.address_line_1 || null;
}

async function findPropertiesMissingInspection(agentEmail) {
  const conditions = [`NOT EXISTS (
      SELECT 1 FROM property_documents pd
      WHERE pd.property_id = p.id AND pd.system_key = 'inspectionReport'
    )`];
  const params = [];

  if (agentEmail) {
    params.push(agentEmail);
    conditions.push(`EXISTS (
      SELECT 1 FROM property_users pu
      JOIN users u ON u.id = pu.user_id
      WHERE pu.property_id = p.id
        AND pu.role = 'editor'
        AND u.email = $${params.length}
    )`);
  }

  const addresses = DEMO_PROPERTY_INDICES.map(addressByIndex).filter(Boolean);
  if (!addresses.length) return [];

  params.push(addresses);
  conditions.push(`p.address_line_1 = ANY($${params.length}::text[])`);

  const res = await db.query(
    `SELECT p.id AS property_id,
            p.address_line_1,
            COALESCE(
              (SELECT user_id FROM property_users WHERE property_id = p.id AND role = 'editor' LIMIT 1),
              (SELECT user_id FROM property_users WHERE property_id = p.id AND role = 'owner' LIMIT 1)
            ) AS seed_user_id
     FROM properties p
     WHERE ${conditions.join(" AND ")}
     ORDER BY p.id`,
    params
  );

  const addressToIndex = new Map(
    DEMO_PROPERTY_INDICES.map((index) => [addressByIndex(index), index]).filter(([addr]) => addr)
  );

  return res.rows
    .map((row) => ({
      ...row,
      propertyIndex: addressToIndex.get(row.address_line_1),
    }))
    .filter((row) => row.propertyIndex != null && row.seed_user_id != null);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const emailArg = process.argv.find((a) => a.startsWith("--email="));
  const agentEmail = emailArg ? emailArg.split("=")[1] : null;

  const targets = await findPropertiesMissingInspection(agentEmail);
  if (!targets.length) {
    console.log(
      agentEmail
        ? `No demo properties missing inspection reports for agent ${agentEmail}.`
        : "No demo properties missing inspection reports."
    );
    process.exit(0);
  }

  console.log(
    `${dryRun ? "Would backfill" : "Backfilling"} ${targets.length} propert(ies)...`
  );

  let seeded = 0;
  for (const row of targets) {
    const label = `${row.address_line_1} (index ${row.propertyIndex}, property ${row.property_id})`;
    if (dryRun) {
      console.log(`  DRY RUN  ${label}`);
      seeded += 1;
      continue;
    }

    try {
      const result = await seedInspectionAnalysis(
        row.property_id,
        row.seed_user_id,
        row.propertyIndex
      );
      console.log(
        `  OK  ${label}  →  document ${result.propertyDocumentId}, ${result.itemCount} checklist items`
      );
      seeded += 1;
    } catch (err) {
      console.error(`  FAIL  ${label}: ${err.message}`);
    }
  }

  console.log(`Done. ${seeded}/${targets.length} processed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
