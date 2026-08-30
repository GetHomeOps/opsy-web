"use strict";

const db = require("../db");

class ActionItemBidReview {
  static async get(checklistItemId) {
    const result = await db.query(
      `SELECT * FROM action_item_bid_reviews WHERE checklist_item_id = $1`,
      [checklistItemId],
    );
    return result.rows[0] || null;
  }

  static async upsert(checklistItemId, { comparison, questions, activity, generatedAt } = {}) {
    const existing = await this.get(checklistItemId);
    const nextComparison =
      comparison !== undefined ? comparison : existing?.comparison || {};
    const nextQuestions =
      questions !== undefined ? questions : existing?.questions || [];
    const nextActivity =
      activity !== undefined ? activity : existing?.activity || [];
    const nextGenerated =
      generatedAt !== undefined
        ? generatedAt
        : existing?.generated_at || (comparison ? new Date().toISOString() : null);

    const result = await db.query(
      `INSERT INTO action_item_bid_reviews
         (checklist_item_id, comparison, questions, activity, generated_at, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, NOW())
       ON CONFLICT (checklist_item_id) DO UPDATE SET
         comparison = EXCLUDED.comparison,
         questions = EXCLUDED.questions,
         activity = EXCLUDED.activity,
         generated_at = COALESCE(EXCLUDED.generated_at, action_item_bid_reviews.generated_at),
         updated_at = NOW()
       RETURNING *`,
      [
        checklistItemId,
        JSON.stringify(nextComparison ?? {}),
        JSON.stringify(nextQuestions ?? []),
        JSON.stringify(nextActivity ?? []),
        nextGenerated,
      ],
    );
    return result.rows[0];
  }

  static async appendActivity(checklistItemId, event) {
    const existing = await this.get(checklistItemId);
    const activity = Array.isArray(existing?.activity) ? [...existing.activity] : [];
    activity.push(event);
    return this.upsert(checklistItemId, {
      comparison: existing?.comparison,
      questions: existing?.questions,
      activity,
      generatedAt: existing?.generated_at,
    });
  }
}

module.exports = ActionItemBidReview;
