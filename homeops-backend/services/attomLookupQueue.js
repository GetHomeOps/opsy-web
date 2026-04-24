"use strict";

/**
 * In-process queue for ATTOM lookup jobs.
 *
 * Serial worker with:
 *   - configurable min delay between ATTOM calls (ATTOM_MIN_DELAY_MS, default 1200ms)
 *     so bulk-import bursts never trip ATTOM's per-second rate limit.
 *   - exponential backoff on transient failures (rate_limited, network errors);
 *     the retry delay is stored on the row (run_after) so it survives restarts.
 *   - startup recovery: re-enqueues every row currently in 'queued' or 'processing',
 *     covering jobs that were in flight when the process crashed / restarted.
 *
 * Suitable for dev/single-instance. Upgrade path to BullMQ/Redis mirrors the
 * existing services/inspectionAnalysisQueue.js.
 */

const AttomLookupJob = require("../models/attomLookupJob");
const { runAttomLookupJob } = require("./attomLookupService");

const MIN_DELAY_MS = parseInt(process.env.ATTOM_MIN_DELAY_MS || "1200", 10) || 1200;
/** Retry backoff (ms) by attempt number (1-indexed). Capped by max_attempts on the row. */
const RETRY_BACKOFF_MS = [15_000, 60_000, 300_000];

const queue = [];
const queuedSet = new Set();
let processing = false;
let lastRunAt = 0;

function nowMs() {
  return Date.now();
}

function enqueue(jobId) {
  const id = Number(jobId);
  if (!Number.isFinite(id)) return;
  if (queuedSet.has(id)) return;
  queuedSet.add(id);
  queue.push(id);
  setImmediate(processNext);
}

function retryDelayForAttempt(attempt) {
  if (!Number.isFinite(attempt) || attempt < 1) return RETRY_BACKOFF_MS[0];
  const idx = Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1);
  return RETRY_BACKOFF_MS[idx];
}

async function runOne(jobId) {
  const elapsedSinceLast = nowMs() - lastRunAt;
  if (elapsedSinceLast < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsedSinceLast));
  }
  lastRunAt = nowMs();

  try {
    const result = await runAttomLookupJob(jobId);
    if (!result?.terminal) {
      let job;
      try {
        job = await AttomLookupJob.get(jobId);
      } catch {
        return;
      }
      const nextAttempt = (job.attempts ?? 0) + 1;
      if (nextAttempt >= (job.max_attempts ?? 3)) {
        await AttomLookupJob.markFailed(jobId, {
          error_code: result.reason || "error",
          error_message:
            result.message || "Exceeded maximum retry attempts for ATTOM lookup",
        });
        return;
      }
      const backoff = Math.max(
        result.retryAfterMs || 0,
        retryDelayForAttempt(nextAttempt)
      );
      await AttomLookupJob.reschedule(jobId, {
        retryAfterMs: backoff,
        error_code: result.reason || null,
        error_message: result.message || null,
      });
      setTimeout(() => enqueue(jobId), backoff);
    }
  } catch (err) {
    console.error("[attomLookupQueue] Unhandled job error:", jobId, err);
    try {
      await AttomLookupJob.markFailed(jobId, {
        error_code: "exception",
        error_message: err?.message || "Unhandled worker exception",
      });
    } catch (innerErr) {
      console.error(
        "[attomLookupQueue] Failed to mark job as failed:",
        jobId,
        innerErr?.message
      );
    }
  }
}

async function processNext() {
  if (processing) return;
  if (queue.length === 0) return;
  processing = true;
  const jobId = queue.shift();
  queuedSet.delete(jobId);
  try {
    await runOne(jobId);
  } finally {
    processing = false;
    if (queue.length > 0) {
      setImmediate(processNext);
    }
  }
}

/**
 * On server startup, re-enqueue anything that was queued or mid-flight when the
 * process died. Delays the initial poll so db/pool is ready. Safe to call
 * multiple times (enqueue is idempotent via queuedSet).
 */
async function recoverPendingJobs() {
  try {
    const ids = await AttomLookupJob.getReadyJobIds({ limit: 1000 });
    if (ids.length === 0) return;
    console.log(
      `[attomLookupQueue] Recovering ${ids.length} pending ATTOM lookup job(s).`
    );
    for (const id of ids) enqueue(id);
  } catch (err) {
    console.error("[attomLookupQueue] recoverPendingJobs failed:", err?.message);
  }
}

module.exports = {
  enqueue,
  recoverPendingJobs,
  MIN_DELAY_MS,
};
