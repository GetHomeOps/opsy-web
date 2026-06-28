"use strict";

/**
 * Runtime demo account provisioning for demo.heyopsy.com.
 * Creates login-ready paid accounts with sample portfolio data.
 */

const db = require("../db");
const bcrypt = require("bcrypt");
const { BadRequestError } = require("../expressError");
const { BCRYPT_WORK_FACTOR } = require("../config");
const { isDemoEnvironment } = require("../helpers/demoEnvironment");
const { generatePassportId } = require("../helpers/properties");
const Account = require("../models/account");
const Contact = require("../models/contact");
const User = require("../models/user");
const Property = require("../models/property");
const MaintenanceRecord = require("../models/maintenanceRecord");
const MaintenanceEvent = require("../models/maintenanceEvent");
const InspectionChecklistItem = require("../models/inspectionChecklistItem");
const Conversation = require("../models/conversation");
const HomeownerAgentInquiry = require("../models/homeownerAgentInquiry");
const Professional = require("../models/professional");
const Communication = require("../models/communication");
const Notification = require("../models/notification");
const { syncMaintenanceRecordDocuments } = require("./maintenanceRecordDocumentsService");
const { onSystemCreated } = require("./systemRecommendationGenerator");
const {
  DEMO_AGENT_PERSONA,
  SYSTEM_KEYS,
  ACCOUNT_CONTACTS,
  DEMO_CONTRACTORS,
  DEMO_BROADCAST_COMMUNICATIONS,
  getIdentityFixtureForIndex,
  getSystemFixturesForProperty,
  getMaintenanceRecordsForProperty,
  getConversationThread,
  getScenarioForRole,
  getInspectionFixtureForIndex,
} = require("../data/demoAccountScenarios");
const {
  getAgentCalendarEventsForProperty,
  HPS_BY_INDEX,
  VIEW_COUNTS_BY_INDEX,
} = require("../data/demoProvisioningFixtures");

const INTERNAL_PASSWORD = "demo-internal-not-for-login";

let cachedInternalPasswordHash = null;

async function getCachedInternalPasswordHash() {
  if (!cachedInternalPasswordHash) {
    cachedInternalPasswordHash = await bcrypt.hash(INTERNAL_PASSWORD, BCRYPT_WORK_FACTOR);
  }
  return cachedInternalPasswordHash;
}

/** Register @demo.internal users with a shared precomputed password hash (no bcrypt per provision). */
async function registerInternalUserDirect({ email, name, phone, role, avatarUrl }) {
  const existing = await User.get(email).catch(() => null);
  if (existing?.id) return existing;

  const hashedPassword = await getCachedInternalPasswordHash();
  const result = await db.query(
    `INSERT INTO users
       (email, password_hash, name, phone, role, contact_id, is_active, role_locked,
        auth_provider, email_verified, onboarding_completed)
     VALUES ($1, $2, $3, $4, $5, 0, true, true, 'local', true, true)
     RETURNING id, email, name, phone, role, contact_id AS "contact", is_active`,
    [email, hashedPassword, name, phone || null, role]
  );
  const user = result.rows[0];
  if (avatarUrl) {
    await db.query(
      `UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1`,
      [user.id, avatarUrl]
    );
  }
  return user;
}

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

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
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
  const user = await registerInternalUserDirect({ email, name, phone, role, avatarUrl });
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

async function createSyntheticHomeowner({ name, email, phone, avatarUrl }) {
  const existing = await User.get(email).catch(() => null);
  if (existing?.id) {
    const accountRes = await db.query(
      `SELECT a.id, a.url, a.name
       FROM accounts a
       JOIN account_users au ON au.account_id = a.id
       WHERE au.user_id = $1 AND au.role = 'owner'
       ORDER BY a.id
       LIMIT 1`,
      [existing.id]
    );
    const accountRow = accountRes.rows[0];
    if (accountRow) {
      return {
        user: await User.getById(existing.id),
        account: { id: accountRow.id, url: accountRow.url, name: accountRow.name },
      };
    }
  }

  const user = await registerInternalUserDirect({
    email,
    name,
    phone,
    role: "homeowner",
    avatarUrl,
  });

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

async function createPropertyOnAccount({ accountId, template, syntheticHomeowner }) {
  const { address, main_photo, index } = template;
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

  if (index != null) {
    const identityFixture = getIdentityFixtureForIndex(index, syntheticHomeowner);
    if (identityFixture) {
      await Property.updateProperty(property.id, identityFixture);
    }
  }

  return property;
}

async function seedSystems(propertyId, propertyIndex) {
  const systemFixtures = getSystemFixturesForProperty(propertyIndex ?? 2, daysFromNow);
  const values = [];
  const placeholders = [];
  let idx = 1;

  for (const system_key of SYSTEM_KEYS) {
    const fixture = systemFixtures[system_key];
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, $${idx++})`);
    values.push(
      propertyId,
      system_key,
      JSON.stringify(fixture?.data ?? {}),
      fixture?.next_service_date ?? daysFromNow(90),
      true
    );
  }

  await db.query(
    `INSERT INTO property_systems (property_id, system_key, data, next_service_date, included)
     VALUES ${placeholders.join(", ")}`,
    values
  );

  await Promise.all(
    SYSTEM_KEYS.map((system_key) =>
      onSystemCreated(propertyId, system_key, { included: true })
    )
  );
}

async function seedInspectionAnalysis(propertyId, userId, propertyIndex) {
  const fixture = getInspectionFixtureForIndex(propertyIndex ?? 2);
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
      fixture.condition_rating,
      fixture.condition_confidence,
      fixture.condition_rationale,
      JSON.stringify(fixture.needs_attention),
      JSON.stringify(fixture.maintenance_suggestions),
      fixture.summary,
    ]
  );

  const analysisResult = resultRes.rows[0];
  const items = await InspectionChecklistItem.generateFromAnalysis(analysisResult);

  const statuses = ["completed", "in_progress", "pending", "pending"];
  const updatePromises = [];
  for (let i = 0; i < items.length; i++) {
    const status = statuses[i % statuses.length];
    if (status !== "pending") {
      updatePromises.push(
        InspectionChecklistItem.update(items[i].id, {
          status,
          ...(status === "completed"
            ? { completed_at: new Date().toISOString(), completed_by: userId }
            : {}),
        })
      );
    }
  }
  await Promise.all(updatePromises);

  return { jobId, analysisResultId: analysisResult.id, itemCount: items.length };
}

async function seedMaintenanceRecords(propertyId, propertyIndex, focus, createdByUserId) {
  const records = getMaintenanceRecordsForProperty(
    propertyIndex ?? 2,
    propertyId,
    focus,
    daysAgo,
    daysFromNow
  );
  const created = await MaintenanceRecord.createMany(records);

  const user = { id: createdByUserId };
  for (const record of created) {
    let data = record.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        data = {};
      }
    }
    const files = data?.files;
    if (Array.isArray(files) && files.length > 0) {
      await syncMaintenanceRecordDocuments({ ...record, data }, { analyzeUser: user });
    }
  }
}

async function seedMaintenanceEvents(propertyId, createdByUserId, focus) {
  const events = [
    {
      property_id: propertyId,
      system_key: "heating",
      system_name: "Heating",
      scheduled_date: daysAgo(45),
      status: "completed",
      event_type: "maintenance",
      created_by: createdByUserId,
    },
    {
      property_id: propertyId,
      system_key: "plumbing",
      system_name: "Plumbing",
      scheduled_date: daysFromNow(21),
      status: "scheduled",
      event_type: "maintenance",
      created_by: createdByUserId,
    },
  ];

  if (focus === "maintenance" || focus === "balanced") {
    events.push({
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

  await Promise.all(events.map((event) => MaintenanceEvent.create(event)));
}

async function seedAccountContacts(accountId) {
  if (ACCOUNT_CONTACTS.length === 0) return [];

  const contactValues = [];
  const contactPlaceholders = [];
  let idx = 1;

  for (const c of ACCOUNT_CONTACTS) {
    contactPlaceholders.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
    );
    contactValues.push(
      c.name,
      null,
      1,
      c.phone,
      c.email,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      c.company,
      c.role || "Contractor"
    );
  }

  const contactRes = await db.query(
    `INSERT INTO contacts
       (name, image, type, phone, email, website, street1, street2, city, state, zip_code, country, country_code, notes, role)
     VALUES ${contactPlaceholders.join(", ")}
     RETURNING id`,
    contactValues
  );

  const linkValues = [];
  const linkPlaceholders = [];
  idx = 1;
  for (const row of contactRes.rows) {
    linkPlaceholders.push(`($${idx++}, $${idx++}, $${idx++})`);
    linkValues.push(row.id, accountId, null);
  }

  await db.query(
    `INSERT INTO account_contacts (contact_id, account_id, added_by_user_id)
     VALUES ${linkPlaceholders.join(", ")}`,
    linkValues
  );

  return contactRes.rows;
}

async function seedContractors(accountId, userId) {
  const professionals = await Promise.all(
    DEMO_CONTRACTORS.map((row) =>
      Professional.create({
        ...row,
        account_id: accountId,
        is_verified: true,
      })
    )
  );

  if (professionals.length > 0) {
    const values = [];
    const placeholders = [];
    let idx = 1;
    for (const pro of professionals) {
      placeholders.push(`($${idx++}, $${idx++})`);
      values.push(userId, pro.id);
    }
    await db.query(
      `INSERT INTO saved_professionals (user_id, professional_id)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT DO NOTHING`,
      values
    );
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

  const existingMsgs = await db.query(
    `SELECT id FROM conversation_messages WHERE conversation_id = $1 LIMIT 1`,
    [conv.id]
  );
  if (existingMsgs.rows.length > 0) {
    return { conversationId: conv.id, messageCount: 0, skipped: true };
  }

  const thread = getConversationThread(focus);
  const messageDefs = thread.messages.map((m) => ({
    senderUserId: m.sender === "agent" ? agentUserId : homeownerUserId,
    kind: m.kind,
    payload: m.payload,
    daysAgo: m.daysAgo ?? 0,
  }));

  const msgValues = [];
  const msgPlaceholders = [];
  let idx = 1;
  let msgIdx = 0;
  for (const m of messageDefs) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - m.daysAgo);
    createdAt.setHours(createdAt.getHours() - msgIdx++);
    msgPlaceholders.push(
      `($${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}::timestamptz)`
    );
    msgValues.push(conv.id, m.senderUserId, m.kind, JSON.stringify(m.payload), createdAt.toISOString());
  }

  await db.query(
    `INSERT INTO conversation_messages (conversation_id, sender_user_id, kind, payload, created_at)
     VALUES ${msgPlaceholders.join(", ")}`,
    msgValues
  );
  await Conversation.updateLastMessageAt(conv.id);

  const inquiryPromises = (thread.inquiries || []).map((inq) =>
    HomeownerAgentInquiry.create({
      accountId,
      propertyId,
      senderUserId: homeownerUserId,
      agentUserId,
      kind: inq.kind,
      payload: inq.payload,
    })
  );
  await Promise.all(inquiryPromises);

  return { conversationId: conv.id, messageCount: messageDefs.length };
}

/**
 * Backfill demo conversations for an agent whose client properties may be missing message threads.
 * Safe to run multiple times (skips conversations that already have messages).
 */
async function backfillAgentDemoConversations(agentUserId) {
  if (!isDemoEnvironment()) {
    throw new BadRequestError("Demo conversation backfill is only available on the demo site.");
  }

  const propsRes = await db.query(
    `SELECT p.id AS "propertyId", p.account_id AS "accountId",
            owner_pu.user_id AS "homeownerUserId"
     FROM properties p
     JOIN property_users agent_pu
       ON agent_pu.property_id = p.id AND agent_pu.user_id = $1 AND agent_pu.role = 'editor'
     JOIN property_users owner_pu
       ON owner_pu.property_id = p.id AND owner_pu.role = 'owner'
     ORDER BY p.id`,
    [agentUserId]
  );

  const focusByOwner = {
    "Noel Jones": "inspections",
    "Tatum Walker": "maintenance",
    "Alex Jackson": "messages",
  };
  const results = [];

  for (const row of propsRes.rows) {
    const ownerRes = await db.query(
      `SELECT owner_name FROM properties WHERE id = $1`,
      [row.propertyId]
    );
    const ownerName = ownerRes.rows[0]?.owner_name;
    const focus = focusByOwner[ownerName] || "balanced";

    const result = await seedConversation({
      accountId: row.accountId,
      propertyId: row.propertyId,
      homeownerUserId: row.homeownerUserId,
      agentUserId,
      focus,
    });
    results.push({ propertyId: row.propertyId, ...result });
  }

  return { agentUserId, properties: results.length, results };
}

async function seedBroadcastCommunications({ accountId, agentUserId, homeownerUserIds }) {
  if (!homeownerUserIds.length) return [];

  const created = [];
  for (const template of DEMO_BROADCAST_COMMUNICATIONS) {
    const comm = await Communication.create({
      account_id: accountId,
      subject: template.subject,
      content: template.content,
      recipient_mode: "selected_homeowners",
      recipient_ids: homeownerUserIds,
      status: "draft",
      created_by: agentUserId,
    });

    await Communication.update(comm.id, {
      status: "sent",
      sent_at: isoDaysAgo(template.sentDaysAgo),
      recipient_count: homeownerUserIds.length,
    });

    for (const uid of homeownerUserIds) {
      await db.query(
        `INSERT INTO comm_recipients (communication_id, user_id, channel, status, delivered_at)
         VALUES ($1, $2, 'in_app', 'delivered', NOW())`,
        [comm.id, uid]
      );
    }

    await Notification.createForUsers(homeownerUserIds, {
      type: "communication_sent",
      communicationId: comm.id,
      title: `New: ${template.subject}`,
    });

    created.push(comm);
  }
  return created;
}

async function seedAgentCalendarEvents({ propertyId, propertyIndex, ownerName, agentUserId }) {
  const events = getAgentCalendarEventsForProperty(
    propertyIndex,
    propertyId,
    ownerName,
    daysAgo,
    daysFromNow
  );
  if (!events.length) return [];

  await Promise.all(
    events.map((event) =>
      MaintenanceEvent.create({
        ...event,
        created_by: agentUserId,
      })
    )
  );
  return events;
}

async function seedPropertyHealthScore(propertyId, propertyIndex) {
  const score = HPS_BY_INDEX[propertyIndex];
  if (score == null) return null;
  await db.query(`UPDATE properties SET hps_score = $1, updated_at = NOW() WHERE id = $2`, [
    score,
    propertyId,
  ]);
  return score;
}

async function seedPropertyEngagement({
  propertyUid,
  propertyIndex,
  homeownerUserId,
  agentUserId,
  accountUrl,
}) {
  const homeownerViews = VIEW_COUNTS_BY_INDEX[propertyIndex] ?? 6;
  const agentViews = Math.max(2, Math.floor(homeownerViews / 3));
  const path = accountUrl ? `/${accountUrl}/properties/${propertyUid}` : `/properties/${propertyUid}`;
  const eventData = { propertyId: propertyUid, path };

  const inserts = [];
  for (let i = 0; i < homeownerViews; i++) {
    inserts.push([homeownerUserId, JSON.stringify(eventData), i % 6]);
  }
  for (let i = 0; i < agentViews; i++) {
    inserts.push([agentUserId, JSON.stringify(eventData), (i + 2) % 6]);
  }

  if (!inserts.length) return 0;

  const placeholders = [];
  const values = [];
  let idx = 1;
  for (const [userId, data, dayOffset] of inserts) {
    placeholders.push(
      `($${idx++}, 'page_view', $${idx++}::jsonb, NOW() - ($${idx++} || ' days')::interval)`
    );
    values.push(userId, data, String(dayOffset));
  }

  await db.query(
    `INSERT INTO platform_engagement_events (user_id, event_type, event_data, created_at)
     VALUES ${placeholders.join(", ")}`,
    values
  );
  return inserts.length;
}

async function seedPropertyPortfolio({
  template,
  propertyAccountId,
  ownerUserId,
  agentUserId,
  createdByUserId,
  focus = "balanced",
  syntheticHomeowner,
  accountUrl,
}) {
  const property = await createPropertyOnAccount({
    accountId: propertyAccountId,
    template,
    syntheticHomeowner,
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

  await seedSystems(property.id, template.index);

  let inspection = null;
  if (focus === "inspections" || focus === "balanced") {
    inspection = await seedInspectionAnalysis(property.id, createdByUserId, template.index);
  } else {
    await InspectionChecklistItem.createUserItem({
      propertyId: property.id,
      systemKey: "roof",
      title: "Review annual maintenance checklist",
      description: "Demo action item for property overview.",
      priority: "medium",
    });
  }

  await seedMaintenanceRecords(property.id, template.index, focus, createdByUserId);
  await seedMaintenanceEvents(property.id, createdByUserId, focus);
  await seedAgentCalendarEvents({
    propertyId: property.id,
    propertyIndex: template.index,
    ownerName: syntheticHomeowner?.name || template.homeowner?.name,
    agentUserId,
  });
  await seedPropertyHealthScore(property.id, template.index);
  await seedPropertyEngagement({
    propertyUid: property.property_uid,
    propertyIndex: template.index,
    homeownerUserId: ownerUserId,
    agentUserId,
    accountUrl,
  });

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
    propertyIndex: template.index,
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

    await seedAccountContacts(account.id);
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
        accountUrl: account.url,
      });
      propertySummaries.push(summary);
    } else {
      const homeownerUserIds = [];
      const summaries = await Promise.all(
        scenario.properties.map(async (template) => {
          const synthetic = await createSyntheticHomeowner({
            name: template.syntheticHomeowner.name,
            email: template.syntheticHomeowner.email,
            phone: template.syntheticHomeowner.phone,
            avatarUrl: template.syntheticHomeowner.avatar_url,
          });

          homeownerUserIds.push(synthetic.user.id);

          await Account.addUserToAccount({
            userId,
            accountId: synthetic.account.id,
            role: "member",
          });

          return seedPropertyPortfolio({
            template,
            propertyAccountId: synthetic.account.id,
            ownerUserId: synthetic.user.id,
            agentUserId: userId,
            createdByUserId: userId,
            focus: template.focus || "balanced",
            syntheticHomeowner: template.syntheticHomeowner,
            accountUrl: synthetic.account.url,
          });
        })
      );
      propertySummaries.push(...summaries);

      await seedBroadcastCommunications({
        accountId: account.id,
        agentUserId: userId,
        homeownerUserIds,
      });
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
  backfillAgentDemoConversations,
};
