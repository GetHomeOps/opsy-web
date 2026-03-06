/**
 * Build a Google Calendar "Add event" URL that opens the event edit form with
 * pre-filled details. No OAuth required; user clicks the link and saves in Google.
 *
 * @param {Object} event - Normalized calendar event
 * @param {string} [event.title]
 * @param {string} event.date - YYYY-MM-DD
 * @param {string} [event.scheduledTime] - HH:mm (24h)
 * @param {string} [event.type] - "maintenance" | "inspection"
 * @param {string} [event.propertyName]
 * @param {string} [event.address]
 * @param {string} [event.contractorName]
 * @param {string} [event.notes]
 * @returns {string} Google Calendar eventedit URL
 */
export function buildGoogleCalendarUrl(event) {
  const base = "https://calendar.google.com/calendar/u/0/r/eventedit";
  const title = encodeURIComponent(event?.title || "HomeOps Event");

  const dateStr = event?.date || "";
  const [h = 9, m = 0] = (event?.scheduledTime || "09:00")
    .split(":")
    .map((x) => parseInt(x, 10) || 0);

  const [y, mo, d] = dateStr.split("-").map((x) => parseInt(x, 10) || 0);
  const start = new Date(y || new Date().getFullYear(), (mo || 1) - 1, d || 1, h, m, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const fmt = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .split(".")[0] + "Z";
  const dates = `${fmt(start)}/${fmt(end)}`;

  const detailsParts = [
    event?.type === "inspection" ? "Inspection" : "Maintenance",
    event?.propertyName && `Property: ${event.propertyName}`,
    event?.contractorName && `Contractor: ${event.contractorName}`,
    event?.notes,
  ].filter(Boolean);
  const details = detailsParts.join("\n");

  const params = [`text=${title}`, `dates=${dates}`];
  if (details) params.push(`details=${encodeURIComponent(details)}`);
  if (event?.address) params.push(`location=${encodeURIComponent(event.address)}`);

  return `${base}?${params.join("&")}`;
}
