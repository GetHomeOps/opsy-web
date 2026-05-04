"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

const COLUMNS = `
  id, property_id, system_key, system_name,
  contractor_id, contractor_source, contractor_name,
  scheduled_date, scheduled_time,
  recurrence_type, recurrence_interval_value, recurrence_interval_unit,
  recurrence_parent_id,
  alert_timing, alert_custom_days, email_reminder,
  message_enabled, message_body,
  status, event_type, timezone, checklist_item_id, created_by,
  created_at, updated_at`;

/** Map stored event_type to calendar API type (synthetic due-dates use inspection without a row). */
function calendarTypeFromEventType(eventType) {
  return eventType === "inspection" ? "inspection" : "maintenance";
}

/** Format a Date as YYYY-MM-DD using local components (avoids TZ shift). */
function formatYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Compute future occurrence dates for a recurring series. Caller's start date
 * is the parent; we return only the *additional* dates to insert as children.
 * Bounded by max occurrences and a horizon to keep the table reasonable.
 *
 * @returns {string[]} array of YYYY-MM-DD strings
 */
function computeOccurrenceDates(
  startDateStr,
  recurrenceType,
  intervalValue = null,
  intervalUnit = null,
  { maxOccurrences = 60, maxHorizonMonths = 60 } = {},
) {
  if (!recurrenceType || recurrenceType === "one-time") return [];
  if (!startDateStr) return [];

  // Anchor at noon local time so DST transitions don't roll the date.
  const start = new Date(`${String(startDateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const horizon = new Date(start);
  horizon.setMonth(horizon.getMonth() + maxHorizonMonths);

  const occurrences = [];
  const cursor = new Date(start);

  for (let i = 0; i < maxOccurrences; i++) {
    if (recurrenceType === "quarterly") {
      cursor.setMonth(cursor.getMonth() + 3);
    } else if (recurrenceType === "semi-annually") {
      cursor.setMonth(cursor.getMonth() + 6);
    } else if (recurrenceType === "annually") {
      cursor.setFullYear(cursor.getFullYear() + 1);
    } else if (recurrenceType === "custom") {
      const v = parseInt(intervalValue, 10);
      if (!Number.isFinite(v) || v < 1) break;
      if (intervalUnit === "days") cursor.setDate(cursor.getDate() + v);
      else if (intervalUnit === "weeks") cursor.setDate(cursor.getDate() + v * 7);
      else if (intervalUnit === "months") cursor.setMonth(cursor.getMonth() + v);
      else break;
    } else {
      break;
    }
    if (cursor > horizon) break;
    occurrences.push(formatYMD(cursor));
  }
  return occurrences;
}

class MaintenanceEvent {
  static computeOccurrenceDates = computeOccurrenceDates;

  /**
   * Insert a single row in maintenance_events. Used for the parent record and
   * each child occurrence in a recurring series.
   * @private
   */
  static async _insertRow(client, data) {
    const {
      property_id, system_key, system_name,
      contractor_id = null, contractor_source = null, contractor_name = null,
      scheduled_date, scheduled_time = null,
      recurrence_type = "one-time", recurrence_interval_value = null, recurrence_interval_unit = null,
      recurrence_parent_id = null,
      alert_timing = "3d", alert_custom_days = null, email_reminder = false,
      message_enabled = false, message_body = null,
      status = "scheduled", event_type = "maintenance", timezone = null, checklist_item_id = null, created_by = null,
    } = data;

    const result = await client.query(
      `INSERT INTO maintenance_events
         (property_id, system_key, system_name,
          contractor_id, contractor_source, contractor_name,
          scheduled_date, scheduled_time,
          recurrence_type, recurrence_interval_value, recurrence_interval_unit,
          recurrence_parent_id,
          alert_timing, alert_custom_days, email_reminder,
          message_enabled, message_body,
          status, event_type, timezone, checklist_item_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING ${COLUMNS}`,
      [
        property_id, system_key, system_name || null,
        contractor_id, contractor_source, contractor_name,
        scheduled_date, scheduled_time,
        recurrence_type, recurrence_interval_value, recurrence_interval_unit,
        recurrence_parent_id,
        alert_timing, alert_custom_days, email_reminder,
        message_enabled, message_body,
        status, event_type, timezone, checklist_item_id, created_by,
      ],
    );
    return result.rows[0];
  }

  /**
   * Create a maintenance event. When recurrence_type is not "one-time", also
   * inserts future child occurrences (linked via recurrence_parent_id) bounded
   * by sane defaults so the table stays small. Returns the parent event;
   * callers (auto-send, calendar sync, email notification) only act on it.
   */
  static async create(data) {
    const recurrenceType = data.recurrence_type || "one-time";
    const intervalValue = data.recurrence_interval_value ?? null;
    const intervalUnit = data.recurrence_interval_unit ?? null;

    if (recurrenceType === "one-time") {
      return MaintenanceEvent._insertRow(db, {
        ...data,
        recurrence_parent_id: null,
      });
    }

    const futureDates = computeOccurrenceDates(
      data.scheduled_date,
      recurrenceType,
      intervalValue,
      intervalUnit,
    );

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const parent = await MaintenanceEvent._insertRow(client, {
        ...data,
        recurrence_parent_id: null,
      });
      // Only mirror message/email-notification settings on the parent so the
      // contractor isn't notified about every occurrence in the series.
      for (const date of futureDates) {
        await MaintenanceEvent._insertRow(client, {
          ...data,
          scheduled_date: date,
          recurrence_parent_id: parent.id,
          message_enabled: false,
          message_body: null,
          // checklist_item_id stays null on children — only the first event ties
          // back to the originating to-do item.
          checklist_item_id: null,
        });
      }
      await client.query("COMMIT");
      return parent;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /** Get all events that share a recurrence series with the given event id.
   *  Returns rows ordered by scheduled_date ASC. Includes the master row.
   */
  static async getSeriesById(eventId) {
    const result = await db.query(
      `SELECT ${COLUMNS}
         FROM maintenance_events
        WHERE id = $1
           OR recurrence_parent_id = $1
           OR id = (SELECT recurrence_parent_id FROM maintenance_events WHERE id = $1)
           OR recurrence_parent_id = (SELECT recurrence_parent_id FROM maintenance_events WHERE id = $1 AND recurrence_parent_id IS NOT NULL)
        ORDER BY scheduled_date ASC, scheduled_time ASC NULLS LAST`,
      [eventId],
    );
    return result.rows;
  }

  static async getByPropertyId(propertyId) {
    const result = await db.query(
      `SELECT me.id, me.property_id, me.system_key, me.system_name,
         me.contractor_id, me.contractor_source, me.contractor_name,
         me.scheduled_date, me.scheduled_time,
         me.recurrence_type, me.recurrence_interval_value, me.recurrence_interval_unit,
         me.alert_timing, me.alert_custom_days, me.email_reminder,
         me.message_enabled, me.message_body,
         me.status, me.event_type, me.timezone, me.checklist_item_id, me.created_by,
         me.created_at, me.updated_at,
         ici.title AS checklist_item_title
       FROM maintenance_events me
       LEFT JOIN inspection_checklist_items ici ON me.checklist_item_id = ici.id
       WHERE me.property_id = $1
       ORDER BY me.scheduled_date ASC, me.scheduled_time ASC NULLS LAST`,
      [propertyId],
    );
    return result.rows.map((r) => {
      const { checklist_item_title, ...rest } = r;
      return { ...rest, checklist_item_title: checklist_item_title || null };
    });
  }

  static async getById(id) {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM maintenance_events WHERE id = $1`,
      [id],
    );
    const event = result.rows[0];
    if (!event) throw new NotFoundError(`No maintenance event: ${id}`);
    return event;
  }

  static async update(id, data) {
    const jsToSql = {
      property_id: "property_id",
      system_key: "system_key",
      system_name: "system_name",
      contractor_id: "contractor_id",
      contractor_source: "contractor_source",
      contractor_name: "contractor_name",
      scheduled_date: "scheduled_date",
      scheduled_time: "scheduled_time",
      recurrence_type: "recurrence_type",
      recurrence_interval_value: "recurrence_interval_value",
      recurrence_interval_unit: "recurrence_interval_unit",
      alert_timing: "alert_timing",
      alert_custom_days: "alert_custom_days",
      email_reminder: "email_reminder",
      message_enabled: "message_enabled",
      message_body: "message_body",
      status: "status",
      event_type: "event_type",
      timezone: "timezone",
    };

    const { setCols, values } = sqlForPartialUpdate(data, jsToSql);
    const idx = "$" + (values.length + 1);

    const result = await db.query(
      `UPDATE maintenance_events
       SET ${setCols}, updated_at = NOW()
       WHERE id = ${idx}
       RETURNING ${COLUMNS}`,
      [...values, id],
    );
    const event = result.rows[0];
    if (!event) throw new NotFoundError(`No maintenance event: ${id}`);
    return event;
  }

  /**
   * Delete a single occurrence. If the row being deleted is the master of a
   * recurring series, promote the earliest sibling to be the new master and
   * re-point the rest before deleting, so a single-row delete doesn't take
   * the whole series down via ON DELETE CASCADE.
   */
  static async delete(id) {
    const childRes = await db.query(
      `SELECT id FROM maintenance_events
         WHERE recurrence_parent_id = $1
         ORDER BY scheduled_date ASC, scheduled_time ASC NULLS LAST
         LIMIT 1`,
      [id],
    );
    if (childRes.rows.length > 0) {
      const newMasterId = childRes.rows[0].id;
      await db.query(
        `UPDATE maintenance_events SET recurrence_parent_id = NULL WHERE id = $1`,
        [newMasterId],
      );
      await db.query(
        `UPDATE maintenance_events SET recurrence_parent_id = $1
           WHERE recurrence_parent_id = $2 AND id <> $1`,
        [newMasterId, id],
      );
    }

    const result = await db.query(
      `DELETE FROM maintenance_events WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.rows[0]) throw new NotFoundError(`No maintenance event: ${id}`);
  }

  /**
   * Delete every occurrence in the same recurrence series as the given event.
   * Locates the master and deletes it; ON DELETE CASCADE removes the children.
   * If the event has no series, this is equivalent to {@link delete}.
   */
  static async deleteSeries(id) {
    const evtRes = await db.query(
      `SELECT id, recurrence_parent_id FROM maintenance_events WHERE id = $1`,
      [id],
    );
    if (!evtRes.rows[0]) throw new NotFoundError(`No maintenance event: ${id}`);
    const masterId = evtRes.rows[0].recurrence_parent_id ?? evtRes.rows[0].id;
    const result = await db.query(
      `DELETE FROM maintenance_events WHERE id = $1 RETURNING id`,
      [masterId],
    );
    if (!result.rows[0]) throw new NotFoundError(`No maintenance event: ${masterId}`);
    return masterId;
  }

  /** Get upcoming maintenance events for a user (across all their properties).
   * Returns events with scheduled_date >= today and status = 'scheduled'.
   * Also includes property_systems with next_service_date >= today as inspection reminders.
   */
  static async getUpcomingForUser(userId) {
    const today = new Date().toISOString().slice(0, 10);

    const [eventsResult, systemsResult] = await Promise.all([
      db.query(
        `SELECT me.id, me.property_id, me.system_key, me.system_name,
                me.scheduled_date, me.scheduled_time, me.status, me.event_type,
                p.property_uid, p.property_name, p.address, p.city, p.state
         FROM maintenance_events me
         JOIN properties p ON p.id = me.property_id
         JOIN property_users pu ON pu.property_id = me.property_id
         WHERE pu.user_id = $1
           AND me.scheduled_date >= $2
           AND me.status = 'scheduled'
         ORDER BY me.scheduled_date ASC, me.scheduled_time ASC NULLS LAST`,
        [userId, today],
      ),
      db.query(
        `SELECT ps.id, ps.property_id, ps.system_key, ps.next_service_date,
                p.property_uid, p.property_name, p.address, p.city, p.state
         FROM property_systems ps
         JOIN properties p ON p.id = ps.property_id
         JOIN property_users pu ON pu.property_id = ps.property_id
         WHERE pu.user_id = $1
           AND ps.next_service_date >= $2
           AND ps.next_service_date IS NOT NULL
         ORDER BY ps.next_service_date ASC`,
        [userId, today],
      ),
    ]);

    const SYSTEM_LABELS = {
      roof: "Roof",
      gutters: "Gutters",
      foundation: "Foundation",
      exterior: "Exterior",
      windows: "Windows",
      heating: "Heating",
      ac: "Air Conditioning",
      waterHeating: "Water Heating",
      electrical: "Electrical",
      plumbing: "Plumbing",
      safety: "Safety",
      inspections: "Inspections",
    };

    const toDateKey = (d) => {
      if (d == null) return "";
      const date = d instanceof Date ? d : new Date(d);
      return date.toISOString().slice(0, 10);
    };

    const maintenanceEvents = eventsResult.rows.map((r) => ({
      type: calendarTypeFromEventType(r.event_type),
      id: r.id,
      propertyId: r.property_id,
      propertyUid: r.property_uid,
      propertyName: r.property_name,
      address: [r.address, r.city, r.state].filter(Boolean).join(", "),
      systemKey: r.system_key,
      systemName: r.system_name || SYSTEM_LABELS[r.system_key] || r.system_key,
      scheduledDate: r.scheduled_date,
      scheduledTime: r.scheduled_time,
      status: r.status,
    }));

    const maintenanceKeys = new Set(
      maintenanceEvents.map((e) => `${e.propertyId}-${e.systemKey}-${toDateKey(e.scheduledDate)}`),
    );

    const inspectionEvents = systemsResult.rows
      .filter((r) => !maintenanceKeys.has(`${r.property_id}-${r.system_key}-${toDateKey(r.next_service_date)}`))
      .map((r) => ({
        type: "inspection",
        id: `system-${r.property_id}-${r.system_key}`,
        propertyId: r.property_id,
        propertyUid: r.property_uid,
        propertyName: r.property_name,
        address: [r.address, r.city, r.state].filter(Boolean).join(", "),
        systemKey: r.system_key,
        systemName: SYSTEM_LABELS[r.system_key] || r.system_key,
        scheduledDate: r.next_service_date,
        scheduledTime: null,
        status: "due",
      }));

    const combined = [...maintenanceEvents, ...inspectionEvents].sort(
      (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate),
    );

    return combined.slice(0, 20);
  }

  /** Get unified events for homepage: overdue + upcoming maintenance & inspections.
   * Returns events with: id, propertyId, systemType, title, category, status,
   * scheduledAt, dueAt, professionalId, professionalName, daysUntilDue, isOverdue.
   * - Reminders: overdue + upcoming (inspection/due, not yet booked)
   * - Scheduled work: maintenance events with status scheduled/confirmed
   */
  static async getUnifiedEventsForUser(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const pastCutoff = new Date();
    pastCutoff.setFullYear(pastCutoff.getFullYear() - 1);
    const pastDate = pastCutoff.toISOString().slice(0, 10);
    const futureCutoff = new Date();
    futureCutoff.setFullYear(futureCutoff.getFullYear() + 1);
    const futureDate = futureCutoff.toISOString().slice(0, 10);

    const [eventsResult, systemsResult] = await Promise.all([
      db.query(
        `SELECT me.id, me.property_id, me.system_key, me.system_name,
                me.contractor_id, me.contractor_name, me.scheduled_date, me.scheduled_time, me.status, me.event_type,
                p.property_uid, p.property_name, p.address, p.city, p.state
         FROM maintenance_events me
         JOIN properties p ON p.id = me.property_id
         JOIN property_users pu ON pu.property_id = me.property_id
         WHERE pu.user_id = $1
           AND me.scheduled_date >= $2
           AND me.scheduled_date <= $3
         ORDER BY me.scheduled_date ASC, me.scheduled_time ASC NULLS LAST`,
        [userId, pastDate, futureDate],
      ),
      db.query(
        `SELECT ps.id, ps.property_id, ps.system_key, ps.next_service_date,
                p.property_uid, p.property_name, p.address, p.city, p.state
         FROM property_systems ps
         JOIN properties p ON p.id = ps.property_id
         JOIN property_users pu ON pu.property_id = ps.property_id
         WHERE pu.user_id = $1
           AND ps.next_service_date IS NOT NULL
           AND ps.next_service_date >= $2
           AND ps.next_service_date <= $3
         ORDER BY ps.next_service_date ASC`,
        [userId, pastDate, futureDate],
      ),
    ]);

    const SYSTEM_LABELS = {
      roof: "Roof",
      gutters: "Gutters",
      foundation: "Foundation",
      exterior: "Exterior",
      windows: "Windows",
      heating: "Heating",
      ac: "Air Conditioning",
      waterHeating: "Water Heating",
      electrical: "Electrical",
      plumbing: "Plumbing",
      safety: "Safety",
      inspections: "Inspections",
    };

    const toDateKey = (d) => {
      if (d == null) return "";
      const date = d instanceof Date ? d : new Date(d);
      return date.toISOString().slice(0, 10);
    };

    const maintenanceEvents = eventsResult.rows.map((r) => {
      const dateKey = toDateKey(r.scheduled_date);
      const dueAt = r.scheduled_date;
      const daysUntilDue = Math.ceil((new Date(dueAt) - new Date()) / (1000 * 60 * 60 * 24));
      const isOverdue = daysUntilDue < 0;
      const status = r.status === "completed" ? "completed" : isOverdue ? "overdue" : "upcoming";
      const systemName = r.system_name || SYSTEM_LABELS[r.system_key] || r.system_key;
      const isInspection = r.event_type === "inspection";
      const cat = isInspection ? "inspection" : "maintenance";
      const title = isInspection
        ? `${systemName} inspection${r.contractor_name ? ` – ${r.contractor_name}` : ""}`
        : systemName + (r.contractor_name ? ` – ${r.contractor_name}` : "");
      return {
        id: String(r.id),
        propertyId: r.property_id,
        propertyUid: r.property_uid,
        systemType: cat,
        title,
        category: cat,
        status,
        scheduledAt: dateKey,
        dueAt: dateKey,
        professionalId: r.contractor_id,
        professionalName: r.contractor_name,
        daysUntilDue,
        isOverdue,
        isBooked: ["scheduled", "confirmed"].includes((r.status || "").toLowerCase()),
      };
    });

    const maintenanceKeys = new Set(
      eventsResult.rows.map((r) => `${r.property_id}-${r.system_key}-${toDateKey(r.scheduled_date)}`),
    );

    const inspectionEvents = systemsResult.rows
      .filter((r) => !maintenanceKeys.has(`${r.property_id}-${r.system_key}-${toDateKey(r.next_service_date)}`))
      .map((r) => {
        const dateKey = toDateKey(r.next_service_date);
        const daysUntilDue = Math.ceil((new Date(dateKey) - new Date()) / (1000 * 60 * 60 * 24));
        const isOverdue = daysUntilDue < 0;
        const systemName = SYSTEM_LABELS[r.system_key] || r.system_key;
        return {
          id: `system-${r.property_id}-${r.system_key}`,
          propertyId: r.property_id,
          propertyUid: r.property_uid,
          systemType: "inspection",
          title: `${systemName} inspection due`,
          category: "inspection",
          status: isOverdue ? "overdue" : "upcoming",
          scheduledAt: dateKey,
          dueAt: dateKey,
          professionalId: null,
          professionalName: null,
          daysUntilDue,
          isOverdue,
          isBooked: false,
        };
      });

    const all = [...maintenanceEvents, ...inspectionEvents].sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return new Date(a.dueAt) - new Date(b.dueAt);
    });

    const reminders = all.filter((e) => !e.isBooked && e.status !== "completed");
    const scheduledWork = all.filter((e) => e.isBooked);
    const nextAlert = reminders[0] || scheduledWork[0];

    return {
      events: all,
      reminders,
      scheduledWork,
      nextAlert: nextAlert || null,
    };
  }

  /** Get calendar events (maintenance + inspections) for a user in a date range.
   * Used by the Calendar page to display all scheduled events in a month.
   */
  static async getCalendarEventsForUser(userId, startDate, endDate) {
    const [eventsResult, systemsResult] = await Promise.all([
      db.query(
        `SELECT me.id, me.property_id, me.system_key, me.system_name,
                me.contractor_name, me.message_body, me.recurrence_type,
                me.recurrence_interval_value, me.recurrence_interval_unit,
                me.recurrence_parent_id,
                me.alert_timing, me.alert_custom_days,
                me.scheduled_date, me.scheduled_time, me.status, me.event_type,
                p.property_uid, p.property_name, p.address, p.city, p.state
         FROM maintenance_events me
         JOIN properties p ON p.id = me.property_id
         JOIN property_users pu ON pu.property_id = me.property_id
         WHERE pu.user_id = $1
           AND me.scheduled_date >= $2
           AND me.scheduled_date <= $3
         ORDER BY me.scheduled_date ASC, me.scheduled_time ASC NULLS LAST`,
        [userId, startDate, endDate],
      ),
      db.query(
        `SELECT ps.id, ps.property_id, ps.system_key, ps.next_service_date,
                p.property_uid, p.property_name, p.address, p.city, p.state
         FROM property_systems ps
         JOIN properties p ON p.id = ps.property_id
         JOIN property_users pu ON pu.property_id = ps.property_id
         WHERE pu.user_id = $1
           AND ps.next_service_date >= $2
           AND ps.next_service_date <= $3
           AND ps.next_service_date IS NOT NULL
         ORDER BY ps.next_service_date ASC`,
        [userId, startDate, endDate],
      ),
    ]);

    const SYSTEM_LABELS = {
      roof: "Roof",
      gutters: "Gutters",
      foundation: "Foundation",
      exterior: "Exterior",
      windows: "Windows",
      heating: "Heating",
      ac: "Air Conditioning",
      waterHeating: "Water Heating",
      electrical: "Electrical",
      plumbing: "Plumbing",
      safety: "Safety",
      inspections: "Inspections",
    };

    const toDateKey = (d) => {
      if (d == null) return "";
      const date = d instanceof Date ? d : new Date(d);
      return date.toISOString().slice(0, 10);
    };

    /** Return YYYY-MM-DD so frontend gets date-only; avoids timezone shift when DB returns Date. */
    const toDateOnly = (d) => {
      if (d == null) return null;
      if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
      const date = d instanceof Date ? d : new Date(d);
      return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    };

    const maintenanceEvents = eventsResult.rows.map((r) => ({
      type: calendarTypeFromEventType(r.event_type),
      id: r.id,
      propertyId: r.property_id,
      propertyUid: r.property_uid,
      propertyName: r.property_name,
      address: [r.address, r.city, r.state].filter(Boolean).join(", "),
      systemKey: r.system_key,
      systemName: r.system_name || SYSTEM_LABELS[r.system_key] || r.system_key,
      contractorName: r.contractor_name,
      notes: r.message_body,
      scheduledDate: toDateOnly(r.scheduled_date),
      scheduledTime: r.scheduled_time,
      status: r.status,
      recurrenceType: r.recurrence_type,
      recurrenceIntervalValue: r.recurrence_interval_value,
      recurrenceIntervalUnit: r.recurrence_interval_unit,
      recurrenceParentId: r.recurrence_parent_id,
      alertTiming: r.alert_timing,
      alertCustomDays: r.alert_custom_days,
    }));

    const maintenanceKeys = new Set(
      maintenanceEvents.map((e) => `${e.propertyId}-${e.systemKey}-${toDateKey(e.scheduledDate)}`),
    );

    const inspectionEvents = systemsResult.rows
      .filter((r) => !maintenanceKeys.has(`${r.property_id}-${r.system_key}-${toDateKey(r.next_service_date)}`))
      .map((r) => ({
        type: "inspection",
        id: `system-${r.property_id}-${r.system_key}`,
        propertyId: r.property_id,
        propertyUid: r.property_uid,
        propertyName: r.property_name,
        address: [r.address, r.city, r.state].filter(Boolean).join(", "),
        systemKey: r.system_key,
        systemName: SYSTEM_LABELS[r.system_key] || r.system_key,
        contractorName: null,
        notes: null,
        scheduledDate: toDateOnly(r.next_service_date),
        scheduledTime: null,
        status: "due",
        recurrenceType: null,
        recurrenceIntervalValue: null,
        recurrenceIntervalUnit: null,
        recurrenceParentId: null,
        alertTiming: null,
        alertCustomDays: null,
      }));

    return [...maintenanceEvents, ...inspectionEvents].sort(
      (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate),
    );
  }
}

module.exports = MaintenanceEvent;
