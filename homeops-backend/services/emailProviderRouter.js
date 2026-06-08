"use strict";

/**
 * Routes outbound emails to SES or Customer.io based on platform config.
 */

const PlatformEmailSettings = require("../models/platformEmailSettings");
const EmailTemplateConfig = require("../models/emailTemplateConfig");
const { renderTemplate, enrichMergeData, stripUnusedMergeTags } = require("./emailTemplateRenderer");
const sesProvider = require("./emailProviders/sesProvider");
const customerIoProvider = require("./emailProviders/customerIoProvider");
const { wrapEmailHtml } = require("./emailComposer");
const { EMAIL_BRAND_NAME } = require("../config");
const { attachTemplateIconMergeData } = require("./emailTemplateIcons");

const settingsCache = { at: 0, settings: null };
const templateCache = new Map();
const CACHE_TTL_MS = 30_000;

function shouldFallbackToSes() {
  const raw = process.env.EMAIL_FALLBACK_TO_SES;
  if (raw === "false" || raw === "0") return false;
  return true;
}

async function getSettings() {
  const now = Date.now();
  if (settingsCache.settings && now - settingsCache.at < CACHE_TTL_MS) {
    return settingsCache.settings;
  }
  const settings = await PlatformEmailSettings.get();
  settingsCache.at = now;
  settingsCache.settings = settings;
  return settings;
}

async function getTemplateConfig(emailType) {
  const now = Date.now();
  const cached = templateCache.get(emailType);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.config;
  }
  const config = await EmailTemplateConfig.getByType(emailType);
  templateCache.set(emailType, { at: now, config });
  return config;
}

function invalidateCache() {
  settingsCache.at = 0;
  settingsCache.settings = null;
  templateCache.clear();
}

async function resolveProvider(emailType) {
  const [settings, config] = await Promise.all([
    getSettings(),
    getTemplateConfig(emailType),
  ]);
  const provider =
    config.provider === "inherit"
      ? settings.defaultProvider
      : config.provider;
  return { provider, config, settings };
}

/**
 * @param {Object} opts
 * @param {string} opts.emailType
 * @param {string} opts.to
 * @param {string} opts.subject - default subject (used when no custom SES template)
 * @param {string} opts.html - default html (used when no custom SES template)
 * @param {Object} opts.mergeData - variables for templates / Customer.io
 * @param {string} [opts.replyTo]
 * @param {string[]} [opts.cc]
 * @param {Object} [opts.usage]
 */
async function deliver({
  emailType,
  to,
  subject,
  html,
  mergeData = {},
  replyTo,
  cc,
  usage,
}) {
  const { provider, config } = await resolveProvider(emailType);
  const mergedData = attachTemplateIconMergeData(
    emailType,
    mergeData,
    config.customerIoIcons
  );
  const usageWithProvider = {
    ...usage,
    emailType: usage?.emailType || emailType,
    provider,
  };

  if (provider === "customer_io") {
    try {
      return await customerIoProvider.deliverViaCustomerIo({
        to,
        config,
        messageData: mergedData,
        replyTo,
        cc,
        usage: usageWithProvider,
      });
    } catch (err) {
      console.error(
        `[emailProviderRouter] Customer.io failed for ${emailType}:`,
        err.message
      );
      if (shouldFallbackToSes() && sesProvider.isSesConfigured()) {
        console.warn(`[emailProviderRouter] Falling back to SES for ${emailType}`);
        return deliverViaSes({
          to,
          config,
          subject,
          html,
          mergeData: mergedData,
          replyTo,
          cc,
          usage: { ...usageWithProvider, provider: "ses" },
        });
      }
      throw err;
    }
  }

  return deliverViaSes({
    to,
    config,
    subject,
    html,
    mergeData: mergedData,
    replyTo,
    cc,
    usage: usageWithProvider,
  });
}

async function deliverViaSes({
  to,
  config,
  subject,
  html,
  mergeData,
  replyTo,
  cc,
  usage,
}) {
  if (!sesProvider.isSesConfigured()) {
    throw new Error(
      "SES not configured. Set SES_FROM_EMAIL and AWS credentials (or IAM role)."
    );
  }

  const mergedData = enrichMergeData(mergeData);
  let finalSubject = subject;
  let bodyHtml = html;

  if (config.sesSubject) {
    finalSubject = renderTemplate(config.sesSubject, mergedData);
  }
  if (config.sesHtmlBody) {
    bodyHtml = stripUnusedMergeTags(
      renderTemplate(config.sesHtmlBody, mergedData)
    );
  }

  const finalHtml = wrapEmailHtml(bodyHtml, {
    showFooter: config.showFooter !== false,
    footerImageUrl: config.footerImageUrl || process.env.EMAIL_FOOTER_IMAGE_URL,
    footerLinkUrl: process.env.EMAIL_FOOTER_LINK_URL,
    brandName: EMAIL_BRAND_NAME,
  });

  return sesProvider.sendViaSes({
    to,
    subject: finalSubject,
    html: finalHtml,
    replyTo,
    cc,
    usage,
  });
}

module.exports = {
  deliver,
  resolveProvider,
  invalidateCache,
  deliverViaSes,
};
