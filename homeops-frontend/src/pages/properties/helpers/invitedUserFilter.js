export const INVITED_USER_FILTER_TYPE = "invitedUser";

export function normalizeInviteeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getInvitationInviteeEmail(invitation) {
  return normalizeInviteeEmail(
    invitation?.inviteeEmail ?? invitation?.invitee_email,
  );
}

export function getInvitationInviteeLabel(invitation) {
  const name = String(
    invitation?.inviteeName ?? invitation?.invitee_name ?? "",
  ).trim();
  const email =
    invitation?.inviteeEmail ?? invitation?.invitee_email ?? "";
  return name || email;
}

export function addInvitationMatchKeys(set, invitation) {
  if (!set || !invitation) return;
  const uid = invitation.propertyUid ?? invitation.property_uid;
  if (uid) set.add(String(uid));
  const pid = invitation.propertyId ?? invitation.property_id;
  if (pid != null && pid !== "") set.add(String(pid));
}

export function getPropertyMatchKeys(property) {
  const keys = [];
  if (!property) return keys;
  const uid = property.property_uid ?? property.propertyUid;
  if (uid) keys.push(String(uid));
  if (property.id != null && property.id !== "") keys.push(String(property.id));
  return keys;
}

export function isActivePendingPropertyInvitation(invitation, now = Date.now()) {
  if (!invitation) return false;
  const type = invitation.type;
  if (type && type !== "property") return false;
  const status = invitation.status;
  if (status && status !== "pending") return false;
  const uid = invitation.propertyUid ?? invitation.property_uid;
  const pid = invitation.propertyId ?? invitation.property_id;
  if (!uid && (pid == null || pid === "")) return false;
  const expiresAt = invitation.expiresAt ?? invitation.expires_at;
  if (expiresAt) {
    const t = new Date(expiresAt).getTime();
    if (Number.isFinite(t) && t <= now) return false;
  }
  return true;
}

/**
 * Build Filter dropdown options and email → property-key sets from account invitations.
 * @returns {{ options: {value: string, label: string}[], uidsByEmail: Map<string, Set<string>> }}
 */
export function buildInvitedUserFilterData(invitations, now = Date.now()) {
  const uidsByEmail = new Map();
  const labelByEmail = new Map();
  for (const invitation of invitations || []) {
    if (!isActivePendingPropertyInvitation(invitation, now)) continue;
    const email = getInvitationInviteeEmail(invitation);
    if (!email) continue;
    if (!uidsByEmail.has(email)) uidsByEmail.set(email, new Set());
    addInvitationMatchKeys(uidsByEmail.get(email), invitation);
    if (!labelByEmail.has(email)) {
      labelByEmail.set(email, getInvitationInviteeLabel(invitation));
    }
  }
  const options = [...uidsByEmail.keys()]
    .map((email) => ({
      value: email,
      label: labelByEmail.get(email) || email,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return {options, uidsByEmail};
}

export function propertyMatchesInvitedUserFilter(
  property,
  selectedEmails,
  uidsByEmail,
) {
  if (!selectedEmails?.length) return true;
  const keys = getPropertyMatchKeys(property);
  if (!keys.length) return false;
  return selectedEmails.some((email) => {
    const set = uidsByEmail?.get(normalizeInviteeEmail(email));
    if (!set) return false;
    return keys.some((key) => set.has(key));
  });
}
