"use strict";

const User = require("../models/user");
const { notifyDemoAccountOpened } = require("../services/demoAccountNotifyService");

/** Record first login for ready-to-use demo accounts; never blocks auth. */
async function recordDemoFirstLogin(userId) {
  try {
    const firstLogin = await User.recordDemoFirstLogin(userId);
    if (firstLogin?.id) {
      notifyDemoAccountOpened(firstLogin.id).catch((err) =>
        console.error("[demoFirstLogin] notify opened:", err.message)
      );
    }
  } catch (err) {
    console.error("[demoFirstLogin] failed:", err.message);
  }
}

module.exports = { recordDemoFirstLogin };
