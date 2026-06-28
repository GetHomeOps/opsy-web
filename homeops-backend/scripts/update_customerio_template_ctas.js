"use strict";

/**
 * Update Customer.io campaign email CTAs to use customer.primary_property_url.
 *
 * Usage: node scripts/update_customerio_template_ctas.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const CTA_LIQUID =
  "{{ customer.primary_property_url | default: 'https://app.heyopsy.com/home/properties/new' }}";

const CTA_LIQUID_WITH_EVENT_FALLBACK =
  "{{ customer.primary_property_url | default: event.property_url | default: 'https://app.heyopsy.com/home/properties/new' }}";

function getApiBaseUrl() {
  const r = (process.env.CUSTOMER_IO_REGION || "us").trim().toLowerCase();
  return r === "eu" ? "https://api-eu.customer.io" : "https://api.customer.io";
}

function getFlyBaseUrl() {
  return "https://fly.customer.io";
}

async function flyFetch(path, options = {}) {
  const token = process.env.CUSTOMER_IO_APP_API_KEY;
  if (!token) throw new Error("CUSTOMER_IO_APP_API_KEY is not set");
  const res = await fetch(`${getFlyBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Customer.io ${res.status}: ${text.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function updateTemplate(environmentId, templateId, transformBody) {
  const data = await flyFetch(
    `/v1/environments/${environmentId}/templates/${templateId}`
  );
  const template = data?.template;
  if (!template?.body) {
    throw new Error(`Template ${templateId} has no body`);
  }
  const newBody = transformBody(template.body);
  if (newBody === template.body) {
    console.info(`[templates] ${templateId}: already up to date`);
    return;
  }
  await flyFetch(`/v1/environments/${environmentId}/templates/${templateId}`, {
    method: "PUT",
    body: JSON.stringify({ template: { body: newBody } }),
  });
  console.info(`[templates] Updated template ${templateId}`);
}

async function main() {
  const environmentId = process.env.CUSTOMER_IO_ENVIRONMENT_ID || "218445";

  await updateTemplate(environmentId, "28", (body) =>
    body
      .split("https://app.heyopsy.com/home/properties")
      .join(CTA_LIQUID)
  );

  await updateTemplate(environmentId, "29", (body) =>
    body.replace(
      "{{ event.property_url | default: 'https://app.heyopsy.com' }}",
      CTA_LIQUID_WITH_EVENT_FALLBACK
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[templates] Failed:", err.message);
    process.exit(1);
  });
