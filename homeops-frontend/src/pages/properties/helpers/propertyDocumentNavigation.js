/**
 * Build the path for a property document on the Documents tab.
 */
export function getPropertyDocumentDetailPath({
  accountUrl,
  propertyId,
  documentId,
}) {
  if (!accountUrl || !propertyId || documentId == null) return null;
  const params = new URLSearchParams({
    tab: "documents",
    documentId: String(documentId),
  });
  return `/${accountUrl}/properties/${propertyId}?${params.toString()}`;
}

/**
 * Open a property document on the Documents tab in a new browser tab.
 */
export function openPropertyDocumentInNewTab({
  accountUrl,
  propertyId,
  documentId,
}) {
  const path = getPropertyDocumentDetailPath({
    accountUrl,
    propertyId,
    documentId,
  });
  if (!path) return false;
  window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * Resolve a property_documents row id from a maintenance record linked file.
 */
export function resolvePropertyDocumentIdFromLinkedFile(
  file,
  propertyDocuments,
  maintenanceRecordId,
) {
  if (!file) return null;

  const directId =
    file.property_document_id ??
    file.propertyDocumentId ??
    file.document_id ??
    file.documentId;
  if (directId != null && directId !== "") {
    return Number(directId);
  }

  const documentKey = file.key ?? file.document_key;
  if (!documentKey || !Array.isArray(propertyDocuments)) return null;

  const matches = propertyDocuments.filter(
    (doc) => doc.document_key === documentKey,
  );
  if (matches.length === 0) return null;

  if (maintenanceRecordId != null) {
    const linked = matches.find(
      (doc) =>
        String(doc.maintenance_record_id) === String(maintenanceRecordId),
    );
    if (linked) return linked.id;
  }

  return matches[0]?.id ?? null;
}
