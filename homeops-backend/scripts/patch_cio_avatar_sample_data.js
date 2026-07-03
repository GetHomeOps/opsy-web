"use strict";

/**
 * Update Customer.io composer sample event data for account invitation templates
 * so avatarUrl uses the live Opsy mark (not the legacy 404 URL).
 *
 * Usage: node scripts/patch_cio_avatar_sample_data.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const ENVIRONMENT_ID = process.env.CUSTOMER_IO_ENVIRONMENT_ID || "218445";
const BRAND_MARK_URL =
  process.env.EMAIL_ACCOUNT_INVITATION_MARK_URL ||
  "https://app.heyopsy.com/opsy_favicon.png";
const LEGACY_MARK_URL = "https://heyopsy.com/email/opsy-mark.png";
const AVATAR_LIQUID = `{{ event.avatarUrl | replace: '${LEGACY_MARK_URL}', '${BRAND_MARK_URL}' | default: '${BRAND_MARK_URL}' }}`;

const SAMPLE_BASE = {
  avatarUrl: BRAND_MARK_URL,
  brandName: "Opsy",
  inviteUrl: "https://app.heyopsy.com/invite/sample",
  inviteeName: "Alex",
  recipientFirstName: "Alex",
  senderFirstName: "Jane",
};

const TEMPLATES = [
  { id: "30", userRole: "agent" },
  { id: "31", userRole: "homeowner" },
  { id: "32", userRole: "admin" },
];

function getFlyBaseUrl() {
  return "https://fly.customer.io";
}

async function flyFetch(path, options = {}) {
  const token =
    process.env.CUSTOMER_IO_WRITE_TOKEN || process.env.CUSTOMER_IO_APP_API_KEY;
  if (!token) {
    throw new Error(
      "Set CUSTOMER_IO_WRITE_TOKEN or CUSTOMER_IO_APP_API_KEY in homeops-backend/.env"
    );
  }
  const res = await fetch(`${getFlyBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function patchTemplateBody(templateId) {
  const data = await flyFetch(
    `/v1/environments/${ENVIRONMENT_ID}/templates/${templateId}`
  );
  let body = data?.template?.body || "";
  if (!body) return;

  const imgPatterns = [
    `{{ event.avatarUrl | default: '${BRAND_MARK_URL}' }}`,
    `{{ event.avatarUrl | default: '${LEGACY_MARK_URL}' }}`,
    `{{avatarUrl | default: '${LEGACY_MARK_URL}'}}`,
    `{{avatarUrl | default: '${BRAND_MARK_URL}'}}`,
  ];
  let patched = body;
  for (const pattern of imgPatterns) {
    patched = patched.split(pattern).join(AVATAR_LIQUID);
  }
  patched = patched.split(LEGACY_MARK_URL).join(BRAND_MARK_URL);
  if (patched === body) return;

  await flyFetch(`/v1/environments/${ENVIRONMENT_ID}/templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify({ template: { body: patched } }),
  });
  console.info(`Patched avatar liquid in template ${templateId} body`);
}

async function updateSampleData(templateId, userRole) {
  await flyFetch(`/v1/environments/${ENVIRONMENT_ID}/sample_data/${templateId}`, {
    method: "PUT",
    body: JSON.stringify({
      sample_data: { ...SAMPLE_BASE, userRole },
    }),
  });
  console.info(`Updated sample_data for template ${templateId} (${userRole})`);
}

async function main() {
  for (const { id, userRole } of TEMPLATES) {
    await patchTemplateBody(id);
    await updateSampleData(id, userRole);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[patch_cio_avatar_sample_data]", err.message);
    process.exit(1);
  });
