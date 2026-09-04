"use strict";

/**
 * Async, cached homeowner advice for composed property financials.
 * Never invents rates, balances, or due dates. GET /financials must not wait.
 */

const OpenAI = require("openai");
const PropertyFinancials = require("../../models/propertyFinancials");
const { composeFromRow } = require("../propertyFinancialsCompose");
const {
  compactSnapshot,
  hasEnoughInsightData,
  normalizeAdviceAiResponse,
  buildAdvicePrompt,
} = require("./propertyFinancialsInsightAdvice");

const ADVICE_MODEL = process.env.AI_FINANCIALS_PLAUSIBILITY_MODEL || "gpt-4o-mini";

async function reviewPropertyFinancialsPlausibility(propertyId) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const row = await PropertyFinancials.get(propertyId);
  if (!row) return null;

  const dto = composeFromRow(row, { attomStatus: "ready" });
  const snapshot = compactSnapshot(dto);

  if (!hasEnoughInsightData(snapshot)) {
    return PropertyFinancials.savePlausibilityFlags(propertyId, []);
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: ADVICE_MODEL,
    messages: [
      {
        role: "system",
        content: "You output only valid JSON. Write actionable homeowner financial advice. Never invent numbers. Never treat missing public-record fields as problems.",
      },
      { role: "user", content: buildAdvicePrompt(snapshot) },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return null;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const advice = normalizeAdviceAiResponse(parsed);
  return PropertyFinancials.savePlausibilityFlags(propertyId, advice);
}

function enqueueFinancialInsightsReview(propertyId) {
  void reviewPropertyFinancialsPlausibility(propertyId).catch((err) => {
    console.error("[propertyFinancials] insight review:", err?.message);
  });
}

module.exports = {
  reviewPropertyFinancialsPlausibility,
  enqueueFinancialInsightsReview,
  normalizeAdviceAiResponse,
  normalizePlausibilityAiResponse: normalizeAdviceAiResponse,
  compactSnapshot,
  hasEnoughInsightData,
};
