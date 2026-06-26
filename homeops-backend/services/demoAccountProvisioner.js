"use strict";

/**
 * Runtime demo account provisioning for demo.heyopsy.com.
 * Creates login-ready paid accounts with sample portfolio data.
 */

const db = require("../db");
const { BadRequestError } = require("../expressError");
const { isDemoEnvironment } = require("../helpers/demoEnvironment");
const { generatePassportId } = require("../helpers/properties");
const Account = require("../models/account");
const Contact = require("../models/contact");
const User = require("../models/user");
const Property = require("../models/property");
const System = require("../models/system");
const MaintenanceRecord = require("../models/maintenanceRecord");
const MaintenanceEvent = require("../models/maintenanceEvent");
const InspectionChecklistItem = require("../models/inspectionChecklistItem");
const Conversation = require("../models/conversation");
const ConversationMessage = require("../models/conversationMessage");
const HomeownerAgentInquiry = require("../models/homeownerAgentInquiry");
const Professional = require("../models/professional");
const SavedProfessional = require("../models/savedProfessional");
const {
  DEMO_AGENT_PERSONA,
  SYSTEM_KEYS,
  ACCOUNT_CONTACTS,
  DEMO_CONTRACTORS,
  INSPECTION_FIXTURE,
  getScenarioForRole,
} = require("../data/demoAccountScenarios");

const INTERNAL_PASSWORD = "demo-internal-not-for-login";

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatYmd(d);
}

function daysAgo(days) {
  return daysFromNow(-days);
}

async function provisionActivePaidPlan(accountId, planCode) {
  const productRes = await db.query(
    `SELECT id FROM subscription_products
     WHERE code = $1 AND (is_active IS NULL OR is_active = true)
     LIMIT 1`,
    [planCode]
  );
  const productId = productRes.rows[0]?.id;
  if (!productId) {
    throw new BadRequestError(`Subscription plan not found: ${planCode}`);
  }

  const existingRes = await db.query(
    `SELECT id FROM account_subscriptions
     WHERE account_id = $1 AND status IN ('active', 'trialing')
     ORDER BY updated_at DESC NULLS LAST, id DESC
     LIMIT 1`,
    [accountId]
  );

  if (existingRes.rows[0]) {
    await db.query(
      `UPDATE account_subscriptions
       SET subscription_product_id = $1,
           stripe_subscription_id = NULL,
           stripe_price_id = NULL,
           cancel_at_period_end = false,
           status = 'active',
           current_period_start = NOW(),
           current_period_end = NOW() + INTERVAL '1 year',
           updated_at = NOW()
       WHERE id = $2`,
      [productId, existingRes.rows[0].id]
    );
    return existingRes.rows[0].id;
  }

  const insertRes = await db.query(
    `INSERT INTO account_subscriptions
       (account_id, subscription_product_id, status, current_period_start, current_period_end)
     VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '1 year')
     RETURNING id`,
    [accountId, productId]
  );
  return insertRes.rows[0]?.id;
}

async function findOrCreateInternalUser({ email, name, phone, role, avatarUrl }) {
  const existing = await User.get(email).catch(() => null);
  if (existing?.id) return existing;

  const user = await User.register({
    name,
    email,
    password: INTERNAL_PASSWORD,
    phone,
    role,
    is_active: true,
    role_locked: true,
  });

  await db.query(
    `UPDATE users
     SET email_verified = true,
         onboarding_completed = true,
         avatar_url = COALESCE($2, avatar_url),
         updated_at = NOW()
     WHERE id = $1`,
    [user.id, avatarUrl || null]
  );

  return await User.getById(user.id);
}

async function findOrCreateDemoAgentPersona() {
  return findOrCreateInternalUser({
    email: DEMO_AGENT_PERSONA.email,
    name: DEMO_AGENT_PERSONA.name,
    phone: DEMO_AGENT_PERSONA.phone,
    role: DEMO_AGENT_PERSONA.role,
  });
}

async function createSyntheticHomeowner({ name, phone, avatarUrl, suffix }) {
  const email = `provision-hw-${suffix}@demo.internal`;
  const existing = await User.get(email).catch(() => null);
  if (existing?.id) return existing;

  const user = await User.register({
    name,
    email,
    password: INTERNAL_PASSWORD,
    phone,
    role: "homeowner",
    is_active: true,
    role_locked: true,
  });

  await db.query(
    `UPDATE users
     SET email_verified = true,
         onboarding_completed = true,
         avatar_url = COALESCE($2, avatar_url),
         updated_at = NOW()
     WHERE id = $1`,
    [user.id, avatarUrl || null]
  );

  const account = await Account.linkNewUserToAccount({ name, userId: user.id });
  const contact = await Contact.create({ name, email, phone });
  await Contact.addToAccount({ contactId: contact.id, accountId: account.id });
  await User.update({ id: user.id, contact: contact.id });

  return { user: await User.getById(user.id), account };
}

async function setupBaseAccount({ userId, name, email, phone, role, planCode }) {
  const account = await Account.linkNewUserToAccount({ name, userId });
  const contact = await Contact.create({ name, email, phone: phone || null });
  await Contact.addToAccount({ contactId: contact.id, accountId: account.id });
  await User.update({ id: userId, contact: contact.id });

  await User.completeOnboarding(userId, { role, subscriptionTier: planCode });
  await db.query(
    `UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
  await provisionActivePaidPlan(account.id, planCode);

  return account;
}

async function createPropertyOnAccount({ accountId, template }) {
  const { address, main_photo } = template;
  const property = await Property.create({
    account_id: accountId,
    property_name: address.address_line_1,
    main_photo,
    address: address.full,
    address_line_1: address.address_line_1,
    city: address.city,
    state: address.state,
    zip: address.zip,
    passport_id: generatePassportId({ state: address.state, zip: address.zip }),
  });
  return property;
}

async function seedSystems(propertyId) {
  const nextService = daysFromNow(90);
  for (const system_key of SYSTEM_KEYS) {
    await System.create({
      property_id: propertyId,
      system_key,
      data: { demo: true },
      next_service_date: nextService,
      included: true,
    });
  }
}

async function seedInspectionAnalysis(propertyId, userId) {
  const jobRes = await db.query(
    `INSERT INTO inspection_analysis_jobs
       (property_id, user_id, s3_key, file_name, mime_type, status)
     VALUES ($1, $2, 'demo/inspection-report.pdf', 'inspection-report.pdf', 'application/pdf', 'completed')
     RETURNING id`,
    [propertyId, userId]
  );
  const jobId = jobRes.rows[0].id;

  const resultRes = await db.query(
    `INSERT INTO inspection_analysis_results
       (job_id, property_id, condition_rating, condition_confidence, condition_rationale,
        needs_attention, maintenance_suggestions, summary, review_status, reviewed_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, 'approved', NOW())
     RETURNING *`,
    [
      jobId,
      propertyId,
      INSPECTION_FIXTURE.condition_rating,
      INSPECTION_FIXTURE.condition_confidence,
      INSPECTION_FIXTURE.condition_rationale,
      JSON.stringify(INSPECTION_FIXTURE.needs_attention),
      JSON.stringify(INSPECTION_FIXTURE.maintenance_suggestions),
      INSPECTION_FIXTURE.summary,
    ]
  );

  const analysisResult = resultRes.rows[0];
  const items = await InspectionChecklistItem.generateFromAnalysis(analysisResult);

  const statuses = ["completed", "in_progress", "pending", "pending"];
  for (let i = 0; i < items.length; i++) {
    const status = statuses[i % statuses.length];
    if (status !== "pending") {
      await InspectionChecklistItem.update(items[i].id, {
        status,
        ...(status === "completed"
          ? { completed_at: new Date().toISOString(), completed_by: userId }
          : {}),
      });
    }
  }

  return { jobId, analysisResultId: analysisResult.id, itemCount: items.length };
}

async function seedMaintenanceRecords(propertyId) {
  await MaintenanceRecord.createMany([
    {
      property_id: propertyId,
      system_key: "heating",
      completed_at: daysAgo(120),
      next_service_date: daysFromNow(60),
      status: "completed",
      data: { task: "Annual furnace tune-up", demo: true },
    },
    {
      property_id: propertyId,
      system_key: "gutters",
      completed_at: daysAgo(200),
      next_service_date: daysFromNow(30),
      status: "pending",
      data: { task: "Gutter cleaning", demo: true },
    },
    {
      property_id: propertyId,
      system_key: "roof",
      completed_at: null,
      next_service_date: daysFromNow(14),
      status: "pending",
      data: { task: "Roof inspection", demo: true },
    },
  ]);
}

async function seedMaintenanceEvents(propertyId, createdByUserId, focus) {
  await MaintenanceEvent.create({
    property_id: propertyId,
    system_key: "heating",
    system_name: "Heating",
    scheduled_date: daysAgo(45),
    status: "completed",
    event_type: "maintenance",
    created_by: createdByUserId,
  });

  await MaintenanceEvent.create({
    property_id: propertyId,
    system_key: "plumbing",
    system_name: "Plumbing",
    scheduled_date: daysFromNow(21),
    status: "scheduled",
    event_type: "maintenance",
    created_by: createdByUserId,
  });

  if (focus === "maintenance" || focus === "balanced") {
    await MaintenanceEvent.create({
      property_id: propertyId,
      system_key: "gutters",
      system_name: "Gutters",
      scheduled_date: daysFromNow(10),
      recurrence_type: "annually",
      status: "scheduled",
      event_type: "maintenance",
      created_by: createdByUserId,
    });
  }
}

async function seedAccountContacts(accountId, ownerUserId) {
  const created = [];
  for (const c of ACCOUNT_CONTACTS) {
    const contact = await Contact.create({
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.company,
    });
    await Contact.addToAccount({ contactId: contact.id, accountId });
    created.push(contact);
  }
  return created;
}

async function seedContractors(accountId, userId) {
  const professionals = [];
  for (const row of DEMO_CONTRACTORS) {
    const pro = await Professional.create({
      ...row,
      account_id: accountId,
      is_verified: true,
    });
    professionals.push(pro);
    await SavedProfessional.save(userId, pro.id);
  }
  return professionals;
}

async function seedConversation({
  accountId,
  propertyId,
  homeownerUserId,
  agentUserId,
  focus,
}) {
  const conv = await Conversation.findOrCreate({
    accountId,
    propertyId,
    homeownerUserId,
    agentUserId,
  });

  const homeownerMsg = await ConversationMessage.create({
    conversationId: conv.id,
    senderUserId: homeownerUserId,
    kind: "text",
    payload: {
      message:
        focus === "messages"
          ? "Hi Sarah — could you recommend a good roofer for the missing shingles we discussed?"
          : "Thanks for setting up our home profile. When should we schedule the HVAC service?",
    },
  });
  await Conversation.updateLastMessageAt(conv.id);

  await ConversationMessage.create({
    conversationId: conv.id,
    senderUserId: agentUserId,
    kind: "text",
    payload: {
      message:
        "I have a few trusted contractors — I'll share options and can coordinate scheduling for you.",
    },
  });
  await Conversation.updateLastMessageAt(conv.id);

  if (focus === "messages" || focus === "balanced") {
    await ConversationMessage.create({
      conversationId: conv.id,
      senderUserId: homeownerUserId,
      kind: "referral_request",
      payload: {
        referralType: "Roofer",
        notes: "Looking for licensed roofer for ridge-line repair, prefer local referrals.",
      },
    });
    await Conversation.updateLastMessageAt(conv.id);
  }

  await HomeownerAgentInquiry.create({
    accountId,
    propertyId,
    senderUserId: homeownerUserId,
    agentUserId,
    kind: "message",
    payload: { message: "Can you review the inspection findings before we book contractors?" },
  });

  if (focus === "messages") {
    await HomeownerAgentInquiry.create({
      accountId,
      propertyId,
      senderUserId: homeownerUserId,
      agentUserId,
      kind: "referral_request",
      payload: {
        referralType: "Plumber",
        notes: "Guest bath drain is slow — need someone this week if possible.",
      },
    });
  }

  return { conversationId: conv.id, messageCount: focus === "messages" ? 4 : 3 };
}

async function seedPropertyPortfolio({
  template,
  propertyAccountId,
  ownerUserId,
  agentUserId,
  createdByUserId,
  focus = "balanced",
}) {
  const property = await createPropertyOnAccount({
    accountId: propertyAccountId,
    template,
  });

  await Property.addUserToProperty({
    property_id: property.id,
    user_id: ownerUserId,
    role: "owner",
  });
  await Property.addUserToProperty({
    property_id: property.id,
    user_id: agentUserId,
    role: "editor",
  });

  await seedSystems(property.id);

  let inspection = null;
  if (focus === "inspections" || focus === "balanced") {
    inspection = await seedInspectionAnalysis(property.id, createdByUserId);
  } else {
    await InspectionChecklistItem.createUserItem({
      propertyId: property.id,
      systemKey: "roof",
      title: "Review annual maintenance checklist",
      description: "Demo action item for property overview.",
      priority: "medium",
    });
  }

  await seedMaintenanceRecords(property.id);
  await seedMaintenanceEvents(property.id, createdByUserId, focus);

  const conversation = await seedConversation({
    accountId: propertyAccountId,
    propertyId: property.id,
    homeownerUserId: ownerUserId,
    agentUserId,
    focus,
  });

  return {
    propertyId: property.id,
    propertyUid: property.property_uid,
    inspection,
    conversation,
  };
}

/**
 * Provision a login-ready demo account with sample data.
 * @param {{ userId: number, role: string, name: string, email: string, phone?: string }}
 */
async function provisionDemoAccount({ userId, role, name, email, phone }) {
  if (!isDemoEnvironment()) {
    throw new BadRequestError("Demo account provisioning is only available on the demo site.");
  }
  if (role !== "homeowner" && role !== "agent") {
    throw new BadRequestError("Demo provisioning supports homeowner and agent roles only.");
  }

  const scenario = getScenarioForRole(role);
  const planCode = scenario.plan.code;
  const agentPersona = await findOrCreateDemoAgentPersona();
  const propertySummaries = [];

  try {
    const account = await setupBaseAccount({
      userId,
      name,
      email,
      phone,
      role,
      planCode,
    });

    await seedAccountContacts(account.id, userId);
    await seedContractors(account.id, userId);

    if (role === "homeowner") {
      const template = scenario.properties[0];
      const summary = await seedPropertyPortfolio({
        template,
        propertyAccountId: account.id,
        ownerUserId: userId,
        agentUserId: agentPersona.id,
        createdByUserId: userId,
        focus: "balanced",
      });
      propertySummaries.push(summary);
    } else {
      for (let i = 0; i < scenario.properties.length; i++) {
        const template = scenario.properties[i];
        const suffix = `${userId}-${i + 1}-${Date.now()}`;
        const synthetic = await createSyntheticHomeowner({
          name: template.syntheticHomeowner.name,
          phone: template.syntheticHomeowner.phone,
          avatarUrl: template.syntheticHomeowner.avatar_url,
          suffix,
        });

        await Account.addUserToAccount({
          userId,
          accountId: synthetic.account.id,
          role: "member",
        });

        const summary = await seedPropertyPortfolio({
          template,
          propertyAccountId: synthetic.account.id,
          ownerUserId: synthetic.user.id,
          agentUserId: userId,
          createdByUserId: userId,
          focus: template.focus || "balanced",
        });
        propertySummaries.push(summary);
      }
    }

    return {
      loginReady: true,
      planCode,
      planLabel: scenario.plan.label,
      propertyCount: propertySummaries.length,
      propertyIds: propertySummaries.map((p) => p.propertyId),
      propertyUids: propertySummaries.map((p) => p.propertyUid),
      accountId: account.id,
      accountUrl: account.url,
    };
  } catch (err) {
    console.error("[demoAccountProvisioner] failed:", err.message);
    try {
      await User.remove(userId);
    } catch (cleanupErr) {
      console.error("[demoAccountProvisioner] cleanup failed:", cleanupErr.message);
    }
    throw err;
  }
}

module.exports = {
  provisionDemoAccount,
  provisionActivePaidPlan,
};
