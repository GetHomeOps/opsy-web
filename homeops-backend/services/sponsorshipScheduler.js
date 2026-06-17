"use strict";

/**
 * In-process scheduler for agent-subsidized billing maintenance.
 *
 * There is no external cron in this app, so we run a lightweight interval sweep
 * (mirroring the attomLookupQueue pattern). The sweep is idempotent and safe to
 * run repeatedly: it activates overdue pending offers (missed-webhook safety net),
 * expires grace periods, sends grace reminders, and revalidates active sponsors.
 */

const propertySponsorshipService = require("./propertySponsorshipService");

const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const INITIAL_DELAY_MS = 60 * 1000; // first run shortly after boot

let timer = null;
let running = false;

async function runOnce() {
  if (running) return; // avoid overlapping sweeps
  running = true;
  try {
    const result = await propertySponsorshipService.runSponsorshipSweep();
    const touched =
      result.activatedPending + result.expiredGrace + result.reminders + result.revalidated;
    if (touched > 0) {
      console.info(
        `[sponsorship] sweep: activated=${result.activatedPending} expiredGrace=${result.expiredGrace} reminders=${result.reminders} revalidated=${result.revalidated}`
      );
    }
  } catch (err) {
    console.warn("[sponsorship] sweep failed:", err?.message);
  } finally {
    running = false;
  }
}

function startSponsorshipSweeper() {
  if (timer) return; // already started
  setTimeout(runOnce, INITIAL_DELAY_MS).unref?.();
  timer = setInterval(runOnce, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.info("[sponsorship] grace/pending sweeper started (hourly).");
}

module.exports = { startSponsorshipSweeper, runOnce };
