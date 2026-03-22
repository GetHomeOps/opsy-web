"use strict";

/**
 * Email Service
 *
 * Sends transactional emails via AWS SES.
 * Requires: SES_FROM_EMAIL (verified in SES). Credentials: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY,
 * or AWS_PROFILE, or IAM role / ~/.aws/credentials (default chain). Region: AWS_REGION or AWS_SES_REGION.
 * Optional: SES_FROM_NAME (defaults from config)
 *
 * When email is not configured, password reset logs the link to console (dev).
 */

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { EMAIL_BRAND_NAME } = require("../config");
const brandName = EMAIL_BRAND_NAME;

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

async function sendViaSes({ to, subject, html, replyTo }) {
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
  return { success: true };
}

async function sendPasswordResetEmail({ to, resetUrl, userName }) {
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
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">— The ${brandName} Team</p>
    </div>
  `;

  return sendViaSes({
    to,
    subject: `Reset your ${brandName} password`,
    html,
  });
}

async function sendEmailVerificationEmail({ to, verifyUrl, userName }) {
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
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">— The ${brandName} Team</p>
    </div>
  `;

  return sendViaSes({
    to,
    subject: `Verify your email — ${brandName}`,
    html,
  });
}

/**
 * Send invitation email with confirmation link.
 * @param {Object} opts - { to, inviteUrl, inviterName?, inviteeName?, type: 'account'|'property', propertyAddress? }
 */
async function sendInvitationEmail({ to, inviteUrl, inviterName, inviteeName, type = "account", propertyAddress }) {
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

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564;">You're invited to ${brandName}</h2>
      <p>${intro}</p>
      <p>${contextText} Click the button below to accept and set up your account:</p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept invitation</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link expires in 48 hours. If you didn't expect this invite, you can safely ignore this email.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">— The ${brandName} Team</p>
    </div>
  `;

  return sendViaSes({ to, subject, html });
}

/**
 * Send contractor report request email with a link to fill out the maintenance report.
 * @param {Object} opts - { to, reportUrl, contractorName?, propertyAddress?, systemName?, senderName?, origin?, inspectionDate? }
 */
async function sendContractorReportEmail({ to, reportUrl, contractorName, propertyAddress, systemName, senderName, origin, inspectionDate }) {
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
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">— The ${brandName} Team</p>
    </div>
  `;

  return sendViaSes({ to, subject, html });
}

/**
 * Send scheduling notification email to a professional/contractor.
 * @param {Object} opts - { to, contractorName?, propertyAddress?, systemName?, scheduledDate?, scheduledTime?, messageBody?, senderName?, replyTo? }
 */
async function sendScheduleNotificationEmail({ to, contractorName, propertyAddress, systemName, scheduledDate, scheduledTime, messageBody, senderName, replyTo }) {
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
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">— The ${brandName} Team</p>
    </div>
  `;

  return sendViaSes({ to, subject, html, replyTo });
}

module.exports = {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendInvitationEmail,
  sendContractorReportEmail,
  sendScheduleNotificationEmail,
};
