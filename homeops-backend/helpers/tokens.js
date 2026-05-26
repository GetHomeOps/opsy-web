"use strict";

/**
 * Tokens Helper
 *
 * Creates signed JWTs for authentication. Two token types:
 * - Access token: short-lived (15m), carries user identity for API calls
 * - Refresh token: long-lived (7d), used only to obtain new access tokens
 *
 * Optional impersonation claims (access + refresh):
 * - impersonatorId, impersonatorEmail — set when a super admin is viewing as another user
 *
 * Exports: createAccessToken, createRefreshToken, createToken (alias)
 */

const jwt = require("jsonwebtoken");
const { SECRET_KEY } = require("../config");

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function buildImpersonationClaims(impersonator) {
  if (!impersonator?.id) return {};
  return {
    impersonatorId: impersonator.id,
    impersonatorEmail: impersonator.email,
  };
}

function createAccessToken(user, impersonator = null) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      ...buildImpersonationClaims(impersonator),
    },
    SECRET_KEY,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function createRefreshToken(user, impersonator = null) {
  return jwt.sign(
    {
      id: user.id,
      type: "refresh",
      ...buildImpersonationClaims(impersonator),
    },
    SECRET_KEY,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

function getRefreshTokenExpiresAt() {
  return new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);
}

function impersonatorFromPayload(payload) {
  if (!payload?.impersonatorId) return null;
  return {
    id: payload.impersonatorId,
    email: payload.impersonatorEmail,
  };
}

const createToken = createAccessToken;

module.exports = {
  createToken,
  createAccessToken,
  createRefreshToken,
  getRefreshTokenExpiresAt,
  impersonatorFromPayload,
};
