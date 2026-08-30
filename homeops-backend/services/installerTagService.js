"use strict";

/**
 * Backward-compatible re-export. New code should import contactTagService.
 */
const {
  INSTALLER_TAG_NAME,
  installerIdFromData,
  ensureInstallerTag,
  ensureInstallerTagForSystemData,
  ensureInstallerTagsForSystems,
} = require("./contactTagService");

module.exports = {
  INSTALLER_TAG_NAME,
  installerIdFromData,
  ensureInstallerTag,
  ensureInstallerTagForSystemData,
  ensureInstallerTagsForSystems,
};
