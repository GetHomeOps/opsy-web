#!/usr/bin/env node
/**
 * Backfill OAuth avatars into S3 for Google-linked users missing a custom upload.
 * Safe to re-run — skips users who already have an S3 image key.
 *
 * Usage:
 *   node scripts/backfill-oauth-avatars.js
 *   node scripts/backfill-oauth-avatars.js --email=maile.sandoval@gmail.com
 *   node scripts/backfill-oauth-avatars.js --dry-run
 */
require("dotenv").config();
const db = require("../db");
const User = require("../models/user");
const { syncGoogleAvatar } = require("../services/avatarService");

async function findOAuthUsersWithoutImage(email) {
  const params = [];
  let emailFilter = "";
  if (email) {
    emailFilter = "AND LOWER(TRIM(email)) = LOWER(TRIM($1))";
    params.push(email);
  }

  const res = await db.query(
    `SELECT id, email, name, image, avatar_url AS "avatarUrl", google_sub AS "googleSub"
     FROM users
     WHERE google_sub IS NOT NULL
       AND (image IS NULL OR TRIM(image) = '')
       ${emailFilter}
     ORDER BY id`,
    params
  );
  return res.rows;
}

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--email="));
  const email = emailArg ? emailArg.split("=")[1] : null;
  const dryRun = process.argv.includes("--dry-run");

  const users = await findOAuthUsersWithoutImage(email);
  if (!users.length) {
    console.log(
      email
        ? `No OAuth users without S3 image found for: ${email}`
        : "No OAuth users without S3 image found."
    );
    process.exit(0);
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Processing ${users.length} OAuth user(s)...`
  );

  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const hasAvatarUrl = !!(user.avatarUrl && String(user.avatarUrl).trim());
    if (!hasAvatarUrl) {
      console.log(`  skip ${user.email} (id=${user.id}): no avatar_url — needs Google sign-in`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  would sync ${user.email} (id=${user.id}) from stored avatar_url`);
      synced += 1;
      continue;
    }

    try {
      const result = await syncGoogleAvatar(user, null);
      if (result.synced) {
        const refreshed = await User.getById(user.id);
        console.log(`  synced ${user.email} (id=${user.id}) -> ${refreshed?.image}`);
        synced += 1;
      } else {
        console.log(`  skip ${user.email} (id=${user.id}): nothing to sync`);
        skipped += 1;
      }
    } catch (err) {
      console.error(`  failed ${user.email} (id=${user.id}): ${err.message}`);
      failed += 1;
    }
  }

  console.log(`Done. synced=${synced}, skipped=${skipped}, failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
