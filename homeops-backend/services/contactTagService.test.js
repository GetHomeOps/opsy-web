"use strict";

/**
 * Contact system-tag helpers.
 * Run: node services/contactTagService.test.js
 */

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const {
  HOMEOWNER_TAG_NAME,
  PROFESSIONAL_TAG_NAME,
  INSTALLER_TAG_NAME,
  CONTACT_SHARE_SOURCE,
  systemTagsForInvitationRole,
  systemTagsForContactSource,
  installerIdFromData,
  ensureContactTag,
  ensureInstallerTag,
  ensureDefaultAccountTags,
  applyInvitationContactTag,
  applyContactSourceTags,
  backfillContactSystemTags,
} = require("./contactTagService");

function mockTagModel(existingByName = {}) {
  const created = [];
  return {
    created,
    async findOrCreate({ accountId, name }) {
      if (existingByName[name]) return existingByName[name];
      const tag = {
        id: created.length + 100,
        account_id: accountId,
        name,
      };
      existingByName[name] = tag;
      created.push(tag);
      return tag;
    },
  };
}

function mockContactModel() {
  const assigned = [];
  return {
    assigned,
    async addTag(contactId, tagId) {
      assigned.push({ contactId, tagId });
    },
  };
}

describe("systemTagsForInvitationRole", () => {
  it("returns Homeowner for a homeowner invitation", () => {
    assert.deepEqual(systemTagsForInvitationRole("homeowner"), [
      HOMEOWNER_TAG_NAME,
    ]);
    assert.deepEqual(systemTagsForInvitationRole("Homeowner"), [
      HOMEOWNER_TAG_NAME,
    ]);
  });

  it("returns no tags for agent, insurance, mortgage, or missing role", () => {
    assert.deepEqual(systemTagsForInvitationRole("agent"), []);
    assert.deepEqual(systemTagsForInvitationRole("insurance"), []);
    assert.deepEqual(systemTagsForInvitationRole("mortgage"), []);
    assert.deepEqual(systemTagsForInvitationRole(null), []);
    assert.deepEqual(systemTagsForInvitationRole(undefined), []);
    assert.deepEqual(systemTagsForInvitationRole(""), []);
  });
});

describe("systemTagsForContactSource", () => {
  it("returns Professional for contact_share", () => {
    assert.deepEqual(systemTagsForContactSource(CONTACT_SHARE_SOURCE), [
      PROFESSIONAL_TAG_NAME,
    ]);
  });

  it("returns no tags for other sources", () => {
    assert.deepEqual(systemTagsForContactSource("manual"), []);
    assert.deepEqual(systemTagsForContactSource(null), []);
  });
});

describe("installerIdFromData", () => {
  it("parses a numeric installer_id", () => {
    assert.equal(installerIdFromData({ installer_id: 12 }), 12);
    assert.equal(installerIdFromData({ installer_id: "8" }), 8);
  });

  it("returns null when missing or invalid", () => {
    assert.equal(installerIdFromData(null), null);
    assert.equal(installerIdFromData({}), null);
    assert.equal(installerIdFromData({ installer_id: "" }), null);
    assert.equal(installerIdFromData({ installer_id: "abc" }), null);
  });
});

describe("ensureContactTag", () => {
  it("finds or creates the tag and assigns it additively", async () => {
    const Tag = mockTagModel();
    const Contact = mockContactModel();
    const tag = await ensureContactTag(3, 9, HOMEOWNER_TAG_NAME, {
      Tag,
      Contact,
    });
    assert.equal(tag.name, HOMEOWNER_TAG_NAME);
    assert.equal(Contact.assigned.length, 1);
    assert.equal(Contact.assigned[0].contactId, 3);
    assert.equal(Contact.assigned[0].tagId, tag.id);
  });

  it("skips when contact or account is missing", async () => {
    const Tag = mockTagModel();
    const Contact = mockContactModel();
    assert.equal(await ensureContactTag(null, 9, "Homeowner", { Tag, Contact }), null);
    assert.equal(await ensureContactTag(3, null, "Homeowner", { Tag, Contact }), null);
    assert.equal(Contact.assigned.length, 0);
  });
});

describe("applyInvitationContactTag", () => {
  it("tags a homeowner invitation contact, including an existing contact", async () => {
    const Tag = mockTagModel();
    const Contact = mockContactModel();
    const existingContactId = 44;
    const tags = await applyInvitationContactTag(
      existingContactId,
      2,
      "homeowner",
      { Tag, Contact }
    );
    assert.equal(tags.length, 1);
    assert.equal(tags[0].name, HOMEOWNER_TAG_NAME);
    assert.equal(Contact.assigned[0].contactId, existingContactId);
  });

  it("does not tag agent or missing invitation roles", async () => {
    const Tag = mockTagModel();
    const Contact = mockContactModel();
    await applyInvitationContactTag(1, 2, "agent", { Tag, Contact });
    await applyInvitationContactTag(1, 2, null, { Tag, Contact });
    assert.equal(Contact.assigned.length, 0);
    assert.equal(Tag.created.length, 0);
  });
});

describe("applyContactSourceTags", () => {
  it("applies Professional when source is contact_share", async () => {
    const Tag = mockTagModel();
    const Contact = mockContactModel();
    const tags = await applyContactSourceTags(5, 7, "contact_share", {
      Tag,
      Contact,
    });
    assert.equal(tags.length, 1);
    assert.equal(tags[0].name, PROFESSIONAL_TAG_NAME);
  });

  it("does not apply a tag for a manual create", async () => {
    const Tag = mockTagModel();
    const Contact = mockContactModel();
    const tags = await applyContactSourceTags(5, 7, undefined, { Tag, Contact });
    assert.equal(tags.length, 0);
    assert.equal(Contact.assigned.length, 0);
  });
});

describe("ensureInstallerTag", () => {
  it("assigns Professional only", async () => {
    const Tag = mockTagModel();
    const Contact = mockContactModel();
    const tag = await ensureInstallerTag(10, 1, { Tag, Contact });
    assert.equal(tag.name, PROFESSIONAL_TAG_NAME);
    assert.deepEqual(Tag.created.map((t) => t.name), [PROFESSIONAL_TAG_NAME]);
    assert.equal(Contact.assigned.length, 1);
  });
});

describe("ensureDefaultAccountTags", () => {
  it("seeds Homeowner and Professional", async () => {
    const Tag = mockTagModel();
    const tags = await ensureDefaultAccountTags(3, { Tag });
    assert.deepEqual(
      tags.map((t) => t.name).sort(),
      [HOMEOWNER_TAG_NAME, PROFESSIONAL_TAG_NAME].sort()
    );
  });
});

describe("backfillContactSystemTags", () => {
  it("applies Homeowner from invitations and Professional from installer signals", async () => {
    const Tag = mockTagModel();
    const Contact = mockContactModel();
    const queries = [];
    const query = async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes("intended_property_role")) {
        return { rows: [{ contact_id: 21, account_id: 4 }] };
      }
      if (sql.includes("FROM contact_tags") && sql.includes("SELECT DISTINCT")) {
        return { rows: [{ contact_id: 22, account_id: 4 }] };
      }
      if (sql.includes("installer_id") && sql.includes("SELECT DISTINCT")) {
        return { rows: [{ account_id: 4, installer_id: "23" }] };
      }
      if (sql.includes("DELETE FROM tags")) {
        return { rows: [{ id: 99 }] };
      }
      return { rows: [] };
    };

    const result = await backfillContactSystemTags({ Tag, Contact, query });
    assert.equal(result.homeownerCount, 1);
    assert.equal(result.professionalCount, 2);
    assert.equal(result.retiredInstallerTags, 1);
    const assignedNames = Contact.assigned.map((a) => {
      const tag = Tag.created.find((t) => t.id === a.tagId);
      return { contactId: a.contactId, name: tag?.name };
    });
    assert.ok(
      assignedNames.some(
        (a) => a.contactId === 21 && a.name === HOMEOWNER_TAG_NAME
      )
    );
    assert.ok(
      assignedNames.some(
        (a) => a.contactId === 22 && a.name === PROFESSIONAL_TAG_NAME
      )
    );
    assert.ok(
      assignedNames.some(
        (a) => a.contactId === 23 && a.name === PROFESSIONAL_TAG_NAME
      )
    );
    assert.ok(
      !assignedNames.some((a) => a.name === INSTALLER_TAG_NAME)
    );
    assert.ok(queries.some((q) => q.sql.includes("DELETE FROM contact_tags")));
    assert.ok(queries.some((q) => q.sql.includes("DELETE FROM tags")));
  });
});

after(async () => {
  await db.end();
});
