"use strict";

const express = require("express");
const jsonschema = require("jsonschema");
const db = require("../db");
const { ensureLoggedIn, ensurePropertyAccess } = require("../middleware/auth");
const { BadRequestError, ForbiddenError } = require("../expressError");
const MaintenanceEvent = require("../models/maintenanceEvent");
const maintenanceEventNewSchema = require("../schemas/maintenanceEventNew.json");
const maintenanceEventUpdateSchema = require("../schemas/maintenanceEventUpdate.json");
const { onEventScheduled } = require("../services/resourceAutoSend");
const { getMaintenanceAdvice } = require("../services/maintenanceAdviceService");
const InspectionChecklistItem = require("../models/inspectionChecklistItem");
const { syncEventToCalendars, updateEventInCalendars, deleteEventFromCalendars } = require("../services/calendarSyncService");
const { sendScheduleNotificationEmail } = require("../services/emailService");
const { isPropertyUid } = require("../helpers/properties");

const router = express.Router();

/** POST /:propertyId/ai-advice - Get AI maintenance advice for a system. */
router.post(
  "/:propertyId/ai-advice",
  ensureLoggedIn,
  resolvePropertyIdForCreate,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const { propertyId } = req.params;
      const { systemType, systemName, systemContext, scheduleType } = req.body || {};
      if (!systemType || !systemName) {
        throw new BadRequestError("systemType and systemName are required");
      }
      const advice = await getMaintenanceAdvice({
        propertyId,
        systemType,
        systemName,
        systemContext: systemContext || {},
        scheduleType: scheduleType === "maintenance" || scheduleType === "inspection" ? scheduleType : null,
      });
      return res.json({ advice });
    } catch (err) {
      return next(err);
    }
  }
);

/** Resolve property_uid (8 digits) or numeric primary-key id to numeric id
 *  so maintenance_events.property_id (integer) works. */
async function resolvePropertyIdForCreate(req, res, next) {
  try {
    const raw = req.params.propertyId;
    if (!raw) return next();
    const rawStr = String(raw);
    if (isPropertyUid(rawStr)) {
      const propRes = await db.query(
        `SELECT id FROM properties WHERE property_uid = $1`,
        [rawStr],
      );
      if (propRes.rows.length === 0) throw new ForbiddenError("Property not found.");
      req.params.propertyId = propRes.rows[0].id;
      return next();
    }
    if (/^\d+$/.test(rawStr)) {
      req.params.propertyId = parseInt(rawStr, 10);
      return next();
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/** GET /calendar - List maintenance & inspection events for current user in date range. */
router.get(
  "/calendar",
  ensureLoggedIn,
  async function (req, res, next) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
      const { start, end } = req.query;
      if (!start || !end) {
        return res.status(400).json({ error: { message: "Query params start and end (YYYY-MM-DD) are required" } });
      }
      const events = await MaintenanceEvent.getCalendarEventsForUser(userId, start, end);
      return res.json({ events });
    } catch (err) {
      return next(err);
    }
  },
);

/** GET /upcoming - List upcoming maintenance & inspection events for current user. */
router.get(
  "/upcoming",
  ensureLoggedIn,
  async function (req, res, next) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
      const events = await MaintenanceEvent.getUpcomingForUser(userId);
      return res.json({ events });
    } catch (err) {
      return next(err);
    }
  },
);

/** GET /home-events - Unified events for homepage: reminders, scheduled work, next alert. */
router.get(
  "/home-events",
  ensureLoggedIn,
  async function (req, res, next) {
    try {
      const userId = res.locals.user?.id;
      if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
      const data = await MaintenanceEvent.getUnifiedEventsForUser(userId);
      return res.json(data);
    } catch (err) {
      return next(err);
    }
  },
);

async function loadPropertyIdFromEvent(req, res, next) {
  try {
    const event = await MaintenanceEvent.getById(req.params.id);
    req.params.propertyId = event.property_id;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** POST /:propertyId - Create a maintenance event. */
router.post(
  "/:propertyId",
  ensureLoggedIn,
  resolvePropertyIdForCreate,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const validator = jsonschema.validate(req.body, maintenanceEventNewSchema);
      if (!validator.valid) {
        const errs = validator.errors.map((e) => e.stack);
        throw new BadRequestError(errs);
      }
      const event = await MaintenanceEvent.create({
        ...req.body,
        property_id: req.params.propertyId,
        created_by: res.locals.user.id,
      });

      if (event.checklist_item_id) {
        InspectionChecklistItem.update(event.checklist_item_id, {
          status: "in_progress",
        }).catch((err) => console.error("[inspectionChecklist] Auto-update failed:", err.message));
      }

      const creatorRole = res.locals.user?.role;
      const roleForTrigger = creatorRole === "homeowner" ? "homeowner" : "agent";
      try {
        await onEventScheduled({
          eventId: event.id,
          propertyId: req.params.propertyId,
          createdByUserId: res.locals.user.id,
          creatorRole: roleForTrigger,
        });
      } catch (autoErr) {
        console.error("[resourceAutoSend] event scheduled:", autoErr.message);
      }

      let calendarSync = { synced: [], failed: [] };
      let propRow = null;
      try {
        const propRes = await db.query(
          `SELECT property_name, address, city, state FROM properties WHERE id = $1`,
          [req.params.propertyId]
        );
        propRow = propRes.rows[0];
        const propertyInfo = {
          propertyName: propRow?.property_name || "",
          address: [propRow?.address, propRow?.city, propRow?.state].filter(Boolean).join(", ") || "",
        };
        calendarSync = await syncEventToCalendars(res.locals.user.id, event, propertyInfo);
        if (calendarSync.failed.length > 0) {
          console.error("[calendarSync] create sync partial/failed:", JSON.stringify(calendarSync.failed));
        }
      } catch (calErr) {
        console.error("[calendarSync] create sync failed:", calErr.message);
        calendarSync = { synced: [], failed: [{ provider: "unknown", error: calErr.message }] };
      }

      const contractorEmail = req.body.contractor_email;
      const sendEmailNow = req.body.send_email_now === true;
      if (contractorEmail && sendEmailNow) {
        try {
          const userRes = await db.query(
            `SELECT name, email FROM users WHERE id = $1`,
            [res.locals.user.id]
          );
          const u = userRes.rows[0];
          const senderName = u?.name?.trim() || null;
          const replyTo = req.body.reply_email?.trim() || u?.email || res.locals.user?.email || null;
          const propertyAddress = propRow ? [propRow.address, propRow.city, propRow.state].filter(Boolean).join(", ") : null;

          const schedAccRes = await db.query(`SELECT account_id FROM properties WHERE id = $1`, [
            req.params.propertyId,
          ]);
          const scheduleAccountId = schedAccRes.rows[0]?.account_id;
          const scheduleUserId = res.locals.user?.id;

          await sendScheduleNotificationEmail({
            to: contractorEmail,
            contractorName: event.contractor_name,
            propertyAddress: propertyAddress || propRow?.property_name,
            systemName: event.system_name,
            scheduledDate: event.scheduled_date,
            scheduledTime: event.scheduled_time,
            messageBody: event.message_body,
            senderName,
            replyTo,
            usage:
              scheduleAccountId && scheduleUserId
                ? {
                    accountId: scheduleAccountId,
                    userId: scheduleUserId,
                    emailType: "schedule_notification",
                  }
                : undefined,
          });
        } catch (emailErr) {
          console.error("[emailService] Failed to send schedule notification:", emailErr.message);
        }
      }

      return res.status(201).json({ event, calendarSync });
    } catch (err) {
      return next(err);
    }
  },
);

/** GET /:propertyId - List maintenance events for a property. */
router.get(
  "/:propertyId",
  ensureLoggedIn,
  resolvePropertyIdForCreate,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const events = await MaintenanceEvent.getByPropertyId(req.params.propertyId);
      return res.json({ events });
    } catch (err) {
      return next(err);
    }
  },
);

/** PATCH /:id - Update a maintenance event. */
router.patch(
  "/:id",
  ensureLoggedIn,
  loadPropertyIdFromEvent,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const validator = jsonschema.validate(req.body, maintenanceEventUpdateSchema);
      if (!validator.valid) {
        const errs = validator.errors.map((e) => e.stack);
        throw new BadRequestError(errs);
      }
      const event = await MaintenanceEvent.update(req.params.id, req.body);
      try {
        const propRes = await db.query(
          `SELECT p.property_name, p.address, p.city, p.state
           FROM properties p JOIN maintenance_events me ON me.property_id = p.id
           WHERE me.id = $1`,
          [req.params.id]
        );
        const p = propRes.rows[0];
        const propertyInfo = {
          propertyName: p?.property_name || "",
          address: [p?.address, p?.city, p?.state].filter(Boolean).join(", ") || "",
        };
        const userId = event.created_by || res.locals.user.id;
        await updateEventInCalendars(userId, event, propertyInfo);
      } catch (calErr) {
        console.error("[calendarSync] update sync failed:", calErr.message);
      }
      return res.json({ event });
    } catch (err) {
      return next(err);
    }
  },
);

/** DELETE /:id - Delete a maintenance event. */
router.delete(
  "/:id",
  ensureLoggedIn,
  loadPropertyIdFromEvent,
  ensurePropertyAccess({ param: "propertyId" }),
  async function (req, res, next) {
    try {
      const event = await MaintenanceEvent.getById(req.params.id);
      const userId = event.created_by || res.locals.user.id;
      try {
        await deleteEventFromCalendars(userId, req.params.id);
      } catch (calErr) {
        console.error("[calendarSync] delete sync failed:", calErr.message);
      }
      await MaintenanceEvent.delete(req.params.id);
      return res.json({ deleted: req.params.id });
    } catch (err) {
      return next(err);
    }
  },
);

module.exports = router;
