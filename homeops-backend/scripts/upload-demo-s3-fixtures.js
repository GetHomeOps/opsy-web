#!/usr/bin/env node
/**
 * Upload shared demo PDF fixtures to AWS_S3_BUCKET under the demo/ prefix.
 *
 * Place PDFs in homeops-backend/data/demo-assets/ (filenames must match below).
 * Requires AWS credentials and AWS_S3_BUCKET in .env (same bucket the demo app reads).
 *
 * Usage:
 *   node scripts/upload-demo-s3-fixtures.js
 *   node scripts/upload-demo-s3-fixtures.js --dry-run
 */
"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { DEMO_INSPECTION_REPORT_FILES } = require("../data/demoAccountScenarios");
const { uploadFile } = require("../services/s3Service");
const { AWS_S3_BUCKET } = require("../config");

const ASSETS_DIR = path.join(__dirname, "..", "data", "demo-assets");

/** @type {{ localName: string, s3Key: string }[]} */
const MAINTENANCE_FIXTURES = [
  { localName: "furnace-service-report.pdf", s3Key: "demo/furnace-service-report.pdf" },
  { localName: "gutter-service-invoice.pdf", s3Key: "demo/gutter-service-invoice.pdf" },
  { localName: "plumbing-repair-receipt.pdf", s3Key: "demo/plumbing-repair-receipt.pdf" },
  { localName: "electrical-inspection-report.pdf", s3Key: "demo/electrical-inspection-report.pdf" },
  { localName: "water-heater-service.pdf", s3Key: "demo/water-heater-service.pdf" },
];

function buildFixtureManifest() {
  const inspection = Object.values(DEMO_INSPECTION_REPORT_FILES).map(({ s3Key }) => {
    const localName = path.basename(s3Key);
    return { localName, s3Key };
  });
  const seen = new Set();
  return [...inspection, ...MAINTENANCE_FIXTURES].filter((item) => {
    if (seen.has(item.s3Key)) return false;
    seen.add(item.s3Key);
    return true;
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  if (!AWS_S3_BUCKET) {
    console.error("AWS_S3_BUCKET is not set. Configure S3 in .env before uploading.");
    process.exit(1);
  }

  if (!fs.existsSync(ASSETS_DIR)) {
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
  }

  const fixtures = buildFixtureManifest();
  let uploaded = 0;
  let missing = 0;

  console.log(`Target bucket: ${AWS_S3_BUCKET}`);
  console.log(`Assets directory: ${ASSETS_DIR}`);
  if (dryRun) console.log("Dry run — no files will be uploaded.\n");

  for (const { localName, s3Key } of fixtures) {
    const localPath = path.join(ASSETS_DIR, localName);
    if (!fs.existsSync(localPath)) {
      console.log(`  MISSING  ${localName}  →  ${s3Key}`);
      missing += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  OK       ${localName}  →  ${s3Key}`);
      uploaded += 1;
      continue;
    }

    const buffer = fs.readFileSync(localPath);
    await uploadFile(buffer, s3Key, "application/pdf");
    console.log(`  UPLOADED ${localName}  →  ${s3Key}`);
    uploaded += 1;
  }

  console.log(`\nDone. ${uploaded} ready/uploaded, ${missing} missing local file(s).`);

  if (missing > 0) {
    console.log(
      "\nAdd the missing PDFs to data/demo-assets/, then re-run this script."
    );
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
