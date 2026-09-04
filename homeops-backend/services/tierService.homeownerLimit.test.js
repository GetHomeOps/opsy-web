"use strict";

/**
 * Max Home Owners seat counting.
 * Run: node services/tierService.homeownerLimit.test.js
 */

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const {
  isHomeownerCapacityInvite,
  countsTowardHomeownerLimit,
  tallyHomeownerSeats,
  countHomeownersForPropertyLimit,
} = require("./tierService");

describe("isHomeownerCapacityInvite", () => {
  it("treats unset category as a homeowner edit invite", () => {
    assert.equal(isHomeownerCapacityInvite({}), true);
    assert.equal(isHomeownerCapacityInvite({ intendedRole: "editor" }), true);
    assert.equal(isHomeownerCapacityInvite({ intendedRole: null, intendedPropertyRole: null }), true);
  });

  it("returns true for explicit homeowner edit invites", () => {
    assert.equal(
      isHomeownerCapacityInvite({ intendedRole: "editor", intendedPropertyRole: "homeowner" }),
      true
    );
  });

  it("returns false for viewers and non-homeowner categories", () => {
    assert.equal(
      isHomeownerCapacityInvite({ intendedRole: "viewer", intendedPropertyRole: "homeowner" }),
      false
    );
    assert.equal(
      isHomeownerCapacityInvite({ intendedRole: "editor", intendedPropertyRole: "agent" }),
      false
    );
    assert.equal(
      isHomeownerCapacityInvite({ intendedRole: "editor", intendedPropertyRole: "insurance" }),
      false
    );
    assert.equal(
      isHomeownerCapacityInvite({ intendedRole: "editor", intendedPropertyRole: "mortgage" }),
      false
    );
  });
});

describe("countsTowardHomeownerLimit / tallyHomeownerSeats", () => {
  const adminOwner = {
    kind: "member",
    userRole: "admin",
    propertyRole: "owner",
  };
  const superAdminOwner = {
    kind: "member",
    userRole: "super_admin",
    propertyRole: "owner",
  };
  const agentEditor = {
    kind: "member",
    userRole: "agent",
    propertyRole: "editor",
  };
  const homeownerOwner = {
    kind: "member",
    userRole: "homeowner",
    propertyRole: "owner",
  };
  const homeownerEditor = {
    kind: "member",
    userRole: "homeowner",
    propertyRole: "editor",
  };
  const homeownerViewer = {
    kind: "member",
    userRole: "homeowner",
    propertyRole: "viewer",
  };
  const pendingPatty = {
    kind: "invite",
    invitationId: "inv-patty",
    intendedRole: "editor",
    intendedPropertyRole: "homeowner",
  };
  const pendingDirk = {
    kind: "invite",
    invitationId: "inv-dirk",
    intendedRole: "editor",
    intendedPropertyRole: "homeowner",
  };
  const pendingLegacy = {
    kind: "invite",
    invitationId: "inv-legacy",
    intendedRole: "editor",
    intendedPropertyRole: null,
  };
  const pendingAgent = {
    kind: "invite",
    invitationId: "inv-agent",
    intendedRole: "editor",
    intendedPropertyRole: "agent",
  };
  const pendingViewer = {
    kind: "invite",
    invitationId: "inv-viewer",
    intendedRole: "viewer",
    intendedPropertyRole: "homeowner",
  };

  it("does not count admin/super_admin owners or agents", () => {
    assert.equal(countsTowardHomeownerLimit(adminOwner), false);
    assert.equal(countsTowardHomeownerLimit(superAdminOwner), false);
    assert.equal(countsTowardHomeownerLimit(agentEditor), false);
  });

  it("counts accepted homeowners including a homeowner owner", () => {
    assert.equal(countsTowardHomeownerLimit(homeownerEditor), true);
    assert.equal(countsTowardHomeownerLimit(homeownerOwner), true);
  });

  it("does not count a viewer homeowner", () => {
    assert.equal(countsTowardHomeownerLimit(homeownerViewer), false);
    assert.equal(countsTowardHomeownerLimit(pendingViewer), false);
  });

  it("counts two pending homeowners (the Snel case)", () => {
    assert.equal(
      tallyHomeownerSeats([adminOwner, pendingPatty, pendingDirk]),
      2
    );
  });

  it("counts a legacy pending invite with no intended_property_role as a homeowner", () => {
    assert.equal(countsTowardHomeownerLimit(pendingLegacy), true);
  });

  it("does not count pending agent invites", () => {
    assert.equal(countsTowardHomeownerLimit(pendingAgent), false);
  });

  it("omits the invitation being accepted via excludeInvitationId", () => {
    assert.equal(
      tallyHomeownerSeats([adminOwner, pendingPatty, pendingDirk], {
        excludeInvitationId: "inv-patty",
      }),
      1
    );
    assert.equal(
      countsTowardHomeownerLimit(pendingPatty, { excludeInvitationId: "inv-patty" }),
      false
    );
    assert.equal(
      countsTowardHomeownerLimit(pendingDirk, { excludeInvitationId: "inv-patty" }),
      true
    );
  });
});

describe("countHomeownersForPropertyLimit", () => {
  it("queries homeowners only and returns the SQL count", async () => {
    let seenSql = "";
    let seenParams;
    const count = await countHomeownersForPropertyLimit(42, {
      queryFn: async (sql, params) => {
        seenSql = sql;
        seenParams = params;
        return { rows: [{ count: 2 }] };
      },
    });
    assert.equal(count, 2);
    assert.deepEqual(seenParams, [42]);
    assert.match(seenSql, /u\.role::text = 'homeowner'/);
    assert.match(seenSql, /COALESCE\(intended_property_role, 'homeowner'\) = 'homeowner'/);
    assert.match(seenSql, /pu\.role != 'viewer'/);
    assert.doesNotMatch(seenSql, /id != \$2/);
  });

  it("excludes the invitation being accepted", async () => {
    let seenSql = "";
    let seenParams;
    const count = await countHomeownersForPropertyLimit(42, {
      excludeInvitationId: "inv-patty",
      queryFn: async (sql, params) => {
        seenSql = sql;
        seenParams = params;
        return { rows: [{ count: 1 }] };
      },
    });
    assert.equal(count, 1);
    assert.deepEqual(seenParams, [42, "inv-patty"]);
    assert.match(seenSql, /id != \$2/);
  });
});

after(async () => {
  await db.end();
});
