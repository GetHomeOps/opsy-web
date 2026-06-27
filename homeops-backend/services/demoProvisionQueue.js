"use strict";

/**
 * In-process queue for async demo account provisioning on demo.heyopsy.com.
 */

const { provisionDemoAccount } = require("./demoAccountProvisioner");

/** @type {Map<number, object>} */
const jobs = new Map();
const queue = [];
let processing = false;

function getProvisionStatus(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id)) return null;
  const job = jobs.get(id);
  if (!job) return null;
  return {
    userId: id,
    status: job.status,
    demoSummary: job.demoSummary || null,
    error: job.error || null,
    startedAt: job.startedAt || null,
    completedAt: job.completedAt || null,
  };
}

function enqueueDemoProvision(payload) {
  const userId = Number(payload.userId);
  if (!Number.isFinite(userId)) {
    throw new Error("enqueueDemoProvision requires a numeric userId");
  }

  const job = {
    userId,
    status: "pending",
    demoSummary: null,
    error: null,
    startedAt: Date.now(),
    completedAt: null,
  };
  jobs.set(userId, job);
  queue.push({ ...payload, userId });
  setImmediate(processNext);
  return getProvisionStatus(userId);
}

async function processNext() {
  if (processing || queue.length === 0) return;
  processing = true;
  const payload = queue.shift();
  const job = jobs.get(payload.userId);
  if (!job) {
    processing = false;
    if (queue.length > 0) setImmediate(processNext);
    return;
  }

  job.status = "running";
  try {
    const demoSummary = await provisionDemoAccount(payload);
    job.status = "complete";
    job.demoSummary = demoSummary;
    job.completedAt = Date.now();
  } catch (err) {
    job.status = "failed";
    job.error = err.message || "Demo provisioning failed";
    job.completedAt = Date.now();
    console.error("[demoProvisionQueue] job failed:", payload.userId, job.error);
  } finally {
    processing = false;
    if (queue.length > 0) {
      setImmediate(processNext);
    }
  }
}

module.exports = {
  enqueueDemoProvision,
  getProvisionStatus,
};
