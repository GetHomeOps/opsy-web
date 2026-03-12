"use strict";

/**
 * Auth routes integration tests.
 * Requires DATABASE_URL and SECRET_KEY in env (e.g. from .env).
 * Run: node routes/auth.test.js
 */

require("dotenv").config();
const { describe, it } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../app");

describe("POST /auth/token", () => {
  it("returns 401 with 'Invalid email or password' for invalid credentials", async () => {
    const res = await request(app)
      .post("/auth/token")
      .set("Content-Type", "application/json")
      .send({ email: "nonexistent@example.com", password: "wrongpassword" });

    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    assert.ok(res.body?.error, "Response should have error object");
    assert.ok(res.body.error?.message, "Error should have message");
    assert.match(
      res.body.error.message,
      /Invalid email or password/i,
      `Message should match 'Invalid email or password', got: ${res.body.error.message}`
    );
  });
});
