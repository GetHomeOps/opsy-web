"use strict";

/**
 * Update Customer.io Homeaversary campaign templates (34 homeowner, 35 agent).
 *
 * Usage:
 *   node scripts/update_customerio_homeaversary_templates.js --dry-run
 *   node scripts/update_customerio_homeaversary_templates.js
 *   node scripts/update_customerio_homeaversary_templates.js --sample-data-only
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const {
  getHomeaversaryHtml,
} = require("../data/homeaversaryEmailHtml");
const { getSampleMergeData } = require("../data/emailTemplateDefaults");

const ENVIRONMENT_ID = process.env.CUSTOMER_IO_ENVIRONMENT_ID || "218445";
const TEMPLATE_IDS = {
  homeowner: process.env.CUSTOMER_IO_HOMEAVERSARY_HOMEOWNER_TEMPLATE_ID || "34",
  agent: process.env.CUSTOMER_IO_HOMEAVERSARY_AGENT_TEMPLATE_ID || "35",
};

function getFlyBaseUrl() {
  return "https://fly.customer.io";
}

async function flyFetch(path, options = {}) {
  const token = process.env.CUSTOMER_IO_WRITE_TOKEN || process.env.CUSTOMER_IO_APP_API_KEY;
  if (!token) {
    throw new Error("Set CUSTOMER_IO_WRITE_TOKEN or CUSTOMER_IO_APP_API_KEY");
  }
  const res = await fetch(`${getFlyBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Customer.io ${res.status}: ${text.slice(0, 400)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const TEMPLATES = {
  homeowner: {
    id: TEMPLATE_IDS.homeowner,
    subject: "Happy Homeaversary — one more year at {{ event.propertyAddress }}",
    preheader: "One more year at {{ event.propertyAddress }}",
    body: getHomeaversaryHtml("homeowner", { liquid: true }),
  },
  agent: {
    id: TEMPLATE_IDS.agent,
    subject: "Homeaversary in 7 days: {{ event.propertyAddress }}",
    preheader: "{{ event.ownerName }}'s Homeaversary is {{ event.anniversaryDate }}",
    body: getHomeaversaryHtml("agent", { liquid: true }),
  },
};

function sampleEventData(audience) {
  return getSampleMergeData(
    audience === "agent" ? "homeaversary_agent" : "homeaversary_homeowner"
  );
}

async function updateTemplate(audience, meta, dryRun) {
  const payload = {
    template: {
      subject: meta.subject,
      preheader_text: meta.preheader,
      body: meta.body,
      editor: "html",
    },
  };
  if (dryRun) {
    console.info(`[homeaversary] dry-run ${audience} template ${meta.id} (${meta.body.length} chars)`);
    return;
  }
  await flyFetch(`/v1/environments/${ENVIRONMENT_ID}/templates/${meta.id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  console.info(`[homeaversary] updated ${audience} template ${meta.id}`);
}

async function updateSampleData(audience, templateId, dryRun) {
  const sample_data = sampleEventData(audience);
  if (dryRun) {
    console.info(
      `[homeaversary] dry-run ${audience} sample_data ${templateId} (${Object.keys(sample_data).length} keys)`
    );
    return;
  }
  await flyFetch(`/v1/environments/${ENVIRONMENT_ID}/sample_data/${templateId}`, {
    method: "PUT",
    body: JSON.stringify({ sample_data }),
  });
  console.info(`[homeaversary] updated ${audience} sample_data ${templateId}`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const sampleDataOnly = process.argv.includes("--sample-data-only");
  for (const [audience, meta] of Object.entries(TEMPLATES)) {
    if (!sampleDataOnly) {
      await updateTemplate(audience, meta, dryRun);
    }
    await updateSampleData(audience, meta.id, dryRun);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { TEMPLATES, updateTemplate, updateSampleData, sampleEventData };
