"use strict";

/**
 * Stripe Billing Service
 *
 * Creates Checkout sessions, Customer Portal sessions, and processes webhooks.
 * All billing state is source-of-truth via webhooks; never trust client for paid status.
 */

const Stripe = require("stripe");
const db = require("../db");
const {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_SUCCESS_URL,
  STRIPE_CANCEL_URL,
  BILLING_MOCK_MODE,
} = require("../config");

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

/** Get or create Stripe customer for account. */
async function getOrCreateStripeCustomer(accountId, email, name) {
  if (BILLING_MOCK_MODE) return { id: "cus_mock" };

  const acc = await db.query(
    `SELECT a.id, a.stripe_customer_id, a.name
     FROM accounts a WHERE a.id = $1`,
    [accountId]
  );
  if (!acc.rows[0]) throw new Error("Account not found");

  const existing = acc.rows[0].stripe_customer_id;
  if (existing) return { id: existing };

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || acc.rows[0].name,
    metadata: { account_id: String(accountId) },
  });

  await db.query(
    `UPDATE accounts SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`,
    [customer.id, accountId]
  );
  return { id: customer.id };
}

/** Create Checkout Session for subscription. Returns { url }. */
async function createCheckoutSession({ accountId, userId, planCode, billingInterval = "month", successUrl, cancelUrl, customerEmail, customerName }) {
  if (BILLING_MOCK_MODE) {
    const base = successUrl || STRIPE_SUCCESS_URL;
    const sep = base.includes("?") ? "&" : "?";
    return { url: `${base}${sep}mock=1` };
  }

  const plan = await db.query(
    `SELECT sp.id, sp.code, sp.trial_days, pp.stripe_price_id
     FROM subscription_products sp
     LEFT JOIN plan_prices pp ON pp.subscription_product_id = sp.id AND pp.billing_interval = $1
     WHERE sp.code = $2 AND sp.is_active = true`,
    [billingInterval, planCode]
  );
  if (!plan.rows[0] || !plan.rows[0].stripe_price_id) {
    throw new Error(`Plan ${planCode} (${billingInterval}) not found or has no Stripe price configured`);
  }

  const accountRes = await db.query(
    `SELECT a.id, a.stripe_customer_id, a.name, u.email, u.name AS user_name
     FROM accounts a
     JOIN account_users au ON au.account_id = a.id AND au.user_id = $1
     JOIN users u ON u.id = $1
     WHERE a.id = $2`,
    [userId, accountId]
  );
  if (!accountRes.rows[0]) throw new Error("Account access denied");

  const acc = accountRes.rows[0];
  const customer = await getOrCreateStripeCustomer(accountId, customerEmail || acc.email, customerName || acc.user_name);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    payment_method_types: ["card"],
    line_items: [{
      price: plan.rows[0].stripe_price_id,
      quantity: 1,
    }],
    subscription_data: plan.rows[0].trial_days
      ? { trial_period_days: plan.rows[0].trial_days }
      : undefined,
    success_url: successUrl || STRIPE_SUCCESS_URL,
    cancel_url: cancelUrl || STRIPE_CANCEL_URL,
    metadata: {
      account_id: String(accountId),
      user_id: String(userId),
      plan_code: planCode,
      subscription_product_id: String(plan.rows[0].id),
      billing_interval: billingInterval,
    },
    allow_promotion_codes: true,
  });

  return { url: session.url, sessionId: session.id };
}

/** Create Customer Portal session. Returns { url }. */
async function createPortalSession(accountId, userId, returnUrl) {
  if (BILLING_MOCK_MODE) {
    return { url: returnUrl || `${process.env.APP_BASE_URL || "http://localhost:5173"}/#/billing` };
  }

  const acc = await db.query(
    `SELECT a.stripe_customer_id
     FROM accounts a
     JOIN account_users au ON au.account_id = a.id AND au.user_id = $1
     WHERE a.id = $2`,
    [userId, accountId]
  );
  if (!acc.rows[0]) throw new Error("Account access denied");
  const stripeCustomerId = acc.rows[0].stripe_customer_id;
  if (!stripeCustomerId) throw new Error("No billing account found. Subscribe to a plan first.");

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl || `${process.env.APP_BASE_URL || "http://localhost:5173"}/#/billing`,
  });

  return { url: session.url };
}

/** Verify webhook signature and return event or null if invalid. */
function constructWebhookEvent(payload, signature) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return null;
  try {
    return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return null;
  }
}

/** Check if event was already processed (idempotency). */
async function isEventProcessed(stripeEventId) {
  const r = await db.query(
    `SELECT 1 FROM stripe_webhook_events WHERE stripe_event_id = $1`,
    [stripeEventId]
  );
  return r.rows.length > 0;
}

/** Mark event as processed. */
async function markEventProcessed(stripeEventId) {
  await db.query(
    `INSERT INTO stripe_webhook_events (stripe_event_id) VALUES ($1) ON CONFLICT (stripe_event_id) DO NOTHING`,
    [stripeEventId]
  );
}

/** Safely convert Stripe unix timestamp (number or string) to Date. Returns null if invalid. */
function toValidDate(unixTimestamp) {
  if (unixTimestamp == null) return null;
  const num = typeof unixTimestamp === "string" ? parseInt(unixTimestamp, 10) : unixTimestamp;
  if (typeof num !== "number" || !Number.isFinite(num)) return null;
  const d = new Date(num * 1000);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Extract period dates from subscription. Supports both legacy (subscription-level) and Basil API (items[0]-level). */
function getSubscriptionPeriodDates(subscription) {
  const fromSub = {
    start: toValidDate(subscription.current_period_start),
    end: toValidDate(subscription.current_period_end),
  };
  if (fromSub.start && fromSub.end) return fromSub;
  const item = subscription.items?.data?.[0];
  const fromItem = {
    start: toValidDate(item?.current_period_start),
    end: toValidDate(item?.current_period_end),
  };
  return {
    start: fromSub.start || fromItem.start,
    end: fromSub.end || fromItem.end,
  };
}

/** Ensure a value is a valid Date for PostgreSQL. node-postgres serializes invalid Dates as "0NaN-NaN-NaN..." which PG rejects. */
function toSafeTimestamp(value, fallback = null) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (value == null) return fallback ?? new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : (fallback ?? new Date());
}

/** Process checkout.session.completed */
async function handleCheckoutCompleted(session) {
  const accountId = session.metadata?.account_id;
  const subscriptionProductId = session.metadata?.subscription_product_id;
  if (!accountId || !subscriptionProductId) return;

  const sub = session.subscription;
  if (!sub) return;

  const subscription = await stripe.subscriptions.retrieve(sub, { expand: ["items.data.price"] });
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const status = subscription.status;
  const { start: periodStart, end: periodEnd } = getSubscriptionPeriodDates(subscription);
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;

  if (!periodStart || !periodEnd) {
    console.info("[webhooks/stripe] checkout.session.completed: using fallback period dates");
  }

  const safeStart = toSafeTimestamp(periodStart, new Date());
  const safeEnd = toSafeTimestamp(periodEnd, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  await db.query(
    `INSERT INTO account_subscriptions
      (account_id, subscription_product_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status,
       current_period_start, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL
     DO UPDATE SET
       status = CASE WHEN EXCLUDED.status = 'incomplete' AND account_subscriptions.status IN ('active', 'trialing')
                     THEN account_subscriptions.status ELSE EXCLUDED.status END,
       stripe_price_id = EXCLUDED.stripe_price_id,
       current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = NOW()`,
    [accountId, subscriptionProductId, subscription.id, session.customer, priceId, status, safeStart, safeEnd, cancelAtPeriodEnd]
  );

  // Cancel any placeholder free subscriptions created at signup (before Stripe checkout).
  // The paid subscription from Stripe is now the single active source of truth.
  await db.query(
    `UPDATE account_subscriptions
     SET status = 'canceled', updated_at = NOW()
     WHERE account_id = $1 AND stripe_subscription_id IS NULL AND status = 'active'`,
    [accountId]
  );
}

/** Process customer.subscription.updated / deleted */
async function handleSubscriptionUpdated(subscription) {
  const subId = subscription.id;
  const accountRes = await db.query(
    `SELECT id, account_id, subscription_product_id, status AS "currentStatus" FROM account_subscriptions WHERE stripe_subscription_id = $1`,
    [subId]
  );

  let status = subscription.status;
  let { start: periodStart, end: periodEnd } = getSubscriptionPeriodDates(subscription);

  // Webhook payloads carry the status at event-generation time, which may be stale when
  // multiple events fire concurrently (e.g. "incomplete" arrives after invoice.payment_succeeded
  // already set "active"). Retrieve the authoritative status from Stripe to avoid downgrading.
  if (stripe && status === "incomplete" && accountRes.rows[0]?.currentStatus === "active") {
    try {
      const fresh = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
      status = fresh.status;
      const freshDates = getSubscriptionPeriodDates(fresh);
      periodStart = periodStart || freshDates.start;
      periodEnd = periodEnd || freshDates.end;
    } catch (_) { /* use event payload as fallback */ }
  }

  // Webhook payload may lack expanded items; retrieve from API if period dates missing (Basil API uses items[0])
  if ((!periodStart || !periodEnd) && stripe) {
    try {
      const retrieved = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
      const fromRetrieved = getSubscriptionPeriodDates(retrieved);
      periodStart = periodStart || fromRetrieved.start;
      periodEnd = periodEnd || fromRetrieved.end;
      if (fromRetrieved.start && fromRetrieved.end) {
        subscription.items = subscription.items || {};
        subscription.items.data = subscription.items.data || [];
        if (!subscription.items.data[0]) subscription.items.data[0] = {};
        subscription.items.data[0].current_period_start = retrieved.items?.data?.[0]?.current_period_start;
        subscription.items.data[0].current_period_end = retrieved.items?.data?.[0]?.current_period_end;
      }
    } catch (retrieveErr) {
      // Ignore; we'll use fallback dates below
    }
  }
  const cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;

  if (accountRes.rows.length > 0) {
    if (status === "canceled" || status === "unpaid") {
      await db.query(
        `UPDATE account_subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2`,
        [status, subId]
      );
    } else if (periodStart && periodEnd) {
      // Never downgrade active/trialing to incomplete from a stale event payload
      const noDowngrade = status === "incomplete" ? `AND status NOT IN ('active', 'trialing')` : "";
      await db.query(
        `UPDATE account_subscriptions SET status = $1, stripe_price_id = COALESCE($2, stripe_price_id),
         current_period_start = $3, current_period_end = $4, cancel_at_period_end = $5, updated_at = NOW()
         WHERE stripe_subscription_id = $6 ${noDowngrade}`,
        [status, priceId, periodStart, periodEnd, cancelAtPeriodEnd, subId]
      );
    } else {
      const noDowngrade = status === "incomplete" ? `AND status NOT IN ('active', 'trialing')` : "";
      await db.query(
        `UPDATE account_subscriptions SET status = $1, stripe_price_id = COALESCE($2, stripe_price_id),
         cancel_at_period_end = $3, updated_at = NOW()
         WHERE stripe_subscription_id = $4 ${noDowngrade}`,
        [status, priceId, cancelAtPeriodEnd, subId]
      );
    }
    return;
  }

  const customerId = subscription.customer;
  const accountByCustomer = await db.query(
    `SELECT id FROM accounts WHERE stripe_customer_id = $1`,
    [customerId]
  );
  if (accountByCustomer.rows.length === 0) return;

  const productByPrice = priceId
    ? await db.query(`SELECT subscription_product_id FROM plan_prices WHERE stripe_price_id = $1`, [priceId])
    : { rows: [] };
  const subscriptionProductId = productByPrice.rows[0]?.subscription_product_id
    || (await db.query(`SELECT id FROM subscription_products WHERE code = 'homeowner_free' LIMIT 1`)).rows[0]?.id;
  if (!subscriptionProductId) return;

  if (!periodStart || !periodEnd) {
    // Fallback dates are valid; subscription created/updated successfully. Common with Basil API (period dates on items[0]).
    console.info("[webhooks/stripe] subscription.updated: using fallback period dates (Stripe may send minimal webhook payload)");
  }

  const safeStart = toSafeTimestamp(periodStart, new Date());
  const safeEnd = toSafeTimestamp(periodEnd, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const accountId = accountByCustomer.rows[0].id;

  await db.query(
    `INSERT INTO account_subscriptions
      (account_id, subscription_product_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, status,
       current_period_start, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL
     DO UPDATE SET
       status = CASE WHEN EXCLUDED.status = 'incomplete' AND account_subscriptions.status IN ('active', 'trialing')
                     THEN account_subscriptions.status ELSE EXCLUDED.status END,
       stripe_price_id = EXCLUDED.stripe_price_id,
       current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = NOW()`,
    [accountId, subscriptionProductId, subId, customerId, priceId, status, safeStart, safeEnd, cancelAtPeriodEnd]
  );

  // Supersede placeholder free subscriptions when Stripe subscription is active
  if (status === "active" || status === "trialing") {
    await db.query(
      `UPDATE account_subscriptions
       SET status = 'canceled', updated_at = NOW()
       WHERE account_id = $1 AND stripe_subscription_id IS NULL AND status = 'active'`,
      [accountId]
    );
  }
}

/** Process invoice.payment_succeeded / invoice.payment_failed */
async function handleInvoicePayment(invoice) {
  const subId = invoice.subscription;
  if (!subId) return;

  const subscription = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
  const accountRes = await db.query(
    `SELECT id FROM account_subscriptions WHERE stripe_subscription_id = $1`,
    [subId]
  );
  if (accountRes.rows.length === 0) return;

  const status = subscription.status;
  const { start: periodStart, end: periodEnd } = getSubscriptionPeriodDates(subscription);
  const priceId = subscription.items?.data?.[0]?.price?.id || null;

  if (periodStart && periodEnd) {
    await db.query(
      `UPDATE account_subscriptions SET status = $1, stripe_price_id = COALESCE($2, stripe_price_id),
       current_period_start = $3, current_period_end = $4, updated_at = NOW()
       WHERE stripe_subscription_id = $5`,
      [status, priceId, periodStart, periodEnd, subId]
    );
  } else {
    await db.query(
      `UPDATE account_subscriptions SET status = $1, stripe_price_id = COALESCE($2, stripe_price_id), updated_at = NOW()
       WHERE stripe_subscription_id = $3`,
      [status, priceId, subId]
    );
  }
}

/** Process webhook event (idempotent). */
async function processWebhookEvent(event) {
  if (await isEventProcessed(event.id)) return;
  await markEventProcessed(event.id);

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionUpdated(event.data.object);
      break;
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      await handleInvoicePayment(event.data.object);
      break;
    default:
      break;
  }
}

/** List active Stripe prices with product info (for admin dropdown). */
async function listActivePrices() {
  if (BILLING_MOCK_MODE || !stripe) {
    return [];
  }

  const prices = await stripe.prices.list({
    active: true,
    expand: ["data.product"],
    limit: 100,
  });

  return (prices.data || []).map((p) => ({
    id: p.id,
    nickname: p.nickname || "",
    unitAmount: p.unit_amount,
    currency: p.currency,
    interval: p.recurring?.interval || null,
    intervalCount: p.recurring?.interval_count || null,
    productId: typeof p.product === "string" ? p.product : p.product?.id,
    productName: typeof p.product === "object" ? p.product?.name : null,
  }));
}

/** Get default payment method for a Stripe customer. Returns { brand, last4 } or null. */
async function getCustomerPaymentMethod(stripeCustomerId) {
  if (BILLING_MOCK_MODE || !stripe || !stripeCustomerId) return null;

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted) return null;

    const pmId = customer.invoice_settings?.default_payment_method
      || customer.default_source;
    if (!pmId) return null;

    // When expanded, pmId may be the full PaymentMethod object
    const pm = typeof pmId === "string" && pmId.startsWith("pm_")
      ? await stripe.paymentMethods.retrieve(pmId)
      : pmId;

    if (pm?.card) {
      return {
        brand: pm.card.brand || "card",
        last4: pm.card.last4 || "••••",
      };
    }
  } catch {
    // Customer not found or invalid - return null gracefully
  }
  return null;
}

/** List invoices for a Stripe customer. Returns array of { id, created, amountDue, status, hostedInvoiceUrl, invoicePdf }. */
async function listCustomerInvoices(stripeCustomerId, limit = 12) {
  if (BILLING_MOCK_MODE || !stripe || !stripeCustomerId) return [];

  const invoices = await stripe.invoices.list({
    customer: stripeCustomerId,
    limit,
    status: "paid",
  });

  return (invoices.data || []).map((inv) => ({
    id: inv.id,
    created: inv.created ? new Date(inv.created * 1000).toISOString() : null,
    amountDue: inv.amount_paid ?? inv.amount_due,
    currency: inv.currency,
    status: inv.status,
    hostedInvoiceUrl: inv.hosted_invoice_url || null,
    invoicePdf: inv.invoice_pdf || null,
  }));
}

module.exports = {
  stripe,
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
  processWebhookEvent,
  isEventProcessed,
  handleSubscriptionUpdated,
  listActivePrices,
  getCustomerPaymentMethod,
  listCustomerInvoices,
};
