"use strict";

const { EMAIL_BRAND_NAME } = require("../config");
const { getHomeaversaryHtml } = require("./homeaversaryEmailHtml");
const { toMergeFields } = require("../services/homeaversaryYearInReview");

const SAMPLE_YEAR_IN_REVIEW = toMergeFields(
  {
    tasksCompletedCount: 4,
    documentsUploadedCount: 3,
    systemsServicedCount: 3,
    tasks: [
      { title: "HVAC spring tune-up" },
      { title: "Gutter cleaning" },
      { title: "Roof inspection" },
      { title: "Water heater flush" },
    ],
  },
  { audience: "homeowner", yearsOwned: 7, streetLabel: "205 E 95th St" }
);

/**
 * Default SES email templates.
 *
 * Each `htmlBody` is the BODY ONLY — no wrapping container, no footer.
 * The container `<div>` and (optional) footer are added at render time by
 * services/emailComposer.js. This lets the admin edit only the meaningful
 * content and toggle the Opsy footer on/off independently.
 */

const DEFAULTS = {
  welcome: {
    subject: "Welcome to {{brandName}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Welcome to {{brandName}}</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{recipientFirstName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">Welcome. {{brandName}} is a calm, organized home for your home — it keeps track of what the house needs and tells you when something matters, before it becomes a weekend you didn't plan for.</p>
<p style="margin: 12px 0; line-height: 1.6;">The first step is the only one that needs you: add your home, and we'll start filling in the rest.</p>
<p style="margin: 24px 0;"><a href="{{ctaUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Add your home</a></p>
<p style="color: #6b7280; font-size: 14px;">Takes about a minute &middot; Nothing to download</p>`,
  },
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
  contractor_bid_inquiry: {
    subject: "Questions about your proposal — {{actionItemTitle}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">A few questions about your proposal</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{contractorName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">{{senderName}} has a few questions about <strong>{{actionItemTitle}}</strong>.</p>
<div style="margin: 16px 0; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #456564; font-size: 15px; color: #111827; line-height: 1.5;">{{messageHtml}}</div>
<p style="color: #6b7280; font-size: 14px;">You can reply directly to this email.</p>`,
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
  sponsorship_active: {
    subject: "{{agentName}} now covers {{propertyLabel}} — {{brandName}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Your agent now covers this property</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{userName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">{{agentName}}'s plan now covers <strong>{{propertyLabel}}</strong>. You won't be charged for this property. You can subscribe again anytime to take back control.</p>
<p style="margin: 24px 0;"><a href="{{billingUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open billing</a></p>`,
  },
  sponsorship_grace_started: {
    subject: "Action needed: coverage for {{propertyLabel}} is ending — {{brandName}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Action needed: agent coverage is ending</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{userName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">{{agentName}} is no longer covering <strong>{{propertyLabel}}</strong>.</p>
<p style="margin: 12px 0; line-height: 1.6;">You have a 30-day grace period (until <strong>{{graceEndsOn}}</strong>) to resume your own plan. If you don't, this property will move to the free plan with reduced limits and AI turned off.</p>
<p style="margin: 24px 0;"><a href="{{billingUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Resume my plan</a></p>`,
  },
  sponsorship_grace_reminder: {
    subject: "Reminder: coverage for {{propertyLabel}} ends {{graceEndsOn}} — {{brandName}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Reminder: agent coverage is ending soon</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{userName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">Agent coverage for <strong>{{propertyLabel}}</strong> ends on <strong>{{graceEndsOn}}</strong>.</p>
<p style="margin: 12px 0; line-height: 1.6;">Subscribe before then to keep your premium features for this property.</p>
<p style="margin: 24px 0;"><a href="{{billingUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Resume my plan</a></p>`,
  },
  sponsorship_ended: {
    subject: "Agent coverage for {{propertyLabel}} has ended — {{brandName}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Agent coverage has ended</h2>
<p style="margin: 12px 0; line-height: 1.6;">Hi {{userName}},</p>
<p style="margin: 12px 0; line-height: 1.6;">Agent coverage for <strong>{{propertyLabel}}</strong> has ended and it has moved to the free plan.</p>
<p style="margin: 12px 0; line-height: 1.6;">Subscribe anytime to restore premium features for this property.</p>
<p style="margin: 24px 0;"><a href="{{billingUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Subscribe</a></p>`,
  },
  helpdesk_inspection_review_created: {
    subject: "Inspection review needed: {{propertyAddress}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">New inspection report review</h2>
<p style="margin: 12px 0; line-height: 1.6;">A new AI inspection analysis is ready for review on the Helpdesk.</p>
{{detailsHtml}}
<p style="margin: 24px 0;"><a href="{{reviewUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Open review</a></p>`,
  },
  helpdesk_ticket_created_ops: {
    subject: "{{ticketTypeLabel}} ticket #{{ticketId}}: {{ticketSubject}}",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">New {{ticketTypeLabel}} ticket</h2>
<p style="margin: 12px 0; line-height: 1.6;">A new helpdesk ticket was submitted.</p>
{{detailsHtml}}
{{descriptionHtml}}
<p style="margin: 24px 0;"><a href="{{ticketUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View ticket</a></p>`,
  },
  demo_account_opened: {
    subject: "Demo opened: {{userName}} ({{userRole}})",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Demo account opened</h2>
<p style="margin: 12px 0; line-height: 1.6;">A prospect just logged into a ready-to-use demo account for the first time.</p>
{{detailsHtml}}
<p style="margin: 24px 0;"><a href="{{adminUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View user</a></p>`,
  },
  demo_account_expired: {
    subject: "Demo expired: {{userName}} ({{userRole}})",
    htmlBody: `<h2 style="color: #456564; margin: 0 0 12px;">Demo account expired</h2>
<p style="margin: 12px 0; line-height: 1.6;">A ready-to-use demo account has reached its expiry time.</p>
{{detailsHtml}}
<p style="margin: 24px 0;"><a href="{{adminUrl}}" style="background-color: #456564; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View user</a></p>`,
  },
  homeaversary_homeowner: {
    subject: "Happy Homeaversary — one more year at {{propertyAddress}}",
    htmlBody: getHomeaversaryHtml("homeowner"),
  },
  homeaversary_agent: {
    subject: "Homeaversary in 7 days: {{propertyAddress}}",
    htmlBody: getHomeaversaryHtml("agent"),
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
  homeaversary_homeowner: ["Happy Homeaversary</h2>", "keep it in good shape"],
  homeaversary_agent: ["Homeaversary coming up", "short note or small gift"],
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
    welcome: {
      ...base,
      recipientFirstName: "Alex",
      ctaUrl: "https://app.heyopsy.com/home/properties/new",
    },
    account_invitation: {
      ...base,
      inviteUrl: "https://app.heyopsy.com/invite/sample",
      inviterName: "Jane Smith",
      senderFirstName: "Jane",
      avatarUrl: "https://app.heyopsy.com/opsy_favicon.png",
      inviteeName: "Alex",
      recipientFirstName: "Alex",
      userRole: "agent",
    },
    property_invitation: {
      ...base,
      inviteUrl: "https://app.heyopsy.com/invite/sample",
      inviterName: "Kino Belden",
      inviteeName: "Maria",
      recipientFirstName: "Maria",
      propertyAddress: "123 Elm Street",
      propertyAddressSuffix: ": 123 Elm Street",
      invitedByAgent: true,
      agentFirstName: "Kino",
      agentFullName: "Kino Belden",
      agentRole: "real estate advisor",
      agentPhotoUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=144&h=144&fit=crop",
      agentAvatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=144&h=144&fit=crop",
      agentInitials: "KB",
      hasAgentPhoto: true,
      emailIconPlace: "",
      emailIconAlert: "",
      emailIconHome: "",
      propertyStreet: "123 Elm Street",
      missingDataCount: 3,
      missingDataSummary: "Documents, Roof, Maintenance history",
      missingDataHtml:
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top" style="padding-bottom:14px; font-size:13px; line-height:19px; color:#3a4a42;"><strong style="color:#2f4a3d;">Documents</strong><br>Inspection reports, warranties, and closing paperwork are not attached yet.</td></tr></table>',
      missingDataItem1Title: "Documents",
      missingDataItem1Body:
        "Inspection reports, warranties, and closing paperwork are not attached yet.",
      missingDataItem2Title: "Roof",
      missingDataItem2Body: "3 of 8 key roof details are filled in so far.",
      missingDataItem3Title: "Maintenance history",
      missingDataItem3Body: "Past service visits and tune-ups have not been recorded yet.",
      teamName: "Kino's Team",
      brokerageName: "Ohana Brokers",
      brokerageLogoUrl: "",
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
    contractor_bid_inquiry: {
      ...base,
      contractorName: "John",
      actionItemTitle: "Replace living room flooring",
      messageHtml: "Thanks for the proposal. Does the price include furniture moving?",
      senderName: "Jane Smith",
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
    sponsorship_active: {
      ...base,
      userName: "Alex",
      propertyLabel: "205 E 95th St, New York, NY",
      agentName: "Jane Smith",
      billingUrl: "https://app.heyopsy.com/home/settings/billing",
    },
    sponsorship_grace_started: {
      ...base,
      userName: "Alex",
      propertyLabel: "205 E 95th St, New York, NY",
      agentName: "Jane Smith",
      graceEndsOn: "July 17, 2026",
      billingUrl: "https://app.heyopsy.com/home/settings/billing",
    },
    sponsorship_grace_reminder: {
      ...base,
      userName: "Alex",
      propertyLabel: "205 E 95th St, New York, NY",
      graceEndsOn: "July 17, 2026",
      billingUrl: "https://app.heyopsy.com/home/settings/billing",
    },
    sponsorship_ended: {
      ...base,
      userName: "Alex",
      propertyLabel: "205 E 95th St, New York, NY",
      billingUrl: "https://app.heyopsy.com/home/settings/billing",
    },
    helpdesk_inspection_review_created: {
      ...base,
      propertyAddress: "205 E 95th St, New York, NY",
      customerName: "Maria Garcia",
      customerEmail: "maria@example.com",
      reviewId: "42",
      jobId: "108",
      uploadedAt: "Jun 19, 2026, 3:45 PM",
      reviewUrl: "https://app.heyopsy.com/home/helpdesk/inspection-reviews/42",
      detailsHtml:
        '<table style="border-collapse: collapse; margin: 12px 0;"><tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Property</td><td>205 E 95th St, New York, NY</td></tr></table>',
    },
    helpdesk_ticket_created_ops: {
      ...base,
      ticketId: "101",
      ticketType: "support",
      ticketTypeLabel: "Support",
      ticketSubject: "Cannot upload inspection report",
      ticketUrl: "https://app.heyopsy.com/home/helpdesk/support/101",
      accountName: "Home account",
      accountId: "12",
      createdByName: "Alex Johnson",
      createdByEmail: "alex@example.com",
      descriptionHtml:
        '<div style="margin: 12px 0; padding: 12px 16px; background: #f9fafb; border-radius: 8px;">The upload fails after 30 seconds.</div>',
      detailsHtml:
        '<table style="border-collapse: collapse; margin: 12px 0;"><tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Subject</td><td>Cannot upload inspection report</td></tr></table>',
    },
    demo_account_opened: {
      ...base,
      userName: "Jordan Lee",
      userEmail: "jordan.lee@example.com",
      userRole: "agent",
      userId: "501",
      demoExpiresAt: "Jul 12, 2026, 4:00 PM UTC",
      demoFirstLoginAt: "Jul 9, 2026, 4:45 PM UTC",
      provisionedByName: "Sales Admin",
      adminUrl: "https://demo.heyopsy.com/home/users/501",
      detailsHtml:
        '<table style="border-collapse: collapse; margin: 12px 0;"><tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Name</td><td>Jordan Lee</td></tr></table>',
    },
    demo_account_expired: {
      ...base,
      userName: "Jordan Lee",
      userEmail: "jordan.lee@example.com",
      userRole: "agent",
      userId: "501",
      demoExpiresAt: "Jul 12, 2026, 4:00 PM UTC",
      demoFirstLoginAt: "Jul 9, 2026, 4:45 PM UTC",
      wasOpened: "Yes",
      provisionedByName: "Sales Admin",
      adminUrl: "https://demo.heyopsy.com/home/users/501",
      detailsHtml:
        '<table style="border-collapse: collapse; margin: 12px 0;"><tr><td style="padding: 4px 12px 4px 0; color: #6b7280;">Name</td><td>Jordan Lee</td></tr></table>',
    },
    homeaversary_homeowner: {
      ...base,
      audience: "homeowner",
      recipientFirstName: "Alex",
      propertyAddress: "205 E 95th St, New York, NY",
      propertyUrl: "https://app.heyopsy.com/home/properties/sample",
      yearsOwned: "7",
      yearsOwnedPlural: "s",
      anniversaryDate: "March 1, 2026",
      lastSaleDate: "2019-03-01",
      ownerName: "",
      ...SAMPLE_YEAR_IN_REVIEW,
    },
    homeaversary_agent: {
      ...base,
      audience: "agent",
      recipientFirstName: "Jordan",
      propertyAddress: "205 E 95th St, New York, NY",
      propertyUrl: "https://app.heyopsy.com/home/properties/sample",
      yearsOwned: "7",
      yearsOwnedPlural: "s",
      anniversaryDate: "March 1, 2026",
      lastSaleDate: "2019-03-01",
      ownerName: "Alex Rivera",
      ...toMergeFields(
        {
          tasksCompletedCount: 4,
          documentsUploadedCount: 3,
          systemsServicedCount: 3,
          tasks: [
            { title: "HVAC spring tune-up" },
            { title: "Gutter cleaning" },
            { title: "Roof inspection" },
            { title: "Water heater flush" },
          ],
        },
        { audience: "agent", yearsOwned: 7, streetLabel: "205 E 95th St" }
      ),
    },
  };
  return samples[emailType] || base;
}

module.exports = {
  getDefaultSesTemplate,
  getSampleMergeData,
  isLegacySesTemplate,
};
