/**
 * Build the path for the standalone maintenance record edit form (MaintenanceRecordPage).
 */
export function getMaintenanceRecordEditPath({
  accountUrl,
  propertyId,
  record,
  systemIdFallback,
}) {
  const sysId =
    record?.systemId ?? record?.system_key ?? systemIdFallback ?? null;
  const recId = record?.id ?? record ?? null;
  if (!accountUrl || !propertyId || !sysId || recId == null) return null;
  return `/${accountUrl}/properties/${propertyId}/maintenance/${encodeURIComponent(
    sysId,
  )}/${encodeURIComponent(recId)}`;
}

/**
 * Build the path for the read-only maintenance record detail view on the property page.
 */
export function getMaintenanceRecordDetailPath({accountUrl, propertyId, record}) {
  const recId = record?.id ?? record ?? null;
  if (!accountUrl || !propertyId || recId == null) return null;
  const params = new URLSearchParams({
    tab: "maintenance",
    recordId: String(recId),
  });
  return `/${accountUrl}/properties/${propertyId}?${params.toString()}`;
}

/** @deprecated Use getMaintenanceRecordEditPath */
export function getMaintenanceRecordPath(args) {
  return getMaintenanceRecordEditPath(args);
}

/**
 * Open a maintenance record detail view in a new browser tab (property Maintenance tab).
 */
export function openMaintenanceRecordInNewTab({
  accountUrl,
  propertyId,
  record,
}) {
  const path = getMaintenanceRecordDetailPath({accountUrl, propertyId, record});
  if (!path) return false;
  window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
  return true;
}

/**
 * Open the maintenance record edit form in a new browser tab (MaintenanceRecordPage).
 */
export function openMaintenanceRecordEditInNewTab({
  accountUrl,
  propertyId,
  record,
  systemIdFallback,
}) {
  const path = getMaintenanceRecordEditPath({
    accountUrl,
    propertyId,
    record,
    systemIdFallback,
  });
  if (!path) return false;
  window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
  return true;
}
