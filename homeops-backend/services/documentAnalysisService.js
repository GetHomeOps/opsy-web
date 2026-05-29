"use strict";

/**
 * Document Analysis Service
 *
 * Downloads a filed property document from S3, extracts text or uses vision for
 * images, classifies document type, and extracts structured findings.
 */

const { PDFParse } = require("pdf-parse");
const OpenAI = require("openai");
const db = require("../db");
const { getFile } = require("./s3Service");
const DocumentAnalysisJob = require("../models/documentAnalysisJob");
const DocumentAnalysisResult = require("../models/documentAnalysisResult");
const { AWS_S3_BUCKET } = require("../config");
const { logAiUsage } = require("./usageService");
const { normalizeFindings } = require("./documentAnalysisFieldMapper");

const MODEL = process.env.AI_DOCUMENT_ANALYSIS_MODEL || "gpt-4o-mini";
const VISION_MODEL = process.env.AI_DOCUMENT_ANALYSIS_VISION_MODEL || "gpt-4o-mini";

const VALID_CATEGORIES = new Set([
  "installation_invoice",
  "maintenance_report",
  "inspection_report",
  "bid",
  "other",
]);

const CLASSIFY_PROMPT = `You are a home property document classifier. Given document text/metadata, output ONLY valid JSON:
{
  "category": "installation_invoice|maintenance_report|inspection_report|bid|other",
  "confidence": 0.0-1.0,
  "rationale": "brief reason"
}

Category guide:
- installation_invoice: receipts, invoices, warranties for installed equipment
- maintenance_report: service/maintenance visit reports
- inspection_report: inspection or condition assessment reports (single system or general)
- bid: quotes, estimates, proposals for replacement or repair work
- other: anything else

Hints — filename: {FILENAME}, document_type: {DOC_TYPE}, system: {SYSTEM_KEY}
`;

const EXTRACTION_PROMPTS = {
  installation_invoice: `Extract installation/invoice details from this document for the "{SYSTEM_KEY}" system.
Output ONLY valid JSON:
{
  "summary": "1-2 sentence summary",
  "items": [
    { "fieldKey": "brand|model|installDate|installer|vendor|cost|warranty|maintenanceScheduleRecommendation", "label": "Human label", "value": "extracted value or array for lists", "confidence": 0.0-1.0, "evidence": "short verbatim quote" }
  ]
}
Include only fields you can support with evidence. Dates as YYYY-MM-DD when possible.`,

  maintenance_report: `Extract maintenance report details for the "{SYSTEM_KEY}" system.
Output ONLY valid JSON:
{
  "summary": "1-2 sentence summary",
  "items": [
    { "fieldKey": "reportDate|technician|condition|findings|suggestedNextDates|maintenanceScheduleRecommendation", "label": "Human label", "value": "string or array", "confidence": 0.0-1.0, "evidence": "short verbatim quote" }
  ]
}
findings and suggestedNextDates may be arrays of strings.`,

  inspection_report: `Extract inspection report details for the "{SYSTEM_KEY}" system.
Output ONLY valid JSON:
{
  "summary": "1-2 sentence summary",
  "items": [
    { "fieldKey": "reportDate|condition|findings|suggestedNextDates|nextServiceDate", "label": "Human label", "value": "string or array", "confidence": 0.0-1.0, "evidence": "short verbatim quote" }
  ]
}`,

  bid: `Extract bid/quote details for the "{SYSTEM_KEY}" system.
Output ONLY valid JSON:
{
  "summary": "1-2 sentence summary",
  "items": [
    { "fieldKey": "vendor|totalPrice|lineItems|termsAndConditions|scope|validUntil", "label": "Human label", "value": "string or array", "confidence": 0.0-1.0, "evidence": "short verbatim quote" }
  ]
}`,

  other: `Extract useful property document details for the "{SYSTEM_KEY}" system.
Output ONLY valid JSON:
{
  "summary": "1-2 sentence summary",
  "items": [
    { "fieldKey": "summary|keyDates|notes", "label": "Human label", "value": "string or array", "confidence": 0.0-1.0, "evidence": "short verbatim quote if available" }
  ]
}`,
};

async function extractTextFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text || "";
}

function isImageMime(mimeType) {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

function parseJsonFromResponse(content) {
  if (!content) return null;
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function callChat(openai, messages, usageCtx) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.2,
    response_format: { type: "json_object" },
  });
  const content = response.choices?.[0]?.message?.content;
  if (usageCtx?.accountId && response.usage) {
    logAiUsage({
      accountId: usageCtx.accountId,
      userId: usageCtx.userId,
      model: `openai/${MODEL}`,
      promptTokens: response.usage.prompt_tokens || 0,
      completionTokens: response.usage.completion_tokens || 0,
      endpoint: "document_analysis",
    }).catch(() => {});
  }
  return parseJsonFromResponse(content);
}

async function extractViaVision(openai, buffer, mimeType, prompt, usageCtx) {
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${mimeType || "image/jpeg"};base64,${base64}`;
  const response = await openai.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });
  const content = response.choices?.[0]?.message?.content;
  if (usageCtx?.accountId && response.usage) {
    logAiUsage({
      accountId: usageCtx.accountId,
      userId: usageCtx.userId,
      model: `openai/${VISION_MODEL}`,
      promptTokens: response.usage.prompt_tokens || 0,
      completionTokens: response.usage.completion_tokens || 0,
      endpoint: "document_analysis_vision",
    }).catch(() => {});
  }
  return parseJsonFromResponse(content);
}

function buildFindingsFromExtraction(parsed, category) {
  const items = normalizeFindings(parsed?.items || parsed?.findings || []);
  const findings = items.filter((i) => i && (i.fieldKey || i.key));
  if (parsed?.summary) {
    findings.unshift({
      fieldKey: "summary",
      label: "Summary",
      value: parsed.summary,
      confidence: 0.9,
      evidence: null,
    });
  }
  return { category, findings, summary: parsed?.summary || null };
}

async function runDocumentAnalysis(jobId) {
  const job = await DocumentAnalysisJob.get(jobId);
  if (job.status !== "queued" && job.status !== "processing") {
    return;
  }

  await DocumentAnalysisJob.updateStatus(jobId, {
    status: "processing",
    progress: "Downloading document...",
  });

  let buffer;
  try {
    if (!AWS_S3_BUCKET) throw new Error("S3 bucket not configured");
    buffer = await getFile(job.s3_key);
  } catch (err) {
    console.error("[documentAnalysis] S3 download error:", err);
    await DocumentAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: "Failed to download document from storage",
    });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await DocumentAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: "AI analysis is not configured. Set OPENAI_API_KEY.",
    });
    return;
  }

  const openai = new OpenAI({ apiKey });
  const accountRes = await db.query(
    `SELECT account_id FROM properties WHERE id = $1`,
    [job.property_id],
  );
  const usageCtx = {
    accountId: accountRes.rows[0]?.account_id,
    userId: job.user_id,
  };

  let text = "";
  const useVision = isImageMime(job.mime_type);

  if (useVision) {
    await DocumentAnalysisJob.updateStatus(jobId, { progress: "Analyzing image..." });
  } else {
    await DocumentAnalysisJob.updateStatus(jobId, { progress: "Extracting text..." });
    text = await extractTextFromPdf(buffer);
    if (!text || text.trim().length < 30) {
      await DocumentAnalysisJob.updateStatus(jobId, {
        status: "failed",
        error_message:
          "Could not extract enough text from the document. Try a clearer scan or image upload.",
      });
      return;
    }
  }

  await DocumentAnalysisJob.updateStatus(jobId, { progress: "Classifying document..." });

  const classifyPrompt = CLASSIFY_PROMPT
    .replace("{FILENAME}", job.file_name || "")
    .replace("{DOC_TYPE}", job.document_type || "")
    .replace("{SYSTEM_KEY}", job.system_key || "");

  let category = "other";
  try {
    let classified;
    if (useVision) {
      classified = await extractViaVision(
        openai,
        buffer,
        job.mime_type,
        `${classifyPrompt}\n\nDescribe what you see and classify.`,
        usageCtx,
      );
    } else {
      classified = await callChat(
        openai,
        [
          { role: "system", content: "Output only valid JSON." },
          { role: "user", content: `${classifyPrompt}\n\nDocument text:\n${text.slice(0, 12000)}` },
        ],
        usageCtx,
      );
    }
    if (classified?.category && VALID_CATEGORIES.has(classified.category)) {
      category = classified.category;
    } else if (job.document_type === "inspection") {
      category = "inspection_report";
    } else if (job.document_type === "receipt") {
      category = "installation_invoice";
    } else if (job.document_type === "contract") {
      category = "bid";
    }
  } catch (err) {
    console.warn("[documentAnalysis] classify failed, using other:", err.message);
  }

  await DocumentAnalysisJob.updateStatus(jobId, { progress: "Extracting findings..." });

  const extractTemplate = EXTRACTION_PROMPTS[category] || EXTRACTION_PROMPTS.other;
  const extractPrompt = extractTemplate.replace("{SYSTEM_KEY}", job.system_key || "general");

  let extraction;
  try {
    if (useVision) {
      extraction = await extractViaVision(openai, buffer, job.mime_type, extractPrompt, usageCtx);
    } else {
      extraction = await callChat(
        openai,
        [
          { role: "system", content: "Output only valid JSON." },
          {
            role: "user",
            content: `${extractPrompt}\n\nDocument text:\n${text.slice(0, 30000)}`,
          },
        ],
        usageCtx,
      );
    }
  } catch (err) {
    console.error("[documentAnalysis] extraction error:", err);
    await DocumentAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: err.message || "AI extraction failed",
    });
    return;
  }

  const { findings } = buildFindingsFromExtraction(extraction, category);

  try {
    await DocumentAnalysisResult.create({
      job_id: jobId,
      property_id: job.property_id,
      property_document_id: job.property_document_id,
      system_key: job.system_key,
      detected_category: category,
      findings,
    });
    await DocumentAnalysisJob.updateStatus(jobId, {
      status: "completed",
      progress: "Complete",
    });
  } catch (err) {
    console.error("[documentAnalysis] save result error:", err);
    await DocumentAnalysisJob.updateStatus(jobId, {
      status: "failed",
      error_message: "Failed to save analysis results",
    });
  }
}

module.exports = { runDocumentAnalysis };
