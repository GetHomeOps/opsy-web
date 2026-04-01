"use strict";

/**
 * User Model
 *
 * Handles all user-related database operations for the `users` table.
 * Manages authentication, registration, profile updates, and account associations.
 *
 * Key operations:
 * - authenticate: Verify credentials and return user data
 * - register: Create new user with hashed password
 * - get / getByAccountId / getUsersBySharedAccounts: Retrieve user(s)
 * - update / remove: Modify or delete user records
 * - changePassword / activateFromInvitation: Account lifecycle operations
 */

const db = require("../db");
const bcrypt = require("bcrypt");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
} = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");


const { BCRYPT_WORK_FACTOR } = require("../config.js");

//Model for user-related functions
class User {

  /** authenticate user with username, password.
  *
  * Returns {  email, fullName, phone, role, contact, isActive }
  *
  * Throws UnauthorizedError is user not found or wrong password.
  **/
  static async authenticate(email, password) {
    // try to find the user first
    const result = await db.query(`
      SELECT id,
             email,
             password_hash AS "password",
             name,
             phone,
             role,
             contact_id AS "contact",
             is_active AS "isActive",
             mfa_enabled AS "mfaEnabled",
             onboarding_completed AS "onboardingCompleted",
             email_verified AS "emailVerified",
             auth_provider AS "authProvider"
      FROM users
      WHERE email = $1`,
      [email]
    );

    const user = result.rows[0];

    if (user) {
      // User may have no password (e.g. Google OAuth signup)
      if (!user.password) {
        throw new UnauthorizedError("This account uses Google sign-in. Please use the Google button to sign in.");
      }
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        delete user.password;
        if (user.emailVerified !== true && user.role !== "super_admin") {
          throw new UnauthorizedError(
            "Please verify your email before signing in. Check your inbox for the verification link, or use \"Resend verification\" on the sign-in page."
          );
        }
        return user;
      }
    }
    throw new UnauthorizedError("Invalid email or password");
  }

  /** Register user with data.
 *
 * Data should include: { name (required), email (required), password, phone, role, contact, isActive }
 *
 * Returns { email, fullName, phone, role, contact, isActive }
 *
 * Throws BadRequestError on duplicates.
 **/
  static async register({ name, email, password, phone = null, role = 'homeowner', contact = 0, is_active = false, onboarding_completed }) {
    if (name == null || (typeof name === 'string' && name.trim() === '')) {
      throw new BadRequestError("Name is required");
    }
    if (email == null || (typeof email === 'string' && email.trim() === '')) {
      throw new BadRequestError("Email is required");
    }
    if (password == null || (typeof password === 'string' && password.length < 4)) {
      throw new BadRequestError("Password is required and must be at least 4 characters");
    }

    const duplicateCheck = await db.query(`
      SELECT email
      FROM users
      WHERE email =$1`,
      [email]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new BadRequestError(`Duplicate user: ${email}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    // Ensure contact is an integer, defaulting to 0 if null/undefined
    const contactId = contact === null || contact === undefined ? 0 : parseInt(contact, 10) || 0;

    const includeOnboarding = onboarding_completed === false;
    const cols = includeOnboarding
      ? "email, password_hash, name, phone, role, contact_id, is_active, onboarding_completed, auth_provider, email_verified"
      : "email, password_hash, name, phone, role, contact_id, is_active, auth_provider, email_verified";
    const vals = includeOnboarding ? "$1,$2,$3,$4,$5,$6,$7,$8,$9,$10" : "$1,$2,$3,$4,$5,$6,$7,$8,$9";
    const params = [email, hashedPassword, name, phone, role, contactId, is_active];
    if (includeOnboarding) params.push(false);
    // Bootstrap super admin (npm start) has no inbox to verify
    params.push("local", role === "super_admin");

    const result = await db.query(`
        INSERT INTO users (${cols})
        VALUES (${vals})
        RETURNING
              id,
              email,
              name,
              phone,
              role,
              contact_id AS "contact",
              is_active`, params
    );

    const user = result.rows[0];

    return user;
  }

  /** Given a user ID, return data about user.
   *
   * Returns { id, email, name, phone, role, contact, isActive, image }
   * or null if not found.
   */
  static async getById(id) {
    const result = await db.query(
      `SELECT id,
             email,
             name,
             phone,
             role,
             contact_id AS "contact",
             is_active AS "isActive",
             image,
             auth_provider AS "authProvider",
             google_sub AS "googleSub",
             avatar_url AS "avatarUrl",
             email_verified AS "emailVerified",
             mfa_enabled AS "mfaEnabled",
             mfa_enrolled_at AS "mfaEnrolledAt",
             subscription_tier AS "subscriptionTier",
             onboarding_completed AS "onboardingCompleted",
             welcome_modal_dismissed AS "welcomeModalDismissed"
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /** Find user by Google sub. Returns null if not found. */
  static async findByGoogleSub(googleSub) {
    if (!googleSub) return null;
    const result = await db.query(
      `SELECT id, email, name, phone, role, contact_id AS "contact",
              is_active AS "isActive", image, auth_provider AS "authProvider",
              google_sub AS "googleSub", avatar_url AS "avatarUrl",
              email_verified AS "emailVerified",
              subscription_tier AS "subscriptionTier",
              onboarding_completed AS "onboardingCompleted",
              welcome_modal_dismissed AS "welcomeModalDismissed"
       FROM users WHERE google_sub = $1`,
      [googleSub]
    );
    return result.rows[0] || null;
  }

  /** Find user by email. Returns null if not found. */
  static async findByEmailOrNull(email) {
    if (!email) return null;
    const result = await db.query(
      `SELECT id, email, name, phone, role, contact_id AS "contact",
              is_active AS "isActive", image, auth_provider AS "authProvider",
              google_sub AS "googleSub", avatar_url AS "avatarUrl",
              email_verified AS "emailVerified",
              subscription_tier AS "subscriptionTier",
              onboarding_completed AS "onboardingCompleted",
              welcome_modal_dismissed AS "welcomeModalDismissed"
       FROM users WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  /** Register a new user via Google OAuth (no password).
   * Sets onboarding_completed = false so user is redirected to onboarding flow. */
  static async registerGoogle({ email, name, avatarUrl, emailVerified, googleSub }) {
    if (!email || !name || !googleSub) {
      throw new BadRequestError("Email, name, and googleSub are required for Google signup");
    }
    const duplicateCheck = await db.query(
      `SELECT id FROM users WHERE email = $1 OR google_sub = $2`,
      [email, googleSub]
    );
    if (duplicateCheck.rows.length > 0) {
      throw new BadRequestError(`Account already exists for ${email}`);
    }
    const result = await db.query(
      `INSERT INTO users (email, name, auth_provider, google_sub, avatar_url, email_verified, is_active, onboarding_completed)
       VALUES ($1, $2, 'google', $3, $4, $5, false, false)
       RETURNING id, email, name, phone, role, contact_id AS "contact",
                 is_active AS "isActive", image, auth_provider AS "authProvider",
                 google_sub AS "googleSub", avatar_url AS "avatarUrl",
                 email_verified AS "emailVerified",
                 subscription_tier AS "subscriptionTier",
                 onboarding_completed AS "onboardingCompleted",
                 welcome_modal_dismissed AS "welcomeModalDismissed"`,
      [email, name, googleSub, avatarUrl || null, emailVerified ?? true]
    );
    return result.rows[0];
  }

  /** Link Google account to existing user (e.g. local user signing in with Google). */
  static async linkGoogle(userId, googleSub, emailVerifiedFromGoogle = true) {
    const ev =
      emailVerifiedFromGoogle === undefined || emailVerifiedFromGoogle === null
        ? true
        : !!emailVerifiedFromGoogle;
    const result = await db.query(
      `UPDATE users SET google_sub = $1, auth_provider = 'google', email_verified = $3 WHERE id = $2
       RETURNING id, email, name, phone, role, contact_id AS "contact",
                 is_active AS "isActive", image, auth_provider AS "authProvider",
                 google_sub AS "googleSub", avatar_url AS "avatarUrl",
                 email_verified AS "emailVerified",
                 subscription_tier AS "subscriptionTier",
                 onboarding_completed AS "onboardingCompleted",
                 welcome_modal_dismissed AS "welcomeModalDismissed"`,
      [googleSub, userId, ev]
    );
    return result.rows[0] || null;
  }

  /** Set email_verified (e.g. after accepting invitation or admin action). */
  static async setEmailVerified(userId, verified = true) {
    const result = await db.query(
      `UPDATE users SET email_verified = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email_verified AS "emailVerified"`,
      [!!verified, userId]
    );
    return result.rows[0] || null;
  }

  /** Given an email, return data about user.
   *
   * Returns { email, fullName, phone, role, contact, isActive }
   *
   * Throws NotFoundError if user not found.
   **/
  static async get(email) {
    try {
      const userRes = await db.query(`
        SELECT id,
               email,
               name,
               phone,
               role,
               contact_id AS "contact",
               is_active AS "isActive",
               image,
               auth_provider AS "authProvider",
               google_sub AS "googleSub",
               avatar_url AS "avatarUrl",
               email_verified AS "emailVerified",
               mfa_enabled AS "mfaEnabled",
               mfa_enrolled_at AS "mfaEnrolledAt",
               subscription_tier AS "subscriptionTier",
               onboarding_completed AS "onboardingCompleted",
               welcome_modal_dismissed AS "welcomeModalDismissed"
        FROM users
        WHERE email=$1`,
        [email]
      );

      const user = userRes.rows[0];

      if (!user) throw new NotFoundError(`No user: ${email}`);

      return user;
    } catch (err) {
      throw err;
    }
  }

  /* Get all users by account id */
  static async getByAccountId(accountId) {
    try {
      const userRes = await db.query(`
      SELECT u.id,
             u.email,
             u.name,
             u.phone,
             u.contact_id AS "contact",
             u.is_active AS "isActive",
             u.image,
             au.role
      FROM account_users au
      JOIN users u ON u.id = au.user_id
      WHERE au.account_id = $1`,
        [accountId]
      );
      return userRes.rows;
    } catch (err) {
      throw err;
    }
  }

  /* Get user + all users that share any account with this user */
  static async getUsersBySharedAccounts(userId) {
    try {
      const userRes = await db.query(`
      SELECT u.id,
             u.email,
             u.name,
             u.phone,
             u.contact_id AS "contact",
             u.is_active AS "isActive",
             u.image,
             u.role::text AS "role"
      FROM users u
      WHERE u.id = $1

      UNION

      SELECT DISTINCT u.id,
             u.email,
             u.name,
             u.phone,
             u.contact_id AS "contact",
             u.is_active AS "isActive",
             u.image,
             u.role::text AS "role"
      FROM account_users au1
      JOIN account_users au2 ON au2.account_id = au1.account_id
      JOIN users u ON u.id = au2.user_id
      WHERE au1.user_id = $1 AND au2.user_id != $1`,
        [userId]
      );
      return userRes.rows;
    } catch (err) {
      throw err;
    }
  }

  /** Return all active users with the agent role only (excludes admin, super_admin). */
  static async getAgents() {
    const result = await db.query(`
      SELECT id, email, name, image, avatar_url AS "avatarUrl"
      FROM users
      WHERE role = 'agent' AND is_active = true
      ORDER BY name`);
    return result.rows;
  }

  /** Return data of ALL users.
   *
   * Returns { email, fullName, phone, role, contact, isActive }
   *
   * Throws NotFoundError if user not found.
   **/
  static async getAll() {
    try {
      const userRes = await db.query(`
        SELECT u.id,
               u.email,
               u.name,
               u.phone,
               u.role,
               u.contact_id AS "contact",
               u.is_active AS "isActive",
               u.onboarding_completed AS "onboardingCompleted",
               u.subscription_tier AS "subscriptionTier",
               u.image,
               u.created_at AS "createdAt",
               u.updated_at AS "updatedAt",
               latest_sub.status AS "latestSubscriptionStatus",
               latest_sub.code AS "latestSubscriptionPlanCode",
               latest_sub.account_id AS "latestSubscriptionAccountId",
               latest_sub.updated_at AS "latestSubscriptionUpdatedAt",
               CASE
                 WHEN u.onboarding_completed = false THEN false
                 WHEN u.role = 'agent' THEN true
                WHEN u.role = 'homeowner'
                  AND u.subscription_tier IS NOT NULL
                  AND u.subscription_tier NOT IN ('free', 'beta_homeowner') THEN true
                 ELSE false
               END AS "paidRequired",
               (paid_active.has_paid IS NOT NULL) AS "hasActivePaidSubscription",
               CASE
                 WHEN u.is_active IS NOT TRUE THEN 'disabled'
                 WHEN u.onboarding_completed = false THEN 'onboarding_pending'
                 WHEN (
                   CASE
                     WHEN u.onboarding_completed = false THEN false
                     WHEN u.role = 'agent' THEN true
                    WHEN u.role = 'homeowner'
                      AND u.subscription_tier IS NOT NULL
                      AND u.subscription_tier NOT IN ('free', 'beta_homeowner') THEN true
                     ELSE false
                   END
                 ) AND paid_active.has_paid IS NULL THEN 'payment_pending'
                 ELSE 'active'
               END AS "accessState"
        FROM users u
        LEFT JOIN LATERAL (
          SELECT asub.status, sp.code, asub.account_id, asub.updated_at
          FROM account_users au
          JOIN account_subscriptions asub ON asub.account_id = au.account_id
          LEFT JOIN subscription_products sp ON sp.id = asub.subscription_product_id
          WHERE au.user_id = u.id
          ORDER BY
            CASE WHEN asub.status IN ('active', 'trialing') THEN 0 ELSE 1 END,
            asub.updated_at DESC NULLS LAST,
            asub.id DESC
          LIMIT 1
        ) latest_sub ON true
        LEFT JOIN LATERAL (
          SELECT 1 AS has_paid
          FROM account_users au
          JOIN account_subscriptions asub ON asub.account_id = au.account_id
          JOIN subscription_products sp ON sp.id = asub.subscription_product_id
          WHERE au.user_id = u.id
            AND asub.status IN ('active', 'trialing')
            AND COALESCE(sp.price, 0) > 0
          LIMIT 1
        ) paid_active ON true`
      );

      const users = userRes.rows;

      if (!users) throw new NotFoundError(`No users found`);

      return users;
    } catch (err) {
      throw err;
    }
  }

  /** Update user data with `data`.
     *
     * This is a "partial update" --- it's fine if data doesn't contain
     * all the fields; this only changes provided ones.
     *
     * Data can include:
     *   { name, email, phone, role, contact, password, isActive }
     *
     * Returns { email, fullName, phone, role, contact, isActive }
     *
     * Throws NotFoundError if not found.
     *
     * WARNING: this function can set a new password or make a user inactive.
     * Callers of this function must be certain they have validated inputs to this
     * or serious security risks are opened.
     */
  static async update({ id, name, phone, contact, image, avatar_url, welcome_modal_dismissed }) {
    try {
      const fields = {};
      if (name !== undefined) fields.name = name;
      if (phone !== undefined) fields.phone = phone;
      if (contact !== undefined) fields.contact_id = contact;
      if (image !== undefined) fields.image = image;
      if (avatar_url !== undefined) fields.avatar_url = avatar_url;
      if (welcome_modal_dismissed !== undefined) fields.welcome_modal_dismissed = welcome_modal_dismissed;

      if (Object.keys(fields).length === 0) {
        throw new BadRequestError("No data to update");
      }

      const { setCols, values } = sqlForPartialUpdate(fields,
        {
          contact_id: "contact_id"
        });
      const idVarIdx = "$" + (values.length + 1);

      const querySql = `
      UPDATE users
      SET ${setCols}
      WHERE id = ${idVarIdx}
      RETURNING id,
                email,
                name,
                phone,
                role,
                contact_id AS "contact",
                is_active AS "isActive",
                image,
                welcome_modal_dismissed AS "welcomeModalDismissed"
                `;
      const result = await db.query(querySql, [...values, id]);
      const user = result.rows[0];

      if (!user) throw new NotFoundError(`No user: ${id}`);

      return user;
    } catch (err) {
      throw err;
    }
  }

  /** Complete onboarding for Google OAuth signup. Updates role, subscriptionTier, onboardingCompleted, is_active. */
  static async completeOnboarding(userId, { role, subscriptionTier }) {
    const result = await db.query(
      `UPDATE users
       SET role = $1, subscription_tier = $2, onboarding_completed = true, is_active = true
       WHERE id = $3
       RETURNING id, email, name, phone, role, contact_id AS "contact",
                 is_active AS "isActive", image, auth_provider AS "authProvider",
                 google_sub AS "googleSub", avatar_url AS "avatarUrl",
                 email_verified AS "emailVerified",
                 subscription_tier AS "subscriptionTier",
                 onboarding_completed AS "onboardingCompleted"`,
      [role, subscriptionTier || null, userId]
    );
    const user = result.rows[0];
    if (!user) throw new NotFoundError(`No user: ${userId}`);
    return user;
  }


  /** Remove user. Returns removed user id
   *
   * Returns { id }
   *
   * Throws NotFoundError if user not found.
   **/
  static async remove(id) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const userCheck = await client.query(
        `SELECT id, role
         FROM users
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );

      if (!userCheck.rows[0]) throw new NotFoundError(`No user: ${id}`);

      if (userCheck.rows[0].role === "super_admin") {
        const err = new ForbiddenError(
          "Super admin accounts cannot be deleted."
        );
        err.code = "SUPER_ADMIN_PROTECTED";
        throw err;
      }

      const ownsAnyProperty = await client.query(
        `SELECT 1
         FROM property_users pu
         JOIN properties p ON p.id = pu.property_id
         WHERE pu.user_id = $1
           AND pu.role = 'owner'
         LIMIT 1`,
        [id]
      );

      if (ownsAnyProperty.rows.length > 0) {
        const err = new BadRequestError(
          "This user is a property owner. Transfer property ownership before deleting this user."
        );
        err.code = "PROPERTY_OWNER";
        throw err;
      }

      const ownedAccountsRes = await client.query(
        `SELECT a.id,
                EXISTS (
                  SELECT 1
                  FROM properties p
                  WHERE p.account_id = a.id
                ) AS "hasProperties"
         FROM accounts a
         WHERE a.owner_user_id = $1
         FOR UPDATE`,
        [id]
      );

      const ownedAccountsWithProperties = ownedAccountsRes.rows.filter(
        (row) => row.hasProperties === true
      );
      if (ownedAccountsWithProperties.length > 0) {
        const err = new BadRequestError(
          "This user is a property owner. Transfer property ownership before deleting this user."
        );
        err.code = "PROPERTY_OWNER";
        throw err;
      }

      for (const account of ownedAccountsRes.rows) {
        const nextOwnerRes = await client.query(
          `SELECT user_id AS "userId"
           FROM account_users
           WHERE account_id = $1
             AND user_id <> $2
           ORDER BY CASE role
                    WHEN 'owner' THEN 1
                    WHEN 'admin' THEN 2
                    ELSE 3
                    END,
                    created_at ASC
           LIMIT 1`,
          [account.id, id]
        );

        const nextOwner = nextOwnerRes.rows[0]?.userId;
        if (nextOwner) {
          await client.query(
            `UPDATE accounts
             SET owner_user_id = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [nextOwner, account.id]
          );
        } else {
          await client.query(
            `DELETE FROM invitations
             WHERE account_id = $1`,
            [account.id]
          );
          await client.query(
            `UPDATE professionals
             SET account_id = NULL
             WHERE account_id = $1`,
            [account.id]
          );
          await client.query(
            `DELETE FROM accounts
             WHERE id = $1`,
            [account.id]
          );
        }
      }

      const result = await client.query(
        `DELETE
         FROM users
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      const user = result.rows[0];
      if (!user) throw new NotFoundError(`No user: ${id}`);

      await client.query("COMMIT");
      return user;
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        // Ignore rollback errors; original error is more relevant.
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize Super Admin if none exists.
   *
   * This function should be called once during the application's startup
   * process to ensure that at least one super admin account exists in the system.
   */
  static async initializeSuperAdmin() {
    try {
      const result = await db.query(
        `SELECT id FROM users WHERE role='super_admin'`
      );

      if (result.rows.length === 0) {
        const res = await this.register({
          name: process.env.SUPER_ADMIN_FULL_NAME,
          email: process.env.SUPER_ADMIN_EMAIL,
          password: process.env.SUPER_ADMIN_PASSWORD,
          role: 'super_admin',
          is_active: true,
        });

        console.log("Super admin initialized");
        return res;
      }

      await db.query(
        `UPDATE users SET email_verified = true, updated_at = NOW()
         WHERE role = 'super_admin' AND email_verified IS NOT TRUE`
      );

      return result.rows[0];
    } catch (err) {
      throw err;
    }
  }

  /* Check if user is linked to any account and return the account id */
  static async userHasAccount(userId) {
    try {
      const result = await db.query(
        `SELECT account_id
        FROM account_users
        WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0];
    } catch (err) {
      throw err;
    }
  }

  /** Change password for a user. Requires current password verification.
   * @param {number} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  static async changePassword(userId, currentPassword, newPassword) {
    const result = await db.query(
      `SELECT password_hash AS "passwordHash" FROM users WHERE id = $1`,
      [userId]
    );
    const user = result.rows[0];
    if (!user) throw new NotFoundError(`No user with id: ${userId}`);

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedError("Current password is incorrect");

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_WORK_FACTOR);
    await db.query(
      `UPDATE users SET password_hash = $1 WHERE id = $2`,
      [hashedPassword, userId]
    );
  }

  /* ----- Invitation functions ----- */

  /* Activate user from invitation */
  static async activateFromInvitation(userId, password) {
    try {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

      const result = await db.query(
        `UPDATE users
      SET password_hash = $1,
          is_active = true
      WHERE id = $2
      RETURNING id,
       email,
       name AS "fullName",
       phone,
       role,
       contact_id AS "contact",
       is_active AS "isActive"`,
        [hashedPassword, userId]
      );

      return result.rows[0];
    } catch (err) {
      throw err;
    }
  }

  /* Activate Signup User */
  static async activateUser(userId) {
    try {
      const result = await db.query(
        `UPDATE users
      SET is_active = true
      WHERE id = $1
      RETURNING id, email, name, phone, role, contact_id AS "contact", is_active AS "isActive"`,
        [userId]
      );
      return result.rows[0];
    } catch (err) {
      throw err;
    }
  }

  /* ----- MFA functions ----- */

  /** Get decrypted TOTP secret for a user. Internal use only. */
  static async getMfaSecret(userId) {
    const result = await db.query(
      `SELECT mfa_secret_encrypted AS "secretEncrypted" FROM users WHERE id = $1`,
      [userId]
    );
    const row = result.rows[0];
    if (!row || !row.secretEncrypted) return null;
    const { decrypt } = require("../helpers/encryption");
    return decrypt(row.secretEncrypted);
  }

  /** Set user as MFA enrolled with encrypted secret. */
  static async setMfaEnrolled(userId, encryptedSecret) {
    await db.query(
      `UPDATE users SET mfa_enabled = true, mfa_secret_encrypted = $1, mfa_enrolled_at = NOW() WHERE id = $2`,
      [encryptedSecret, userId]
    );
  }

  /** Clear MFA for user. */
  static async clearMfa(userId) {
    await db.query(
      `UPDATE users SET mfa_enabled = false, mfa_secret_encrypted = NULL, mfa_enrolled_at = NULL WHERE id = $1`,
      [userId]
    );
  }
}

module.exports = User;
