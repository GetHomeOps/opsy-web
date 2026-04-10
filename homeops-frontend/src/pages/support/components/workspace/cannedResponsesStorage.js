export const CANNED_RESPONSES_STORAGE_KEY = "opsy.support.cannedResponses.v2";

/**
 * Bracket tokens like [firstName] — shown in the editor; resolved when inserting into a reply.
 * Keys are matched case-insensitively (firstName → firstname).
 */
export const CANNED_PLACEHOLDER_VARIABLES = [
  { key: "firstName", label: "First name", hint: "Requester" },
  { key: "lastName", label: "Last name", hint: "Requester" },
  { key: "fullName", label: "Full name", hint: "Requester" },
  { key: "email", label: "Email", hint: "Requester" },
  { key: "ticketId", label: "Ticket ID", hint: "Ticket" },
  { key: "subject", label: "Subject", hint: "Ticket" },
  { key: "subscriptionTier", label: "Plan", hint: "Account" },
  { key: "assigneeName", label: "Assignee", hint: "Ticket" },
];

function emailLocalFirstToken(email) {
  if (!email || typeof email !== "string") return "";
  const local = email.split("@")[0];
  if (!local) return "";
  const normalized = local.replace(/[.+_]/g, " ").trim();
  const first = normalized.split(/\s+/).filter(Boolean)[0];
  return first || local;
}

/**
 * Builds lowercase keys for placeholder lookup: firstname, lastname, ticketid, etc.
 * @param {object | null | undefined} ticket
 */
export function buildCannedPlaceholderMap(ticket) {
  const t = ticket || {};
  const rawName = (t.createdByName || "").trim();
  const parts = rawName.split(/\s+/).filter(Boolean);
  const firstName = parts[0] || emailLocalFirstToken(t.createdByEmail) || "";
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
  const fullName = rawName || (t.createdByEmail ? String(t.createdByEmail).split("@")[0] : "") || "";
  const email = t.createdByEmail || "";
  const assigneeName = (t.assignedToName || "").trim();

  return {
    firstname: firstName,
    lastname: lastName,
    fullname: fullName,
    email,
    ticketid: t.id != null ? String(t.id) : "",
    subject: t.subject || "",
    subscriptiontier: String(t.subscriptionTier || "Free"),
    plan: String(t.subscriptionTier || "Free"),
    assigneename: assigneeName,
    assignee: assigneeName,
  };
}

/**
 * Replaces [firstName], [ticketId], etc. with values from the ticket (requester = submitter).
 * Unknown tokens are left unchanged.
 * @param {string} template
 * @param {object | null | undefined} ticket
 */
export function resolveCannedPlaceholders(template, ticket) {
  if (template == null || typeof template !== "string") return "";
  const map = buildCannedPlaceholderMap(ticket);
  return template.replace(/\[([a-zA-Z][a-zA-Z0-9_]*)\]/g, (match, key) => {
    const k = key.toLowerCase();
    return k in map ? map[k] : match;
  });
}

/** @typedef {{ id: string, title: string, shortcutKey: string, body: string, builtin?: boolean }} CannedResponse */

/** @type {CannedResponse[]} */
export const INITIAL_CANNED_RESPONSES = [
  {
    id: "b-feedback",
    title: "Acknowledge feedback",
    shortcutKey: "feedback",
    body: "Thanks for your feedback — we're looking into this and will update you soon.",
    builtin: true,
  },
  {
    id: "b-received",
    title: "Request received",
    shortcutKey: "received",
    body: "Thanks for reaching out. We've received your request and will get back to you shortly.",
    builtin: true,
  },
  {
    id: "b-detail",
    title: "Ask for more detail",
    shortcutKey: "detail",
    body: "Hi [firstName], could you share a bit more detail so we can help you better?",
    builtin: true,
  },
  {
    id: "b-patience",
    title: "Thanks for patience",
    shortcutKey: "patience",
    body: "We appreciate your patience while we look into this.",
    builtin: true,
  },
  {
    id: "b-resolved",
    title: "Mark resolved",
    shortcutKey: "resolved",
    body: "This should now be resolved. Please let us know if anything else comes up.",
    builtin: true,
  },
];

export function readCannedResponses() {
  try {
    const raw = localStorage.getItem(CANNED_RESPONSES_STORAGE_KEY);
    if (!raw) return INITIAL_CANNED_RESPONSES.map((r) => ({ ...r }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return INITIAL_CANNED_RESPONSES.map((r) => ({ ...r }));
    }
    return parsed.map((r) => ({
      ...r,
      builtin: r.builtin ?? String(r.id).startsWith("b-"),
    }));
  } catch {
    return INITIAL_CANNED_RESPONSES.map((r) => ({ ...r }));
  }
}

/** @param {CannedResponse[]} items */
export function writeCannedResponses(items) {
  try {
    localStorage.setItem(CANNED_RESPONSES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @param {string} key
 * @param {CannedResponse[]} items
 * @param {string} [excludeId]
 */
export function isShortcutTaken(key, items, excludeId) {
  const k = normalizeShortcutKey(key);
  if (!k) return false;
  return items.some(
    (i) =>
      i.id !== excludeId &&
      normalizeShortcutKey(i.shortcutKey) === k,
  );
}

export function normalizeShortcutKey(raw) {
  if (raw == null || typeof raw !== "string") return "";
  let s = raw.trim().toLowerCase();
  if (s.startsWith("/")) s = s.slice(1);
  return s.replace(/[^a-z0-9-]/g, "");
}

export function validateShortcutKey(raw) {
  const k = normalizeShortcutKey(raw);
  if (!k) return { ok: false, message: "Enter a shortcut (letters, numbers, hyphens)." };
  if (!/^[a-z0-9]/.test(k)) return { ok: false, message: "Shortcut must start with a letter or number." };
  if (k.length > 32) return { ok: false, message: "Shortcut is too long (max 32)." };
  return { ok: true, key: k };
}

/**
 * When the cursor is immediately after `/shortcut` (no trailing space yet), replace with body.
 * @param {string} text
 * @param {number} cursorPos
 * @param {CannedResponse[]} items
 * @param {object | null | undefined} ticket — used to resolve [placeholders] in the snippet body
 * @returns {{ newText: string, newCursor: number } | null}
 */
export function tryExpandCannedShortcut(text, cursorPos, items, ticket) {
  if (!items?.length) return null;
  const before = text.slice(0, cursorPos);
  const match = before.match(/(^|\s)\/([a-z0-9-]+)$/i);
  if (!match) return null;
  const key = match[2].toLowerCase();
  const snippet = items.find((s) => s.shortcutKey?.toLowerCase() === key);
  if (!snippet?.body) return null;
  const resolved = resolveCannedPlaceholders(snippet.body, ticket);
  const tokenStart = match.index + match[1].length;
  const newText = text.slice(0, tokenStart) + resolved + text.slice(cursorPos);
  const newCursor = tokenStart + resolved.length;
  return { newText, newCursor };
}
