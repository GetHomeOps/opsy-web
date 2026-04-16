"use strict";

/**
 * Coupon routes integration tests.
 * Run: node --test routes/coupons.test.js
 */

require("dotenv").config();
const crypto = require("crypto");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const request = require("supertest");
const app = require("../app");
const db = require("../db");

let authToken;
const testCode = `TEST${Date.now()}`;

before(async () => {
  const res = await request(app)
    .post("/auth/token")
    .send({
      email: process.env.SUPER_ADMIN_EMAIL || "admin@heyopsy.com",
      password: process.env.SUPER_ADMIN_PASSWORD || "DigitalPassport!",
    });
  authToken = res.body?.accessToken || res.body?.token;
  assert.ok(authToken, `Should get auth token for super admin, got: ${JSON.stringify(res.body)}`);
});

after(async () => {
  await db.query(`DELETE FROM coupon_redemptions WHERE coupon_id IN (SELECT id FROM coupons WHERE code LIKE 'TEST%')`);
  await db.query(`DELETE FROM coupons WHERE code LIKE 'TEST%'`);
  await db.end();
});

describe("POST /coupons", () => {
  it("creates a coupon with valid data", async () => {
    const res = await request(app)
      .post("/coupons")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        code: testCode,
        name: "Test Coupon",
        discountType: "percent",
        discountValue: 20,
        duration: "once",
      });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.coupon, "Response should have coupon object");
    assert.strictEqual(res.body.coupon.code, testCode.toUpperCase());
    assert.strictEqual(res.body.coupon.discountType, "percent");
    assert.strictEqual(Number(res.body.coupon.discountValue), 20);
    assert.strictEqual(res.body.coupon.isActive, true);
  });

  it("rejects duplicate code", async () => {
    const res = await request(app)
      .post("/coupons")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        code: testCode,
        discountType: "percent",
        discountValue: 10,
        duration: "once",
      });

    assert.strictEqual(res.status, 400);
  });

  it("rejects invalid discount type", async () => {
    const res = await request(app)
      .post("/coupons")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        code: `INVALID${Date.now()}`,
        discountType: "bogus",
        discountValue: 10,
        duration: "once",
      });

    assert.strictEqual(res.status, 400);
  });

  it("rejects percent > 100", async () => {
    const res = await request(app)
      .post("/coupons")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        code: `OVER100_${Date.now()}`,
        discountType: "percent",
        discountValue: 150,
        duration: "once",
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.message?.includes("100"), "Should mention 100");
  });

  it("requires durationInMonths for repeating", async () => {
    const res = await request(app)
      .post("/coupons")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        code: `REPEAT${Date.now()}`,
        discountType: "percent",
        discountValue: 10,
        duration: "repeating",
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error?.message?.includes("durationInMonths"), "Should mention durationInMonths");
  });
});

describe("GET /coupons", () => {
  it("returns list of coupons", async () => {
    const res = await request(app)
      .get("/coupons")
      .set("Authorization", `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.coupons), "Should return coupons array");
    assert.ok(res.body.coupons.length > 0, "Should have at least one coupon");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/coupons");
    assert.strictEqual(res.status, 401);
  });
});

describe("GET /coupons/:id", () => {
  it("returns single coupon with redemptions", async () => {
    const listRes = await request(app)
      .get("/coupons")
      .set("Authorization", `Bearer ${authToken}`);
    const couponId = listRes.body.coupons[0]?.id;
    assert.ok(couponId, "Should have a coupon ID");

    const res = await request(app)
      .get(`/coupons/${couponId}`)
      .set("Authorization", `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.coupon, "Should have coupon object");
    assert.ok(Array.isArray(res.body.coupon.redemptions), "Should have redemptions array");
  });
});

describe("PATCH /coupons/:id", () => {
  it("updates coupon name and active status", async () => {
    const listRes = await request(app)
      .get("/coupons")
      .set("Authorization", `Bearer ${authToken}`);
    const coupon = listRes.body.coupons.find((c) => c.code === testCode.toUpperCase());
    assert.ok(coupon, "Should find the test coupon");

    const res = await request(app)
      .patch(`/coupons/${coupon.id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ name: "Updated Test Coupon", isActive: false });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.coupon.name, "Updated Test Coupon");
    assert.strictEqual(res.body.coupon.isActive, false);
  });
});

describe("POST /coupons/validate", () => {
  it("rejects inactive coupon", async () => {
    const res = await request(app)
      .post("/coupons/validate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ code: testCode });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.valid, false);
    assert.ok(res.body.reason?.includes("active"), "Should mention active");
  });

  it("validates a reactivated coupon", async () => {
    const listRes = await request(app)
      .get("/coupons")
      .set("Authorization", `Bearer ${authToken}`);
    const coupon = listRes.body.coupons.find((c) => c.code === testCode.toUpperCase());

    await request(app)
      .patch(`/coupons/${coupon.id}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ isActive: true });

    const res = await request(app)
      .post("/coupons/validate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ code: testCode });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.valid, true);
    assert.ok(res.body.coupon, "Should return coupon details");
    assert.strictEqual(res.body.coupon.code, testCode.toUpperCase());
  });

  it("rejects nonexistent code", async () => {
    const res = await request(app)
      .post("/coupons/validate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ code: "DOESNOTEXIST999" });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.valid, false);
    assert.ok(res.body.reason?.includes("not found"), "Should say not found");
  });

  it("rejects expired coupon", async () => {
    const expiredCode = `EXP${Date.now()}`.toUpperCase();
    // Insert directly into DB to bypass Stripe validation (Stripe rejects past redeem_by)
    await db.query(
      `INSERT INTO coupons (code, discount_type, discount_value, duration, expires_at, is_active)
       VALUES ($1, 'percent', 10, 'once', $2, true)`,
      [expiredCode, new Date(Date.now() - 86400000)]
    );

    const res = await request(app)
      .post("/coupons/validate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ code: expiredCode });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.valid, false);
    assert.ok(res.body.reason?.includes("expired"), "Should mention expired");
  });

  it("rejects coupon at max redemptions", async () => {
    const maxedCode = `MAX${Date.now()}`;
    await request(app)
      .post("/coupons")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        code: maxedCode,
        discountType: "fixed",
        discountValue: 5,
        duration: "once",
        maxRedemptions: 1,
      });

    // Manually set redemption_count = 1
    await db.query(`UPDATE coupons SET redemption_count = 1 WHERE code = $1`, [maxedCode.toUpperCase()]);

    const res = await request(app)
      .post("/coupons/validate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ code: maxedCode });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.valid, false);
    assert.ok(res.body.reason?.includes("maximum"), "Should mention maximum redemptions");
  });
});

describe("DELETE /coupons/:id", () => {
  it("soft-deletes (deactivates) coupon", async () => {
    const listRes = await request(app)
      .get("/coupons")
      .set("Authorization", `Bearer ${authToken}`);
    const coupon = listRes.body.coupons.find((c) => c.code === testCode.toUpperCase());
    assert.ok(coupon, "Should find test coupon");

    const res = await request(app)
      .delete(`/coupons/${coupon.id}`)
      .set("Authorization", `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.coupon.isActive, false);
  });
});

describe("POST /coupons/batch/:batchId/activate", () => {
  it("reactivates unused unique codes in a batch", async () => {
    const batchId = crypto.randomUUID();
    const ts = Date.now();
    const code1 = `TESTBA${ts}1`.toUpperCase();
    const code2 = `TESTBA${ts}2`.toUpperCase();

    await db.query(
      `INSERT INTO coupons (code, discount_type, discount_value, duration, is_active, coupon_type, batch_id, batch_name, redemption_count)
       VALUES ($1, 'percent', 10, 'once', false, 'unique', $3, 'Activate Test Batch', 0),
              ($2, 'percent', 10, 'once', false, 'unique', $3, 'Activate Test Batch', 0)`,
      [code1, code2, batchId]
    );

    const res = await request(app)
      .post(`/coupons/batch/${batchId}/activate`)
      .set("Authorization", `Bearer ${authToken}`);

    assert.strictEqual(res.status, 200, JSON.stringify(res.body));
    assert.strictEqual(res.body.activatedCount, 2);

    const rowRes = await db.query(
      `SELECT COUNT(*)::int AS n FROM coupons WHERE batch_id = $1 AND is_active = true`,
      [batchId]
    );
    assert.strictEqual(rowRes.rows[0].n, 2);
  });
});
