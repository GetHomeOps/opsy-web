"use strict";

const express = require("express");
const { ensureLoggedIn } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const {
  fetchAttomBasicProfile,
  mapAttomToFields,
} = require("../services/attomLookupService");

const router = new express.Router();

/** POST /property-details — Look up property details from ATTOM public records. */
router.post("/property-details", ensureLoggedIn, async function (req, res, next) {
  try {
    const { address, addressLine1, city, state, zip } = req.body ?? {};
    const lookup = await fetchAttomBasicProfile({
      address,
      addressLine1,
      city,
      state,
      zip,
    });

    if (lookup.status === "missing_config") {
      throw new BadRequestError("ATTOM API key is not configured");
    }
    if (lookup.status === "invalid_input") {
      throw new BadRequestError(lookup.message);
    }
    if (lookup.status === "auth_error") {
      throw new BadRequestError(lookup.message);
    }
    if (lookup.status === "rate_limited") {
      throw new BadRequestError(lookup.message);
    }
    if (lookup.status === "not_found") {
      throw new BadRequestError(lookup.message);
    }
    if (lookup.status !== "success") {
      throw new BadRequestError(
        "Property could not be found. Please verify the address and try again."
      );
    }

    const prediction = mapAttomToFields(lookup.rawProperty, lookup.fullData);

    return res.json({
      prediction,
      source: "attom",
    });
  } catch (err) {
    if (err instanceof BadRequestError) return next(err);
    console.error("ATTOM property lookup error:", err);
    return next(
      new BadRequestError(
        "Property could not be found. Please verify the address and try again."
      )
    );
  }
});

module.exports = router;
