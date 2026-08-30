"use strict";

/**
 * Graphic Homeaversary email bodies (table layout).
 * SES uses {{mergeTag}}; Customer.io uses {{ event.mergeTag }}.
 */

const HOUSE_IMAGE_URL =
  process.env.HOMEAVERSARY_HOUSE_IMAGE_URL ||
  "https://app.heyopsy.com/email/homeaversary/house.jpg";
const KEYS_IMAGE_URL =
  process.env.HOMEAVERSARY_KEYS_IMAGE_URL ||
  "https://app.heyopsy.com/email/homeaversary/keys.jpg";

function tag(key, { liquid, filters } = {}) {
  if (!liquid) return `{{${key}}}`;
  if (filters) return `{{ event.${key} ${filters} }}`;
  return `{{ event.${key} }}`;
}

function sharedStyles() {
  return `<style>
    .opsy-ha-wrap { width:100% !important; }
    @media only screen and (max-width: 620px) {
      .opsy-ha-pad { padding-left:20px !important; padding-right:20px !important; }
      .opsy-ha-h1 { font-size:28px !important; line-height:1.25 !important; }
      .opsy-ha-hero { width:100% !important; max-width:280px !important; }
    }
  </style>`;
}

function footerBlock() {
  return `
          <tr>
            <td align="center" class="opsy-ha-pad" style="padding:22px 36px 8px;">
              <p style="margin:0; color:#1f3d36; font-size:18px; font-style:italic; font-weight:700; font-family:Georgia,'Times New Roman',Times,serif;">
                Let's move home forward.
              </p>
              <p style="margin:10px 0 0; color:#b8863b; font-size:11px; letter-spacing:2.5px; text-transform:uppercase; font-family:Georgia,'Times New Roman',Times,serif;">
                Opsy by HomeOps
              </p>
            </td>
          </tr>`;
}

function yearInReviewBox(opts, heading) {
  const html = tag("yearInReviewHtml", opts);
  return `
          <tr>
            <td class="opsy-ha-pad" style="padding:8px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background-color:#f5f0e8; border-radius:12px;">
                <tr>
                  <td style="padding:22px 24px;">
                    <p style="margin:0 0 14px; color:#b8863b; font-size:11px; letter-spacing:2px; text-transform:uppercase; font-family:Georgia,'Times New Roman',Times,serif;">
                      ${heading}
                    </p>
                    ${html}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function ctaBlock(opts, label) {
  const href = tag("propertyUrl", opts);
  return `
          <tr>
            <td class="opsy-ha-pad" style="padding:24px 36px 0;">
              <a href="${href}" target="_blank"
                 style="display:block; background-color:#1f3d36; color:#ffffff; text-align:center;
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                        font-size:16px; font-weight:700; text-decoration:none; padding:16px 18px; border-radius:8px;">
                ${label}
              </a>
            </td>
          </tr>`;
}

function getHomeaversaryHomeownerHtml(opts = {}) {
  const firstName = opts.liquid
    ? `{{ event.recipientFirstName | default: customer.first_name | default: "there" }}`
    : "{{recipientFirstName}}";
  const address = tag("propertyAddress", opts);
  const years = tag("yearsOwned", opts);
  const plural = tag("yearsOwnedPlural", opts);
  const brand = opts.liquid
    ? `{{ event.brandName | default: "Opsy" }}`
    : "{{brandName}}";
  const milestones = tag("milestoneHtml", opts);

  return `${sharedStyles()}
<table role="presentation" class="opsy-ha-wrap" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea;">
  <tr>
    <td align="center" style="padding:24px 10px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:600px; max-width:600px; background-color:#ffffff; border-radius:16px;">
          <tr>
            <td class="opsy-ha-pad" style="padding:28px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" style="padding-right:12px;">
                    <p style="margin:0 0 8px; color:#b8863b; font-size:11px; letter-spacing:2.4px; text-transform:uppercase; font-family:Georgia,'Times New Roman',Times,serif;">
                      A milestone worth celebrating
                    </p>
                    <h1 class="opsy-ha-h1" style="margin:0 0 12px; color:#1f3d36; font-size:34px; line-height:1.2; font-weight:700; font-family:Georgia,'Times New Roman',Times,serif;">
                      Happy Homeaversary
                    </h1>
                    <p style="margin:0; color:#3a3a3a; font-size:15px; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      Hi ${firstName}, congratulations on one more year with <strong>${address}</strong> — that's ${years} year${plural} in your home.
                    </p>
                  </td>
                  <td valign="middle" width="180" align="right">
                    <img class="opsy-ha-hero" src="${HOUSE_IMAGE_URL}" alt="A home worth celebrating" width="170"
                         style="display:block; border:0; outline:none; width:170px; max-width:100%; height:auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="opsy-ha-pad" style="padding:28px 28px 0;">
              ${milestones}
            </td>
          </tr>
          ${yearInReviewBox(opts, "This year at your home")}
          ${ctaBlock(opts, `Open your home in ${brand}`)}
          ${footerBlock()}
          <tr><td style="height:28px; font-size:0; line-height:0;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>
</table>`;
}

function agentInfoRow(iconLabel, title, value, last) {
  const pad = last ? "0" : "14px";
  return `
                    <tr>
                      <td valign="top" width="36" style="padding-bottom:${pad};">
                        <div style="width:28px; height:28px; border-radius:14px; background:#ece7d8; color:#1f3d36; text-align:center; line-height:28px; font-size:11px; font-weight:700; font-family:Georgia,'Times New Roman',Times,serif;">${iconLabel}</div>
                      </td>
                      <td valign="top" style="padding-bottom:${pad};">
                        <p style="margin:0; color:#9a9a90; font-size:11px; letter-spacing:0.4px; text-transform:uppercase; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${title}</p>
                        <p style="margin:3px 0 0; color:#1f3d36; font-size:15px; font-weight:600; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${value}</p>
                      </td>
                    </tr>`;
}

function getHomeaversaryAgentHtml(opts = {}) {
  const firstName = opts.liquid
    ? `{{ event.recipientFirstName | default: customer.first_name | default: "there" }}`
    : "{{recipientFirstName}}";
  const owner = tag("ownerName", opts);
  const address = tag("propertyAddress", opts);
  const when = tag("anniversaryDate", opts);
  const years = tag("yearsOwned", opts);
  const plural = tag("yearsOwnedPlural", opts);

  return `${sharedStyles()}
<table role="presentation" class="opsy-ha-wrap" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea;">
  <tr>
    <td align="center" style="padding:24px 10px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
             style="width:600px; max-width:600px; background-color:#ffffff; border-radius:16px;">
          <tr>
            <td style="background-color:#1f3d36; padding:22px 36px; border-radius:16px 16px 0 0;">
              <p style="margin:0 0 6px; color:#d4b06a; font-size:11px; letter-spacing:2.4px; text-transform:uppercase; font-family:Georgia,'Times New Roman',Times,serif;">
                Upcoming milestone
              </p>
              <h1 class="opsy-ha-h1" style="margin:0; color:#ffffff; font-size:28px; line-height:1.25; font-weight:700; font-family:Georgia,'Times New Roman',Times,serif;">
                Homeaversary in 7 days
              </h1>
            </td>
          </tr>
          <tr>
            <td class="opsy-ha-pad" style="padding:24px 36px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="top" style="padding-right:16px;">
                    <p style="margin:0 0 16px; color:#3a3a3a; font-size:15px; line-height:1.6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      Hi ${firstName}, <strong>${owner}</strong> is coming up on ${years} year${plural} at this home.
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${agentInfoRow("HO", "Homeowner", owner, false)}
                      ${agentInfoRow("AD", "Property", address, false)}
                      ${agentInfoRow("DT", "Anniversary", when, true)}
                    </table>
                  </td>
                  <td valign="middle" width="160" align="right">
                    <img class="opsy-ha-hero" src="${KEYS_IMAGE_URL}" alt="Homeaversary" width="150"
                         style="display:block; border:0; outline:none; width:150px; max-width:100%; height:auto;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="opsy-ha-pad" style="padding:20px 36px 0;">
              <p style="margin:0; color:#6b6560; font-size:13px; line-height:1.55; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                A purchase anniversary is a natural moment to check in.
              </p>
            </td>
          </tr>
          ${yearInReviewBox(opts, "This year at their home")}
          ${ctaBlock(opts, "View homeowner in Opsy")}
          ${footerBlock()}
          <tr><td style="height:28px; font-size:0; line-height:0;">&nbsp;</td></tr>
      </table>
    </td>
  </tr>
</table>`;
}

function getHomeaversaryHtml(audience, opts = {}) {
  return audience === "agent"
    ? getHomeaversaryAgentHtml(opts)
    : getHomeaversaryHomeownerHtml(opts);
}

module.exports = {
  HOUSE_IMAGE_URL,
  KEYS_IMAGE_URL,
  getHomeaversaryHtml,
  getHomeaversaryHomeownerHtml,
  getHomeaversaryAgentHtml,
};
