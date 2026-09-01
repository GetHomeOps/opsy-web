/**
 * Viewer-specific pending property invitation.
 * Set on list payloads from GET /properties/user/:id when the current user
 * has an unexpired pending invite and is not yet in property_users.
 */

export function isPendingInvitationProperty(property) {
  return property?._pendingInvitation === true;
}

export function getPropertyInvitationId(property) {
  if (!property) return null;
  const id = property._invitationId ?? property._invitation_id;
  if (id == null || id === "") return null;
  return String(id);
}

/**
 * Property detail path. Pending invitations always carry ?invitation= so the
 * detail page opens in invitation/preview mode from any entry point.
 */
export function buildPropertyDetailPath(accountUrl, property, uidOverride) {
  const uid =
    uidOverride ??
    property?.property_uid ??
    property?.uid ??
    property?.id;
  if (uid == null || uid === "") {
    return accountUrl ? `/${accountUrl}/properties` : "/properties";
  }
  const base = accountUrl
    ? `/${accountUrl}/properties/${uid}`
    : `/properties/${uid}`;
  const invitationId = getPropertyInvitationId(property);
  if (isPendingInvitationProperty(property) && invitationId) {
    return `${base}?invitation=${encodeURIComponent(invitationId)}`;
  }
  return base;
}
