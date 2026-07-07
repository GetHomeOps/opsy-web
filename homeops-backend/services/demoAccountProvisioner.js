"use strict";

/**
 * Runtime demo account provisioning for demo.heyopsy.com.
 * Creates login-ready paid accounts with sample portfolio data.
 */

const db = require("../db");
const bcrypt = require("bcrypt");
const { BadRequestError } = require("../expressError");
const { BCRYPT_WORK_FACTOR } = require("../config");
const { isDemoEnvironment, getDefaultDemoAccountExpiryAt } = require("../helpers/demoEnvironment");
const { generatePassportId } = require("../helpers/properties");
const Account = require("../models/account");
const Contact = require("../models/contact");
const User = require("../models/user");
const Property = require("../models/property");
const PropertyDocument = require("../models/propertyDocuments");
const MaintenanceRecord = require("../models/maintenanceRecord");
const MaintenanceEvent = require("../models/maintenanceEvent");
const InspectionChecklistItem = require("../models/inspectionChecklistItem");
const Conversation = require("../models/conversation");
const HomeownerAgentInquiry = require("../models/homeownerAgentInquiry");
const Communication = require("../models/communication");
const Notification = require("../models/notification");
const { syncMaintenanceRecordDocuments } = require("./maintenanceRecordDocumentsService");
const { onSystemCreated } = require("./systemRecommendationGenerator");
const {
  DEMO_AGENT_PERSONA,
  SYSTEM_KEYS,
  ACCOUNT_CONTACTS,
  DEMO_FAVORITE_PROFESSIONAL_HINTS,
  DEMO_BROADCAST_COMMUNICATIONS,
  getIdentityFixtureForIndex,
  getSystemFixturesForProperty,
  getMaintenanceRecordsForProperty,
  getConversationThread,
  getScenarioForRole,
  getInspectionFixtureForIndex,
  getInspectionReportFileForIndex,
  PAIRED_HOMEOWNER_PROPERTY_INDEX,
} = require("../data/demoAccountScenarios");
const {
  getAgentCalendarEventsForProperty,
  DEMO_EVENT_ACTION_ITEM_LINKS,
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

function buildSyntheticHomeownerEmail(agentUserId, personaKey) {
  return `${personaKey}.${agentUserId}@demo.heyopsy.com`;
}

async function setDemoExpiry(userId, expiresAt) {
  let resolved = expiresAt;
  if (!resolved) {
    const existing = await User.getById(userId);
    if (existing?.demoExpiresAt) {
      resolved = existing.demoExpiresAt instanceof Date
        ? existing.demoExpiresAt
        : new Date(existing.demoExpiresAt);
    } else {
      resolved = getDefaultDemoAccountExpiryAt();
    }
  }
  if (!(resolved instanceof Date)) {
    resolved = new Date(resolved);
  }
  await db.query(`UPDATE users SET demo_expires_at = $2, updated_at = NOW() WHERE id = $1`, [
    userId,
    resolved,
  ]);
  return resolved;
}

async function createSyntheticHomeowner({
  name,
  email,
  phone,
  avatarUrl,
  agentUserId,
  personaKey,
}) {
  const namespacedEmail =
    agentUserId && personaKey
      ? buildSyntheticHomeownerEmail(agentUserId, personaKey)
      : email;

  const existing = await User.get(namespacedEmail).catch(() => null);
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
    email: namespacedEmail,
    name,
    phone,
    role: "homeowner",
    avatarUrl,
  });

  const account = await Account.linkNewUserToAccount({ name, userId: user.id });
  const contact = await Contact.create({ name, email: namespacedEmail, phone });
  await Contact.addToAccount({ contactId: contact.id, accountId: account.id });
  await User.update({ id: user.id, contact: contact.id });

  return { user: await User.getById(user.id), account };
}

async function createLoginableSyntheticHomeowner({
  name,
  email,
  phone,
  avatarUrl,
  password,
  agentUserId,
  personaKey,
  demoExpiresAt,
  provisionedByUserId = null,
}) {
  const namespacedEmail = buildSyntheticHomeownerEmail(agentUserId, personaKey);
  const existing = await User.get(namespacedEmail).catch(() => null);
  if (existing?.id) {
    await User.updateLoginPassword({
      id: existing.id,
      password,
      demoLoginPassword: password,
    });
    await db.query(
      `UPDATE users SET demo_paired_agent_id = $2, updated_at = NOW() WHERE id = $1`,
      [existing.id, agentUserId]
    );
    const expiresAt = await setDemoExpiry(existing.id, demoExpiresAt);
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
    if (!accountRow) {
      throw new BadRequestError("Paired demo homeowner account not found.");
    }
    return {
      user: await User.getById(existing.id),
      account: { id: accountRow.id, url: accountRow.url, name: accountRow.name },
      demoLoginPassword: password,
      demoExpiresAt: expiresAt,
    };
  }

  const user = await User.register({
    name,
    email: namespacedEmail,
    password,
    phone,
    role: "homeowner",
    is_active: true,
    role_locked: true,
    demo_login_password: password,
    demo_provisioned_by_user_id: provisionedByUserId,
  });
  if (avatarUrl) {
    await db.query(`UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1`, [
      user.id,
      avatarUrl,
    ]);
  }
  await db.query(
    `UPDATE users
     SET demo_paired_agent_id = $2,
         email_verified = true,
         onboarding_completed = true,
         updated_at = NOW()
     WHERE id = $1`,
    [user.id, agentUserId]
  );
  const expiresAt = await setDemoExpiry(user.id, demoExpiresAt);

  const account = await Account.linkNewUserToAccount({ name, userId: user.id });
  const contact = await Contact.create({ name, email: namespacedEmail, phone });
  await Contact.addToAccount({ contactId: contact.id, accountId: account.id });
  await User.update({ id: user.id, contact: contact.id });
  await User.completeOnboarding(user.id, { role: "homeowner", subscriptionTier: "homeowner_maintain" });
  await provisionActivePaidPlan(account.id, "homeowner_maintain");

  return {
    user: await User.getById(user.id),
    account,
    demoLoginPassword: password,
    demoExpiresAt: expiresAt,
  };
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
  const index = propertyIndex ?? 2;
  const fixture = getInspectionFixtureForIndex(index);
  const reportFile = getInspectionReportFileForIndex(index);
  const jobRes = await db.query(
    `INSERT INTO inspection_analysis_jobs
       (property_id, user_id, s3_key, file_name, mime_type, status)
     VALUES ($1, $2, $3, $4, 'application/pdf', 'completed')
     RETURNING id`,
    [propertyId, userId, reportFile.s3Key, reportFile.fileName]
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

  const documentDate = daysAgo(45);
  const propertyDocument = await PropertyDocument.create({
    property_id: propertyId,
    document_name: reportFile.fileName,
    document_date: documentDate,
    document_key: reportFile.s3Key,
    document_type: "inspection",
    system_key: "inspectionReport",
  });

  return {
    jobId,
    analysisResultId: analysisResult.id,
    itemCount: items.length,
    propertyDocumentId: propertyDocument.id,
  };
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

function contactTypeToInt(type) {
  return type === "company" ? 2 : 1;
}

function normalizeContactEmail(email) {
  return email ? String(email).trim().toLowerCase() : "";
}

/** Map seed template row to DB column values. */
function contactSeedToRow(c) {
  return {
    name: c.name,
    image: null,
    type: contactTypeToInt(c.type),
    phone: c.phone || null,
    email: c.email || null,
    website: c.website || null,
    street1: null,
    street2: null,
    city: c.city || null,
    state: c.state || null,
    zip_code: null,
    country: null,
    country_code: null,
    notes: null,
    role: c.role || null,
  };
}

/**
 * Idempotent upsert of demo account contacts by email within an account.
 * Updates type/role/phone/address for existing linked contacts; inserts missing ones.
 */
async function upsertAccountContacts(accountId) {
  if (ACCOUNT_CONTACTS.length === 0) return { inserted: 0, updated: 0, skipped: 0 };

  const existingRes = await db.query(
    `SELECT c.id, LOWER(TRIM(c.email)) AS email_key
     FROM contacts c
     JOIN account_contacts ac ON ac.contact_id = c.id
     WHERE ac.account_id = $1
       AND c.email IS NOT NULL AND TRIM(c.email) != ''`,
    [accountId]
  );
  const existingByEmail = new Map(
    existingRes.rows.map((row) => [row.email_key, row.id])
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const seed of ACCOUNT_CONTACTS) {
    const row = contactSeedToRow(seed);
    const emailKey = normalizeContactEmail(row.email);

    if (!emailKey) {
      skipped += 1;
      continue;
    }

    const existingId = existingByEmail.get(emailKey);
    if (existingId) {
      await db.query(
        `UPDATE contacts
         SET name = $2,
             type = $3,
             phone = $4,
             email = $5,
             website = $6,
             city = $7,
             state = $8,
             notes = $9,
             role = $10,
             updated_at = NOW()
         WHERE id = $1`,
        [
          existingId,
          row.name,
          row.type,
          row.phone,
          row.email,
          row.website,
          row.city,
          row.state,
          row.notes,
          row.role,
        ]
      );
      updated += 1;
      continue;
    }

    const contactRes = await db.query(
      `INSERT INTO contacts
         (name, image, type, phone, email, website, street1, street2, city, state, zip_code, country, country_code, notes, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id`,
      [
        row.name,
        row.image,
        row.type,
        row.phone,
        row.email,
        row.website,
        row.street1,
        row.street2,
        row.city,
        row.state,
        row.zip_code,
        row.country,
        row.country_code,
        row.notes,
        row.role,
      ]
    );

    const contactId = contactRes.rows[0].id;
    await db.query(
      `INSERT INTO account_contacts (contact_id, account_id, added_by_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [contactId, accountId, null]
    );
    existingByEmail.set(emailKey, contactId);
    inserted += 1;
  }

  return { inserted, updated, skipped };
}

async function seedAccountContacts(accountId) {
  const result = await upsertAccountContacts(accountId);
  return result;
}

async function seedFavoriteDirectoryProfessionals(userId) {
  const hints = DEMO_FAVORITE_PROFESSIONAL_HINTS;
  const limit = 4;

  let result = await db.query(
    `SELECT id FROM professionals
     WHERE is_active = true
       AND profile_photo IS NOT NULL
       AND account_id IS NULL
     ORDER BY
       CASE WHEN company_name = ANY($1::text[]) THEN 0 ELSE 1 END,
       id
     LIMIT $2`,
    [hints, limit]
  );

  if (result.rows.length < limit) {
    result = await db.query(
      `SELECT id FROM professionals
       WHERE is_active = true
         AND profile_photo IS NOT NULL
         AND (email IS NULL OR email NOT LIKE '%.demo')
       ORDER BY
         CASE WHEN company_name = ANY($1::text[]) THEN 0 ELSE 1 END,
         id
       LIMIT $2`,
      [hints, limit]
    );
  }

  if (result.rows.length === 0) return [];

  const values = [];
  const placeholders = [];
  let idx = 1;
  for (const row of result.rows) {
    placeholders.push(`($${idx++}, $${idx++})`);
    values.push(userId, row.id);
  }
  await db.query(
    `INSERT INTO saved_professionals (user_id, professional_id)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT DO NOTHING`,
    values
  );

  return result.rows.map((row) => row.id);
}

async function linkDemoScheduledEventsToActionItems(propertyId) {
  const [eventsRes, itemsRes] = await Promise.all([
    db.query(
      `SELECT id, system_key, checklist_item_id, scheduled_date, status
       FROM maintenance_events
       WHERE property_id = $1
         AND system_key != 'agentCalendar'
         AND LOWER(status) IN ('scheduled', 'confirmed')
         AND checklist_item_id IS NULL
       ORDER BY scheduled_date ASC`,
      [propertyId]
    ),
    db.query(
      `SELECT id, system_key, title, status
       FROM inspection_checklist_items
       WHERE property_id = $1
       ORDER BY id ASC`,
      [propertyId]
    ),
  ]);

  const items = itemsRes.rows;
  const linkedItemIds = new Set();

  for (const event of eventsRes.rows) {
    const systemKey = event.system_key;
    const systemItems = items.filter(
      (item) => item.system_key === systemKey && !linkedItemIds.has(item.id)
    );
    if (!systemItems.length) continue;

    const linkRules = DEMO_EVENT_ACTION_ITEM_LINKS.filter(
      (rule) => rule.system_key === systemKey
    );

    let matched = null;
    for (const rule of linkRules) {
      matched = systemItems.find((item) =>
        String(item.title || "")
          .toLowerCase()
          .includes(rule.titleContains.toLowerCase())
      );
      if (matched) break;
    }

    if (!matched) {
      matched = systemItems.find(
        (item) => String(item.status || "").toLowerCase() !== "completed"
      );
    }
    if (!matched) matched = systemItems[0];

    await db.query(
      `UPDATE maintenance_events SET checklist_item_id = $1 WHERE id = $2`,
      [matched.id, event.id]
    );
    if (String(matched.status || "").toLowerCase() === "pending") {
      await InspectionChecklistItem.update(matched.id, { status: "in_progress" });
    }
    linkedItemIds.add(matched.id);
  }
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

  const inspection = await seedInspectionAnalysis(
    property.id,
    createdByUserId,
    template.index
  );

  await seedMaintenanceRecords(property.id, template.index, focus, createdByUserId);
  await seedMaintenanceEvents(property.id, createdByUserId, focus);
  await seedAgentCalendarEvents({
    propertyId: property.id,
    propertyIndex: template.index,
    ownerName: syntheticHomeowner?.name || template.homeowner?.name,
    agentUserId,
  });
  await linkDemoScheduledEventsToActionItems(property.id);
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
 * @param {{ userId: number, role: string, name: string, email: string, phone?: string, password?: string, includePairedHomeownerLogin?: boolean, demoExpiresAt?: Date|string, provisionedByUserId?: number }}
 */
async function provisionDemoAccount({
  userId,
  role,
  name,
  email,
  phone,
  password,
  includePairedHomeownerLogin = false,
  demoExpiresAt: demoExpiresAtInput,
  provisionedByUserId = null,
}) {
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
  let pairedHomeowner = null;
  const demoExpiresAt = await setDemoExpiry(userId, demoExpiresAtInput);

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
    await seedFavoriteDirectoryProfessionals(userId);

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
          const personaKey = template.syntheticHomeowner.personaKey;
          const isPairedLoginProperty =
            includePairedHomeownerLogin &&
            password &&
            template.index === PAIRED_HOMEOWNER_PROPERTY_INDEX;

          const synthetic = isPairedLoginProperty
            ? await createLoginableSyntheticHomeowner({
              name: template.syntheticHomeowner.name,
              email: template.syntheticHomeowner.email,
              phone: template.syntheticHomeowner.phone,
              avatarUrl: template.syntheticHomeowner.avatar_url,
              password,
              agentUserId: userId,
              personaKey,
              demoExpiresAt,
              provisionedByUserId,
            })
            : await createSyntheticHomeowner({
              name: template.syntheticHomeowner.name,
              email: template.syntheticHomeowner.email,
              phone: template.syntheticHomeowner.phone,
              avatarUrl: template.syntheticHomeowner.avatar_url,
              agentUserId: userId,
              personaKey,
            });

          homeownerUserIds.push(synthetic.user.id);

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
            syntheticHomeowner: template.syntheticHomeowner,
            accountUrl: synthetic.account.url,
          });

          if (isPairedLoginProperty) {
            pairedHomeowner = {
              userId: synthetic.user.id,
              email: synthetic.user.email,
              name: synthetic.user.name,
              demoLoginPassword: synthetic.demoLoginPassword || password,
              propertyUid: summary.propertyUid,
              accountUrl: synthetic.account.url,
              demoExpiresAt: synthetic.demoExpiresAt || demoExpiresAt,
            };
          }

          return summary;
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
      demoExpiresAt,
      pairedHomeowner,
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
  upsertAccountContacts,
  seedInspectionAnalysis,
};
