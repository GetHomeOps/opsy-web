"use strict";

/**
 * Contact Model
 *
 * Manages contacts in the `contacts` table. Contacts represent people or
 * organizations (e.g., vendors, tenants) and can be linked to accounts.
 * Tags are many-to-many via contact_tags.
 *
 * Key operations:
 * - create / get / getAll: CRUD for contacts
 * - addToAccount: Associate contact with an account
 * - getByAccountId: List contacts for a given account
 * - removeWithAccountLinks: Delete contact and all account associations
 */

const db = require("../db.js");
const { NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

const TAGS_SUBQUERY = `COALESCE(
  (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'color', t.color))
   FROM contact_tags ct
   JOIN tags t ON t.id = ct.tag_id
   WHERE ct.contact_id = c.id),
  '[]'::json
)`;

const CONTACT_SELECT_COLUMNS = `c.id,
              c.name,
              c.image,
              c.type,
              c.phone,
              c.email,
              c.website,
              c.street1,
              c.street2,
              c.city,
              c.state,
              c.zip_code,
              c.country,
              c.country_code,
              c.notes,
              c.role,
              c.created_at,
              c.updated_at,
              ${TAGS_SUBQUERY} AS tags`;

/** SQL fragment: contact row visible to a non-admin user. */
function sqlContactVisibleToUser(userIdParam, roleParam, contactAlias = "c", acAlias = "ac") {
  const c = contactAlias;
  const ac = acAlias;
  return `(
      ${roleParam} IN ('super_admin', 'admin')
      OR ${ac}.added_by_user_id = ${userIdParam}
      OR EXISTS (
        SELECT 1 FROM invitations i
        WHERE i.inviter_user_id = ${userIdParam}
          AND i.account_id = ${ac}.account_id
          AND ${c}.email IS NOT NULL AND TRIM(${c}.email) != ''
          AND LOWER(TRIM(i.invitee_email)) = LOWER(TRIM(${c}.email))
      )
      OR (
        ${roleParam} = 'agent'
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN property_users pu_home ON pu_home.user_id = u.id
          JOIN property_users pu_agent ON pu_agent.property_id = pu_home.property_id
          JOIN users ua ON ua.id = pu_agent.user_id
          WHERE pu_agent.user_id = ${userIdParam}
            AND (ua.role = 'agent' OR LOWER(pu_agent.role::text) = 'agent')
            AND (
              u.contact_id = ${c}.id
              OR (${c}.email IS NOT NULL AND TRIM(${c}.email) != ''
                  AND LOWER(TRIM(u.email)) = LOWER(TRIM(${c}.email)))
            )
        )
      )
      OR (
        ${roleParam} = 'homeowner'
        AND EXISTS (
          SELECT 1 FROM users u
          JOIN property_users pu_agent ON pu_agent.user_id = u.id
          JOIN property_users pu_self ON pu_self.property_id = pu_agent.property_id
          WHERE pu_self.user_id = ${userIdParam}
            AND u.role = 'agent'
            AND (
              u.contact_id = ${c}.id
              OR (${c}.email IS NOT NULL AND TRIM(${c}.email) != ''
                  AND LOWER(TRIM(u.email)) = LOWER(TRIM(${c}.email)))
            )
        )
      )
      OR (
        ${ac}.added_by_user_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM users u
          WHERE ${c}.email IS NOT NULL AND TRIM(${c}.email) != ''
            AND LOWER(TRIM(u.email)) = LOWER(TRIM(${c}.email))
        )
        AND NOT EXISTS (
          SELECT 1 FROM invitations i
          WHERE i.account_id = ${ac}.account_id
            AND ${c}.email IS NOT NULL AND TRIM(${c}.email) != ''
            AND LOWER(TRIM(i.invitee_email)) = LOWER(TRIM(${c}.email))
        )
        AND EXISTS (
          SELECT 1 FROM accounts a
          WHERE a.id = ${ac}.account_id AND a.owner_user_id = ${userIdParam}
        )
      )
    )`;
}

class Contact {
  /** Sync contact_tags for a contact. Replaces existing assignments. */
  static async _syncContactTags(contactId, tagIds) {
    await db.query(
      `DELETE FROM contact_tags WHERE contact_id = $1`,
      [contactId]
    );
    const ids = Array.isArray(tagIds) ? tagIds.filter((id) => id != null) : [];
    if (ids.length === 0) return;
    const values = ids.map((_, i) => `($1, $${i + 2})`).join(", ");
    await db.query(
      `INSERT INTO contact_tags (contact_id, tag_id) VALUES ${values}`,
      [contactId, ...ids]
    );
  }

  /** Create a contact (from data), update db, return new contact data.
   *
   * data should be { name (required), image, type, phone, email, website, street1, street2, city, state, zip_code, country, country_code, notes, role, tagIds? }
   *
   * Returns contact with tags array.
   **/
  static async create(data) {
    const {
      name,
      image = null,
      type = 1,
      phone = null,
      email = null,
      website = null,
      street1 = null,
      street2 = null,
      city = null,
      state = null,
      zip_code = null,
      country = null,
      country_code = null,
      notes = null,
      role = null,
      tagIds,
    } = data;

    const result = await db.query(
      `INSERT INTO contacts (name, image, type, phone, email, website, street1, street2, city, state, zip_code, country, country_code, notes, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id,
                 name,
                 image,
                 type,
                 phone,
                 email,
                 website,
                 street1,
                 street2,
                 city,
                 state,
                 zip_code,
                 country,
                 country_code,
                 notes,
                 role,
                 created_at,
                 updated_at`,
      [name, image, type, phone, email, website, street1, street2, city, state, zip_code, country, country_code, notes, role]
    );

    const contact = result.rows[0];
    await this._syncContactTags(contact.id, tagIds);
    contact.tags = await this._getTagsForContact(contact.id);
    return contact;
  }

  /** Get tags array for a contact. */
  static async _getTagsForContact(contactId) {
    const res = await db.query(
      `SELECT t.id, t.name, t.color
       FROM contact_tags ct
       JOIN tags t ON t.id = ct.tag_id
       WHERE ct.contact_id = $1
       ORDER BY t.name`,
      [contactId]
    );
    return res.rows;
  }

  /** Add a contact to an account.
   *
   * Data: { contactId, accountId }
   *
   * Returns { contact_id, account_id, createdAt, updatedAt }
   **/
  static async addToAccount({ contactId, accountId, addedByUserId = null }) {
    const result = await db.query(
      `INSERT INTO account_contacts (contact_id, account_id, added_by_user_id)
       VALUES ($1, $2, $3)
       RETURNING contact_id,
                 account_id,
                 added_by_user_id AS "addedByUserId",
                 created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [contactId, accountId, addedByUserId ?? null]
    );

    return result.rows[0];
  }

  /** Find all contacts with tags. */
  static async getAll() {
    const result = await db.query(
      `SELECT ${CONTACT_SELECT_COLUMNS}
       FROM contacts c
       ORDER BY c.name`
    );
    return result.rows.map((r) => ({ ...r, tags: r.tags || [] }));
  }

  /** Contacts in an account visible to the requesting user (role-scoped). */
  static async getByAccountIdForUser(accountId, userId, userRole) {
    if (userRole === "super_admin" || userRole === "admin") {
      return this.getByAccountId(accountId);
    }

    const visibility = sqlContactVisibleToUser("$2", "$3");
    const result = await db.query(
      `SELECT ${CONTACT_SELECT_COLUMNS}
       FROM contacts c
       JOIN account_contacts ac ON ac.contact_id = c.id
       WHERE ac.account_id = $1
         AND ${visibility}
       ORDER BY c.name`,
      [accountId, userId, userRole]
    );
    return result.rows.map((r) => ({ ...r, tags: r.tags || [] }));
  }

  /** All contacts across the user's accounts, filtered by role-scoped visibility. */
  static async getAllForUser(userId, userRole) {
    if (userRole === "super_admin" || userRole === "admin") {
      return this.getAll();
    }

    const visibility = sqlContactVisibleToUser("$1", "$2");
    const result = await db.query(
      `SELECT DISTINCT ON (c.id) ${CONTACT_SELECT_COLUMNS}
       FROM contacts c
       JOIN account_contacts ac ON ac.contact_id = c.id
       JOIN account_users au ON au.account_id = ac.account_id
       WHERE au.user_id = $1
         AND ${visibility}
       ORDER BY c.id, c.name`,
      [userId, userRole]
    );
    return result.rows.map((r) => ({ ...r, tags: r.tags || [] }));
  }

  /** Whether userId may view/edit contactId. */
  static async userCanAccess(contactId, userId, userRole) {
    if (userRole === "super_admin" || userRole === "admin") {
      const r = await db.query(`SELECT 1 FROM contacts WHERE id = $1`, [contactId]);
      return r.rows.length > 0;
    }

    const visibility = sqlContactVisibleToUser("$2", "$3");
    const result = await db.query(
      `SELECT 1
       FROM contacts c
       JOIN account_contacts ac ON ac.contact_id = c.id
       JOIN account_users au ON au.account_id = ac.account_id AND au.user_id = $2
       WHERE c.id = $1
         AND ${visibility}
       LIMIT 1`,
      [contactId, userId, userRole]
    );
    return result.rows.length > 0;
  }

  /** Get all contacts for a specific account with tags. */
  static async getByAccountId(accountId) {
    const result = await db.query(
      `SELECT ${CONTACT_SELECT_COLUMNS}
       FROM contacts c
       JOIN account_contacts ac ON ac.contact_id = c.id
       WHERE ac.account_id = $1
       ORDER BY c.name`,
      [accountId]
    );
    return result.rows.map((r) => ({ ...r, tags: r.tags || [] }));
  }

  /** Given a contact id, return data about contact with tags. */
  static async get(id) {
    const result = await db.query(
      `SELECT c.id,
              c.name,
              c.image,
              c.type,
              c.phone,
              c.email,
              c.website,
              c.street1,
              c.street2,
              c.city,
              c.state,
              c.zip_code,
              c.country,
              c.country_code,
              c.notes,
              c.role,
              c.created_at,
              c.updated_at,
              ${TAGS_SUBQUERY} AS tags
       FROM contacts c
       WHERE c.id = $1`,
      [id]
    );

    const contact = result.rows[0];
    if (!contact) throw new NotFoundError(`No contact: ${id}`);
    contact.tags = contact.tags || [];
    return contact;
  }

  /** Update contact data with `data`.
   *
   * Data can include: { name, image, type, phone, email, website, street1, street2, city, state, zip_code, country, country_code, notes, role, tagIds }
   * tagIds replaces contact_tags.
   *
   * Returns contact with tags array.
   */
  static async update(id, data) {
    const { tagIds } = data;
    const updateData = { ...data };
    delete updateData.tagIds;

    const keys = Object.keys(updateData);
    if (keys.length > 0) {
      const { setCols, values } = sqlForPartialUpdate(updateData, {
        zip_code: "zip_code",
        country_code: "country_code",
      });
      const idVarIdx = "$" + (values.length + 1);
      await db.query(
        `UPDATE contacts SET ${setCols} WHERE id = ${idVarIdx}`,
        [...values, id]
      );
    }

    if (tagIds !== undefined) {
      await this._syncContactTags(id, tagIds);
    }

    return this.get(id);
  }

  /** Associations for a contact: properties where the contact is a member
   *  (matched to a platform user via users.contact_id or email) and the
   *  maintenance/inspection records where the contact is the contractor.
   *
   *  Returns { properties, records }.
   */
  static async getAssociations(id) {
    const propertiesResult = await db.query(
      `SELECT DISTINCT ON (p.id)
              p.id,
              p.property_uid,
              p.property_name,
              p.passport_id,
              p.main_photo,
              p.address,
              p.address_line_1,
              p.city,
              p.state,
              p.zip,
              pu.role AS property_role
       FROM contacts c
       JOIN users u
         ON u.contact_id = c.id
         OR (
           c.email IS NOT NULL AND TRIM(c.email) <> ''
           AND LOWER(TRIM(u.email)) = LOWER(TRIM(c.email))
         )
       JOIN property_users pu ON pu.user_id = u.id
       JOIN properties p ON p.id = pu.property_id
       WHERE c.id = $1
       ORDER BY p.id, p.property_name NULLS LAST`,
      [id]
    );

    /* Maintenance/inspection records (property_maintenance) where this contact
     * is the contractor. The contractor is stored as free text inside the
     * record's `data` JSONB (no FK), so match on email first, then name. */
    const recordsResult = await db.query(
      `SELECT pm.id,
              pm.system_key,
              pm.completed_at,
              pm.next_service_date,
              pm.data,
              pm.status,
              p.property_uid,
              p.property_name,
              p.address,
              p.city,
              p.state
       FROM property_maintenance pm
       JOIN properties p ON p.id = pm.property_id
       JOIN contacts c ON c.id = $1
       WHERE (
               c.email IS NOT NULL AND TRIM(c.email) <> ''
               AND LOWER(TRIM(pm.data->>'contractorEmail')) = LOWER(TRIM(c.email))
             )
          OR (
               c.name IS NOT NULL AND TRIM(c.name) <> ''
               AND LOWER(TRIM(pm.data->>'contractor')) = LOWER(TRIM(c.name))
             )
       ORDER BY pm.completed_at DESC NULLS LAST, pm.id DESC`,
      [id]
    );

    const records = recordsResult.rows.map((r) => {
      const data = r.data || {};
      return {
        id: r.id,
        title: data.description || data.recordType || "Maintenance record",
        recordType: data.recordType || null,
        systemKey: r.system_key,
        status: data.status || r.status || null,
        date: r.completed_at || r.next_service_date || null,
        propertyUid: r.property_uid,
        propertyName: r.property_name,
        propertyAddress:
          [r.address, r.city, r.state].filter(Boolean).join(", ") || null,
      };
    });

    return {
      properties: propertiesResult.rows,
      records,
    };
  }

  /** Find a contact by email within a specific account. */
  static async getByEmailAndAccount(email, accountId) {
    const result = await db.query(
      `SELECT c.id, c.name, c.email
       FROM contacts c
       JOIN account_contacts ac ON ac.contact_id = c.id
       WHERE c.email = $1 AND ac.account_id = $2
       LIMIT 1`,
      [email, accountId]
    );
    return result.rows[0] || null;
  }

  /** Delete given contact from database. */
  static async remove(id) {
    const result = await db.query(
      `DELETE FROM contacts WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!result.rows[0]) throw new NotFoundError(`No contact: ${id}`);
  }

  /** Remove contact from all accounts and then delete the contact. */
  static async removeWithAccountLinks(id) {
    await db.query(
      `DELETE FROM account_contacts WHERE contact_id = $1`,
      [id]
    );
    await db.query(`DELETE FROM contact_tags WHERE contact_id = $1`, [id]);
    await this.remove(id);
  }
}

module.exports = Contact;
