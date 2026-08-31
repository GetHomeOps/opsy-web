"use strict";

const express = require("express");
const jsonschema = require("jsonschema");
const { ensureLoggedIn, ensurePlatformAdmin, ensureAdminOrSuperAdmin, ensureUserCanAccessAccountByParam, ensureSelfOrAdmin } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const Account = require("../models/account");
const accountUpdateSchema = require("../schemas/accountUpdate.json");
const accountBrandingUpdateSchema = require("../schemas/accountBrandingUpdate.json");
const {
  getEffectiveAccountBranding,
  assertAccountCustomizable,
} = require("../services/brandingService");

const router = express.Router();

/** GET / - List all accounts. Platform admin only. */
router.get("/", ensurePlatformAdmin, async function (req, res, next) {
  try {
    const accounts = await Account.getAll();
    return res.json({ accounts });
  } catch (err) {
    return next(err);
  }
});

/** GET /user/:userId - List accounts for a user. Must be self or admin. */
router.get("/user/:userId", ensureLoggedIn, ensureSelfOrAdmin("userId"), async function (req, res, next) {
  try {
    const accounts = await Account.getUserAccounts(req.params.userId);
    return res.json({ accounts });
  } catch (err) {
    return next(err);
  }
});

/** GET /:id/branding - Effective branding (inheritance applied). Members + platform admins. */
router.get(
  "/:id/branding",
  ensureLoggedIn,
  ensureUserCanAccessAccountByParam("id"),
  async function (req, res, next) {
    try {
      const branding = await getEffectiveAccountBranding(req.params.id);
      return res.json({ branding });
    } catch (err) {
      return next(err);
    }
  }
);

/** PATCH /:id/branding - Update account branding. Platform admin only; agent accounts only. */
router.patch(
  "/:id/branding",
  ensureLoggedIn,
  ensurePlatformAdmin,
  async function (req, res, next) {
    try {
      const validator = jsonschema.validate(req.body, accountBrandingUpdateSchema);
      if (!validator.valid) {
        const errs = validator.errors.map((e) => e.stack);
        throw new BadRequestError(errs);
      }
      await assertAccountCustomizable(req.params.id);
      const branding = await Account.updateBranding(req.params.id, req.body);
      return res.json({
        branding: {
          ...branding,
          source: "account",
          customizable: true,
          inheritsFromLabel: null,
          inheritsFromType: null,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
);

/** GET /:id - Get single account. Requires account membership. */
router.get("/:id", ensureLoggedIn, ensureUserCanAccessAccountByParam("id"), async function (req, res, next) {
  try {
    const account = await Account.get(req.params.id);
    return res.json({ account });
  } catch (err) {
    return next(err);
  }
});

/** POST / - Create account. Owner is the current user unless a platform admin sets otherwise. */
router.post("/", ensureLoggedIn, async function (req, res, next) {
  try {
    const role = res.locals.user?.role;
    const requestedOwner = req.body.ownerUserId ?? req.body.owner_user_id;
    const ownerUserId =
      role === "super_admin" || role === "admin"
        ? requestedOwner || res.locals.user.id
        : res.locals.user.id;
    const account = await Account.create({
      name: req.body.name,
      ownerUserId,
    });
    return res.status(201).json({ account });
  } catch (err) {
    return next(err);
  }
});

/** POST /account_users - Add user to account. Body: { userId, accountId, role }. Admin/super admin only. */
router.post("/account_users", ensureAdminOrSuperAdmin, async function (req, res, next) {
  try {
    const accountUser = await Account.addUserToAccount(req.body);
    return res.status(201).json({ accountUser });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /:id - Update account. Requires account membership. */
router.patch("/:id", ensureLoggedIn, ensureUserCanAccessAccountByParam("id"), async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, accountUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map((e) => e.stack);
      throw new BadRequestError(errs);
    }
    const account = await Account.update(req.params.id, req.body);
    return res.json({ account });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /:id - Remove account. Admin or super admin only. */
router.delete("/:id", ensurePlatformAdmin, async function (req, res, next) {
  try {
    await Account.remove(req.params.id);
    return res.json({ deleted: req.params.id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
