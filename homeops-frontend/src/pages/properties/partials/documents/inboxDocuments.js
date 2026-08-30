import {inferDocumentTypeFromFolder} from "./filenameHeuristics";

export const INBOX_DOC_ID_PREFIX = "inbox:";
export const DEFAULT_FILE_FOLDER = "other";

export function inboxDocId(clientId) {
  return `${INBOX_DOC_ID_PREFIX}${clientId}`;
}

export function isInboxDoc(doc) {
  return doc?.source === "inbox";
}

export function clientIdFromInboxDocId(id) {
  if (typeof id !== "string" || !id.startsWith(INBOX_DOC_ID_PREFIX)) {
    return null;
  }
  return id.slice(INBOX_DOC_ID_PREFIX.length);
}

/**
 * Map a staged inbox card into the same shape the All Documents table uses
 * so unfiled uploads appear next to filed property documents.
 */
export function inboxCardToUIDoc(card) {
  if (!card) return null;
  const systemKey = card.proposed?.system_key || null;
  return {
    id: inboxDocId(card.clientId),
    clientId: card.clientId,
    stagedId: card.id,
    source: "inbox",
    name: card.proposed?.document_name || card.name,
    system: systemKey,
    type: card.proposed?.document_type || "other",
    document_key: card.documentKey,
    document_date: card.proposed?.document_date,
    created_at: card.createdAt,
    status: card.status,
    needsFolder: !systemKey,
  };
}

/**
 * Filing payload for File all. Unguessed folders default to Other so the
 * button is never a silent no-op.
 */
export function fileAllItemFromCard(card, fallbackDate) {
  const systemKey = card.proposed?.system_key || DEFAULT_FILE_FOLDER;
  return {
    clientId: card.clientId,
    system_key: systemKey,
    document_type: inferDocumentTypeFromFolder(
      systemKey,
      card.proposed?.document_type,
    ),
    document_name: card.proposed?.document_name?.trim() || card.name,
    document_date:
      card.proposed?.document_date ||
      fallbackDate ||
      new Date().toISOString().slice(0, 10),
  };
}
