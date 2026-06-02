"use strict";

const db = require("../db");
const Agency = require("../models/agency");
const Office = require("../models/office");
const Team = require("../models/team");
const AgentAffiliation = require("../models/agentAffiliation");
const AffiliationRequest = require("../models/affiliationRequest");
const Notification = require("../models/notification");
const User = require("../models/user");

async function getAgentAffiliationStatus(userId) {
  const [affiliation, pendingRequest] = await Promise.all([
    AgentAffiliation.getActiveForUser(userId),
    AffiliationRequest.getPendingForUser(userId),
  ]);

  let status = "independent";
  if (pendingRequest) {
    status = "pending_request";
  } else if (affiliation) {
    status = "affiliated";
  }

  return { status, affiliation, pendingRequest };
}

async function skipAffiliationOnboarding(userId) {
  await db.query(
    `UPDATE users SET affiliation_onboarding_skipped = true, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
  return { skipped: true };
}

async function approveRequest(requestId, reviewerId) {
  const request = await AffiliationRequest.getById(requestId);
  if (request.status !== "pending") {
    throw new Error("Request is not pending");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    let agencyId = request.agencyId;
    let officeId = request.officeId;
    let teamId = null;
    let resolvedEntityId = null;

    if (request.requestType === "agency") {
      let agency = await Agency.findApprovedByName(request.requestedName, client);
      if (!agency) {
        agency = await Agency.createApproved(
          {
            name: request.requestedName,
            website: request.website,
            city: request.city,
            state: request.state,
            logoUrl: request.logoUrl,
          },
          client
        );
      }
      agencyId = agency.id;
      resolvedEntityId = agency.id;

      const officeName =
        String(request.mainOfficeName || "").trim() ||
        `${request.requestedName} — Main Office`;
      const defaultOffice = await Office.createApproved(
        {
          agencyId,
          name: officeName,
          city: request.city,
          state: request.state,
        },
        client
      );
      officeId = defaultOffice.id;

      const mainTeamName = String(request.mainTeamName || "").trim();
      if (mainTeamName) {
        let team = await Team.findApprovedByName(officeId, mainTeamName, client);
        if (!team) {
          team = await Team.createApproved({ officeId, name: mainTeamName }, client);
        }
        teamId = team.id;
      }
    } else if (request.requestType === "office") {
      if (!agencyId) throw new Error("agencyId required for office request");
      let office = await Office.findApprovedByName(agencyId, request.requestedName, client);
      if (!office) {
        office = await Office.createApproved(
          {
            agencyId,
            name: request.requestedName,
            addressLine1: request.addressLine1,
            city: request.city,
            state: request.state,
            phone: request.phone,
          },
          client
        );
      }
      officeId = office.id;
      resolvedEntityId = office.id;
    } else if (request.requestType === "team") {
      if (!officeId) throw new Error("officeId required for team request");
      let team = await Team.findApprovedByName(officeId, request.requestedName, client);
      if (!team) {
        team = await Team.createApproved({ officeId, name: request.requestedName }, client);
      }
      teamId = team.id;
      resolvedEntityId = team.id;
    }

    await AgentAffiliation.deactivateActive(request.requestedByUserId, client);
    await client.query(
      `INSERT INTO agent_affiliations (user_id, agency_id, office_id, team_id, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      [request.requestedByUserId, agencyId, officeId, teamId]
    );

    await AffiliationRequest.markReviewed(
      requestId,
      { status: "approved", reviewedByUserId: reviewerId, resolvedEntityId },
      client
    );

    await clearPendingRequestAdminNotifications(
      requestId,
      (text, params) => client.query(text, params)
    );

    const notif = await Notification.create(
      {
        userId: request.requestedByUserId,
        type: "affiliation_request_approved",
        title: `Your ${request.requestType} affiliation request was approved`,
        affiliationRequestId: requestId,
      },
      (text, params) => client.query(text, params)
    );

    await client.query("COMMIT");
    return { request: await AffiliationRequest.getById(requestId), notification: notif };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function rejectRequest(requestId, reviewerId) {
  const request = await AffiliationRequest.getById(requestId);
  if (request.status !== "pending") {
    throw new Error("Request is not pending");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await AffiliationRequest.markReviewed(
      requestId,
      { status: "rejected", reviewedByUserId: reviewerId, resolvedEntityId: null },
      client
    );
    await clearPendingRequestAdminNotifications(
      requestId,
      (text, params) => client.query(text, params)
    );
    const notif = await Notification.create(
      {
        userId: request.requestedByUserId,
        type: "affiliation_request_rejected",
        title: `Your ${request.requestType} affiliation request was not approved`,
        affiliationRequestId: requestId,
      },
      (text, params) => client.query(text, params)
    );
    await client.query("COMMIT");
    return { request: await AffiliationRequest.getById(requestId), notification: notif };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function ensureAgent(userId) {
  const user = await User.getById(userId);
  if (!user || user.role !== "agent") {
    const { ForbiddenError } = require("../expressError");
    throw new ForbiddenError("Only agents can manage affiliations");
  }
  return user;
}

async function getSuperAdminUserIds() {
  const r = await db.query(
    `SELECT id FROM users WHERE role = 'super_admin' AND is_active = true`
  );
  return r.rows.map((row) => row.id);
}

function buildPendingRequestTitle(request, agentName) {
  const typeLabel =
    request.requestType === "agency"
      ? "agency"
      : request.requestType === "office"
        ? "office"
        : "team";
  const name = String(agentName || "An agent").trim() || "An agent";
  const requested = String(request.requestedName || "").trim() || "Unnamed";
  return `${name} submitted a new ${typeLabel} affiliation request: ${requested}`;
}

async function notifySuperAdminsOfPendingRequest(request) {
  if (!request?.id) return;
  const adminIds = await getSuperAdminUserIds();
  if (!adminIds.length) return;

  const agentRes = await db.query(`SELECT name FROM users WHERE id = $1`, [
    request.requestedByUserId,
  ]);
  const title = buildPendingRequestTitle(request, agentRes.rows[0]?.name);

  for (const userId of adminIds) {
    await Notification.create({
      userId,
      type: "affiliation_request_pending",
      title,
      affiliationRequestId: request.id,
    });
  }
}

async function clearPendingRequestAdminNotifications(requestId, queryFn = null) {
  if (!requestId) return;
  const run = queryFn || ((text, params) => db.query(text, params));
  await run(
    `DELETE FROM notifications
     WHERE type = 'affiliation_request_pending' AND affiliation_request_id = $1`,
    [requestId]
  );
}

module.exports = {
  getAgentAffiliationStatus,
  skipAffiliationOnboarding,
  approveRequest,
  rejectRequest,
  ensureAgent,
  notifySuperAdminsOfPendingRequest,
};
