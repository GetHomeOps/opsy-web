"use strict";

/**
 * Lightweight in-process queue for pre-purchase analysis jobs.
 * Suitable for dev/single-instance. Can be upgraded to BullMQ/Redis later.
 */

const { runAnalysis } = require("./prePurchaseAnalysisService");

const queue = [];
let processing = false;

async function processNext() {
  if (processing || queue.length === 0) return;
  processing = true;
  const analysisId = queue.shift();
  try {
    await runAnalysis(analysisId);
  } catch (err) {
    console.error("[prePurchaseAnalysisQueue] Job failed:", analysisId, err);
  } finally {
    processing = false;
    if (queue.length > 0) {
      setImmediate(processNext);
    }
  }
}

function enqueue(analysisId) {
  if (!queue.includes(analysisId)) {
    queue.push(analysisId);
  }
  setImmediate(processNext);
}

module.exports = { enqueue };
