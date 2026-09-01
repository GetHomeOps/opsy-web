import {describe, expect, it} from "vitest";
import {
  buildPropertyDetailPath,
  getPropertyInvitationId,
  isPendingInvitationProperty,
} from "./pendingInvitation";

describe("pendingInvitation helpers", () => {
  it("detects viewer-pending list rows", () => {
    expect(isPendingInvitationProperty({_pendingInvitation: true})).toBe(true);
    expect(isPendingInvitationProperty({_pendingInvitation: false})).toBe(false);
    expect(isPendingInvitationProperty({})).toBe(false);
    expect(isPendingInvitationProperty(null)).toBe(false);
  });

  it("reads invitation id from camel or snake case", () => {
    expect(getPropertyInvitationId({_invitationId: 12})).toBe("12");
    expect(getPropertyInvitationId({_invitation_id: "abc"})).toBe("abc");
    expect(getPropertyInvitationId({})).toBe(null);
  });

  it("appends invitation query only for pending properties", () => {
    expect(
      buildPropertyDetailPath("kataicarmen", {
        property_uid: "p1",
        _pendingInvitation: true,
        _invitationId: 9,
      }),
    ).toBe("/kataicarmen/properties/p1?invitation=9");

    expect(
      buildPropertyDetailPath("kataicarmen", {
        property_uid: "p1",
      }),
    ).toBe("/kataicarmen/properties/p1");
  });
});
