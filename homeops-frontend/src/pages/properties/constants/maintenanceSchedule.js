export const RECURRENCE_OPTIONS = [
  {id: "one-time", label: "One-time"},
  {id: "quarterly", label: "Quarterly (every 3 months)"},
  {id: "semi-annually", label: "Semi-annually (every 6 months)"},
  {id: "annually", label: "Annually"},
  {id: "custom", label: "Custom interval"},
];

export const RECURRENCE_UNITS = [
  {id: "days", label: "Days"},
  {id: "weeks", label: "Weeks"},
  {id: "months", label: "Months"},
];

export const ALERT_TIMING_OPTIONS = [
  {id: "1d", label: "1 day before"},
  {id: "3d", label: "3 days before"},
  {id: "1w", label: "1 week before"},
  {id: "2w", label: "2 weeks before"},
  {id: "custom", label: "Custom"},
];

/**
 * Maps property system IDs to professional category keywords for filtering
 * relevant contractors. Uses category names rather than IDs so the mapping
 * is readable and resilient to ID changes.
 */
export const SYSTEM_TO_CATEGORY_MAP = {
  roof: ["roofing"],
  gutters: ["roofing", "gutters"],
  foundation: ["foundation", "structural"],
  exterior: ["siding", "exterior", "painting"],
  windows: ["windows", "doors"],
  heating: ["hvac", "heating"],
  ac: ["hvac", "air conditioning"],
  waterHeating: ["plumbing", "water heater"],
  electrical: ["electrical"],
  plumbing: ["plumbing"],
  safety: ["safety", "fire protection"],
  inspections: ["inspection", "home inspection"],
};

/**
 * Maintenance event shape — designed for future Google Calendar sync.
 *
 * {
 *   id: string,                          // UUID
 *   propertyId: string,
 *   systemId: string,
 *   systemName: string,
 *   contractorId: string | null,
 *   contractorName: string | null,
 *   scheduledDate: string,               // ISO 8601 (YYYY-MM-DD)
 *   scheduledTime: string | null,        // HH:mm (24h)
 *   recurrence: {
 *     type: "one-time" | "quarterly" | "semi-annually" | "annually" | "custom",
 *     intervalValue: number | null,
 *     intervalUnit: "days" | "weeks" | "months" | null,
 *   },
 *   alert: {
 *     timing: "1d" | "3d" | "1w" | "2w" | "custom",
 *     customDays: number | null,
 *     emailReminder: boolean,
 *   },
 *   message: {
 *     enabled: boolean,
 *     body: string,
 *   },
 *   createdAt: string,                   // ISO 8601
 *   timezone: string,                    // e.g. "America/Los_Angeles"
 * }
 */
export function buildMaintenanceEvent(fields) {
  return {
    id: crypto.randomUUID?.() ?? `evt-${Date.now()}`,
    propertyId: fields.propertyId ?? null,
    systemId: fields.systemId ?? null,
    systemName: fields.systemName ?? "",
    contractorId: fields.contractorId ?? null,
    contractorName: fields.contractorName ?? null,
    scheduledDate: fields.scheduledDate ?? "",
    scheduledTime: fields.scheduledTime ?? null,
    recurrence: {
      type: fields.recurrenceType ?? "one-time",
      intervalValue: fields.customIntervalValue ?? null,
      intervalUnit: fields.customIntervalUnit ?? null,
    },
    alert: {
      timing: fields.alertTiming ?? "3d",
      customDays: fields.alertCustomDays ?? null,
      emailReminder: fields.emailReminder ?? false,
    },
    message: {
      enabled: fields.messageEnabled ?? false,
      body: fields.messageBody ?? "",
    },
    createdAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
