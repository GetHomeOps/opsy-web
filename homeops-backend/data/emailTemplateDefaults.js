"use strict";

const { EMAIL_BRAND_NAME } = require("../config");

/**
 * Default SES email templates.
 *
 * Each `htmlBody` is the BODY ONLY — no wrapping container, no footer.
 * The container `<div>` and (optional) footer are added at render time by
 * services/emailComposer.js. This lets the admin edit only the meaningful
 * content and toggle the Opsy footer on/off independently.
 */

const DEFAULTS = {
  account_invitation: {
    subject: "You've been invited to join {{brandName}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">You're invited to join {{brandName}}</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{inviteeName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">{{inviterName}} has invited you to join {{brandName}}. Click the button below to accept and set up your account:</p>
<p style="margin: 24px 0;"><a href="{{inviteUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept invitation</a></p>
<p style="color: #6b7280; font-size: 14px;">This invitation expires in one week. If you didn't expect this invite, you can safely ignore this email.</p>`,
  },
  property_invitation: {
    subject: "You've been invited to join a property{{propertyAddressSuffix}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Property invitation — {{brandName}}</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{inviteeName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">{{inviterName}} has invited you to join a property{{propertyAddressSuffix}}.</p>
{{personalNoteBlock}}
<p style="margin: 12px 0; line-height: 1.6;">{{inviteInstructions}}</p>
<p style="margin: 24px 0;"><a href="{{inviteUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">{{ctaLabel}}</a></p>
<p style="color: #6b7280; font-size: 14px;">This invitation expires in one week. If you didn't expect this invite, you can safely ignore this email.</p>`,
  },
  bulk_property_invitation: {
    subject: "{{subject}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Property invitations</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{inviteeName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">{{inviterName}} has invited you to join the following {{itemCount}} properties on {{brandName}}:</p>
<p style="margin: 12px 0; line-height: 1.6;">{{bulkInviteInstructions}}</p>
<div style="margin: 16px 0;">{{linkIntro}}{{listHtml}}</div>
<p style="color: #6b7280; font-size: 14px;">These invitations expire in one week. If you didn't expect this invite, you can safely ignore this email.</p>`,
  },
  contractor_report: {
    subject: "{{brandName}}: Maintenance report request{{propertySuffix}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Maintenance Report Request</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{contractorName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">{{senderName}} has requested that you fill out a maintenance/inspection report{{propertyAtPhrase}}{{systemPhrase}}.</p>
{{detailsSection}}
<p style="margin: 12px 0; line-height: 1.6;">Please click the button below to open the report form and provide your findings:</p>
<p style="margin: 24px 0;"><a href="{{reportUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Fill Out Report</a></p>
<p style="color: #6b7280; font-size: 14px;">This link expires in 7 days. If you have questions, please contact the homeowner directly.</p>`,
  },
  schedule_notification: {
    subject: "{{brandName}}: Service scheduled{{subjectSuffix}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Service Scheduled</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{contractorName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">{{senderName}} has scheduled a service for <strong>{{systemName}}</strong> at <strong>{{propertyAddress}}</strong>.</p>
{{detailsSection}}
{{messageSection}}
<p style="color: #6b7280; font-size: 14px;">Please confirm this appointment or reach out to the homeowner to discuss the details.</p>`,
  },
  professional_contact: {
    subject: "{{brandName}}: Message about {{professionalCompanyName}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">New message via {{brandName}}</h2>
<p style="margin: 12px 0; line-height: 1.6;">You have a new inquiry from someone viewing your listing <strong>{{professionalCompanyName}}</strong> on {{brandName}}.</p>
<p style="margin: 16px 0 8px; font-size: 14px; color: #374151;"><strong>From:</strong> {{senderLine}}</p>
<div style="margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #456564; font-size: 15px; color: #111827; line-height: 1.5;">{{messageHtml}}</div>
<p style="color: #6b7280; font-size: 14px;">You can reply directly to this email to reach the sender.</p>`,
  },
  communication_notify: {
    subject: "{{subjectLine}} — {{brandName}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">{{subjectLine}}</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{userName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">You have a new message in {{brandName}}. Open it in the app using the link below.</p>
<p style="margin: 24px 0;"><a href="{{viewUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View in {{brandName}}</a></p>
<p style="color: #6b7280; font-size: 14px;">This link opens the message in your browser. Sign in if prompted.</p>`,
  },
  support_ticket_received: {
    subject: "[{{brandName}} Support] Request received{{subjectSuffix}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 8px;">We received your support request</h2>
{{bodyHtml}}
<p style="margin: 24px 0;"><a href="{{viewUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View ticket</a></p>
<p style="color: #6b7280; font-size: 13px; margin-top: 20px;">Replies to this email are not monitored — please use the ticket link above to continue the conversation.</p>`,
  },
  support_ticket_reply: {
    subject: "[{{brandName}} Support] New reply{{subjectSuffix}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 8px;">A team member replied to your ticket</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{userName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">The {{brandName}} Support team just posted an update on your request.</p>
{{replyBlock}}
{{metaHtml}}
<p style="margin: 12px 0; line-height: 1.6;">Open the ticket below to view the full conversation or reply.</p>
<p style="margin: 24px 0;"><a href="{{viewUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View and reply</a></p>
<p style="color: #6b7280; font-size: 13px; margin-top: 20px;">Replies to this email are not monitored — please use the ticket link above so the entire thread stays with your request.</p>`,
  },
};

function getDefaultSesTemplate(emailType) {
  const t = DEFAULTS[emailType];
  if (!t) return null;
  return {
    subject: t.subject.replace(/\{\{brandName\}\}/g, EMAIL_BRAND_NAME),
    htmlBody: t.htmlBody.replace(/\{\{brandName\}\}/g, EMAIL_BRAND_NAME),
  };
}

/**
 * Detect templates saved in the legacy format that wrapped body + footer in
 * one big chunk with opaque merge tags like {{headline}} / {{mainContentHtml}}.
 * Used by the one-time migration to overwrite them with the new body-only
 * defaults.
 */
const LEGACY_MARKERS = {
  account_invitation: ["{{headline}}", "{{intro}}", "{{bodyExtra}}", "{{footerNote}}"],
  property_invitation: ["{{mainContentHtml}}", "{{footerNote}}"],
  bulk_property_invitation: ["{{headline}}", "{{listHtml}}"],
  contractor_report: ["{{greeting}}", "{{requestLine}}"],
  schedule_notification: ["{{greeting}}", "{{scheduleLine}}"],
  communication_notify: ["{{greeting}}", "{{title}}"],
  support_ticket_received: ["{{heading}}"],
  support_ticket_reply: ["{{intro}}"],
};

function isLegacySesTemplate(emailType, html) {
  if (!html || !String(html).trim()) return false;
  const markers = LEGACY_MARKERS[emailType];
  if (!markers) return false;
  return markers.some((m) => String(html).includes(m));
}

/** Sample merge data for admin preview / test sends. */
function getSampleMergeData(emailType) {
  const base = {
    brandName: EMAIL_BRAND_NAME,
  };
  const samples = {
    account_invitation: {
      ...base,
      inviteUrl: "https://app.heyopsy.com/invite/sample",
      inviterName: "Jane Smith",
      inviteeName: "Alex",
    },
    property_invitation: {
      ...base,
      inviteUrl: "https://app.heyopsy.com/invite/sample",
      inviterName: "Jane Smith",
      inviteeName: "Alex",
      propertyAddress: "123 Main St",
      propertyAddressSuffix: ": 123 Main St",
      ctaLabel: "Accept invitation",
      personalNoteBlock: "",
      inviteInstructions:
        "Use the button below to join Opsy and set your password to accept this invitation.",
    },
    bulk_property_invitation: {
      ...base,
      subject: "You've been invited to join 2 properties",
      inviterName: "Jane Smith",
      inviteeName: "Alex",
      itemCount: 2,
      bulkInviteInstructions:
        "Use the links below to join Opsy and set your password to accept each invitation.",
      linkIntro: '<p style="margin-top: 16px;">Accept each invitation:</p>',
      listHtml:
        '<ul style="padding-left: 20px; margin: 16px 0; line-height: 1.6;"><li style="margin: 10px 0;"><a href="#" style="color: #456564; font-weight: 600;">Accept: 123 Main St</a></li></ul>',
      items: [{ propertyAddress: "123 Main St", inviteUrl: "https://example.com" }],
    },
    contractor_report: {
      ...base,
      reportUrl: "https://app.heyopsy.com/report/sample",
      contractorName: "Bob",
      propertyAddress: "123 Main St",
      propertySuffix: " – 123 Main St",
      propertyAtPhrase: " for the property at <strong>123 Main St</strong>",
      systemPhrase: "",
      senderName: "Jane Smith",
      detailsSection: "",
    },
    schedule_notification: {
      ...base,
      contractorName: "Bob",
      propertyAddress: "123 Main St",
      systemName: "HVAC",
      senderName: "Jane Smith",
      subjectSuffix: " — HVAC at 123 Main St",
      detailsSection: "",
      messageSection: "",
    },
    professional_contact: {
      ...base,
      professionalCompanyName: "Acme Plumbing",
      messageHtml: "Hello, I need a quote for a water heater.",
      senderLine: "Jane Smith &lt;jane@example.com&gt;",
    },
    communication_notify: {
      ...base,
      userName: "Alex",
      subjectLine: "Spring maintenance tips",
      viewUrl: "https://app.heyopsy.com/communications/sample",
    },
    support_ticket_received: {
      ...base,
      subjectSuffix: ": Login issue",
      bodyHtml: "<p>Thanks for reaching out. We will respond shortly.</p>",
      viewUrl: "https://app.heyopsy.com/support/sample",
    },
    support_ticket_reply: {
      ...base,
      userName: "Alex",
      subjectSuffix: ": Login issue",
      replyBlock:
        '<div style="padding:14px;background:#f9fafb;">We reset your session. Please try again.</div>',
      metaHtml: "",
      viewUrl: "https://app.heyopsy.com/support/sample",
    },
  };
  return samples[emailType] || base;
}

module.exports = {
  getDefaultSesTemplate,
  getSampleMergeData,
  isLegacySesTemplate,
};
