"use strict";

/**
 * Email Service
 *
 * Sends transactional emails via AWS SES.
 * Requires: SES_FROM_EMAIL (verified in SES). Credentials: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY,
 * or AWS_PROFILE, or IAM role / ~/.aws/credentials (default chain). Region: AWS_REGION or AWS_SES_REGION.
 * Optional: SES_FROM_NAME (defaults from config)
 * Footer image: inline attachment by default (override with EMAIL_FOOTER_IMAGE_URL)
 *
 * When email is not configured, password reset logs the link to console (dev).
 */

const fs = require("fs");
const path = require("path");
const { SESClient, SendEmailCommand, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const { EMAIL_BRAND_NAME, APP_BASE_URL } = require("../config");
const brandName = EMAIL_BRAND_NAME;
const FOOTER_IMAGE_CID = "opsy-footer-image";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtmlAttr(s) {
  if (s == null) return "";
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Linked brand footer image for HTML emails.
 * Uses an inline image (CID) so email clients can render it reliably.
 * If EMAIL_FOOTER_IMAGE_URL is set, that URL is used instead.
 */
function getEmailFooterHtml() {
  const linkUrl = "https://heyopsy.com";
  const imageUrl = process.env.EMAIL_FOOTER_IMAGE_URL || `cid:${FOOTER_IMAGE_CID}`;
  const alt = brandName;
  return `
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px; margin-bottom: 0;">— The ${escapeHtml(brandName)} Team</p>
      <p style="margin-top: 12px; margin-bottom: 0; text-align: center;">
        <a href="${escapeHtmlAttr(linkUrl)}" style="text-decoration: none; border: 0;">
          <img src="${escapeHtmlAttr(imageUrl)}" alt="${escapeHtml(alt)}" width="600" style="display: inline-block; border: 0; outline: none; max-width: 100%; width: 100%; height: auto;" />
        </a>
      </p>`;
}

/** Replace legacy product name in "requested by" lines (e.g. account name "HomeOps Team"). */
function sanitizeSenderLabelForEmail(name) {
  if (!name || typeof name !== "string") return name;
  return name.replace(/\bHomeOps\b/g, "Opsy");
}

const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || "us-east-1";
const credentials =
  process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY
    ? {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    }
    : undefined;
const sesClient = new SESClient({ region, ...(credentials && { credentials }) });

function getFromAddress() {
  const email = process.env.SES_FROM_EMAIL;
  const rawFromName = process.env.SES_FROM_NAME || brandName;
  const name = rawFromName === "HomeOps" ? "Opsy" : rawFromName;
  if (!email) {
    throw new Error("SES_FROM_EMAIL not configured. Set it in .env (e.g. noreply@yourdomain.com)");
  }
  return `${name} <${email}>`;
}

/**
 * True when a verified From address is set. AWS credentials may come from env vars,
 * ~/.aws/credentials (default profile), or an IAM role (ECS/Lambda/EC2) via the SDK default chain.
 * Omit SES_FROM_EMAIL in local .env to skip sending and log the reset link instead (see passwordResetService).
 */
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
    path.resolve(__dirname, "../../homeops-frontend/public/footer.png"),
    path.resolve(__dirname, "../assets/footer.png"),
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
    const { logEmailUsage } = require("./usageService");
    logEmailUsage({
      accountId: usage.accountId,
      userId: usage.userId,
      emailType: usage.emailType || "transactional",
    }).catch((err) => console.error("[emailService] logEmailUsage:", err.message));
  }
}

async function sendViaSesRawWithInlineFooter({ to, subject, html, replyTo, usage, footerImageBase64 }) {
  const boundary = `opsy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const lines = [
    `From: ${getFromAddress()}`,
    `To: ${to}`,
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
  return { success: true };
}

async function sendViaSes({ to, subject, html, replyTo, usage }) {
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
        });
      }
      const fallbackUrl =
        process.env.EMAIL_FOOTER_IMAGE_URL ||
        `${(APP_BASE_URL || "https://app.heyopsy.com").replace(/\/$/, "")}/footer.png`;
      html = html.replace(`cid:${FOOTER_IMAGE_CID}`, escapeHtmlAttr(fallbackUrl));
    } catch (err) {
      console.error("[emailService] inline footer image load failed:", err.message);
    }
  }

  const params = {
    Source: getFromAddress(),
    Destination: { ToAddresses: [to] },
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
  const command = new SendEmailCommand(params);

  await sesClient.send(command);
  await logUsageIfNeeded(usage);
  return { success: true };
}

async function sendPasswordResetEmail({ to, resetUrl, userName, usage }) {
  if (!isSesConfigured()) {
    throw new Error(
      "SES not configured. Set SES_FROM_EMAIL (verified in SES) and AWS credentials or use an IAM role / aws configure."
    );
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564;">Reset your password</h2>
      <p>Hi${userName ? ` ${userName}` : ""},</p>
      <p>We received a request to reset your ${brandName} password. Click the button below to set a new password:</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  return sendViaSes({
    to,
    subject: `Reset your ${brandName} password`,
    html,
    usage,
  });
}

async function sendEmailVerificationEmail({ to, verifyUrl, userName, usage }) {
  if (!isSesConfigured()) {
    throw new Error(
      "SES not configured. Set SES_FROM_EMAIL (verified in SES) and AWS credentials or use an IAM role / aws configure."
    );
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564;">Verify your email</h2>
      <p>Hi${userName ? ` ${userName}` : ""},</p>
      <p>Thanks for signing up for ${brandName}. Please confirm your email address by clicking the button below:</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify email</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 48 hours. If you didn&apos;t create an account, you can ignore this email.</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  return sendViaSes({
    to,
    subject: `Verify your email — ${brandName}`,
    html,
    usage,
  });
}

/**
 * Send invitation email with confirmation or sign-in link.
 * @param {Object} opts - { to, inviteUrl, inviterName?, inviteeName?, type: 'account'|'property', propertyAddress?,
 *   inviteeHasAccount?: boolean } — for property invites, inviteeHasAccount selects existing-user vs new-user copy.
 */
async function sendInvitationEmail({
  to,
  inviteUrl,
  inviterName,
  inviteeName,
  type = "account",
  propertyAddress,
  inviteeHasAccount = false,
  usage,
}) {
  if (!isSesConfigured()) {
    throw new Error("SES not configured. Set SES_FROM_EMAIL and AWS credentials (or IAM role).");
  }

  const isProperty = type === "property";
  const subject = isProperty
    ? `You've been invited to join a property${propertyAddress ? `: ${propertyAddress}` : ""}`
    : `You've been invited to join ${brandName}`;

  const intro = inviteeName ? `Hi ${inviteeName},` : "Hi,";
  const inviterText = inviterName ? `${inviterName} has` : "Someone has";
  const contextText = isProperty
    ? (propertyAddress
      ? `${inviterText} invited you to join a property: ${propertyAddress}.`
      : `${inviterText} invited you to join a property.`)
    : `${inviterText} invited you to join ${brandName}.`;

  let headline;
  let bodyExtra;
  let ctaLabel;
  let footerNote =
    "This invitation expires in 48 hours. If you didn't expect this invite, you can safely ignore this email.";

  if (isProperty && inviteeHasAccount) {
    headline = "Property invitation";
    bodyExtra =
      `${contextText} You already have a ${brandName} account. Use the button below to open the property and accept or decline. If you're not signed in, you'll be asked to sign in first. You can also respond from your notifications (bell icon) when signed in.`;
    ctaLabel = "View Invitation";
  } else if (isProperty) {
    headline = `Property invitation — ${brandName}`;
    bodyExtra = `${contextText} Use the button below to join ${brandName} and set your password to accept this invitation.`;
    ctaLabel = "Accept invitation";
  } else {
    headline = `You're invited to ${brandName}`;
    bodyExtra = `${contextText} Click the button below to accept and set up your account:`;
    ctaLabel = "Accept invitation";
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564;">${headline}</h2>
      <p>${intro}</p>
      <p>${bodyExtra}</p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">${ctaLabel}</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">${footerNote}</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  return sendViaSes({ to, subject, html, usage });
}

/**
 * Send contractor report request email with a link to fill out the maintenance report.
 * @param {Object} opts - { to, reportUrl, contractorName?, propertyAddress?, systemName?, senderName?, origin?, inspectionDate? }
 */
async function sendContractorReportEmail({
  to,
  reportUrl,
  contractorName,
  propertyAddress,
  systemName,
  senderName,
  origin,
  inspectionDate,
  usage,
}) {
  if (!isSesConfigured()) {
    throw new Error("SES not configured. Set SES_FROM_EMAIL and AWS credentials (or IAM role).");
  }

  const greeting = contractorName ? `Hi ${contractorName},` : "Hi,";
  const senderLabel = sanitizeSenderLabelForEmail(senderName);
  const requester = senderLabel ? senderLabel : "A homeowner";
  const propertyText = propertyAddress ? ` for the property at <strong>${propertyAddress}</strong>` : "";
  const systemText = systemName ? ` regarding <strong>${systemName}</strong>` : "";

  const detailsRows = [];
  if (origin) detailsRows.push(`<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">Origin:</td><td><a href="${origin}">${origin}</a></td></tr>`);
  if (propertyAddress) detailsRows.push(`<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">Property:</td><td>${propertyAddress}</td></tr>`);
  if (senderName) detailsRows.push(`<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">Requested by:</td><td>${senderLabel}</td></tr>`);
  if (inspectionDate) detailsRows.push(`<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">Date of inspection:</td><td>${inspectionDate}</td></tr>`);
  const detailsSection = detailsRows.length > 0
    ? `<div style="margin: 16px 0; padding: 12px 16px; background: #f9fafb; border-radius: 8px; font-size: 14px;">
        <table style="border-collapse: collapse;">${detailsRows.join("")}</table>
      </div>`
    : "";

  const subject = `${brandName}: Maintenance report request${propertyAddress ? ` – ${propertyAddress}` : ""}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #456564;">Maintenance Report Request</h2>
      <p>${greeting}</p>
      <p>${requester} has requested that you fill out a maintenance/inspection report${propertyText}${systemText}.</p>
      ${detailsSection}
      <p>Please click the button below to open the report form and provide your findings:</p>
      <p style="margin: 24px 0;">
        <a href="${reportUrl}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Fill Out Report</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 7 days. If you have questions, please contact the homeowner directly.</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  return sendViaSes({ to, subject, html, usage });
}

/**
 * Send scheduling notification email to a professional/contractor.
 * @param {Object} opts - { to, contractorName?, propertyAddress?, systemName?, scheduledDate?, scheduledTime?, messageBody?, senderName?, replyTo? }
 */
async function sendScheduleNotificationEmail({
  to,
  contractorName,
  propertyAddress,
  systemName,
  scheduledDate,
  scheduledTime,
  messageBody,
  senderName,
  replyTo,
  usage,
}) {
  if (!isSesConfigured()) {
    console.warn("[emailService] SES not configured — skipping schedule notification email");
    return { success: false, reason: "ses_not_configured" };
  }

  const greeting = contractorName ? `Hi ${contractorName},` : "Hi,";
  const senderLabel = sanitizeSenderLabelForEmail(senderName);
  const requester = senderLabel || "A homeowner";
  const propertyText = propertyAddress ? ` at <strong>${propertyAddress}</strong>` : "";
  const systemText = systemName ? ` for <strong>${systemName}</strong>` : "";

  const formattedDate = scheduledDate
    ? new Date(scheduledDate + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : null;

  const formattedTime = scheduledTime
    ? (() => {
      const [h, m] = scheduledTime.split(":");
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${m} ${ampm}`;
    })()
    : null;

  const detailsRows = [];
  if (propertyAddress) detailsRows.push(`<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">Property:</td><td>${propertyAddress}</td></tr>`);
  if (systemName) detailsRows.push(`<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">System:</td><td>${systemName}</td></tr>`);
  if (formattedDate) detailsRows.push(`<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">Date:</td><td>${formattedDate}${formattedTime ? ` at ${formattedTime}` : ""}</td></tr>`);
  if (senderName) detailsRows.push(`<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top;">Requested by:</td><td>${senderLabel}</td></tr>`);
  const detailsSection = detailsRows.length > 0
    ? `<div style="margin: 16px 0; padding: 12px 16px; background: #f9fafb; border-radius: 8px; font-size: 14px;">
        <table style="border-collapse: collapse;">${detailsRows.join("")}</table>
      </div>`
    : "";

  const messageSection = messageBody
    ? `<div style="margin: 16px 0; padding: 12px 16px; background: #f0fdf4; border-left: 3px solid #456564; border-radius: 4px; font-size: 14px; color: #374151; white-space: pre-wrap;">${messageBody}</div>`
    : "";

  const subject = `${brandName}: Service scheduled${systemName ? ` — ${systemName}` : ""}${propertyAddress ? ` at ${propertyAddress}` : ""}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #456564;">Service Scheduled</h2>
      <p>${greeting}</p>
      <p>${requester} has scheduled a service${systemText}${propertyText}.</p>
      ${detailsSection}
      ${messageSection ? `<p style="font-size: 14px; color: #374151;">Message from homeowner:</p>${messageSection}` : ""}
      <p style="color: #6b7280; font-size: 14px;">Please confirm this appointment or reach out to the homeowner to discuss the details.</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  return sendViaSes({ to, subject, html, replyTo, usage });
}

/**
 * Notify a professional of a directory message from a logged-in homeowner (SES → pro's email).
 * Reply-To is set to the sender so the professional can respond directly.
 */
async function sendProfessionalContactEmail({
  to,
  professionalCompanyName,
  message,
  senderName,
  senderEmail,
  /** Reply-To header (and shown in body); defaults to senderEmail */
  replyToEmail,
  usage,
}) {
  if (!isSesConfigured()) {
    throw new Error(
      "SES not configured. Set SES_FROM_EMAIL (verified in SES) and AWS credentials or use an IAM role / aws configure."
    );
  }
  if (!to || !String(to).trim()) {
    throw new Error("Recipient email is required");
  }

  const company = escapeHtml(professionalCompanyName || "Professional");
  const safeBody = escapeHtml(message)
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br/>");
  const replyEmail =
    replyToEmail && String(replyToEmail).trim()
      ? String(replyToEmail).trim()
      : senderEmail;
  const senderLabel = escapeHtml(senderName || replyEmail || "A homeowner");
  const senderLine =
    senderName && replyEmail
      ? `${escapeHtml(senderName)} &lt;${escapeHtml(replyEmail)}&gt;`
      : escapeHtml(replyEmail || "");

  const html = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto;">
      <h2 style="color: #456564;">New message via ${escapeHtml(brandName)}</h2>
      <p>You have a new inquiry from someone viewing your listing <strong>${company}</strong> on ${escapeHtml(brandName)}.</p>
      <p style="margin: 16px 0 8px; font-size: 14px; color: #374151;"><strong>From:</strong> ${senderLine || senderLabel}</p>
      <div style="margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #456564; font-size: 15px; color: #111827; line-height: 1.5;">
        ${safeBody}
      </div>
      <p style="color: #6b7280; font-size: 14px;">You can reply directly to this email to reach the sender.</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  const rawSubject = `${brandName}: Message about ${professionalCompanyName || "your listing"}`;
  const subject = rawSubject.length > 200 ? `${rawSubject.slice(0, 197)}...` : rawSubject;

  return sendViaSes({
    to: String(to).trim(),
    subject,
    html,
    replyTo: replyEmail,
    usage,
  });
}

/**
 * Notify a recipient by email that a communication is available in Opsy (in-app is primary).
 */
async function sendCommunicationNotifyEmail({ to, userName, subjectLine, viewUrl, usage }) {
  if (!isSesConfigured()) {
    console.warn("[emailService] SES not configured — skipping communication notify email");
    return { success: false, reason: "ses_not_configured" };
  }
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : "Hi,";
  const title = escapeHtml(subjectLine || "New message");
  const safeUrl = escapeHtml(viewUrl);
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564;">${title}</h2>
      <p>${greeting}</p>
      <p>You have a new message in ${escapeHtml(brandName)}. Open it in the app using the link below.</p>
      <p style="margin: 24px 0;">
        <a href="${safeUrl}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View in ${escapeHtml(brandName)}</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link opens the message in your browser. Sign in if prompted.</p>
      ${getEmailFooterHtml()}
    </div>
  `;
  return sendViaSes({
    to,
    subject: `${subjectLine || "New message"} — ${brandName}`,
    html,
    usage,
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendInvitationEmail,
  sendContractorReportEmail,
  sendScheduleNotificationEmail,
  sendProfessionalContactEmail,
  sendCommunicationNotifyEmail,
};
