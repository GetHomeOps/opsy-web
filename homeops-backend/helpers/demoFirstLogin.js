"use strict";

const User = require("../models/user");

/** Record first login for ready-to-use demo accounts; never blocks auth. */
async function recordDemoFirstLogin(userId) {
  try {
    await User.recordDemoFirstLogin(userId);
  } catch (err) {
    console.error("[demoFirstLogin] failed:", err.message);
  }
}

module.exports = { recordDemoFirstLogin };
