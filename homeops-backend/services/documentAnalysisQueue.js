"use strict";

const { runDocumentAnalysis } = require("./documentAnalysisService");

const queue = [];
let processing = false;

async function processNext() {
  if (processing || queue.length === 0) return;
  processing = true;
  const jobId = queue.shift();
  try {
    await runDocumentAnalysis(jobId);
  } catch (err) {
    console.error("[documentAnalysisQueue] Job failed:", jobId, err);
  } finally {
    processing = false;
    if (queue.length > 0) {
      setImmediate(processNext);
    }
  }
}

function enqueue(jobId) {
  queue.push(jobId);
  setImmediate(processNext);
}

module.exports = { enqueue };
