"use strict";

/**
 * Admin bulk agent onboarding: create properties for one agent, assign the agent
 * as owner, and invite/add homeowners — with a dry-run preview for matching.
 */

const db = require("../db");
const { BadRequestError, ForbiddenError, NotFoundError } = require("../expressError");
const Property = require("../models/property");
const User = require("../models/user");
const AttomLookupJob = require("../models/attomLookupJob");
const { enqueue: enqueueAttomLookup } = require("./attomLookupQueue");
const { generatePassportId } = require("../helpers/properties");
const { onPropertyCreated } = require("./resourceAutoSend");
const { syncPropertyMissingAgentAdminNotifications } = require("./propertyMissingAgentNotifications");
const { createPropertyInvitation } = require("./invitationService");
const {
  resolveUserPrimaryAccountId,
  transferPropertyOwnership,
} = require("./propertyOwnershipService");
const { assertAtMostOneAgentOnProperty } = require("./propertyAgentPolicy");

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const MAX_BATCH_ROWS = 200;

function normalizeAddressKey({ address, city, state, zip } = {}) {
  return [address, city, state, zip]
    .map((v) =>
      String(v ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
    )
    .join("|");
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return Boolean(email) && EMAIL_REGEX.test(email);
}

function normalizeHomeowners(rawHomeowners) {
  if (!Array.isArray(rawHomeowners)) return [];
  const seen = new Set();
  const list = [];
  for (const raw of rawHomeowners) {
    const email = String(raw?.email || "").trim();
    if (!email) continue;
    const emailLower = email.toLowerCase();
    if (seen.has(emailLower)) continue;
    seen.add(emailLower);
    list.push({
      name: String(raw?.name || "").trim(),
      email,
      phone: String(raw?.phone || "").trim(),
    });
  }
  return list;
}

function normalizeIncomingRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new BadRequestError("rows must be a non-empty array");
  }
  if (rows.length > MAX_BATCH_ROWS) {
    throw new BadRequestError(`Maximum ${MAX_BATCH_ROWS} properties per batch`);
  }

  return rows.map((row, index) => {
    const clientKey =
      row?.clientKey != null && String(row.clientKey).trim()
        ? String(row.clientKey).trim()
        : `row-${index}`;
    const address = String(row?.address || "").trim();
    const city = String(row?.city || "").trim();
    const state = String(row?.state || "").trim();
    const zip = String(row?.zip || "").trim();
    const propertyName = String(row?.property_name || row?.propertyName || "").trim();
    const homeowners = normalizeHomeowners(row?.homeowners);
    const forceCreate = row?.forceCreate === true;
    const selected = row?.selected !== false;

    return {
      clientKey,
      property_name: propertyName,
      address,
      city,
      state,
      zip,
      homeowners,
      forceCreate,
      selected,
      addressKey: normalizeAddressKey({ address, city, state, zip }),
    };
  });
}

async function resolveAgentContext(agentUserId) {
  const id = Number(agentUserId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError("agentUserId is required");
  }

  const agent = await User.getById(id);
  if (!agent) throw new NotFoundError(`No user with id: ${id}`);
  if (String(agent.role || "").toLowerCase() !== "agent") {
    throw new BadRequestError("Selected user must have the agent platform role");
  }

  const accountId = await resolveUserPrimaryAccountId(id);
  if (!accountId) {
    throw new BadRequestError("Selected agent does not have an account");
  }

  const accountRes = await db.query(
    `SELECT id, name, url, owner_user_id AS "ownerUserId"
     FROM accounts WHERE id = $1`,
    [accountId]
  );
  const account = accountRes.rows[0];
  if (!account) {
    throw new BadRequestError("Selected agent account could not be found");
  }

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      role: agent.role,
      isActive: agent.isActive === true || agent.is_active === true,
    },
    account,
  };
}

async function findExistingPropertiesByAddress(accountId, normalizedRows) {
  const keys = [
    ...new Set(normalizedRows.map((r) => r.addressKey).filter((k) => k && k !== "|||")),
  ];
  if (keys.length === 0) return new Map();

  const props = await db.query(
    `SELECT id, property_uid, property_name, address, city, state, zip
     FROM properties
     WHERE account_id = $1`,
    [accountId]
  );

  const byKey = new Map();
  for (const p of props.rows) {
    const key = normalizeAddressKey(p);
    if (!byKey.has(key)) byKey.set(key, p);
  }
  return byKey;
}

async function matchHomeowners(homeowners) {
  const results = [];
  for (const ho of homeowners) {
    if (!isValidEmail(ho.email)) {
      results.push({
        name: ho.name,
        email: ho.email,
        phone: ho.phone,
        match: "invalid_email",
        warnings: ["Invalid email address"],
        user: null,
      });
      continue;
    }

    const emailLower = ho.email.trim().toLowerCase();
    const existingRes = await db.query(
      `SELECT id, email, name, phone, role, is_active AS "isActive"
       FROM users WHERE LOWER(TRIM(email)) = $1
       LIMIT 1`,
      [emailLower]
    );
    const existing = existingRes.rows[0] || null;
    if (!existing) {
      results.push({
        name: ho.name,
        email: ho.email,
        phone: ho.phone,
        match: "new_invite",
        warnings: [],
        user: null,
      });
      continue;
    }

    const role = String(existing.role || "").toLowerCase();
    const warnings = [];
    if (role === "agent") {
      warnings.push("Existing user is an agent; cannot invite as homeowner");
    } else if (role === "admin" || role === "super_admin") {
      warnings.push("Existing user is a platform admin");
    }

    results.push({
      name: ho.name || existing.name || "",
      email: ho.email,
      phone: ho.phone || existing.phone || "",
      match: "existing_user",
      warnings,
      user: {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        role: existing.role,
        isActive: existing.isActive === true,
      },
    });
  }
  return results;
}

function validatePropertyFields(row) {
  const errors = [];
  if (!row.address) errors.push("Address is required");
  if (!row.city) errors.push("City is required");
  if (!row.state) errors.push("State is required");
  if (!row.zip) errors.push("Zip is required");
  if (!row.homeowners.length) errors.push("At least one homeowner email is required");
  return errors;
}

/**
 * Dry-run: validate rows, match existing properties/users. No writes.
 */
async function previewBulkOnboard({ agentUserId, rows }) {
  const { agent, account } = await resolveAgentContext(agentUserId);
  const normalized = normalizeIncomingRows(rows);
  const existingByKey = await findExistingPropertiesByAddress(account.id, normalized);

  const previewRows = [];
  for (const row of normalized) {
    const errors = validatePropertyFields(row);
    const homeowners = await matchHomeowners(row.homeowners);

    for (const ho of homeowners) {
      if (ho.match === "invalid_email") {
        errors.push(`Invalid email: ${ho.email || "(empty)"}`);
      }
      if (ho.warnings?.length) {
        errors.push(...ho.warnings.map((w) => `${ho.email}: ${w}`));
      }
    }

    const existing = existingByKey.get(row.addressKey) || null;
    const propertyMatch = existing
      ? {
          status: "existing",
          propertyId: existing.id,
          propertyUid: existing.property_uid,
          propertyName: existing.property_name,
        }
      : { status: "none" };

    const defaultAction =
      propertyMatch.status === "existing" && !row.forceCreate ? "skip" : "create";

    previewRows.push({
      clientKey: row.clientKey,
      selected: row.selected,
      forceCreate: row.forceCreate,
      property_name: row.property_name,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      homeowners,
      propertyMatch,
      defaultAction,
      errors,
      valid: errors.length === 0 || (propertyMatch.status === "existing" && defaultAction === "skip"),
    });
  }

  return {
    agent,
    account: {
      id: account.id,
      name: account.name,
      url: account.url,
    },
    rows: previewRows,
    summary: {
      total: previewRows.length,
      creatable: previewRows.filter(
        (r) =>
          r.selected !== false &&
          r.errors.filter((e) => !String(e).includes("Existing user is an agent")).length ===
            0 &&
          (r.propertyMatch.status === "none" || r.forceCreate)
      ).length,
      existing: previewRows.filter((r) => r.propertyMatch.status === "existing").length,
      withErrors: previewRows.filter((r) => r.errors.length > 0).length,
    },
  };
}

async function removeUserFromProperty(propertyId, userId) {
  await db.query(
    `DELETE FROM property_users WHERE property_id = $1 AND user_id = $2`,
    [propertyId, userId]
  );
}

async function executeOneRow({
  row,
  agent,
  accountId,
  adminUserId,
  enqueueAttom,
  sendHomeownerInvites,
}) {
  const errors = validatePropertyFields(row);
  const homeownerMatches = await matchHomeowners(row.homeowners);
  for (const ho of homeownerMatches) {
    if (ho.match === "invalid_email") {
      errors.push(`Invalid email: ${ho.email || "(empty)"}`);
    }
    if (ho.user && String(ho.user.role || "").toLowerCase() === "agent") {
      errors.push(`${ho.email}: Existing user is an agent; cannot invite as homeowner`);
    }
  }
  if (errors.length) {
    return {
      clientKey: row.clientKey,
      status: "failed",
      propertyId: null,
      propertyUid: null,
      invitations: [],
      homeowners: [],
      error: errors.join("; "),
    };
  }

  const existingByKey = await findExistingPropertiesByAddress(accountId, [row]);
  const existing = existingByKey.get(row.addressKey);
  if (existing && !row.forceCreate) {
    return {
      clientKey: row.clientKey,
      status: "skipped",
      propertyId: existing.id,
      propertyUid: existing.property_uid,
      invitations: [],
      homeowners: [],
      error: "Property already exists for this address on the agent account",
    };
  }

  const passport_id = generatePassportId({ state: row.state, zip: row.zip });
  const client = await db.connect();
  let property;
  try {
    await client.query("BEGIN");
    property = await Property.create(
      {
        address: row.address,
        city: row.city,
        state: row.state,
        zip: row.zip,
        property_name: row.property_name || null,
        passport_id,
        account_id: accountId,
      },
      { client }
    );
    await Property.addUserToProperty(
      {
        property_id: property.id,
        user_id: adminUserId,
        role: "owner",
      },
      { client }
    );
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }

  if (enqueueAttom) {
    try {
      const job = await AttomLookupJob.create({
        property_id: property.id,
        account_id: accountId,
        user_id: adminUserId || null,
        trigger: "bulk_import",
      });
      enqueueAttomLookup(job.id);
    } catch (attomErr) {
      console.error("[bulkOnboard] attom enqueue failed:", attomErr?.message);
    }
  }

  try {
    await onPropertyCreated({
      propertyId: property.id,
      accountId,
      createdByUserId: adminUserId,
      creatorRole: "agent",
      isFirstPropertyForUser: false,
    });
  } catch (autoErr) {
    console.error("[bulkOnboard] onPropertyCreated:", autoErr.message);
  }

  /* Attach agent as owner and remove the admin creator from the team. */
  try {
    await assertAtMostOneAgentOnProperty(property.id, [agent.id]);
    await Property.addUserToProperty({
      property_id: property.id,
      user_id: agent.id,
      role: "editor",
    });
    await transferPropertyOwnership({
      propertyId: property.id,
      fromUserId: adminUserId,
      toUserId: agent.id,
      reason: "bulk_onboard",
      sendNotifications: false,
    });
    await removeUserFromProperty(property.id, adminUserId);
  } catch (teamErr) {
    console.error("[bulkOnboard] agent ownership setup failed:", teamErr.message);
    return {
      clientKey: row.clientKey,
      status: "failed",
      propertyId: property.id,
      propertyUid: property.property_uid,
      invitations: [],
      homeowners: [],
      error: `Property created but agent assignment failed: ${teamErr.message}`,
    };
  }

  try {
    await syncPropertyMissingAgentAdminNotifications(property.id);
  } catch (missingAgentErr) {
    console.error("[bulkOnboard] missing agent sync:", missingAgentErr.message);
  }

  const invitations = [];
  const homeownerResults = [];

  for (const ho of homeownerMatches) {
    if (ho.match === "invalid_email") continue;
    if (ho.user && String(ho.user.role || "").toLowerCase() === "agent") {
      homeownerResults.push({
        email: ho.email,
        status: "failed",
        message: "Existing user is an agent",
      });
      continue;
    }

    try {
      if (ho.user?.isActive) {
        await Property.addUserToProperty({
          property_id: property.id,
          user_id: ho.user.id,
          role: "editor",
        });
        homeownerResults.push({
          email: ho.email,
          status: "added",
          userId: ho.user.id,
        });
      } else {
        /* Invite as the agent so homeowner accept can auto-transfer ownership. */
        const result = await createPropertyInvitation({
          inviterUserId: agent.id,
          inviteeEmail: ho.email,
          inviteeName: ho.name || null,
          accountId,
          propertyId: property.id,
          intendedRole: "editor",
          intendedPropertyRole: "homeowner",
          permissions: null,
          inviterUserRole: "agent",
          skipInviteEmail: !sendHomeownerInvites,
        });
        invitations.push({
          id: result.invitation?.id,
          email: ho.email,
        });
        homeownerResults.push({
          email: ho.email,
          status: "invited",
          invitationId: result.invitation?.id,
        });
      }
    } catch (inviteErr) {
      homeownerResults.push({
        email: ho.email,
        status: "failed",
        message: inviteErr.message || "Failed to add/invite homeowner",
      });
    }
  }

  const failedHomeowners = homeownerResults.filter((h) => h.status === "failed");
  return {
    clientKey: row.clientKey,
    status: failedHomeowners.length === homeownerResults.length && homeownerResults.length > 0
      ? "partial"
      : "created",
    propertyId: property.id,
    propertyUid: property.property_uid,
    invitations,
    homeowners: homeownerResults,
    error:
      failedHomeowners.length > 0
        ? failedHomeowners.map((h) => `${h.email}: ${h.message}`).join("; ")
        : null,
  };
}

/**
 * Execute bulk onboard for selected rows. Best-effort per row.
 */
async function executeBulkOnboard({
  agentUserId,
  rows,
  adminUserId,
  adminUserRole,
  options = {},
}) {
  if (adminUserRole !== "admin" && adminUserRole !== "super_admin") {
    throw new ForbiddenError("Only platform admins can run bulk onboarding");
  }
  if (!adminUserId) {
    throw new BadRequestError("Authenticated admin is required");
  }

  const { agent, account } = await resolveAgentContext(agentUserId);
  const normalized = normalizeIncomingRows(rows).filter((r) => r.selected !== false);

  if (normalized.length === 0) {
    throw new BadRequestError("No selected rows to process");
  }

  const enqueueAttom = options.enqueueAttomLookup !== false;
  const sendHomeownerInvites = options.sendHomeownerInvites === true;

  const results = [];
  for (const row of normalized) {
    try {
      const result = await executeOneRow({
        row,
        agent,
        accountId: account.id,
        adminUserId,
        enqueueAttom,
        sendHomeownerInvites,
      });
      results.push(result);
    } catch (err) {
      results.push({
        clientKey: row.clientKey,
        status: "failed",
        propertyId: null,
        propertyUid: null,
        invitations: [],
        homeowners: [],
        error: err.message || "Unexpected error",
      });
    }
  }

  const summary = {
    total: results.length,
    created: results.filter((r) => r.status === "created" || r.status === "partial").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    invitedHomeowners: results.reduce(
      (n, r) => n + (r.homeowners || []).filter((h) => h.status === "invited").length,
      0
    ),
    addedHomeowners: results.reduce(
      (n, r) => n + (r.homeowners || []).filter((h) => h.status === "added").length,
      0
    ),
  };

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      email: agent.email,
    },
    account: {
      id: account.id,
      name: account.name,
      url: account.url,
    },
    results,
    summary,
  };
}

module.exports = {
  MAX_BATCH_ROWS,
  normalizeAddressKey,
  previewBulkOnboard,
  executeBulkOnboard,
};
