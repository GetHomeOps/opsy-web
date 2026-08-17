/**
 * Build the path for a contact detail page.
 */
export function getContactDetailPath({accountUrl, contactId}) {
  if (!accountUrl || contactId == null || String(contactId).trim() === "") {
    return null;
  }
  return `/${accountUrl}/contacts/${encodeURIComponent(contactId)}`;
}

/**
 * Open a contact detail page in a new browser tab.
 */
export function openContactInNewTab({accountUrl, contactId}) {
  const path = getContactDetailPath({accountUrl, contactId});
  if (!path) return false;
  window.open(
    `${window.location.origin}${path}`,
    "_blank",
    "noopener,noreferrer",
  );
  return true;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

/** Look up a contact by id. */
export function findContactById(contacts, id) {
  if (id == null || String(id).trim() === "") return null;
  return (
    (contacts ?? []).find((c) => c && String(c.id) === String(id)) ?? null
  );
}

/**
 * Resolve a system installer value (contact id, or legacy free text) to a contact.
 */
export function findContactForInstaller(value, contacts) {
  return findContactById(contacts, value);
}

/**
 * Resolve a maintenance/inspection contractor to a contact.
 * Match email first, then name, then numeric id — same order as the backend.
 */
export function findContactForContractor(record, contacts) {
  const list = contacts ?? [];
  const email = normalize(record?.contractorEmail);
  if (email) {
    const byEmail = list.find((c) => normalize(c.email) === email);
    if (byEmail) return byEmail;
  }
  const name = normalize(record?.contractor);
  if (name) {
    const byName = list.find((c) => normalize(c.name) === name);
    if (byName) return byName;
  }
  const raw = record?.contractor;
  if (raw != null && String(raw).trim() !== "" && !Number.isNaN(Number(raw))) {
    return findContactById(list, raw);
  }
  return null;
}
