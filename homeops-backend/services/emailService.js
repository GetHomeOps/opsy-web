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

const db = require("../db");
const { EMAIL_BRAND_NAME, APP_BASE_URL } = require("../config");
const sesProvider = require("./emailProviders/sesProvider");
const emailProviderRouter = require("./emailProviderRouter");
const brandName = EMAIL_BRAND_NAME;
const FOOTER_IMAGE_CID = sesProvider.FOOTER_IMAGE_CID;

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

/** YYYY-MM-DD for email/calendar display (node-pg may return Date objects for DATE columns). */
function toDateOnlyString(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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

function isSesConfigured() {
  return sesProvider.isSesConfigured();
}

/** Comma- or semicolon-separated list; default HeyOpsy@heyopsy.com */
function getOpsTeamNotifyRecipients() {
  const raw = (process.env.OPS_TEAM_NOTIFY_EMAIL || "HeyOpsy@heyopsy.com").trim();
  if (!raw) return [];
  return [...new Set(raw.split(/[,;]+/).map((s) => s.trim()).filter(Boolean))];
}

/**
 * Internal ops alerts (new accounts, tickets, property coverage). Uses SES when configured.
 * When SES is off, logs a short line (local dev).
 */
async function sendOpsTeamInternalNotification({ subject, innerHtml }) {
  const recipients = getOpsTeamNotifyRecipients();
  if (!recipients.length) {
    console.warn("[emailService] OPS team notify: no recipients (OPS_TEAM_NOTIFY_EMAIL empty)");
    return { success: false, reason: "no_recipients" };
  }
  const safeSubject = subject.length > 200 ? `${subject.slice(0, 197)}...` : subject;
  const fullSubject = `${brandName} (ops): ${safeSubject}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      ${innerHtml}
      ${getEmailFooterHtml()}
    </div>
  `;
  if (!isSesConfigured()) {
    console.info(`[emailService] OPS notify (SES not configured): ${fullSubject}`);
    return { success: false, reason: "ses_not_configured" };
  }
  for (const to of recipients) {
    await sesProvider.sendViaSes({ to, subject: fullSubject, html });
  }
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

  return sesProvider.sendViaSes({
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

  return sesProvider.sendViaSes({
    to,
    subject: `Verify your email — ${brandName}`,
    html,
    usage,
  });
}

function getPropertyInvitationEmailParts(
  inviterName,
  inviteeName,
  propertyAddress,
  inviteeHasAccount,
) {
  const intro = inviteeName ? `Hi ${inviteeName},` : "Hi,";
  const inviterText = inviterName ? `${inviterName} has` : "Someone has";
  const contextText = propertyAddress
    ? `${inviterText} invited you to join a property: ${propertyAddress}.`
    : `${inviterText} invited you to join a property.`;

  if (inviteeHasAccount) {
    return {
      headline: "Property invitation",
      intro,
      bodyExtra: `${contextText} You already have a ${brandName} account. Use the button below to open the property and accept or decline. If you're not signed in, you'll be asked to sign in first. You can also respond from your notifications (bell icon) when signed in.`,
      ctaLabel: "View Invitation",
    };
  }
  return {
    headline: `Property invitation — ${brandName}`,
    intro,
    bodyExtra: `${contextText} Use the button below to join ${brandName} and set your password to accept this invitation.`,
    ctaLabel: "Accept invitation",
  };
}

function buildPropertyInvitationDefaultMainPlain({
  inviterName,
  inviteeName,
  propertyAddress,
  inviteeHasAccount,
}) {
  const { headline, intro, bodyExtra } = getPropertyInvitationEmailParts(
    inviterName,
    inviteeName,
    propertyAddress,
    inviteeHasAccount,
  );
  return `${headline}\n\n${intro}\n\n${bodyExtra}`;
}

async function sendInvitationEmail({
  to,
  inviteUrl,
  inviterName,
  inviteeName,
  type = "account",
  propertyAddress,
  inviteeHasAccount = false,
  usage,
  personalNote = null,
  cc = null,
  mainPlainOverride = null,
  recipientFirstName = "",
  invitedByAgent = false,
  agentFirstName = "",
  agentFullName = "",
  agentRole = "",
  agentPhotoUrl = "",
  agentAvatarUrl = "",
  agentInitials = "",
  hasAgentPhoto = false,
  teamName = "",
  brokerageName = "",
  brokerageLogoUrl = "",
  invitationId = null,
  propertyId = null,
  propertyStreet = "",
  missingDataCount = 0,
  missingDataSummary = "",
  missingDataHtml = "",
  missingDataItem1Title = "",
  missingDataItem1Body = "",
  missingDataItem2Title = "",
  missingDataItem2Body = "",
  missingDataItem3Title = "",
  missingDataItem3Body = "",
  senderFirstName = "",
  avatarUrl = "",
}) {
  const isProperty = type === "property";
  const emailType = isProperty ? "property_invitation" : "account_invitation";
  const subject = isProperty
    ? `You've been invited to join a property${propertyAddress ? `: ${propertyAddress}` : ""}`
    : `You've been invited to join ${brandName}`;

  const introDefault = inviteeName ? `Hi ${inviteeName},` : "Hi,";
  const inviterText = inviterName ? `${inviterName} has` : "Someone has";
  const contextText = isProperty
    ? (propertyAddress
      ? `${inviterText} invited you to join a property: ${propertyAddress}.`
      : `${inviterText} invited you to join a property.`)
    : `${inviterText} invited you to join ${brandName}.`;

  let headline;
  let intro;
  let bodyExtra;
  let ctaLabel;
  let footerNote =
    "This invitation expires in one week. If you didn't expect this invite, you can safely ignore this email.";

  if (isProperty) {
    const parts = getPropertyInvitationEmailParts(
      inviterName,
      inviteeName,
      propertyAddress,
      inviteeHasAccount,
    );
    headline = parts.headline;
    intro = parts.intro;
    bodyExtra = parts.bodyExtra;
    ctaLabel = parts.ctaLabel;
  } else {
    headline = `You're invited to ${brandName}`;
    intro = introDefault;
    bodyExtra = `${contextText} Click the button below to accept and set up your account:`;
    ctaLabel = "Accept invitation";
  }

  const mainTrim =
    isProperty && mainPlainOverride != null
      ? String(mainPlainOverride).trim()
      : "";
  const useCustomMain = mainTrim.length > 0;

  const noteTrim =
    !useCustomMain && personalNote != null ? String(personalNote).trim() : "";
  const personalNoteBlock =
    noteTrim.length > 0
      ? `<div style="margin: 20px 0; padding: 14px 16px; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #456564;">
      <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #456564; text-transform: uppercase; letter-spacing: 0.02em;">Personal message</p>
      <p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(
        noteTrim,
      )}</p>
    </div>`
      : "";

  const customMainBlock = useCustomMain
    ? `<div style="font-size: 15px; line-height: 1.6; color: #1f2937; white-space: pre-wrap;">${escapeHtml(
        mainTrim,
      )}</div>`
    : "";

  const standardMainBlock = useCustomMain
    ? ""
    : `<h2 style="color: #456564;">${headline}</h2>
      <p>${intro}</p>
      ${personalNoteBlock}
      <p>${bodyExtra}</p>`;

  const ccList =
    Array.isArray(cc) && cc.length > 0
      ? [...new Set(cc.map((e) => String(e || "").trim()).filter(Boolean))]
      : [];

  const mainContentHtml = useCustomMain ? customMainBlock : standardMainBlock;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      ${mainContentHtml}
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">${ctaLabel}</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">${footerNote}</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  const resolvedRecipientFirstName =
    recipientFirstName || inviteeName || "";
  const mergeData = {
    brandName,
    inviteUrl,
    inviterName: inviterName || "Someone",
    inviteeName: inviteeName || resolvedRecipientFirstName || "",
    propertyAddress: propertyAddress || "",
    propertyAddressSuffix: propertyAddress ? `: ${propertyAddress}` : "",
    inviteeHasAccount,
    personalNote: noteTrim,
    personalNoteBlock,
    mainPlainOverride: mainTrim,
    inviteInstructions: isProperty ? bodyExtra : "",
    headline,
    intro,
    bodyExtra,
    ctaLabel,
    footerNote,
    mainContentHtml,
    invitationType: type,
    ...(isProperty
      ? {
          invitationId: invitationId ?? null,
          propertyId: propertyId ?? null,
          recipientFirstName: resolvedRecipientFirstName,
          invitedByAgent: Boolean(invitedByAgent),
          agentFirstName: agentFirstName || firstNameFromUser(inviterName),
          agentFullName: agentFullName || inviterName || "",
          agentRole: agentRole || "real estate advisor",
          agentPhotoUrl: agentPhotoUrl || "",
          agentAvatarUrl: agentAvatarUrl || agentPhotoUrl || "",
          agentInitials: agentInitials || "",
          hasAgentPhoto: Boolean(hasAgentPhoto),
          teamName: teamName || "",
          brokerageName: brokerageName || "",
          brokerageLogoUrl: brokerageLogoUrl || "",
          propertyStreet: propertyStreet || "",
          missingDataCount: Number(missingDataCount) || 0,
          missingDataSummary: missingDataSummary || "",
          missingDataHtml: missingDataHtml || "",
          missingDataItem1Title: missingDataItem1Title || "",
          missingDataItem1Body: missingDataItem1Body || "",
          missingDataItem2Title: missingDataItem2Title || "",
          missingDataItem2Body: missingDataItem2Body || "",
          missingDataItem3Title: missingDataItem3Title || "",
          missingDataItem3Body: missingDataItem3Body || "",
        }
      : {
          recipientFirstName: resolvedRecipientFirstName,
          senderFirstName:
            senderFirstName || firstNameFromUser(inviterName) || "",
          avatarUrl: avatarUrl || "",
        }),
  };

  return emailProviderRouter.deliver({
    emailType,
    to,
    subject,
    html,
    mergeData,
    usage,
    cc: ccList,
  });
}

/**
 * Single email listing multiple property invitations (one link per property / invitation token).
 * @param {Object} opts - { to, inviterName?, inviteeName?, items: { propertyAddress?, inviteUrl }[], inviteeHasAccount?, usage? }
 */
async function sendBulkPropertyInvitationEmail({
  to,
  inviterName,
  inviteeName,
  items,
  inviteeHasAccount = false,
  usage,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("sendBulkPropertyInvitationEmail requires a non-empty items array");
  }

  const n = items.length;
  const subject =
    n === 1
      ? `You've been invited to join a property${items[0].propertyAddress ? `: ${items[0].propertyAddress}` : ""}`
      : `You've been invited to join ${n} properties`;

  const intro = inviteeName ? `Hi ${escapeHtml(inviteeName)},` : "Hi,";
  const inviterText = inviterName ? `${escapeHtml(inviterName)} has` : "Someone has";

  let contextLead;
  if (n === 1) {
    contextLead = items[0].propertyAddress
      ? `${inviterText} invited you to join a property: ${escapeHtml(items[0].propertyAddress)}.`
      : `${inviterText} invited you to join a property.`;
  } else {
    contextLead = `${inviterText} invited you to join the following ${n} properties on ${escapeHtml(brandName)}:`;
  }

  const headline = n === 1 ? "Property invitation" : "Property invitations";
  const footerNote =
    n === 1
      ? "This invitation expires in one week. If you didn't expect this invite, you can safely ignore this email."
      : "These invitations expire in one week. If you didn't expect this invite, you can safely ignore this email.";

  let bulkInviteInstructions;
  let linkIntro;
  if (inviteeHasAccount) {
    bulkInviteInstructions = `You already have a ${escapeHtml(
      brandName
    )} account. Use the links below to open each property and accept or decline. If you're not signed in, you'll be asked to sign in first. You can also respond from your notifications (bell icon) when signed in.`;
    linkIntro = n === 1 ? "" : `<p style="margin-top: 16px;">Open each invitation:</p>`;
  } else {
    bulkInviteInstructions = `Use the links below to join ${escapeHtml(
      brandName
    )} and set your password to accept ${n === 1 ? "this invitation" : "each invitation"}.`;
    linkIntro = n === 1 ? "" : `<p style="margin-top: 16px;">Accept each invitation:</p>`;
  }
  const bodyExtra = `${contextLead} ${bulkInviteInstructions}`;

  const listHtml =
    n === 1
      ? `<p style="margin: 24px 0;">
        <a href="${escapeHtmlAttr(items[0].inviteUrl)}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">${
          inviteeHasAccount ? "View invitation" : "Accept invitation"
        }</a>
      </p>`
      : `<ul style="padding-left: 20px; margin: 16px 0; line-height: 1.6;">
        ${items
          .map((it) => {
            const label = it.propertyAddress
              ? escapeHtml(it.propertyAddress)
              : "Property invitation";
            const cta = inviteeHasAccount ? "View" : "Accept";
            return `<li style="margin: 10px 0;">
              <a href="${escapeHtmlAttr(it.inviteUrl)}" style="color: #456564; font-weight: 600;">${cta}: ${label}</a>
            </li>`;
          })
          .join("")}
      </ul>`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564;">${headline}</h2>
      <p>${intro}</p>
      <p>${bodyExtra}</p>
      ${linkIntro}
      ${listHtml}
      <p style="color: #6b7280; font-size: 14px;">${footerNote}</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  const resolvedRecipientFirstName = inviteeName || "";
  return emailProviderRouter.deliver({
    emailType: "bulk_property_invitation",
    to,
    subject,
    html,
    mergeData: {
      brandName,
      inviterName: inviterName || "Someone",
      inviteeName: resolvedRecipientFirstName,
      recipientFirstName: resolvedRecipientFirstName,
      inviteeHasAccount,
      items,
      itemCount: n,
      subject,
      bulkInviteInstructions,
      headline,
      intro,
      bodyExtra,
      linkIntro,
      listHtml,
      footerNote,
    },
    usage,
  });
}

/**
 * Single email listing multiple properties the invitee was added to directly.
 * @param {Object} opts - { to, inviterName?, inviteeName?, items: { propertyAddress?, propertyUrl }[], usage? }
 */
async function sendBulkPropertyAddedEmail({
  to,
  inviterName,
  inviteeName,
  items,
  usage,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("sendBulkPropertyAddedEmail requires a non-empty items array");
  }

  const n = items.length;
  const subject =
    n === 1
      ? `You've been added to a property${items[0].propertyAddress ? `: ${items[0].propertyAddress}` : ""}`
      : `You've been added to ${n} properties`;

  const intro = inviteeName ? `Hi ${escapeHtml(inviteeName)},` : "Hi,";
  const inviterText = inviterName ? `${escapeHtml(inviterName)} has` : "Someone has";

  let contextLead;
  if (n === 1) {
    contextLead = items[0].propertyAddress
      ? `${inviterText} added you to a property: ${escapeHtml(items[0].propertyAddress)}.`
      : `${inviterText} added you to a property.`;
  } else {
    contextLead = `${inviterText} added you to the following ${n} properties on ${escapeHtml(brandName)}:`;
  }

  const headline = n === 1 ? "Property added" : "Properties added";
  const footerNote =
    "If you didn't expect this, you can contact your team or remove yourself from the property in the app.";

  const instructions = `You can open ${n === 1 ? "the property" : "each property"} below in ${escapeHtml(
    brandName
  )}. No acceptance is required — you're already on the team.`;

  const bodyExtra = `${contextLead} ${instructions}`;

  const listHtml =
    n === 1
      ? `<p style="margin: 24px 0;">
        <a href="${escapeHtmlAttr(items[0].propertyUrl)}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View property</a>
      </p>`
      : `<ul style="padding-left: 20px; margin: 16px 0; line-height: 1.6;">
        ${items
          .map((it) => {
            const label = it.propertyAddress
              ? escapeHtml(it.propertyAddress)
              : "Property";
            return `<li style="margin: 10px 0;">
              <a href="${escapeHtmlAttr(it.propertyUrl)}" style="color: #456564; font-weight: 600;">View: ${label}</a>
            </li>`;
          })
          .join("")}
      </ul>`;

  const linkIntro = n === 1 ? "" : `<p style="margin-top: 16px;">Open each property:</p>`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564;">${headline}</h2>
      <p>${intro}</p>
      <p>${bodyExtra}</p>
      ${linkIntro}
      ${listHtml}
      <p style="color: #6b7280; font-size: 14px;">${footerNote}</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  const resolvedRecipientFirstName = inviteeName || "";
  return emailProviderRouter.deliver({
    emailType: "bulk_property_invitation",
    to,
    subject,
    html,
    mergeData: {
      brandName,
      inviterName: inviterName || "Someone",
      inviteeName: resolvedRecipientFirstName,
      recipientFirstName: resolvedRecipientFirstName,
      autoAdded: true,
      items,
      itemCount: n,
      subject,
      headline,
      intro,
      bodyExtra,
      linkIntro,
      listHtml,
      footerNote,
    },
    usage,
  });
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
  const greeting = contractorName ? `Hi ${contractorName},` : "Hi,";
  const senderLabel = sanitizeSenderLabelForEmail(senderName);
  const requester = senderLabel ? senderLabel : "A homeowner";
  const propertyText = propertyAddress ? ` for the property at <strong>${propertyAddress}</strong>` : "";
  const systemText = systemName ? ` regarding <strong>${systemName}</strong>` : "";
  const propertyAtPhrase = propertyText;
  const systemPhrase = systemText;

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

  return emailProviderRouter.deliver({
    emailType: "contractor_report",
    to,
    subject,
    html,
    mergeData: {
      brandName,
      reportUrl,
      contractorName: contractorName || "",
      propertyAddress: propertyAddress || "",
      propertySuffix: propertyAddress ? ` – ${propertyAddress}` : "",
      propertyAtPhrase,
      systemPhrase,
      systemName: systemName || "",
      senderName: requester,
      origin: origin || "",
      inspectionDate: inspectionDate || "",
      greeting,
      requestLine: `${requester} has requested that you fill out a maintenance/inspection report${propertyText}${systemText}.`,
      detailsSection,
    },
    usage,
  });
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
  const greeting = contractorName ? `Hi ${contractorName},` : "Hi,";
  const senderLabel = sanitizeSenderLabelForEmail(senderName);
  const requester = senderLabel || "A homeowner";
  const propertyText = propertyAddress ? ` at <strong>${propertyAddress}</strong>` : "";
  const systemText = systemName ? ` for <strong>${systemName}</strong>` : "";

  const dateKey = toDateOnlyString(scheduledDate);
  const dateForLocale = dateKey ? new Date(`${dateKey}T12:00:00`) : null;
  const formattedDate =
    dateForLocale && !Number.isNaN(dateForLocale.getTime())
      ? dateForLocale.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : dateKey || null;

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

  const subjectSuffix = `${systemName ? ` — ${systemName}` : ""}${propertyAddress ? ` at ${propertyAddress}` : ""}`;

  try {
    return await emailProviderRouter.deliver({
    emailType: "schedule_notification",
    to,
    subject,
    html,
    mergeData: {
      brandName,
      contractorName: contractorName || "",
      propertyAddress: propertyAddress || "",
      systemName: systemName || "",
      scheduledDate: dateKey || "",
      scheduledTime: scheduledTime || "",
      formattedDate: formattedDate || "",
      formattedTime: formattedTime || "",
      messageBody: messageBody || "",
      senderName: requester,
      subjectSuffix,
      greeting,
      scheduleLine: `${requester} has scheduled a service${systemText}${propertyText}.`,
      detailsSection,
      messageSection: messageSection
        ? `<p style="font-size: 14px; color: #374151;">Message from homeowner:</p>${messageSection}`
        : "",
    },
      replyTo,
      usage,
    });
  } catch (err) {
    console.warn("[emailService] schedule notification email failed:", err.message);
    return { success: false, reason: "send_failed" };
  }
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

  return emailProviderRouter.deliver({
    emailType: "professional_contact",
    to: String(to).trim(),
    subject,
    html,
    mergeData: {
      brandName,
      professionalCompanyName: professionalCompanyName || "your listing",
      message,
      messageHtml: safeBody,
      senderName: senderName || "",
      senderEmail: replyEmail || "",
      senderLine: senderLine || senderLabel,
    },
    replyTo: replyEmail,
    usage,
  });
}

/**
 * Welcome email after onboarding — prompts user to add their first property.
 */
async function sendWelcomeEmail({ to, recipientFirstName, ctaUrl, usage }) {
  const toAddr = to && String(to).trim();
  if (!toAddr) {
    return { success: false, reason: "no_recipient" };
  }

  const firstName = recipientFirstName || "there";
  const safeCta = ctaUrl ? escapeHtmlAttr(ctaUrl) : "#";
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564; margin: 0 0 12px;">Welcome to ${escapeHtml(brandName)}</h2>
      <p style="margin: 12px 0; line-height: 1.6;">Hi ${escapeHtml(firstName)},</p>
      <p style="margin: 12px 0; line-height: 1.6;">Welcome. ${escapeHtml(brandName)} is a calm, organized home for your home — it keeps track of what the house needs and tells you when something matters, before it becomes a weekend you didn't plan for.</p>
      <p style="margin: 12px 0; line-height: 1.6;">The first step is the only one that needs you: add your home, and we'll start filling in the rest.</p>
      <p style="margin: 24px 0;">
        <a href="${safeCta}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Add your home</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">Takes about a minute &middot; Nothing to download</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  return emailProviderRouter.deliver({
    emailType: "welcome",
    to: toAddr,
    subject: `Welcome to ${brandName}`,
    html,
    mergeData: {
      brandName,
      recipientFirstName: firstName,
      ctaUrl: ctaUrl || "",
    },
    usage,
  });
}

/**
 * Send welcome email when a user completes onboarding and has no property yet.
 * Skips invited users who already joined a property.
 */
async function trySendWelcomeEmailForUser({ userId, accountId }) {
  if (!userId || !accountId) {
    return { sent: false, reason: "missing_ids" };
  }

  const userRes = await db.query(
    `SELECT email, name, role FROM users WHERE id = $1 AND is_active = true`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user?.email) {
    return { sent: false, reason: "no_email" };
  }

  const role = (user.role || "").toLowerCase();
  if (role !== "homeowner" && role !== "agent") {
    return { sent: false, reason: "skip_role" };
  }

  const propRes = await db.query(
    `SELECT COUNT(*)::int AS c FROM property_users WHERE user_id = $1`,
    [userId]
  );
  if ((propRes.rows[0]?.c || 0) > 0) {
    return { sent: false, reason: "has_property" };
  }

  const base = (APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  const accRes = await db.query(`SELECT url, name FROM accounts WHERE id = $1`, [accountId]);
  const accountSlug = String(accRes.rows[0]?.url || accRes.rows[0]?.name || "home").replace(
    /^\/+|\/+$/g,
    ""
  );
  const ctaUrl = `${base}/${accountSlug}/properties/new`;
  const recipientFirstName = firstNameFromUser(user.name) || "there";

  const result = await sendWelcomeEmail({
    to: user.email,
    recipientFirstName,
    ctaUrl,
    usage: { accountId, userId, emailType: "welcome" },
  });
  return { sent: true, result };
}

/**
 * Notify a customer by email that their reviewed inspection analysis is ready to view.
 */
async function sendInspectionAnalysisReadyEmail({ to, userName, propertyLabel, viewUrl, usage }) {
  const toAddr = to && String(to).trim();
  if (!toAddr) {
    return { success: false, reason: "no_recipient" };
  }
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : "Hi,";
  const safeCta = viewUrl ? escapeHtmlAttr(viewUrl) : "#";
  const propertyLine = propertyLabel
    ? `<p style="margin: 12px 0; line-height: 1.6;">Property: <strong>${escapeHtml(propertyLabel)}</strong></p>`
    : "";
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564; margin: 0 0 12px;">Your inspection analysis is ready</h2>
      <p style="margin: 12px 0; line-height: 1.6;">${greeting}</p>
      <p style="margin: 12px 0; line-height: 1.6;">Your inspection analysis is ready. Log in to view your results.</p>
      ${propertyLine}
      <p style="margin: 24px 0;">
        <a href="${safeCta}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View my results</a>
      </p>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">Opsy uses both AI and human review to analyze inspection reports. Our findings are intended to help inform decisions, not replace professional judgment.</p>
      ${getEmailFooterHtml()}
    </div>
  `;

  return emailProviderRouter.deliver({
    emailType: "inspection_analysis_ready",
    to: toAddr,
    subject: "Your inspection analysis is ready",
    html,
    mergeData: {
      brandName,
      recipientFirstName: userName || "",
      propertyLabel: propertyLabel || "",
      viewUrl: viewUrl || "",
    },
    usage,
  });
}

/**
 * Notify a recipient by email that a communication is available in Opsy (in-app is primary).
 */
async function sendCommunicationNotifyEmail({ to, userName, subjectLine, viewUrl, usage }) {
  const toAddr = to && String(to).trim();
  if (!toAddr) {
    return { success: false, reason: "no_recipient" };
  }
  const greeting = userName ? `Hi ${escapeHtml(userName)},` : "Hi,";
  const title = escapeHtml(subjectLine || "New message");
  const safeHref = escapeHtmlAttr(viewUrl);
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564;">${title}</h2>
      <p>${greeting}</p>
      <p>You have a new message in ${escapeHtml(brandName)}. Open it in the app using the link below.</p>
      <p style="margin: 24px 0;">
        <a href="${safeHref}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View in ${escapeHtml(brandName)}</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">This link opens the message in your browser. Sign in if prompted.</p>
      ${getEmailFooterHtml()}
    </div>
  `;
  try {
    return await emailProviderRouter.deliver({
      emailType: "communication_notify",
    to: toAddr,
    subject: `${subjectLine || "New message"} — ${brandName}`,
    html,
    mergeData: {
      brandName,
      userName: userName || "",
      subjectLine: subjectLine || "New message",
      title: subjectLine || "New message",
      greeting: userName ? `Hi ${userName},` : "Hi,",
      viewUrl,
    },
      usage,
    });
  } catch (err) {
    console.warn("[emailService] communication notify email failed:", err.message);
    return { success: false, reason: "send_failed" };
  }
}
function ticketBodyToHtml(text) {
  if (!text) return "";
  const safe = escapeHtml(text).replace(/\r\n/g, "\n");
  const blocks = safe.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const allBullets = lines.every((l) => /^[-*•]\s+/.test(l.trim()));
      if (allBullets && lines.length > 1) {
        const items = lines
          .map((l) => `<li style="margin: 4px 0;">${l.trim().replace(/^[-*•]\s+/, "")}</li>`)
          .join("");
        return `<ul style="padding-left: 20px; margin: 12px 0; line-height: 1.6;">${items}</ul>`;
      }
      return `<p style="margin: 12px 0; line-height: 1.6;">${lines.join("<br/>")}</p>`;
    })
    .join("");
}

/** Human-friendly first name fallback from a full name string. */
function firstNameFromUser(userName) {
  if (!userName || typeof userName !== "string") return null;
  const trimmed = userName.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  return first || null;
}

/** Shared header/style block for ticket emails. */
function ticketEmailShell({ heading, intro, bodyHtml, ctaUrl, ctaLabel, footerNote }) {
  const safeHref = ctaUrl ? escapeHtmlAttr(ctaUrl) : null;
  const cta = safeHref
    ? `<p style="margin: 24px 0;">
        <a href="${safeHref}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">${escapeHtml(ctaLabel || "View ticket")}</a>
      </p>`
    : "";
  const note = footerNote
    ? `<p style="color: #6b7280; font-size: 13px; margin-top: 20px;">${escapeHtml(footerNote)}</p>`
    : "";
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #456564; margin-bottom: 8px;">${escapeHtml(heading)}</h2>
      ${intro ? `<p style="margin: 12px 0; line-height: 1.6;">${intro}</p>` : ""}
      ${bodyHtml || ""}
      ${cta}
      ${note}
      ${getEmailFooterHtml()}
    </div>
  `;
}

/**
 * Confirmation email sent to a user immediately after they submit a support or feedback ticket.
 * The in-thread automated response text is mirrored here so users get a consistent acknowledgment
 * in-app and in their inbox.
 */
async function sendSupportTicketReceivedEmail({
  to,
  ticket,
  viewUrl,
  autoResponseText,
  usage,
}) {
  const toAddr = to && String(to).trim();
  if (!toAddr) return { success: false, reason: "no_recipient" };

  const typeLabel = ticket?.type === "feedback" ? "feedback" : "support request";
  const heading =
    ticket?.type === "feedback"
      ? `We received your feedback`
      : `We received your support request`;
  const subjectLine = ticket?.subject ? `: ${ticket.subject}` : "";
  const subject = `[${brandName} Support] Request received${subjectLine}`.slice(
    0,
    200
  );

  const body = ticketBodyToHtml(autoResponseText);
  const meta = detailsTableTicket([
    ["Subject", ticket?.subject],
    ["Type", ticket?.type === "feedback" ? "Feedback" : "Support"],
  ]);

  const footerNote =
    "You're receiving this email because you submitted a " +
    typeLabel +
    " in Opsy. Replies to this email are not monitored — please use the ticket link above to continue the conversation.";

  const html = ticketEmailShell({
    heading,
    intro: null,
    bodyHtml: `${body}${meta}`,
    ctaUrl: viewUrl,
    ctaLabel: "View ticket",
    footerNote,
  });

  try {
    return await emailProviderRouter.deliver({
      emailType: "support_ticket_received",
    to: toAddr,
    subject,
    html,
    mergeData: {
      brandName,
      heading,
      subjectSuffix: subjectLine,
      bodyHtml: `${body}${meta}`,
      viewUrl,
      footerNote,
      ticketSubject: ticket?.subject || "",
      ticketType: ticket?.type || "support",
      autoResponseText: autoResponseText || "",
    },
      usage,
    });
  } catch (err) {
    console.warn("[emailService] ticket received email failed:", err.message);
    return { success: false, reason: "send_failed" };
  }
}

/**
 * Notification email sent to the ticket creator whenever a team member posts a reply.
 * Skip automated replies (they're acknowledged by sendSupportTicketReceivedEmail) and
 * skip when the creator is the author (self-echo).
 */
async function sendSupportTicketReplyEmail({
  to,
  userName,
  ticket,
  reply,
  viewUrl,
  usage,
}) {
  const toAddr = to && String(to).trim();
  if (!toAddr) return { success: false, reason: "no_recipient" };
  if (!reply?.body?.trim()) return { success: false, reason: "empty_body" };

  const firstName = firstNameFromUser(userName);
  const introPlain = firstName ? `Hi ${firstName},` : "Hi there,";
  const intro = firstName
    ? `Hi ${escapeHtml(firstName)},`
    : "Hi there,";
  const subjectLine = ticket?.subject ? `: ${ticket.subject}` : "";
  const subject = `[${brandName} Support] New reply${subjectLine}`.slice(
    0,
    200
  );

  const replyBlock = `
    <div style="margin: 16px 0; padding: 14px 16px; background: #f9fafb; border-left: 3px solid #456564; border-radius: 6px; font-size: 15px; color: #111827; line-height: 1.55; white-space: pre-wrap;">
      ${escapeHtml(reply.body).replace(/\n/g, "<br/>")}
    </div>`;

  const meta = detailsTableTicket([
    ["Subject", ticket?.subject],
    ["Status", humanizeStatus(ticket?.status)],
  ]);

  const footerNote =
    "Replies to this email are not monitored — please use the ticket link above so the entire thread stays with your request.";

  const html = ticketEmailShell({
    heading: `A team member replied to your ticket`,
    intro,
    bodyHtml: `
      <p style="margin: 12px 0; line-height: 1.6;">
        The Opsy Support team just posted an update on your request.
      </p>
      ${replyBlock}
      ${meta}
      <p style="margin: 12px 0; line-height: 1.6;">
        Open the ticket below to view the full conversation or reply.
      </p>`,
    ctaUrl: viewUrl,
    ctaLabel: "View and reply",
    footerNote,
  });

  try {
    return await emailProviderRouter.deliver({
      emailType: "support_ticket_reply",
    to: toAddr,
    subject,
    html,
    mergeData: {
      brandName,
      userName: firstName || userName || "",
      intro: introPlain,
      subjectSuffix: subjectLine,
      replyBlock,
      metaHtml: meta,
      viewUrl,
      footerNote,
      ticketSubject: ticket?.subject || "",
      ticketStatus: humanizeStatus(ticket?.status) || "",
      replyBody: reply.body,
    },
      usage,
    });
  } catch (err) {
    console.warn("[emailService] ticket reply email failed:", err.message);
    return { success: false, reason: "send_failed" };
  }
}

function detailsTableTicket(rows) {
  const body = rows
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(
      ([label, value]) =>
        `<tr><td style="padding: 4px 12px 4px 0; color: #6b7280; vertical-align: top; font-size: 13px;">${escapeHtml(label)}</td><td style="vertical-align: top; font-size: 13px; color: #111827;">${escapeHtml(value)}</td></tr>`
    )
    .join("");
  if (!body) return "";
  return `<table style="border-collapse: collapse; margin: 12px 0;">${body}</table>`;
}

function parseRecipientList(raw, fallback) {
  const source = (raw && String(raw).trim()) || fallback || "";
  if (!source.trim()) return [];
  return [...new Set(source.split(/[,;]+/).map((s) => s.trim()).filter(Boolean))];
}

/** Internal Helpdesk alert recipients for new inspection report reviews. */
function getHelpdeskInspectionReviewOpsRecipients() {
  return parseRecipientList(
    process.env.HELPDESK_INSPECTION_REVIEW_OPS_EMAIL,
    "kino@heyopsy.com,dev@heyopsy.com"
  );
}

/** Internal Helpdesk alert recipient for new support / feedback / data adjustment tickets. */
function getHelpdeskTicketOpsRecipients() {
  return parseRecipientList(process.env.HELPDESK_TICKET_OPS_EMAIL, "dev@heyopsy.com");
}

async function deliverToRecipients({
  emailType,
  recipients,
  subject,
  html,
  mergeData,
  usage,
}) {
  const toList = Array.isArray(recipients)
    ? recipients.filter((r) => r && String(r).trim())
    : [];
  if (!toList.length) {
    console.warn(`[emailService] ${emailType}: no recipients configured`);
    return { success: false, reason: "no_recipients" };
  }
  let lastResult = { success: false };
  for (const to of toList) {
    try {
      lastResult = await emailProviderRouter.deliver({
        emailType,
        to,
        subject,
        html,
        mergeData,
        usage: { ...usage, emailType },
      });
    } catch (err) {
      console.error(`[emailService] ${emailType} to ${to}:`, err.message);
      lastResult = { success: false, reason: "send_failed" };
    }
  }
  return lastResult;
}

function buildHelpdeskTicketOpsUrl(ticket) {
  const base = (APP_BASE_URL || "").replace(/\/$/, "");
  if (!base || !ticket?.id) return base || "";
  const accountUrl = ticket.accountUrl
    ? String(ticket.accountUrl).replace(/^\/+|\/+$/g, "")
    : null;
  if (!accountUrl) return `${base}/helpdesk/support/${ticket.id}`;
  if (ticket.type === "feedback") {
    return `${base}/${accountUrl}/helpdesk/feedback/${ticket.id}`;
  }
  if (ticket.type === "data_adjustment") {
    return `${base}/${accountUrl}/helpdesk/data-adjustments/${ticket.id}`;
  }
  return `${base}/${accountUrl}/helpdesk/support/${ticket.id}`;
}

const HELPDESK_TICKET_TYPE_LABELS = {
  support: "Support",
  feedback: "Feedback",
  data_adjustment: "Data adjustment",
};

/**
 * Internal ops email when a new inspection report review is queued.
 * Recipients: kino@heyopsy.com and dev@heyopsy.com (override via env).
 */
async function sendHelpdeskInspectionReviewCreatedEmail(detail) {
  if (!detail?.id) return { success: false, reason: "no_detail" };

  const propertyAddress =
    detail.propertyAddress ||
    detail.address ||
    [
      detail.address_line_1,
      detail.city,
      detail.state,
      detail.zip,
    ]
      .filter(Boolean)
      .join(", ") ||
    detail.property_name ||
    (detail.property_uid ? `Property ${detail.property_uid}` : `Property #${detail.property_id}`);

  const customerName = detail.uploader_name || detail.owner_name || "Customer";
  const customerEmail = detail.uploader_email || "";
  const uploadedAt = detail.uploaded_at
    ? new Date(detail.uploaded_at).toLocaleString()
    : "";

  const base = (APP_BASE_URL || "").replace(/\/$/, "");
  const acct = (detail.account_url || "").replace(/^\/+|\/+$/g, "");
  const reviewUrl =
    base && acct && detail.id
      ? `${base}/${acct}/helpdesk/inspection-reviews/${detail.id}`
      : base || "";

  const detailsHtml = detailsTableTicket([
    ["Property address", propertyAddress],
    [
      "Customer",
      customerEmail
        ? `${customerName} (${customerEmail})`
        : customerName,
    ],
    ["Inspection ID", `#${detail.id} (job #${detail.job_id})`],
    ["Uploaded", uploadedAt],
    ["Review page", reviewUrl],
  ]);

  const subject = `Inspection review needed: ${String(propertyAddress).slice(0, 90)}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #456564; margin: 0 0 12px;">New inspection report review</h2>
      <p style="margin: 12px 0; line-height: 1.6;">A new AI inspection analysis is ready for review on the Helpdesk.</p>
      ${detailsHtml}
      ${reviewUrl ? `<p style="margin: 24px 0;"><a href="${escapeHtmlAttr(reviewUrl)}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open review</a></p>` : ""}
      ${getEmailFooterHtml()}
    </div>
  `;

  const mergeData = {
    brandName,
    propertyAddress,
    customerName,
    customerEmail,
    reviewId: String(detail.id),
    jobId: detail.job_id != null ? String(detail.job_id) : "",
    uploadedAt,
    reviewUrl,
    detailsHtml,
  };

  return deliverToRecipients({
    emailType: "helpdesk_inspection_review_created",
    recipients: getHelpdeskInspectionReviewOpsRecipients(),
    subject,
    html,
    mergeData,
  });
}

/**
 * Internal ops email when a support, feedback, or data adjustment ticket is created.
 * Recipient: dev@heyopsy.com (override via env).
 */
async function sendHelpdeskTicketCreatedOpsEmail(ticket) {
  if (!ticket?.id) return { success: false, reason: "no_ticket" };

  const ticketTypeLabel =
    HELPDESK_TICKET_TYPE_LABELS[ticket.type] || "Helpdesk";
  const ticketUrl = buildHelpdeskTicketOpsUrl(ticket);
  const accountLabel = ticket.accountName
    ? `${ticket.accountName} (ID ${ticket.accountId})`
    : ticket.accountId != null
      ? String(ticket.accountId)
      : "";

  const descriptionHtml = ticket.description
    ? `<div style="margin: 12px 0; padding: 12px 16px; background: #f9fafb; border-radius: 8px; font-size: 14px; color: #111827; white-space: pre-wrap;">${escapeHtml(ticket.description)}</div>`
    : "";

  const detailsHtml = detailsTableTicket([
    ["Subject", ticket.subject],
    ["Type", ticketTypeLabel],
    ["Account", accountLabel],
    [
      "Created by",
      ticket.createdByName || ticket.createdByEmail ||
        (ticket.createdBy != null ? `User ${ticket.createdBy}` : ""),
    ],
    ["Ticket page", ticketUrl],
  ]);

  const subject = `${ticketTypeLabel} ticket #${ticket.id}: ${(ticket.subject || "").slice(0, 80)}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #456564; margin: 0 0 12px;">New ${escapeHtml(ticketTypeLabel)} ticket</h2>
      <p style="margin: 12px 0; line-height: 1.6;">A new helpdesk ticket was submitted.</p>
      ${detailsHtml}
      ${descriptionHtml}
      ${ticketUrl ? `<p style="margin: 24px 0;"><a href="${escapeHtmlAttr(ticketUrl)}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View ticket</a></p>` : ""}
      ${getEmailFooterHtml()}
    </div>
  `;

  const mergeData = {
    brandName,
    ticketId: String(ticket.id),
    ticketType: ticket.type || "",
    ticketTypeLabel,
    ticketSubject: ticket.subject || "",
    ticketUrl,
    accountName: ticket.accountName || "",
    accountId: ticket.accountId != null ? String(ticket.accountId) : "",
    createdByName: ticket.createdByName || "",
    createdByEmail: ticket.createdByEmail || "",
    descriptionHtml,
    detailsHtml,
  };

  return deliverToRecipients({
    emailType: "helpdesk_ticket_created_ops",
    recipients: getHelpdeskTicketOpsRecipients(),
    subject,
    html,
    mergeData,
  });
}

function humanizeStatus(status) {
  if (!status) return null;
  return String(status)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build a deep link to an account's billing page for email CTAs. */
async function buildAccountBillingUrl(accountId) {
  const base = (APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  if (!accountId) return `${base}/settings/billing`;
  try {
    const accRes = await db.query(`SELECT url, name FROM accounts WHERE id = $1`, [accountId]);
    const slug = String(accRes.rows[0]?.url || accRes.rows[0]?.name || "home").replace(
      /^\/+|\/+$/g,
      ""
    );
    return `${base}/${slug}/settings/billing`;
  } catch {
    return `${base}/settings/billing`;
  }
}

/**
 * Lifecycle emails for agent-subsidized (sponsored) property billing.
 * `kind` is one of: active | grace_started | grace_reminder | ended.
 * In-app notifications remain the primary channel; these emails ensure the
 * high-stakes grace deadline is seen.
 */
async function sendSponsorshipLifecycleEmail({
  to,
  userName,
  kind,
  propertyLabel,
  agentName,
  graceEndsOn,
  billingUrl,
  usage,
}) {
  const toAddr = to && String(to).trim();
  if (!toAddr) return { success: false, reason: "no_recipient" };

  const greeting = userName ? `Hi ${escapeHtml(userName)},` : "Hi,";
  const property = escapeHtml(propertyLabel || "your property");
  const agent = escapeHtml(agentName || "your agent");
  const deadline = graceEndsOn ? escapeHtml(graceEndsOn) : null;
  const safeCta = billingUrl ? escapeHtmlAttr(billingUrl) : "#";

  let heading;
  let subject;
  let bodyHtml;
  let ctaLabel = `Open billing`;

  if (kind === "active") {
    heading = "Your agent now covers this property";
    subject = `${agent} now covers ${propertyLabel || "your property"} — ${brandName}`;
    bodyHtml = `<p style="margin: 12px 0; line-height: 1.6;">${agent}'s plan now covers <strong>${property}</strong>. You won't be charged for this property. You can subscribe again anytime to take back control.</p>`;
  } else if (kind === "grace_started") {
    heading = "Action needed: agent coverage is ending";
    subject = `Action needed: coverage for ${propertyLabel || "your property"} is ending — ${brandName}`;
    bodyHtml = `
      <p style="margin: 12px 0; line-height: 1.6;">${agent} is no longer covering <strong>${property}</strong>.</p>
      <p style="margin: 12px 0; line-height: 1.6;">You have a 30-day grace period${deadline ? ` (until <strong>${deadline}</strong>)` : ""} to resume your own plan. If you don't, this property will move to the free plan with reduced limits and AI turned off.</p>`;
    ctaLabel = "Resume my plan";
  } else if (kind === "grace_reminder") {
    heading = "Reminder: agent coverage is ending soon";
    subject = `Reminder: coverage for ${propertyLabel || "your property"} ends${deadline ? ` ${graceEndsOn}` : " soon"} — ${brandName}`;
    bodyHtml = `
      <p style="margin: 12px 0; line-height: 1.6;">Agent coverage for <strong>${property}</strong> ends${deadline ? ` on <strong>${deadline}</strong>` : " soon"}.</p>
      <p style="margin: 12px 0; line-height: 1.6;">Subscribe before then to keep your premium features for this property.</p>`;
    ctaLabel = "Resume my plan";
  } else {
    heading = "Agent coverage has ended";
    subject = `Agent coverage for ${propertyLabel || "your property"} has ended — ${brandName}`;
    bodyHtml = `
      <p style="margin: 12px 0; line-height: 1.6;">Agent coverage for <strong>${property}</strong> has ended and it has moved to the free plan.</p>
      <p style="margin: 12px 0; line-height: 1.6;">Subscribe anytime to restore premium features for this property.</p>`;
    ctaLabel = "Subscribe";
  }

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #456564; margin: 0 0 12px;">${escapeHtml(heading)}</h2>
      <p style="margin: 12px 0; line-height: 1.6;">${greeting}</p>
      ${bodyHtml}
      <p style="margin: 24px 0;">
        <a href="${safeCta}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">${escapeHtml(ctaLabel)}</a>
      </p>
      ${getEmailFooterHtml()}
    </div>
  `;

  try {
    return await emailProviderRouter.deliver({
      emailType: `sponsorship_${kind}`,
      to: toAddr,
      subject,
      html,
      mergeData: {
        brandName,
        userName: userName || "",
        propertyLabel: propertyLabel || "",
        agentName: agentName || "",
        graceEndsOn: graceEndsOn || "",
        billingUrl: billingUrl || "",
      },
      usage,
    });
  } catch (err) {
    console.warn(`[emailService] sponsorship ${kind} email failed:`, err.message);
    return { success: false, reason: "send_failed" };
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendWelcomeEmail,
  trySendWelcomeEmailForUser,
  sendInvitationEmail,
  buildPropertyInvitationDefaultMainPlain,
  sendBulkPropertyInvitationEmail,
  sendBulkPropertyAddedEmail,
  sendContractorReportEmail,
  sendScheduleNotificationEmail,
  sendProfessionalContactEmail,
  sendCommunicationNotifyEmail,
  sendInspectionAnalysisReadyEmail,
  sendSupportTicketReceivedEmail,
  sendSupportTicketReplyEmail,
  sendHelpdeskInspectionReviewCreatedEmail,
  sendHelpdeskTicketCreatedOpsEmail,
  getHelpdeskInspectionReviewOpsRecipients,
  getHelpdeskTicketOpsRecipients,
  sendSponsorshipLifecycleEmail,
  buildAccountBillingUrl,
  getOpsTeamNotifyRecipients,
  sendOpsTeamInternalNotification,
};
