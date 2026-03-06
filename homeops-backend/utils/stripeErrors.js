"use strict";

/**
 * Stripe error handling utilities.
 * Maps Stripe API errors to user-friendly messages.
 * See https://docs.stripe.com/api/errors
 */

const { BadRequestError } = require("../expressError");

/** Stripe error codes that indicate a card/payment issue (user should retry with different card). */
const CARD_ERROR_CODES = ["card_declined", "expired_card", "incorrect_cvc", "incorrect_number"];

/**
 * Convert Stripe error to a user-friendly message.
 * @param {Error} err - Stripe or other error
 * @param {string} fallback - Message when we can't determine a good one
 * @returns {string}
 */
function stripeErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;

  const code = err.code || err.type;
  const message = err.message || "";

  if (CARD_ERROR_CODES.includes(code)) {
    if (code === "card_declined") {
      return "Your card was declined. Please try a different payment method.";
    }
    if (code === "expired_card") return "Your card has expired. Please use a different card.";
    if (code === "incorrect_cvc") return "The security code is incorrect. Please check and try again.";
    if (code === "incorrect_number") return "The card number is invalid. Please check and try again.";
    return "There was a problem with your card. Please try a different payment method.";
  }

  if (code === "resource_missing") {
    return "The requested resource was not found. Please contact support.";
  }

  if (code === "rate_limit_error") {
    return "Too many requests. Please wait a moment and try again.";
  }

  if (message && message.length < 120) return message;
  return fallback;
}

/**
 * Wrap an async route handler to convert Stripe errors to BadRequestError with user-friendly messages.
 * Re-throws non-Stripe errors unchanged.
 */
function wrapStripeErrors(handler) {
  return async function (req, res, next) {
    try {
      return await handler(req, res, next);
    } catch (err) {
      if (err && (err.type === "StripeError" || err.type?.startsWith?.("Stripe"))) {
        const msg = stripeErrorMessage(err, "Payment could not be processed. Please try again.");
        return next(new BadRequestError(msg));
      }
      return next(err);
    }
  };
}

module.exports = { stripeErrorMessage, wrapStripeErrors, CARD_ERROR_CODES };
