"use strict";

/**
 * Property Sponsorship Service (agent-subsidized billing)
 *
 * Lets a paying homeowner hand billing of their single agent-managed property to
 * the agent's plan. The homeowner keeps paid access until the end of their current
 * billing period, then stops paying while the property's entitlements resolve from
 * the agent's plan (see tierService.getPropertyEntitlements).
 *
 * Lifecycle: pending -> active -> ended (or declined if cancelled before it starts).
 */

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { BILLING_MOCK_MODE } = require("../config");
const { isDemoEnvironment } = require("../helpers/demoEnvironment");
const Notification = require("../models/notification");
const Subscription = require("../models/subscription");
const stripeService = require("./stripeService");
const emailService = require("./emailService");
const {
  getSponsorshipEligibility,
  countAgentManagedProperties,
  getAccountLimits,
  accountHasActiveSubscription,
  accountHasActivePaidSubscription,
} = require("./tierService");

const FREE_HOMEOWNER_PLAN_CODE = "homeowner_free";

/** How long a homeowner keeps prior entitlements after their agent leaves/drops their plan. */
const GRACE_PERIOD_DAYS = 30;
/** Start sending grace reminders this many days before the deadline. */
const GRACE_REMINDER_WINDOW_DAYS = 7;

const ELIGIBILITY_MESSAGES = {
  not_homeowner: "Only homeowners can transfer billing to an agent.",
  no_account: "No account found for this user.",
  not_on_paid_plan: "This is only available while you are on a paid plan.",
  not_single_property:
    "Agent coverage is only available when you have a single property.",
  already_sponsored: "This property is already covered by an agent's plan.",
  no_agent: "Add an agent to your property before transferring billing.",
  agent_no_account: "Your agent's account could not be found.",
  agent_no_plan: "Your agent does not have an active plan to cover this property.",
  agent_limit_reached:
    "Your agent has reached their plan's property limit, so they can't cover this property right now.",
};

function propertyLabelFromRow(row) {
  const parts = [row?.address, row?.city, row?.state].filter(Boolean);
  return parts.length ? parts.join(", ") : "your property";
}

async function getPropertyLabel(propertyId, queryFn = (t, p) => db.query(t, p)) {
  const res = await queryFn(
    `SELECT address, city, state FROM properties WHERE id = $1`,
    [propertyId]
  );
  return propertyLabelFromRow(res.rows[0]);
}

/** Load the full sponsorship row by id (shared shape for lifecycle transitions). */
async function loadSponsorship(sponsorshipId) {
  const res = await db.query(
    `SELECT id, property_id AS "propertyId", sponsor_account_id AS "sponsorAccountId",
            sponsor_agent_user_id AS "sponsorAgentUserId",
            beneficiary_account_id AS "beneficiaryAccountId",
            beneficiary_user_id AS "beneficiaryUserId", status,
            grace_until AS "graceUntil", grace_plan_code AS "gracePlanCode"
     FROM property_sponsorships WHERE id = $1`,
    [sponsorshipId]
  );
  return res.rows[0] || null;
}

/** The plan code currently backing an account's active/trialing subscription (snapshot source). */
async function getAccountPlanCode(accountId) {
  if (!accountId) return null;
  const res = await db.query(
    `SELECT sp.code
     FROM account_subscriptions asub
     JOIN subscription_products sp ON sp.id = asub.subscription_product_id
     WHERE asub.account_id = $1 AND asub.status IN ('active', 'trialing')
     ORDER BY asub.current_period_end DESC NULLS LAST
     LIMIT 1`,
    [accountId]
  );
  return res.rows[0]?.code || null;
}

async function getUserContact(userId) {
  if (!userId) return null;
  const res = await db.query(`SELECT email, name FROM users WHERE id = $1`, [userId]);
  return res.rows[0] || null;
}

function formatDateForCopy(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Best-effort lifecycle email to a beneficiary (in-app notifications remain primary). */
async function safeSponsorEmail(userId, accountId, { kind, propertyLabel, agentName, graceEndsOn } = {}) {
  if (!userId) return;
  try {
    const contact = await getUserContact(userId);
    if (!contact?.email) return;
    const billingUrl = await emailService.buildAccountBillingUrl(accountId);
    await emailService.sendSponsorshipLifecycleEmail({
      to: contact.email,
      userName: contact.name,
      kind,
      propertyLabel,
      agentName,
      graceEndsOn,
      billingUrl,
      usage: { accountId, userId, emailType: `sponsorship_${kind}` },
    });
  } catch (err) {
    console.warn("[sponsorship] lifecycle email failed:", err.message);
  }
}

/** Public: eligibility for the homeowner offer. */
async function getEligibility({ userId, accountId, userRole }) {
  return getSponsorshipEligibility({ userId, accountId, userRole });
}

/**
 * Current sponsorship state for an account, both as beneficiary (homeowner) and
 * as sponsor (agent). Safe to call for any role.
 */
async function getSponsorshipState(accountId) {
  const beneficiaryRes = await db.query(
    `SELECT ps.id, ps.property_id AS "propertyId", ps.status, ps.effective_at AS "effectiveAt",
            ps.grace_until AS "graceUntil",
            p.property_uid AS "propertyUid", p.address, p.city, p.state,
            su.name AS "sponsorName", su.email AS "sponsorEmail"
     FROM property_sponsorships ps
     JOIN properties p ON p.id = ps.property_id
     LEFT JOIN users su ON su.id = ps.sponsor_agent_user_id
     WHERE ps.beneficiary_account_id = $1 AND ps.status IN ('pending', 'active', 'grace')
     ORDER BY ps.created_at DESC
     LIMIT 1`,
    [accountId]
  );
  const asBeneficiary = beneficiaryRes.rows[0]
    ? {
        id: beneficiaryRes.rows[0].id,
        status: beneficiaryRes.rows[0].status,
        effectiveAt: beneficiaryRes.rows[0].effectiveAt,
        graceUntil: beneficiaryRes.rows[0].graceUntil,
        propertyUid: beneficiaryRes.rows[0].propertyUid,
        propertyLabel: propertyLabelFromRow(beneficiaryRes.rows[0]),
        sponsorName: beneficiaryRes.rows[0].sponsorName || beneficiaryRes.rows[0].sponsorEmail || "your agent",
      }
    : null;

  return { asBeneficiary };
}

/** Agent-facing: list of properties this account currently sponsors. */
async function listSponsoredProperties(sponsorAccountId) {
  const res = await db.query(
    `SELECT ps.id, ps.status, ps.effective_at AS "effectiveAt", ps.created_at AS "createdAt",
            p.id AS "propertyId", p.property_uid AS "propertyUid", p.address, p.city, p.state,
            bu.name AS "beneficiaryName", bu.email AS "beneficiaryEmail"
     FROM property_sponsorships ps
     JOIN properties p ON p.id = ps.property_id
     LEFT JOIN users bu ON bu.id = ps.beneficiary_user_id
     WHERE ps.sponsor_account_id = $1 AND ps.status IN ('pending', 'active')
     ORDER BY ps.created_at DESC`,
    [sponsorAccountId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    status: r.status,
    effectiveAt: r.effectiveAt,
    createdAt: r.createdAt,
    propertyId: r.propertyId,
    propertyUid: r.propertyUid,
    propertyLabel: propertyLabelFromRow(r),
    beneficiaryName: r.beneficiaryName || r.beneficiaryEmail || "Homeowner",
  }));
}

/**
 * Homeowner accepts the offer. Schedules their paid subscription to end at the
 * period boundary and records a pending sponsorship that activates then. When the
 * account has no live Stripe subscription (mock/dev), activates immediately.
 */
async function acceptOffer({ userId, accountId, userRole }) {
  const eligibility = await getSponsorshipEligibility({ userId, accountId, userRole });
  if (!eligibility.eligible) {
    throw new BadRequestError(
      ELIGIBILITY_MESSAGES[eligibility.reason] || "You are not eligible to transfer billing right now."
    );
  }

  const { property, agent } = eligibility;

  // Locate the homeowner's active subscription to schedule its cancellation.
  const subRes = await db.query(
    `SELECT stripe_subscription_id AS "stripeSubscriptionId",
            current_period_end AS "currentPeriodEnd"
     FROM account_subscriptions
     WHERE account_id = $1 AND status IN ('active', 'trialing')
     ORDER BY current_period_end DESC NULLS LAST
     LIMIT 1`,
    [accountId]
  );
  const sub = subRes.rows[0];
  const stripeSubId = sub?.stripeSubscriptionId;

  let effectiveAt = sub?.currentPeriodEnd || null;
  let activateNow = false;

  // Demo never schedules period-end activation — always apply coverage immediately
  // so branding/entitlements inherit without waiting on a (often year-long) period.
  if (
    !isDemoEnvironment() &&
    stripeSubId &&
    !BILLING_MOCK_MODE &&
    stripeService.stripe
  ) {
    const updated = await stripeService.stripe.subscriptions.update(stripeSubId, {
      cancel_at_period_end: true,
      automatic_tax: { enabled: true },
      metadata: {
        pending_downgrade_plan: FREE_HOMEOWNER_PLAN_CODE,
        pending_sponsorship: "1",
      },
    });
    if (updated?.current_period_end) {
      effectiveAt = new Date(updated.current_period_end * 1000);
    }
    await db.query(
      `UPDATE account_subscriptions SET cancel_at_period_end = true, updated_at = NOW()
       WHERE stripe_subscription_id = $1`,
      [stripeSubId]
    );
  } else {
    // No live Stripe subscription to wind down (or demo) — apply the subsidy immediately.
    activateNow = true;
  }

  const insertRes = await db.query(
    `INSERT INTO property_sponsorships
       (property_id, sponsor_account_id, sponsor_agent_user_id,
        beneficiary_account_id, beneficiary_user_id, status, effective_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6)
     RETURNING id`,
    [property.id, agent.accountId, agent.userId, accountId, userId, effectiveAt]
  );
  const sponsorshipId = insertRes.rows[0].id;

  const label = property.label;
  // Notify the agent that a client scheduled coverage.
  await safeNotify(agent.userId, {
    type: "property_sponsorship_offered",
    propertyId: property.id,
    title: `A client transferred billing for ${label} to your plan. Their coverage starts when their current subscription period ends.`,
  });

  if (activateNow) {
    await activateSponsorship(sponsorshipId, { reValidate: false });
    return { activated: true, sponsorshipId, accessUntil: effectiveAt };
  }

  return { scheduled: true, sponsorshipId, accessUntil: effectiveAt };
}

/**
 * Activate a pending sponsorship: re-validate agent capacity, point the property's
 * entitlements at the sponsor account, and drop the beneficiary to the free plan.
 * Called at the homeowner's period end (from the Stripe webhook) or immediately in
 * dev/mock mode.
 */
async function activateSponsorship(sponsorshipId, { reValidate = true } = {}) {
  const psRes = await db.query(
    `SELECT id, property_id AS "propertyId", sponsor_account_id AS "sponsorAccountId",
            sponsor_agent_user_id AS "sponsorAgentUserId",
            beneficiary_account_id AS "beneficiaryAccountId",
            beneficiary_user_id AS "beneficiaryUserId", status
     FROM property_sponsorships WHERE id = $1`,
    [sponsorshipId]
  );
  const ps = psRes.rows[0];
  if (!ps) throw new NotFoundError(`Sponsorship not found: ${sponsorshipId}`);
  if (ps.status === "active") return { activated: true, alreadyActive: true };
  if (ps.status !== "pending") {
    return { activated: false, reason: `status_${ps.status}` };
  }

  if (reValidate) {
    const ok = await sponsorStillValid(ps);
    if (!ok.valid) {
      await endSponsorship({
        sponsorshipId: ps.id,
        reason: `activation_${ok.reason}`,
        notifyResubscribe: true,
      });
      return { activated: false, reason: ok.reason };
    }
  }

  await db.query(
    `UPDATE properties SET active_sponsor_account_id = $1, updated_at = NOW() WHERE id = $2`,
    [ps.sponsorAccountId, ps.propertyId]
  );
  await db.query(
    `UPDATE property_sponsorships
     SET status = 'active', effective_at = COALESCE(effective_at, NOW()), updated_at = NOW()
     WHERE id = $1`,
    [ps.id]
  );

  // Ensure the beneficiary sits on the free homeowner plan (no charge).
  try {
    await Subscription.ensureAccountOnPlanCode(ps.beneficiaryAccountId, FREE_HOMEOWNER_PLAN_CODE);
  } catch (err) {
    console.warn("[sponsorship] could not set free plan for beneficiary:", err.message);
  }

  const label = await getPropertyLabel(ps.propertyId);
  await safeNotify(ps.beneficiaryUserId, {
    type: "property_sponsorship_active",
    propertyId: ps.propertyId,
    title: `Your agent's plan now covers ${label}. You won't be charged for this property.`,
  });
  await safeNotify(ps.sponsorAgentUserId, {
    type: "property_sponsorship_active",
    propertyId: ps.propertyId,
    title: `Your plan now covers ${label} for your client.`,
  });
  const agentContact = await getUserContact(ps.sponsorAgentUserId);
  await safeSponsorEmail(ps.beneficiaryUserId, ps.beneficiaryAccountId, {
    kind: "active",
    propertyLabel: label,
    agentName: agentContact?.name || "your agent",
  });

  return { activated: true };
}

/** Activate every pending sponsorship for a beneficiary account (period-end trigger). */
async function activatePendingForAccount(beneficiaryAccountId) {
  const res = await db.query(
    `SELECT id FROM property_sponsorships
     WHERE beneficiary_account_id = $1 AND status = 'pending'`,
    [beneficiaryAccountId]
  );
  const results = [];
  for (const row of res.rows) {
    try {
      results.push(await activateSponsorship(row.id, { reValidate: true }));
    } catch (err) {
      console.warn(`[sponsorship] activate ${row.id} failed:`, err.message);
    }
  }
  return results;
}

/** Whether the sponsor (agent) can still cover the property. */
async function sponsorStillValid(ps) {
  // Agent must still be on the property team.
  if (ps.sponsorAgentUserId) {
    const onTeam = await db.query(
      `SELECT 1 FROM property_users WHERE property_id = $1 AND user_id = $2 LIMIT 1`,
      [ps.propertyId, ps.sponsorAgentUserId]
    );
    if (onTeam.rows.length === 0) return { valid: false, reason: "agent_removed" };
  }

  // Sponsor account must still have an active plan.
  if (!(await accountHasActiveSubscription(ps.sponsorAccountId))) {
    return { valid: false, reason: "agent_no_plan" };
  }

  // Agent must not be over their property cap.
  if (ps.sponsorAgentUserId) {
    const limits = await getAccountLimits(ps.sponsorAccountId);
    const count = await countAgentManagedProperties(ps.sponsorAgentUserId);
    if (limits.maxProperties != null && count > limits.maxProperties) {
      return { valid: false, reason: "agent_limit_reached" };
    }
  }

  return { valid: true };
}

/**
 * End an active (or pending) sponsorship: clear the sponsor on the property and
 * mark the row ended. Optionally prompts the homeowner to resubscribe.
 */
async function endSponsorship({ sponsorshipId, reason = "ended", notifyResubscribe = true, actorUserId = null }) {
  const psRes = await db.query(
    `SELECT id, property_id AS "propertyId", sponsor_account_id AS "sponsorAccountId",
            sponsor_agent_user_id AS "sponsorAgentUserId",
            beneficiary_account_id AS "beneficiaryAccountId",
            beneficiary_user_id AS "beneficiaryUserId", status
     FROM property_sponsorships WHERE id = $1`,
    [sponsorshipId]
  );
  const ps = psRes.rows[0];
  if (!ps) throw new NotFoundError(`Sponsorship not found: ${sponsorshipId}`);
  if (ps.status === "ended" || ps.status === "declined") {
    return { ended: true, alreadyEnded: true };
  }

  const wasActive = ps.status === "active" || ps.status === "grace";
  const finalStatus = wasActive ? "ended" : "declined";

  // Clear the sponsor pointer only when it still references this sponsor, and drop
  // any grace marker so the property reverts to its own plan entitlements.
  await db.query(
    `UPDATE properties SET active_sponsor_account_id = NULL, grace_until = NULL, updated_at = NOW()
     WHERE id = $1 AND active_sponsor_account_id = $2`,
    [ps.propertyId, ps.sponsorAccountId]
  );
  await db.query(
    `UPDATE property_sponsorships
     SET status = $2, ended_at = NOW(), ended_reason = $3, grace_until = NULL, updated_at = NOW()
     WHERE id = $1`,
    [ps.id, finalStatus, reason]
  );

  const label = await getPropertyLabel(ps.propertyId);
  if (notifyResubscribe) {
    await safeNotify(ps.beneficiaryUserId, {
      type: "property_sponsorship_ended",
      propertyId: ps.propertyId,
      title: `Agent coverage for ${label} has ended. Subscribe to a plan to keep premium features for this property.`,
    });
    await safeSponsorEmail(ps.beneficiaryUserId, ps.beneficiaryAccountId, {
      kind: "ended",
      propertyLabel: label,
    });
  }
  await safeNotify(ps.sponsorAgentUserId, {
    type: "property_sponsorship_ended",
    propertyId: ps.propertyId,
    title: `Your plan no longer covers ${label}.`,
  });

  return { ended: true, wasActive };
}

/**
 * Move an active sponsorship into a 30-day grace period (agent left or dropped their plan).
 * Entitlements are snapshotted (grace_plan_code) so they stay stable during grace even if
 * the sponsor's live plan changes. The homeowner is prompted to resume their own plan.
 */
async function enterGrace({ sponsorshipId, reason = "sponsor_lost" }) {
  const ps = await loadSponsorship(sponsorshipId);
  if (!ps) throw new NotFoundError(`Sponsorship not found: ${sponsorshipId}`);
  if (ps.status === "grace") return { entered: true, alreadyGrace: true };
  if (ps.status !== "active") return { entered: false, reason: `status_${ps.status}` };

  const graceUntil = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const planCode = (await getAccountPlanCode(ps.sponsorAccountId)) || FREE_HOMEOWNER_PLAN_CODE;

  await db.query(
    `UPDATE property_sponsorships
     SET status = 'grace', grace_until = $2, grace_plan_code = $3, grace_reminded_at = NULL,
         ended_reason = $4, updated_at = NOW()
     WHERE id = $1`,
    [ps.id, graceUntil, planCode, reason]
  );
  // Keep active_sponsor_account_id set so the property stays "covered" during grace;
  // entitlements resolve from the snapshot. Mirror the deadline onto the property.
  await db.query(
    `UPDATE properties SET grace_until = $2, updated_at = NOW() WHERE id = $1`,
    [ps.propertyId, graceUntil]
  );

  const label = await getPropertyLabel(ps.propertyId);
  const deadline = formatDateForCopy(graceUntil);
  const agentContact = await getUserContact(ps.sponsorAgentUserId);
  await safeNotify(ps.beneficiaryUserId, {
    type: "property_sponsorship_grace",
    propertyId: ps.propertyId,
    title: `Agent coverage for ${label} is ending. Resume your plan by ${deadline} to keep premium features for this property.`,
  });
  await safeSponsorEmail(ps.beneficiaryUserId, ps.beneficiaryAccountId, {
    kind: "grace_started",
    propertyLabel: label,
    agentName: agentContact?.name || "Your agent",
    graceEndsOn: deadline,
  });

  return { entered: true, graceUntil };
}

/** Expire a grace period: clear coverage, end the row, and notify the homeowner. */
async function expireGrace(sponsorshipId) {
  const ps = await loadSponsorship(sponsorshipId);
  if (!ps) throw new NotFoundError(`Sponsorship not found: ${sponsorshipId}`);
  if (ps.status !== "grace") return { ended: false, reason: `status_${ps.status}` };

  await db.query(
    `UPDATE properties SET active_sponsor_account_id = NULL, grace_until = NULL, updated_at = NOW()
     WHERE id = $1`,
    [ps.propertyId]
  );
  await db.query(
    `UPDATE property_sponsorships
     SET status = 'ended', ended_at = NOW(),
         ended_reason = COALESCE(ended_reason, 'grace_expired'), grace_until = NULL, updated_at = NOW()
     WHERE id = $1`,
    [ps.id]
  );

  // Make sure the beneficiary is parked on the free homeowner plan.
  try {
    await Subscription.ensureAccountOnPlanCode(ps.beneficiaryAccountId, FREE_HOMEOWNER_PLAN_CODE);
  } catch (err) {
    console.warn("[sponsorship] expireGrace free-plan ensure:", err.message);
  }

  const label = await getPropertyLabel(ps.propertyId);
  await safeNotify(ps.beneficiaryUserId, {
    type: "property_sponsorship_ended",
    propertyId: ps.propertyId,
    title: `Agent coverage for ${label} has ended. Subscribe to restore premium features for this property.`,
  });
  await safeSponsorEmail(ps.beneficiaryUserId, ps.beneficiaryAccountId, {
    kind: "ended",
    propertyLabel: label,
  });

  return { ended: true };
}

/** Send a grace-period reminder for one row and stamp grace_reminded_at. */
async function sendGraceReminder(ps) {
  const label = await getPropertyLabel(ps.propertyId);
  const deadline = formatDateForCopy(ps.graceUntil);
  await safeNotify(ps.beneficiaryUserId, {
    type: "property_sponsorship_grace",
    propertyId: ps.propertyId,
    title: `Reminder: agent coverage for ${label} ends ${deadline}. Subscribe to keep premium features.`,
  });
  await safeSponsorEmail(ps.beneficiaryUserId, ps.beneficiaryAccountId, {
    kind: "grace_reminder",
    propertyLabel: label,
    graceEndsOn: deadline,
  });
  await db.query(
    `UPDATE property_sponsorships SET grace_reminded_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [ps.id]
  );
}

/**
 * Shared handler for "the sponsor can no longer cover this property" (agent removed
 * from team, or agent dropped their plan). Active coverage enters grace; a not-yet-started
 * (pending) offer is cancelled so the homeowner keeps paying.
 */
async function handleSponsorLost(ps, reason) {
  if (ps.status === "active") {
    return enterGrace({ sponsorshipId: ps.id, reason });
  }
  if (ps.status === "grace") {
    return { entered: true, alreadyGrace: true };
  }
  if (ps.status === "pending") {
    try {
      if (!BILLING_MOCK_MODE && stripeService.stripe) {
        await stripeService.reactivateSubscription(ps.beneficiaryAccountId, ps.beneficiaryUserId);
      }
    } catch (err) {
      console.warn("[sponsorship] handleSponsorLost reactivate:", err.message);
    }
    return endSponsorship({ sponsorshipId: ps.id, reason, notifyResubscribe: false });
  }
  return { entered: false };
}

/**
 * The beneficiary started paying for themselves again — end any active/grace coverage
 * (they no longer need the subsidy). Pending offers are intentionally untouched: a pending
 * offer means the homeowner is still in their paid period awaiting the switch.
 */
async function handleBeneficiaryResubscribed(beneficiaryAccountId) {
  if (!beneficiaryAccountId) return { ended: 0 };
  if (!(await accountHasActivePaidSubscription(beneficiaryAccountId))) return { ended: 0 };
  const res = await db.query(
    `SELECT id FROM property_sponsorships
     WHERE beneficiary_account_id = $1 AND status IN ('active', 'grace')`,
    [beneficiaryAccountId]
  );
  let ended = 0;
  for (const row of res.rows) {
    try {
      await endSponsorship({
        sponsorshipId: row.id,
        reason: "beneficiary_resubscribed",
        notifyResubscribe: false,
      });
      ended += 1;
    } catch (err) {
      console.warn(`[sponsorship] resubscribe end ${row.id} failed:`, err.message);
    }
  }
  return { ended };
}

/**
 * Time-based sweep (run on an interval + manually): activates overdue pending offers
 * (missed-webhook safety net), expires grace periods, sends grace reminders, and
 * revalidates active sponsors so capacity/plan changes are caught even without an event.
 */
async function runSponsorshipSweep() {
  const result = { activatedPending: 0, expiredGrace: 0, reminders: 0, revalidated: 0 };

  const overdue = await db.query(
    `SELECT id FROM property_sponsorships
     WHERE status = 'pending' AND effective_at IS NOT NULL AND effective_at <= NOW()`
  );
  for (const row of overdue.rows) {
    try {
      const r = await activateSponsorship(row.id, { reValidate: true });
      if (r.activated) result.activatedPending += 1;
    } catch (err) {
      console.warn(`[sponsorship] sweep activate ${row.id} failed:`, err.message);
    }
  }

  const expired = await db.query(
    `SELECT id FROM property_sponsorships
     WHERE status = 'grace' AND grace_until IS NOT NULL AND grace_until <= NOW()`
  );
  for (const row of expired.rows) {
    try {
      const r = await expireGrace(row.id);
      if (r.ended) result.expiredGrace += 1;
    } catch (err) {
      console.warn(`[sponsorship] sweep expire ${row.id} failed:`, err.message);
    }
  }

  const reminders = await db.query(
    `SELECT id, property_id AS "propertyId", beneficiary_user_id AS "beneficiaryUserId",
            beneficiary_account_id AS "beneficiaryAccountId", grace_until AS "graceUntil"
     FROM property_sponsorships
     WHERE status = 'grace' AND grace_until > NOW()
       AND grace_until <= NOW() + ($1 || ' days')::interval
       AND (grace_reminded_at IS NULL OR grace_reminded_at < NOW() - INTERVAL '20 hours')`,
    [String(GRACE_REMINDER_WINDOW_DAYS)]
  );
  for (const row of reminders.rows) {
    try {
      await sendGraceReminder(row);
      result.reminders += 1;
    } catch (err) {
      console.warn(`[sponsorship] sweep reminder ${row.id} failed:`, err.message);
    }
  }

  const actives = await db.query(
    `SELECT id, property_id AS "propertyId", sponsor_account_id AS "sponsorAccountId",
            sponsor_agent_user_id AS "sponsorAgentUserId"
     FROM property_sponsorships WHERE status = 'active'`
  );
  for (const row of actives.rows) {
    try {
      const ok = await sponsorStillValid(row);
      if (!ok.valid) {
        await enterGrace({ sponsorshipId: row.id, reason: `revalidate_${ok.reason}` });
        result.revalidated += 1;
      }
    } catch (err) {
      console.warn(`[sponsorship] sweep revalidate ${row.id} failed:`, err.message);
    }
  }

  return result;
}

/**
 * Homeowner cancels a pending offer before it takes effect (keep paying). Undoes
 * the scheduled Stripe cancellation and marks the sponsorship declined.
 */
async function cancelPendingOffer({ userId, accountId }) {
  const psRes = await db.query(
    `SELECT id FROM property_sponsorships
     WHERE beneficiary_account_id = $1 AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [accountId]
  );
  const ps = psRes.rows[0];
  if (!ps) throw new BadRequestError("No pending agent-coverage offer to cancel.");

  // Undo the scheduled cancellation so the subscription renews normally.
  try {
    if (!BILLING_MOCK_MODE && stripeService.stripe) {
      await stripeService.reactivateSubscription(accountId, userId);
    }
  } catch (err) {
    // If there is nothing scheduled (already reactivated), continue to mark declined.
    console.warn("[sponsorship] cancelPendingOffer reactivate:", err.message);
  }

  await endSponsorship({
    sponsorshipId: ps.id,
    reason: "cancelled_by_homeowner",
    notifyResubscribe: false,
  });
  return { cancelled: true };
}

/**
 * End coverage initiated by a participant (agent or homeowner) on an active/pending
 * sponsorship the actor is part of.
 */
async function endSponsorshipByParticipant({ sponsorshipId, actorUserId, actorAccountId }) {
  const psRes = await db.query(
    `SELECT id, sponsor_account_id AS "sponsorAccountId",
            beneficiary_account_id AS "beneficiaryAccountId", status
     FROM property_sponsorships WHERE id = $1`,
    [sponsorshipId]
  );
  const ps = psRes.rows[0];
  if (!ps) throw new NotFoundError(`Sponsorship not found: ${sponsorshipId}`);
  const isParticipant =
    Number(ps.sponsorAccountId) === Number(actorAccountId) ||
    Number(ps.beneficiaryAccountId) === Number(actorAccountId);
  if (!isParticipant) {
    throw new BadRequestError("You are not a participant in this sponsorship.");
  }
  if (ps.status === "pending") {
    // Pending offers belong to the homeowner to cancel.
    return cancelPendingOffer({ userId: actorUserId, accountId: ps.beneficiaryAccountId });
  }
  return endSponsorship({
    sponsorshipId,
    reason: "ended_by_participant",
    notifyResubscribe: true,
    actorUserId,
  });
}

/**
 * Reconcile sponsorship after a property's team changes. If the sponsoring agent is
 * no longer on the property, end (or cancel) the sponsorship.
 */
async function reconcileForProperty(propertyId) {
  const psRes = await db.query(
    `SELECT id FROM property_sponsorships
     WHERE property_id = $1 AND status IN ('pending', 'active', 'grace')
     LIMIT 1`,
    [propertyId]
  );
  if (!psRes.rows[0]) return;
  const ps = await loadSponsorship(psRes.rows[0].id);
  if (!ps || !ps.sponsorAgentUserId) return;

  const onTeam = await db.query(
    `SELECT 1 FROM property_users WHERE property_id = $1 AND user_id = $2 LIMIT 1`,
    [propertyId, ps.sponsorAgentUserId]
  );
  if (onTeam.rows.length > 0) return; // agent still present

  // Active coverage enters the 30-day grace period; a pending offer is cancelled.
  await handleSponsorLost(ps, "agent_removed");
}

/** Move/cancel all in-flight sponsorships funded by a sponsor account (agent cancelled plan). */
async function endSponsorshipsForCanceledSponsor(sponsorAccountId) {
  const res = await db.query(
    `SELECT id FROM property_sponsorships
     WHERE sponsor_account_id = $1 AND status IN ('pending', 'active', 'grace')`,
    [sponsorAccountId]
  );
  for (const row of res.rows) {
    try {
      const ps = await loadSponsorship(row.id);
      if (ps) await handleSponsorLost(ps, "sponsor_plan_canceled");
    } catch (err) {
      console.warn(`[sponsorship] end ${row.id} for canceled sponsor failed:`, err.message);
    }
  }
}

async function safeNotify(userId, payload) {
  if (!userId) return;
  try {
    await Notification.create({ userId, ...payload });
  } catch (err) {
    console.warn("[sponsorship] notification failed:", err.message);
  }
}

module.exports = {
  getEligibility,
  getSponsorshipState,
  listSponsoredProperties,
  acceptOffer,
  activateSponsorship,
  activatePendingForAccount,
  endSponsorship,
  endSponsorshipByParticipant,
  cancelPendingOffer,
  reconcileForProperty,
  endSponsorshipsForCanceledSponsor,
  enterGrace,
  expireGrace,
  handleBeneficiaryResubscribed,
  runSponsorshipSweep,
};
