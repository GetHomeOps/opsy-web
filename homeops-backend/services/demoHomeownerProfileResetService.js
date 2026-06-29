"use strict";

/**
 * Reset demo homeowner profile activity while preserving account, login, role, and base property.
 * Used by hello-homeowner@heyopsy.com and provisioned paired homeowner accounts.
 */

const db = require("../db");
const { BadRequestError } = require("../expressError");

async function resetDemoHomeownerProfileByUserId(targetUserId) {
  const client = await db.connect();
  const audit = {};
  try {
    await client.query("BEGIN");

    const ownedPropertyRes = await client.query(
      `SELECT property_id
       FROM property_users
       WHERE user_id = $1 AND role = 'owner'`,
      [targetUserId]
    );
    const ownedPropertyIds = ownedPropertyRes.rows.map((r) => r.property_id);
    if (ownedPropertyIds.length === 0) {
      throw new BadRequestError("Demo user has no owned properties to reset.");
    }

    async function runUserDelete(label, table, whereSql) {
      const result = await client.query(
        `DELETE FROM ${table} WHERE ${whereSql}`,
        [targetUserId]
      );
      audit[label] = result.rowCount || 0;
    }

    async function runPropertyDelete(label, table, whereSql = "property_id = ANY($1::int[])") {
      const result = await client.query(
        `DELETE FROM ${table} WHERE ${whereSql}`,
        [ownedPropertyIds]
      );
      audit[label] = result.rowCount || 0;
    }

    await runPropertyDelete(
      "eventCalendarSyncsDeleted",
      "event_calendar_syncs",
      `maintenance_event_id IN (
         SELECT id FROM maintenance_events WHERE property_id = ANY($1::int[])
       )`
    );
    await runPropertyDelete("maintenanceEventsDeleted", "maintenance_events");
    await runPropertyDelete("contractorReportTokensDeleted", "contractor_report_tokens");
    await runPropertyDelete("documentChunksDeleted", "document_chunks");
    await runPropertyDelete("propertyDocumentsDeleted", "property_documents");
    await runPropertyDelete("stagedDocumentsDeleted", "staged_documents");
    await runPropertyDelete("inspectionChecklistItemsDeleted", "inspection_checklist_items");
    await runPropertyDelete("inspectionAnalysisResultsDeleted", "inspection_analysis_results");
    await runPropertyDelete("inspectionAnalysisJobsDeleted", "inspection_analysis_jobs");
    await runPropertyDelete("aiActionDraftsDeleted", "ai_action_drafts");
    await runPropertyDelete("aiConversationsDeleted", "ai_conversations");
    await runPropertyDelete("propertyAiReanalysisAuditDeleted", "property_ai_reanalysis_audit");
    await runPropertyDelete("propertyAiSummaryStateDeleted", "property_ai_summary_state");
    await runPropertyDelete("propertyAiProfilesDeleted", "property_ai_profiles");
    await runPropertyDelete("propertyMaintenanceDeleted", "property_maintenance");
    await runPropertyDelete("propertySystemsDeleted", "property_systems");
    await runPropertyDelete("attomLookupJobsDeleted", "attom_lookup_jobs");
    await runPropertyDelete("homeownerAgentInquiriesDeleted", "homeowner_agent_inquiries");
    await runPropertyDelete("conversationsDeleted", "conversations");
    await runPropertyDelete(
      "notificationsByPropertyDeleted",
      "notifications",
      "property_id = ANY($1::int[])"
    );

    await runUserDelete("savedProfessionalsDeleted", "saved_professionals", "user_id = $1");
    await runUserDelete("calendarIntegrationsDeleted", "calendar_integrations", "user_id = $1");
    await runUserDelete("platformEngagementEventsDeleted", "platform_engagement_events", "user_id = $1");
    await runUserDelete(
      "notificationsByUserDeleted",
      "notifications",
      "user_id = $1 AND property_id IS NULL"
    );

    const resetUserRes = await client.query(
      `UPDATE users
       SET image = NULL,
           avatar_url = NULL,
           welcome_modal_dismissed = false,
           updated_at = NOW()
       WHERE id = $1`,
      [targetUserId]
    );
    audit.userProfileReset = resetUserRes.rowCount || 0;

    await client.query("COMMIT");

    return { ownedPropertyIds, audit };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { resetDemoHomeownerProfileByUserId };
