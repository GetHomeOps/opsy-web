import {describe, expect, it} from "vitest";
import {
  buildInvitedUserFilterData,
  isActivePendingPropertyInvitation,
  normalizeInviteeEmail,
  propertyMatchesInvitedUserFilter,
} from "./invitedUserFilter";

const now = new Date("2026-09-04T12:00:00.000Z").getTime();

function pendingInvite(overrides = {}) {
  return {
    type: "property",
    status: "pending",
    inviteeEmail: "patty@example.com",
    inviteeName: "Patty Snel",
    propertyUid: "prop-1",
    propertyId: 11,
    expiresAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("invitedUserFilter", () => {
  it("normalizes invitee emails", () => {
    expect(normalizeInviteeEmail("  Patty@Example.com ")).toBe(
      "patty@example.com",
    );
  });

  it("keeps unexpired pending property invitations", () => {
    expect(isActivePendingPropertyInvitation(pendingInvite(), now)).toBe(true);
  });

  it("drops account invites, accepted invites, and expired invites", () => {
    expect(
      isActivePendingPropertyInvitation(
        pendingInvite({type: "account", propertyUid: null, propertyId: null}),
        now,
      ),
    ).toBe(false);
    expect(
      isActivePendingPropertyInvitation(pendingInvite({status: "accepted"}), now),
    ).toBe(false);
    expect(
      isActivePendingPropertyInvitation(
        pendingInvite({expiresAt: "2026-08-01T00:00:00.000Z"}),
        now,
      ),
    ).toBe(false);
  });

  it("builds unique invitee options and matches properties by uid or id", () => {
    const {options, uidsByEmail} = buildInvitedUserFilterData(
      [
        pendingInvite(),
        pendingInvite({
          inviteeEmail: "PATTY@example.com",
          propertyUid: "prop-2",
          propertyId: 12,
        }),
        pendingInvite({
          inviteeEmail: "other@example.com",
          inviteeName: "",
          propertyUid: "prop-3",
        }),
        pendingInvite({type: "account", propertyUid: null, propertyId: null}),
      ],
      now,
    );

    expect(options).toEqual([
      {value: "other@example.com", label: "other@example.com"},
      {value: "patty@example.com", label: "Patty Snel"},
    ]);

    expect(
      propertyMatchesInvitedUserFilter(
        {property_uid: "prop-2", id: 12},
        ["patty@example.com"],
        uidsByEmail,
      ),
    ).toBe(true);
    expect(
      propertyMatchesInvitedUserFilter(
        {property_uid: "prop-3", id: 13},
        ["patty@example.com"],
        uidsByEmail,
      ),
    ).toBe(false);
    expect(
      propertyMatchesInvitedUserFilter(
        {id: 11},
        ["patty@example.com"],
        uidsByEmail,
      ),
    ).toBe(true);
  });
});
