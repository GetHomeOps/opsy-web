"use strict";

/**
 * AWS SES email transport.
 */

const fs = require("fs");
const path = require("path");
const { SESClient, SendEmailCommand, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const { EMAIL_BRAND_NAME, APP_BASE_URL } = require("../../config");
const { shouldSuppressOutboundEmail } = require("../../helpers/demoEnvironment");

const brandName = EMAIL_BRAND_NAME;
const FOOTER_IMAGE_CID = "opsy-footer-image";
const HEADER_LOGO_CID = "opsy-header-logo";

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

function resolveHeaderLogoPath() {
  const explicitPath = process.env.EMAIL_HEADER_IMAGE_PATH;
  if (explicitPath && fs.existsSync(explicitPath)) return explicitPath;
  const candidates = [
    path.resolve(__dirname, "../../../homeops-frontend/public/OpsyHeader.png"),
    path.resolve(__dirname, "../../assets/OpsyHeader.png"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

async function readHeaderLogoBase64() {
  const logoPath = resolveHeaderLogoPath();
  if (!logoPath) return null;
  const image = await fs.promises.readFile(logoPath);
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

/**
 * Send a multipart/related message with one or more inline images (CID).
 * @param {Array<{ cid: string, base64: string, filename: string }>} inlineImages
 */
async function sendViaSesRawWithInlineImages({
  to,
  subject,
  html,
  replyTo,
  usage,
  inlineImages,
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
  ];

  for (const img of inlineImages) {
    lines.push(
      `--${boundary}`,
      `Content-Type: image/png; name="${img.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${img.cid}>`,
      `Content-Disposition: inline; filename="${img.filename}"`,
      "",
      chunkBase64(img.base64),
      ""
    );
  }
  lines.push(`--${boundary}--`, "");

  await sesClient.send(
    new SendRawEmailCommand({
      RawMessage: { Data: Buffer.from(lines.join("\r\n"), "utf8") },
    })
  );
  await logUsageIfNeeded(usage);
  return { success: true, provider: "ses" };
}

function replaceCidWithUrl(html, cid, url) {
  return html.split(`cid:${cid}`).join(escapeHtmlAttr(url));
}

async function sendViaSes({ to, subject, html, replyTo, usage, cc, bypassDemoSuppression = false }) {
  if (shouldSuppressOutboundEmail() && !bypassDemoSuppression) {
    console.info("[sesProvider] outbound email suppressed (demo)", {
      to: String(to || "").replace(/(.{2}).*(@.*)/, "$1…$2"),
      subject: subject ? String(subject).slice(0, 80) : "",
    });
    return { success: true, provider: "ses", suppressed: true };
  }

  const ccList = Array.isArray(cc)
    ? [...new Set(cc.map((e) => String(e || "").trim()).filter(Boolean))]
    : [];
  const appBase = (APP_BASE_URL || "https://app.heyopsy.com").replace(/\/$/, "");
  const inlineImages = [];

  if (html.includes(`cid:${HEADER_LOGO_CID}`)) {
    try {
      const headerLogoBase64 = await readHeaderLogoBase64();
      if (headerLogoBase64) {
        inlineImages.push({
          cid: HEADER_LOGO_CID,
          base64: headerLogoBase64,
          filename: "opsy-header.png",
        });
      } else {
        const fallbackUrl =
          process.env.EMAIL_HEADER_IMAGE_URL || `${appBase}/OpsyHeader.png`;
        html = replaceCidWithUrl(html, HEADER_LOGO_CID, fallbackUrl);
      }
    } catch (err) {
      console.error("[sesProvider] inline header logo load failed:", err.message);
      const fallbackUrl =
        process.env.EMAIL_HEADER_IMAGE_URL || `${appBase}/OpsyHeader.png`;
      html = replaceCidWithUrl(html, HEADER_LOGO_CID, fallbackUrl);
    }
  }

  if (html.includes(`cid:${FOOTER_IMAGE_CID}`)) {
    try {
      const footerImageBase64 = await readFooterImageBase64();
      if (footerImageBase64) {
        inlineImages.push({
          cid: FOOTER_IMAGE_CID,
          base64: footerImageBase64,
          filename: "footer.png",
        });
      } else {
        const fallbackUrl =
          process.env.EMAIL_FOOTER_IMAGE_URL || `${appBase}/footer.png`;
        html = replaceCidWithUrl(html, FOOTER_IMAGE_CID, fallbackUrl);
      }
    } catch (err) {
      console.error("[sesProvider] inline footer image load failed:", err.message);
      const fallbackUrl =
        process.env.EMAIL_FOOTER_IMAGE_URL || `${appBase}/footer.png`;
      html = replaceCidWithUrl(html, FOOTER_IMAGE_CID, fallbackUrl);
    }
  }

  if (inlineImages.length > 0) {
    return sendViaSesRawWithInlineImages({
      to,
      subject,
      html,
      replyTo,
      usage,
      inlineImages,
      cc: ccList,
    });
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
  HEADER_LOGO_CID,
};
