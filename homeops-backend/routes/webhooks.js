"use strict";

/**
 * Webhook Routes
 *
 * Mounted in app.js with express.raw() BEFORE express.json() so handlers
 * can verify cryptographic signatures over the unparsed body. Stripe sends
 * application/json; SNS (SES inbound) sends text/plain — both are accepted
 * by the raw parser at mount time.
 *
 * Endpoints:
 *   POST /webhooks/stripe        - Stripe billing events
 *   POST /webhooks/ses-inbound   - SNS notifications for inbound email
 */

const express = require("express");
const stripeService = require("../services/stripeService");
const inboundEmailService = require("../services/inboundEmailService");

const router = express.Router();

/** POST /webhooks/stripe - Stripe webhook handler */
router.post("/stripe", async function (req, res) {
  const signature = req.headers["stripe-signature"];
  const payload = req.body;

  if (!payload || !signature) {
    return res.status(400).send("Missing signature or payload");
  }

  const rawBody = Buffer.isBuffer(payload) ? payload.toString("utf8") : (typeof payload === "string" ? payload : "");
  const event = stripeService.constructWebhookEvent(rawBody, signature);

  if (!event) {
    return res.status(400).send("Invalid signature");
  }

  try {
    await stripeService.processWebhookEvent(event);
    return res.json({ received: true });
  } catch (err) {
    console.error("[webhooks/stripe] Error:", err.message);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

/**
 * POST /webhooks/ses-inbound
 *
 * Receives Amazon SNS notifications published by an SES receipt rule that
 * stores raw inbound MIME in S3. This handler is unauthenticated by design:
 * SNS doesn't carry an HTTP-level secret. Instead the service verifies the
 * SNS message signature against the AWS-issued signing certificate, the
 * topic ARN against `SES_INBOUND_SNS_TOPIC_ARN`, and finally the SES verdict
 * headers (spam/virus/SPF) before doing any work.
 *
 * Always responds 2xx on signature errors so SNS doesn't enter retry-storm
 * mode for a permanently broken payload; returns 5xx only when ingestion
 * itself fails so SNS will retry.
 */
router.post("/ses-inbound", async function (req, res) {
  const payload = req.body;
  if (!payload || (Buffer.isBuffer(payload) && payload.length === 0)) {
    return res.status(400).json({ error: "Empty body" });
  }

  let result;
  try {
    result = await inboundEmailService.verifyAndProcessSnsMessage(payload);
  } catch (err) {
    // Bad signature / unknown topic / unparseable body: log and 200 so SNS
    // doesn't keep retrying. Real ingestion failures throw a different
    // class of error and fall through to the 500 path below.
    if (process.env.NODE_ENV !== "test") {
      console.warn("[webhooks/ses-inbound] rejected:", err.message);
    }
    return res.status(200).json({ accepted: false, reason: err.message });
  }

  // Ingest result statuses other than 'rejected' / 'ingested' / 'subscription_handled'
  // shouldn't error — they're informational.
  return res.status(200).json({ accepted: true, ...result });
});

module.exports = router;
