"use strict";

const { runDocumentAnalysis } = require("./documentAnalysisService");

const queue = [];
let processing = false;

async function processNext() {
  if (processing || queue.length === 0) return;
  processing = true;
  const item = queue.shift();
  const jobId = typeof item === "object" && item != null ? item.jobId : item;
  const declaredCategory =
    typeof item === "object" && item != null ? item.declaredCategory : null;
  try {
    await runDocumentAnalysis(jobId, { declaredCategory });
  } catch (err) {
    console.error("[documentAnalysisQueue] Job failed:", jobId, err);
  } finally {
    processing = false;
    if (queue.length > 0) {
      setImmediate(processNext);
    }
  }
}

function enqueue(jobId, options = {}) {
  queue.push({
    jobId,
    declaredCategory: options.declaredCategory || null,
  });
  setImmediate(processNext);
}

module.exports = { enqueue };
