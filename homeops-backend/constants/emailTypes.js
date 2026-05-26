"use strict";

/**
 * Switchable outbound email types (SES or Customer.io).
 * Auth and ops emails are not listed here — they always use SES.
 */
const SWITCHABLE_EMAIL_TYPES = {
  account_invitation: {
    label: "Account invitation",
    description: "Sent when a user is invited to join an account on Opsy.",
    customerIoDefaultEvent: "account_invitation_sent",
    mergeVariables: [
      { key: "inviteUrl", description: "Accept invitation link" },
      { key: "inviterName", description: "Name of the person who sent the invite" },
      { key: "inviteeName", description: "Invitee first name (optional; used in “Hi {{inviteeName}},”)" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
  property_invitation: {
    label: "Property invitation",
    description: "Sent when a user is invited to join a property.",
    customerIoDefaultEvent: "property_invitation_sent",
    mergeVariables: [
      { key: "inviteUrl", description: "Accept invitation link" },
      { key: "inviterName", description: "Name of the person who sent the invite" },
      { key: "inviteeName", description: "Invitee first name (optional; used in “Hi {{inviteeName}},”)" },
      { key: "propertyAddressSuffix", description: "Property suffix for subject line, e.g. “: 123 Main St”" },
      { key: "inviteeHasAccount", description: "Whether invitee already has an Opsy account" },
      { key: "personalNoteBlock", description: "HTML block for optional personal message" },
      { key: "inviteInstructions", description: "Instructions paragraph before the accept button" },
      { key: "ctaLabel", description: "Button label text" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
  bulk_property_invitation: {
    label: "Bulk property invitation",
    description: "Single email listing multiple property invitations.",
    customerIoDefaultEvent: "bulk_property_invitation_sent",
    mergeVariables: [
      { key: "inviterName", description: "Name of the person who sent the invite" },
      { key: "inviteeName", description: "Invitee first name (optional; used in “Hi {{inviteeName}},”)" },
      { key: "inviteeHasAccount", description: "Whether invitee already has an Opsy account" },
      { key: "items", description: "Array of { propertyAddress, inviteUrl } objects" },
      { key: "itemCount", description: "Number of properties invited" },
      { key: "bulkInviteInstructions", description: "Instructions paragraph before property links" },
      { key: "listHtml", description: "HTML list of invitation links" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
  contractor_report: {
    label: "Contractor maintenance report",
    description: "Request sent to a contractor to fill out a maintenance report.",
    customerIoDefaultEvent: "contractor_report_requested",
    mergeVariables: [
      { key: "reportUrl", description: "Link to the report form" },
      { key: "contractorName", description: "Contractor name" },
      { key: "propertyAddress", description: "Property address" },
      { key: "systemName", description: "System name" },
      { key: "senderName", description: "Homeowner who requested the report (defaults to “A homeowner”)" },
      { key: "propertyAtPhrase", description: "Optional phrase: “ for the property at …”" },
      { key: "systemPhrase", description: "Optional phrase: “ regarding …”" },
      { key: "origin", description: "Origin URL" },
      { key: "inspectionDate", description: "Date of inspection" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
  schedule_notification: {
    label: "Schedule notification",
    description: "Notifies a contractor that a service has been scheduled.",
    customerIoDefaultEvent: "service_scheduled",
    mergeVariables: [
      { key: "contractorName", description: "Contractor name" },
      { key: "propertyAddress", description: "Property address" },
      { key: "systemName", description: "System name" },
      { key: "scheduledDate", description: "Scheduled date (YYYY-MM-DD)" },
      { key: "scheduledTime", description: "Scheduled time (HH:MM)" },
      { key: "formattedDate", description: "Human-readable date" },
      { key: "formattedTime", description: "Human-readable time" },
      { key: "messageBody", description: "Message from homeowner" },
      { key: "senderName", description: "Homeowner name" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
  professional_contact: {
    label: "Professional directory contact",
    description: "Message from a homeowner to a professional via the directory.",
    customerIoDefaultEvent: "professional_contact_sent",
    mergeVariables: [
      { key: "professionalCompanyName", description: "Professional company name" },
      { key: "message", description: "Message body" },
      { key: "senderName", description: "Sender name" },
      { key: "senderEmail", description: "Sender email (Reply-To)" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
  communication_notify: {
    label: "Communication notification",
    description: "Notifies a user that a new in-app communication is available.",
    customerIoDefaultEvent: "communication_notify_sent",
    mergeVariables: [
      { key: "userName", description: "Recipient name" },
      { key: "subjectLine", description: "Communication subject" },
      { key: "viewUrl", description: "Link to view in app" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
  support_ticket_received: {
    label: "Support ticket received",
    description: "Confirmation sent when a user submits a support or feedback ticket.",
    customerIoDefaultEvent: "support_ticket_received",
    mergeVariables: [
      { key: "ticketSubject", description: "Ticket subject" },
      { key: "ticketType", description: "support or feedback" },
      { key: "autoResponseText", description: "Automated acknowledgment text" },
      { key: "viewUrl", description: "Link to view ticket" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
  support_ticket_reply: {
    label: "Support ticket reply",
    description: "Notification when a team member replies to a support ticket.",
    customerIoDefaultEvent: "support_ticket_reply",
    mergeVariables: [
      { key: "userName", description: "Ticket creator name" },
      { key: "ticketSubject", description: "Ticket subject" },
      { key: "ticketStatus", description: "Current ticket status" },
      { key: "replyBody", description: "Reply message body" },
      { key: "viewUrl", description: "Link to view ticket" },
      { key: "brandName", description: "Product brand name" },
    ],
  },
};

const EMAIL_TYPE_KEYS = Object.keys(SWITCHABLE_EMAIL_TYPES);

module.exports = {
  SWITCHABLE_EMAIL_TYPES,
  EMAIL_TYPE_KEYS,
};
