"use strict";

/**
 * In-process scheduler for Homeaversary emails.
 * Mirrors sponsorshipScheduler: hourly sweep, idempotent via homeaversary_sends.
 */

const { runHomeaversarySweep } = require("./homeaversaryEmailService");

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const INITIAL_DELAY_MS = 60 * 1000;

let timer = null;
let running = false;

async function runOnce() {
  if (running) return;
  running = true;
  try {
    const result = await runHomeaversarySweep();
    const touched = result.homeownerSent + result.agentSent + result.failed;
    if (touched > 0) {
      console.info(
        `[homeaversary] sweep: homeowner=${result.homeownerSent} agent=${result.agentSent} failed=${result.failed} skipped=${result.skipped}`
      );
    }
  } catch (err) {
    console.warn("[homeaversary] sweep failed:", err?.message);
  } finally {
    running = false;
  }
}

function startHomeaversarySweeper() {
  if (timer) return;
  setTimeout(runOnce, INITIAL_DELAY_MS).unref?.();
  timer = setInterval(runOnce, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.info("[homeaversary] sweeper started (hourly).");
}

module.exports = { startHomeaversarySweeper, runOnce };
