"use strict";

/**
 * Auto-generation of default maintenance Action Items when a system is added.
 *
 * Called from the System model after a property system is created/upserted.
 * Copies the active templates for the system into inspection_checklist_items
 * (source = 'default_recommendation'). Generation runs at most once per
 * (property, system) pair, guarded by property_systems.recommendations_generated_at.
 *
 * Only the 11 canonical systems have templates; custom systems are skipped.
 * Errors are swallowed so recommendation generation never blocks system writes.
 */

const db = require("../db");
const { CANONICAL_SYSTEMS } = require("./systemTypes");
const SystemRecommendationTemplate = require("../models/systemRecommendationTemplate");
const InspectionChecklistItem = require("../models/inspectionChecklistItem");

/**
 * Generate default recommendations for one newly added system.
 *
 * @param {number} propertyId
 * @param {string} systemKey   canonical system key (roof, heating, ...)
 * @param {object} [opts]
 * @param {boolean} [opts.included=true]  skip generation for deselected systems
 * @returns {Promise<{generated: number}>}
 */
async function onSystemCreated(propertyId, systemKey, { included = true } = {}) {
  try {
    if (!propertyId || !systemKey) return { generated: 0 };
    if (!included) return { generated: 0 };
    if (!CANONICAL_SYSTEMS.includes(systemKey)) return { generated: 0 };

    // Dedup guard: claim the slot atomically. If the row was already stamped
    // (or doesn't exist), the UPDATE affects 0 rows and we skip generation.
    const claim = await db.query(
      `UPDATE property_systems
         SET recommendations_generated_at = NOW()
       WHERE property_id = $1
         AND system_key = $2
         AND recommendations_generated_at IS NULL
       RETURNING id`,
      [propertyId, systemKey]
    );
    if (claim.rows.length === 0) return { generated: 0 };

    const templates = await SystemRecommendationTemplate.getActiveBySystemKey(systemKey);
    if (templates.length === 0) return { generated: 0 };

    const rows = await InspectionChecklistItem.generateDefaultRecommendations({
      propertyId,
      systemKey,
      templates,
    });
    return { generated: rows.length };
  } catch (err) {
    // Never block system creation on recommendation generation.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[systemRecommendationGenerator] failed for property ${propertyId} system ${systemKey}:`,
        err.message
      );
    }
    return { generated: 0 };
  }
}

module.exports = { onSystemCreated };
