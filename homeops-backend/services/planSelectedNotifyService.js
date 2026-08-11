"use strict";

/**
 * Ops email alerts when a user picks a free/zero-cost plan or pays via Stripe Checkout.
 * Failures are logged and never thrown to callers (onboarding / webhooks / billing).
 */

const db = require("../db");
const { sendPlanSelectedOpsEmail } = require("./emailService");

function formatAmountPaid(amountTotal, currency) {
  if (amountTotal == null || !Number.isFinite(Number(amountTotal))) return "";
  const cents = Number(amountTotal);
  const cur = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
}

async function loadNotifyContext({ userId, accountId, planCode, subscriptionProductId }) {
  let user = null;
  if (userId) {
    const userRes = await db.query(
      `SELECT id, email, name, role FROM users WHERE id = $1`,
      [userId]
    );
    user = userRes.rows[0] || null;
  }

  let account = null;
  if (accountId) {
    const accRes = await db.query(
      `SELECT id, name, url FROM accounts WHERE id = $1`,
      [accountId]
    );
    account = accRes.rows[0] || null;
  }

  if (!user && accountId) {
    const ownerRes = await db.query(
      `SELECT u.id, u.email, u.name, u.role
       FROM accounts a
       JOIN users u ON u.id = a.owner_user_id
       WHERE a.id = $1`,
      [accountId]
    );
    user = ownerRes.rows[0] || null;
  }

  if (!account && userId) {
    const accRes = await db.query(
      `SELECT a.id, a.name, a.url
       FROM account_users au
       JOIN accounts a ON a.id = au.account_id
       WHERE au.user_id = $1
       ORDER BY (a.owner_user_id = $1) DESC, au.created_at ASC
       LIMIT 1`,
      [userId]
    );
    account = accRes.rows[0] || null;
  }

  let plan = null;
  if (subscriptionProductId) {
    const planRes = await db.query(
      `SELECT id, code, name FROM subscription_products WHERE id = $1`,
      [subscriptionProductId]
    );
    plan = planRes.rows[0] || null;
  } else if (planCode) {
    const planRes = await db.query(
      `SELECT id, code, name FROM subscription_products WHERE code = $1 LIMIT 1`,
      [planCode]
    );
    plan = planRes.rows[0] || null;
  }

  return { user, account, plan };
}

/**
 * @param {object} opts
 * @param {string|number} [opts.userId]
 * @param {string|number} [opts.accountId]
 * @param {string} [opts.planCode]
 * @param {string|number} [opts.subscriptionProductId]
 * @param {boolean} [opts.isPaid]
 * @param {string} [opts.billingInterval]
 * @param {number} [opts.amountTotal] Stripe amount in smallest currency unit
 * @param {string} [opts.currency]
 * @param {"onboarding"|"upgrade_downgrade"|"stripe_checkout"} opts.source
 */
async function notifyPlanSelected(opts = {}) {
  try {
    const {
      userId,
      accountId,
      planCode,
      subscriptionProductId,
      isPaid = false,
      billingInterval,
      amountTotal,
      currency,
      source,
    } = opts;

    const { user, account, plan } = await loadNotifyContext({
      userId,
      accountId,
      planCode,
      subscriptionProductId,
    });

    const resolvedPlanCode = plan?.code || planCode || "";
    const resolvedPlanName = plan?.name || resolvedPlanCode || "Unknown plan";

    return await sendPlanSelectedOpsEmail({
      userName: user?.name || "",
      userEmail: user?.email || "",
      userRole: user?.role || "",
      userId: user?.id ?? userId,
      accountId: account?.id ?? accountId,
      accountName: account?.name || "",
      accountUrl: account?.url || "",
      planCode: resolvedPlanCode,
      planName: resolvedPlanName,
      isPaid: !!isPaid,
      billingInterval: billingInterval || "",
      amountPaid: isPaid ? formatAmountPaid(amountTotal, currency) : "",
      source,
    });
  } catch (err) {
    console.error("[planSelectedNotify] send failed:", err.message);
    return { success: false, reason: "send_failed" };
  }
}

/**
 * Fire-and-forget wrapper for Stripe Checkout completion (webhook path only).
 * @param {object} session Stripe Checkout Session
 */
function notifyPlanSelectedFromCheckoutSession(session) {
  if (!session) return;
  const meta = session.metadata || {};
  void notifyPlanSelected({
    userId: meta.user_id,
    accountId: meta.account_id,
    planCode: meta.plan_code,
    subscriptionProductId: meta.subscription_product_id,
    isPaid: true,
    billingInterval: meta.billing_interval || "",
    amountTotal: session.amount_total,
    currency: session.currency,
    source: "stripe_checkout",
  }).catch((err) =>
    console.error("[planSelectedNotify] checkout notify:", err.message)
  );
}

module.exports = {
  notifyPlanSelected,
  notifyPlanSelectedFromCheckoutSession,
  formatAmountPaid,
};
