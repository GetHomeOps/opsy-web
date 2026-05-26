"use strict";

/**
 * AWS SES email transport.
 */

const fs = require("fs");
const path = require("path");
const { SESClient, SendEmailCommand, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const { EMAIL_BRAND_NAME, APP_BASE_URL } = require("../../config");

const brandName = EMAIL_BRAND_NAME;
const FOOTER_IMAGE_CID = "opsy-footer-image";

const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || "us-east-1";
const credentials =
  process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY
    ? {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    }
    : undefined;
const sesClient = new SESClient({ region, ...(credentials && { credentials }) });

function escapeHtmlAttr(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function getFromAddress() {
  const email = process.env.SES_FROM_EMAIL;
  const rawFromName = process.env.SES_FROM_NAME || brandName;
  const name = rawFromName === "HomeOps" ? "Opsy" : rawFromName;
  if (!email) {
    throw new Error("SES_FROM_EMAIL not configured. Set it in .env (e.g. noreply@yourdomain.com)");
  }
  return `${name} <${email}>`;
}

function isSesConfigured() {
  return !!(process.env.SES_FROM_EMAIL && process.env.SES_FROM_EMAIL.trim());
}

function chunkBase64(value, size = 76) {
  const chunks = [];
  for (let i = 0; i < value.length; i += size) chunks.push(value.slice(i, i + size));
  return chunks.join("\r\n");
}

function resolveFooterImagePath() {
  const explicitPath = process.env.EMAIL_FOOTER_IMAGE_PATH;
  if (explicitPath && fs.existsSync(explicitPath)) return explicitPath;
  const candidates = [
    path.resolve(__dirname, "../../../homeops-frontend/public/footer.png"),
    path.resolve(__dirname, "../../assets/footer.png"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function readFooterImageBase64() {
  const footerPath = resolveFooterImagePath();
  if (!footerPath) return null;
  const image = await fs.promises.readFile(footerPath);
  return image.toString("base64");
}

async function logUsageIfNeeded(usage) {
  if (usage?.accountId != null && usage?.userId != null) {
    const { logEmailUsage } = require("../usageService");
    logEmailUsage({
      accountId: usage.accountId,
      userId: usage.userId,
      emailType: usage.emailType || "transactional",
      provider: usage.provider || "ses",
    }).catch((err) => console.error("[sesProvider] logEmailUsage:", err.message));
  }
}

async function sendViaSesRawWithInlineFooter({
  to,
  subject,
  html,
  replyTo,
  usage,
  footerImageBase64,
  cc = [],
}) {
  const boundary = `opsy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const ccLine =
    Array.isArray(cc) && cc.length > 0 ? `Cc: ${cc.join(", ")}` : null;
  const lines = [
    `From: ${getFromAddress()}`,
    `To: ${to}`,
    ...(ccLine ? [ccLine] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundary}"`,
    ...(replyTo && replyTo.trim() ? [`Reply-To: ${replyTo.trim()}`] : []),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
    `--${boundary}`,
    'Content-Type: image/png; name="footer.png"',
    "Content-Transfer-Encoding: base64",
    `Content-ID: <${FOOTER_IMAGE_CID}>`,
    'Content-Disposition: inline; filename="footer.png"',
    "",
    chunkBase64(footerImageBase64),
    `--${boundary}--`,
    "",
  ];

  await sesClient.send(
    new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(lines.join("\r\n"), "utf8") },
    })
  );
  await logUsageIfNeeded(usage);
  return { success: true, provider: "ses" };
}

async function sendViaSes({ to, subject, html, replyTo, usage, cc }) {
  const ccList = Array.isArray(cc)
    ? [...new Set(cc.map((e) => String(e || "").trim()).filter(Boolean))]
    : [];
  if (html.includes(`cid:${FOOTER_IMAGE_CID}`)) {
    try {
      const footerImageBase64 = await readFooterImageBase64();
      if (footerImageBase64) {
        return sendViaSesRawWithInlineFooter({
          to,
          subject,
          html,
          replyTo,
          usage,
          footerImageBase64,
          cc: ccList,
        });
      }
      const fallbackUrl =
        process.env.EMAIL_FOOTER_IMAGE_URL ||
        `${(APP_BASE_URL || "https://app.heyopsy.com").replace(/\/$/, "")}/footer.png`;
      html = html.replace(`cid:${FOOTER_IMAGE_CID}`, escapeHtmlAttr(fallbackUrl));
    } catch (err) {
      console.error("[sesProvider] inline footer image load failed:", err.message);
    }
  }

  const params = {
    Source: getFromAddress(),
    Destination: {
      ToAddresses: [to],
      ...(ccList.length > 0 ? { CcAddresses: ccList } : {}),
    },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
      },
    },
  };
  if (replyTo && replyTo.trim()) {
    params.ReplyToAddresses = [replyTo.trim()];
  }

  await sesClient.send(new SendEmailCommand(params));
  await logUsageIfNeeded(usage);
  return { success: true, provider: "ses" };
}

module.exports = {
  isSesConfigured,
  getFromAddress,
  sendViaSes,
  FOOTER_IMAGE_CID,
};
